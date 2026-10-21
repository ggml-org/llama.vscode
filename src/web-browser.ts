import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';
import * as dns from 'dns';
import { URL } from 'url';
import type { Application } from './application';

/**
 * Web browsing support for the agent (tool "web_browser").
 *
 * Design notes (best practices for a browsing agent tool):
 *  - Only plain text is returned to the model - HTML is reduced to readable text
 *    (scripts, styles, navigation, forms, SVG etc. are removed, headings and
 *    lists are kept as markdown, entities are decoded).
 *  - The returned text is always limited (chars and lines) so the agent does not
 *    burn its context on a single page. The agent can page through a long page
 *    with the `start_char` parameter.
 *  - Search is done with a provider fallback chain, because public search
 *    endpoints are regularly rate limited / challenge bot traffic.
 *  - Fetched pages are cached for a short time so the agent can re-read/skim a
 *    page without hitting the network again.
 *  - Only http(s) is allowed and private/loopback addresses are blocked to avoid
 *    server side request forgery (the model controls the URL).
 */

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024;   // hard limit for a single response
const MAX_REDIRECTS = 5;
const MAX_CACHED_CHARS = 200000;              // no need to cache more per page
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 24;
const MIN_USEFUL_TEXT = 200;                  // below this, a page has no real content

export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
}

export interface WebSearchResponse {
    provider: string;
    results: WebSearchResult[];
}

export interface WebPageContent {
    url: string;
    finalUrl: string;
    title: string;
    text: string;
    contentType: string;
    truncated: boolean;
}

interface RawHttpResponse {
    status: number;
    headers: http.IncomingHttpHeaders;
    buffer: Buffer;
    truncated: boolean;
    finalUrl: string;
}

interface CacheEntry {
    fetchedAt: number;
    page: WebPageContent;
}

/**
 * Pure HTML -> text helpers. Kept as static methods so they can be reused
 * (for example by the custom_tool) without an Application instance.
 */
export class HtmlText {
    private static readonly NAMED_ENTITIES: Record<string, string> = {
        nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
        ldquo: '\u201c', rdquo: '\u201d', lsquo: '\u2018', rsquo: '\u2019',
        mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', middot: '\u00b7',
        bull: '\u2022', copy: '\u00a9', reg: '\u00ae', trade: '\u2122',
        euro: '\u20ac', pound: '\u00a3', yen: '\u00a5', deg: '\u00b0',
        laquo: '\u00ab', raquo: '\u00bb', times: '\u00d7', divide: '\u00f7',
        thinsp: ' ', ensp: ' ', emsp: ' ', zwnj: '', zwj: '',
    };

    static decodeEntities = (input: string): string => {
        return input.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
            if (entity[0] === '#') {
                const isHex = entity[1] === 'x' || entity[1] === 'X';
                const codePoint = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
                if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return match;
                try {
                    return String.fromCodePoint(codePoint);
                } catch {
                    return match;
                }
            }
            const named = HtmlText.NAMED_ENTITIES[entity.toLowerCase()];
            return named !== undefined ? named : match;
        });
    }

    static collapseWhitespace = (input: string): string => {
        return input.replace(/\s+/g, ' ').trim();
    }

    /** Removes all tags and decodes entities - good for titles, snippets, one liners. */
    static stripTags = (input: string): string => {
        return HtmlText.collapseWhitespace(HtmlText.decodeEntities(input.replace(/<[^>]*>/g, ' ')));
    }

    static extractTitle = (html: string): string => {
        const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i);
        if (og && HtmlText.stripTags(og[1]).length > 0) return HtmlText.stripTags(og[1]);
        const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title\s*>/i);
        if (titleTag) return HtmlText.stripTags(titleTag[1]);
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1\s*>/i);
        if (h1) return HtmlText.stripTags(h1[1]);
        return '';
    }

    /** Removes every attribute (keeps the tag name) - values may contain ">" inside quotes. */
    private static removeAttributes = (html: string): string => {
        return html.replace(/<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g, '<$1>');
    }

    /**
     * Removes blocks which are mostly a list of links (menus, sidebars, tables of
     * contents, breadcrumbs). Such blocks are usually the first half of the text
     * extracted from documentation pages and carry no useful information for the
     * model, so removing them saves a lot of tokens.
     *
     * The scan is nesting aware (a lazy `<\/tag>` regex would cut nested markup at
     * the wrong place) and a block is removed only when it clearly looks like a
     * navigation list: many anchors, very short labels and little other text. Real
     * content lists therefore survive.
     */
    private static removeLinkListBlocks = (html: string, tags: string[], requireNavigationLook: boolean = true): string => {
        let result = html;
        for (const tag of tags) {
            const tagPattern = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
            const ranges: [number, number][] = [];
            let depth = 0;
            let start = -1;
            let match: RegExpExecArray | null;
            while ((match = tagPattern.exec(result)) !== null) {
                if (match[1] !== '/') {
                    if (depth === 0) start = match.index;
                    depth++;
                } else if (depth > 0) {
                    depth--;
                    if (depth === 0 && start >= 0) {
                        ranges.push([start, match.index + match[0].length]);
                        start = -1;
                    }
                }
            }
            // Iterate from the end so the already collected offsets stay valid
            for (let i = ranges.length - 1; i >= 0; i--) {
                const [from, to] = ranges[i];
                const block = result.slice(from, to);
                if (!requireNavigationLook || HtmlText.isNavigationBlock(block)) {
                    result = result.slice(0, from) + ' ' + result.slice(to);
                }
            }
        }
        return result;
    }

    private static isNavigationBlock = (block: string): boolean => {
        if (block.length < 400) return false;
        const anchors = (block.match(/<a\b/gi) || []).length;
        if (anchors < 8) return false;

        const fullText = HtmlText.stripTags(block);
        if (fullText.length === 0) return true;
        // Menu entries are short labels
        if (fullText.length / anchors > 80) return false;

        // Prose with a few inline links must survive
        const textWithoutLinks = HtmlText.stripTags(block.replace(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi, ' '));
        return textWithoutLinks.length <= fullText.length * 0.5;
    }

    /**
     * Removes page chrome by the class/id of the container (the approach used by
     * readability style extractors): menus, sidebars, cookie banners, share bars,
     * comment sections, "related articles" and similar.
     *
     * Matching is done per class/id token (not as a substring of the whole
     * attribute, otherwise "downloads" would match "ads") and a block is kept when
     * it holds a big share of the page text - a wrapper must never be removed.
     */
    private static removeChromeBlocks = (html: string): string => {
        const chromeTokens = new Set([
            'nav', 'navbar', 'navigation', 'menu', 'menubar', 'sidebar', 'sidenav', 'breadcrumb', 'breadcrumbs',
            'cookie', 'cookies', 'consent', 'newsletter', 'subscribe', 'subscription', 'share', 'sharing', 'social',
            'advert', 'advertisement', 'advertisements', 'ads', 'adsense', 'promo', 'promotion', 'sponsor', 'sponsored',
            'banner', 'toolbar', 'masthead', 'related', 'recommended', 'recommendations', 'comments', 'popup', 'modal',
            'drawer', 'offcanvas', 'skiplink', 'tooltip', 'pagination', 'pager', 'toc',
        ]);

        const totalTextLength = HtmlText.stripTags(html).length;
        const openingTag = /<([a-zA-Z][\w-]*)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
        const ranges: [number, number][] = [];

        let match: RegExpExecArray | null;
        while ((match = openingTag.exec(html)) !== null) {
            const rawTag = match[1].toLowerCase();
            if (rawTag === 'html' || rawTag === 'body') continue;
            const attributes = match[2];

            const classValue = HtmlText.getAttributeValue(attributes, 'class');
            const idValue = HtmlText.getAttributeValue(attributes, 'id');
            if (!HtmlText.hasChromeToken(classValue, chromeTokens) && !HtmlText.hasChromeToken(idValue, chromeTokens)) continue;

            const from = match.index;
            const to = HtmlText.findClosingTag(html, rawTag, from + match[0].length);
            if (to < 0) continue;

            // Never remove a wrapper that holds most of the page
            const blockTextLength = HtmlText.stripTags(html.slice(from, to)).length;
            if (totalTextLength > 0 && blockTextLength > totalTextLength * 0.4) continue;
            if (to - from < 40) continue;

            ranges.push([from, to]);
        }

        if (ranges.length === 0) return html;

        // Drop nested/overlapping ranges, then remove from the end so offsets stay valid
        ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
        const merged: [number, number][] = [];
        for (const range of ranges) {
            const last = merged[merged.length - 1];
            if (last && range[0] < last[1]) continue;
            merged.push(range);
        }

        let result = html;
        for (let i = merged.length - 1; i >= 0; i--) {
            const [from, to] = merged[i];
            result = result.slice(0, from) + ' ' + result.slice(to);
        }
        return result;
    }

    private static getAttributeValue = (attributes: string, name: string): string => {
        const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
        const match = attributes.match(pattern);
        if (!match) return '';
        return match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : (match[3] || '');
    }

    /** True when any of the class/id tokens (hyphen/underscore separated) is a chrome token. */
    private static hasChromeToken = (value: string, chromeTokens: Set<string>): boolean => {
        if (!value) return false;
        for (const token of value.toLowerCase().split(/\s+/)) {
            if (!token) continue;
            for (const part of token.split(/[-_]+/)) {
                if (part && chromeTokens.has(part)) return true;
            }
        }
        return false;
    }

    /** Returns the index right after the closing tag matching an already open tag. */
    private static findClosingTag = (html: string, tag: string, from: number): number => {
        const pattern = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
        pattern.lastIndex = from;
        let depth = 1;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(html)) !== null) {
            if (match[1] === '/') {
                depth--;
                if (depth === 0) return match.index + match[0].length;
            } else {
                depth++;
            }
        }
        return -1;
    }

    /**
     * Converts HTML into readable plain text / simple markdown.
     * Headings become markdown headings, list items and rows become "- " items.
     */
    static toText = (html: string): string => {
        if (!html) return '';

        let text = html.replace(/<!--[\s\S]*?-->/g, ' ');

        // Remove everything that never contains readable content
        const skip = 'script|style|noscript|template|svg|canvas|iframe|object|embed|head|nav|footer|aside|form|select|textarea|button|dialog|menu|figcaption';
        text = text.replace(new RegExp(`<(?:${skip})\\b[^>]*>[\\s\\S]*?<\\/(?:${skip})\\s*>`, 'gi'), ' ');

        // Remove page chrome (menus, sidebars, cookie banners, share bars...) by class/id
        text = HtmlText.removeChromeBlocks(text);

        // Remove navigation/sidebar/table-of-contents blocks - they are pure noise for the model.
        text = HtmlText.removeLinkListBlocks(text, ['ul', 'ol', 'div', 'nav']);

        // Drop attributes (JSON blobs in data-* attributes are the biggest noise source)
        text = HtmlText.removeAttributes(text);

        // Prefer the main content container when the page provides one
        const container = text.match(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1\s*>/i);
        if (container && container[2] && container[2].replace(/<[^>]*>/g, '').trim().length > 300) {
            text = container[2];
        }

        // Keep some structure
        text = text.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (_match, level: string, inner: string) => {
            const value = inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            return value ? `\n\n${'#'.repeat(Number(level))} ${value}\n` : '\n';
        });
        text = text.replace(/<li\b[^>]*>/gi, '\n- ').replace(/<\/li\s*>/gi, '');
        text = text.replace(/<br\s*\/?>/gi, '\n');
        text = text.replace(/<\/(p|div|ul|ol|tr|td|th|section|article|blockquote|pre|table|main|header|figure|dd|dt|dl|code)\s*>/gi, '\n\n');

        // Remaining tags
        text = text.replace(/<[^>]+>/g, ' ');

        text = HtmlText.decodeEntities(text);
        text = text.replace(/\r\n?/g, '\n')
            .replace(/[\t\f\v\u00a0\u200b\u200c\u200d]/g, ' ')
            .replace(/[ ]{2,}/g, ' ');

        // Trim each line, drop empty duplicates and excessive blank lines
        const lines = text.split('\n').map(line => line.trim());
        const cleaned: string[] = [];
        for (const line of lines) {
            if (line === '' && (cleaned.length === 0 || cleaned[cleaned.length - 1] === '')) continue;
            cleaned.push(line);
        }
        return cleaned.join('\n').trim();
    }
}

export class WebBrowser {
    private app: Application;
    private cache: Map<string, CacheEntry> = new Map();

    constructor(application: Application) {
        this.app = application;
    }

    // ------------------------- tool entry point -------------------------

    /**
     * Tool function. Accepts a JSON string (the tools framework passes the raw
     * arguments string) with:
     *   query       - search the web
     *   url         - open and read a page
     *   max_results - number of search results (1..10)
     *   start_char  - read the page content starting from this char (paging)
     */
    public browse = async (args: string): Promise<string> => {
        let params: { [key: string]: any };
        try {
            params = typeof args === 'string' ? JSON.parse(args) : (args ?? {});
        } catch {
            return 'Error: the arguments are not valid JSON. Expected {"query": "..."} or {"url": "..."}.';
        }
        if (!params || typeof params !== 'object') {
            return 'Error: the arguments are not valid JSON. Expected {"query": "..."} or {"url": "..."}.';
        }

        const query = typeof params.query === 'string' ? params.query.trim() : '';
        const url = typeof params.url === 'string' ? params.url.trim() : '';
        const maxResults = this.clampNumber(params.max_results, 1, 10, this.app.configuration.web_browser_max_results);
        const startChar = this.clampNumber(params.start_char, 0, Number.MAX_SAFE_INTEGER, 0);

        if (url) {
            return await this.readPageForAgent(url, startChar);
        }
        if (query) {
            return await this.searchForAgent(query, maxResults);
        }

        return 'Error: provide either "query" (to search the web) or "url" (to read a page).';
    }

    public browseDesc = async (args: string): Promise<string> => {
        let params: { [key: string]: any } = {};
        try {
            params = typeof args === 'string' ? JSON.parse(args) : (args ?? {});
        } catch {
            return 'Web browser tool is executed.';
        }
        const url = typeof params?.url === 'string' ? params.url.trim() : '';
        const query = typeof params?.query === 'string' ? params.query.trim() : '';
        if (url) return 'Reading web page: ' + url;
        if (query) return 'Searching the web for: ' + query;
        return 'Web browser tool is executed.';
    }

    // ------------------------- search -------------------------

    public search = async (query: string, maxResults: number): Promise<WebSearchResponse> => {
        const errors: string[] = [];
        const encodedQuery = encodeURIComponent(query);
        const providers: { name: string; url: string; referer: string; parse: (body: string, limit: number) => WebSearchResult[] }[] = [
            {
                name: 'duckduckgo',
                url: `https://lite.duckduckgo.com/lite/?q=${encodedQuery}&kl=us-en`,
                referer: 'https://lite.duckduckgo.com/',
                parse: WebBrowser.parseDuckDuckGoLite,
            },
            {
                name: 'duckduckgo',
                url: `https://html.duckduckgo.com/html/?q=${encodedQuery}&kl=us-en`,
                referer: 'https://html.duckduckgo.com/',
                parse: WebBrowser.parseDuckDuckGoHtml,
            },
            {
                name: 'bing',
                url: `https://www.bing.com/search?format=rss&count=20&q=${encodedQuery}`,
                referer: 'https://www.bing.com/',
                parse: WebBrowser.parseBingRss,
            },
        ];

        for (const provider of providers) {
            try {
                const response = await this.httpGet(provider.url, { referer: provider.referer, timeoutMs: this.timeoutMs });
                if (response.status !== 200) {
                    errors.push(`${provider.name}: HTTP ${response.status}`);
                    continue;
                }
                const body = WebBrowser.decodeBody(response);
                const results = provider.parse(body, maxResults);
                if (results.length === 0) {
                    errors.push(`${provider.name}: ${WebBrowser.isBotChallenge(body) ? 'blocked by bot protection' : 'no results'}`);
                    continue;
                }
                return { provider: provider.name, results };
            } catch (error) {
                errors.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        throw new Error('no search provider returned results (' + errors.join('; ') + ')');
    }

    private searchForAgent = async (query: string, maxResults: number): Promise<string> => {
        let response: WebSearchResponse;
        try {
            response = await this.search(query, maxResults);
        } catch (error) {
            return `Web search for "${query}" failed: ${error instanceof Error ? error.message : String(error)}
Try again later, reformulate the query, or open a known URL directly with {"url": "https://..."}.`;
        }

        const lines: string[] = [];
        lines.push(`Search results for "${query}" (${response.results.length}, source: ${response.provider}):`);
        lines.push('');
        response.results.forEach((result, index) => {
            lines.push(`${index + 1}. ${result.title || '(no title)'}`);
            lines.push(`   URL: ${result.url}`);
            if (result.snippet) lines.push(`   ${WebBrowser.truncate(result.snippet, 400)}`);
        });
        lines.push('');
        lines.push('The results above contain only titles and short snippets. To read the full content of a result, call web_browser again with {"url": "<one of the URLs above>"}.');
        return this.limitResult(lines.join('\n'));
    }

    // ------------------------- page reading -------------------------

    public fetchPageText = async (url: string): Promise<WebPageContent> => {
        const cached = this.getFromCache(url);
        if (cached) return cached;

        const absoluteUrl = this.toAbsoluteUrl(url);
        if (!absoluteUrl) {
            throw new Error(`invalid URL "${url}" - only absolute http(s) URLs are supported`);
        }
        await this.assertUrlAllowed(absoluteUrl);

        const response = await this.httpGet(absoluteUrl, { timeoutMs: this.timeoutMs });
        if (response.status < 200 || response.status >= 400) {
            if (response.status === 403 || response.status === 429) {
                throw new Error(`the server returned HTTP ${response.status} - the page blocks automated access, try another source`);
            }
            if (response.status === 404) {
                throw new Error(`the server returned HTTP 404 - the page does not exist, check the URL`);
            }
            throw new Error(`the server returned HTTP ${response.status} for ${absoluteUrl}`);
        }

        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (contentType && !WebBrowser.isTextualContentType(contentType)) {
            throw new Error(`unsupported content type "${contentType.split(';')[0]}" - only text and HTML pages can be read`);
        }

        const body = WebBrowser.decodeBody(response);
        const isHtml = contentType.includes('html') || (!contentType && /<html[\s>]/i.test(body.slice(0, 2000)));

        if (isHtml && WebBrowser.isBotChallengePage(body)) {
            throw new Error('the page is protected by bot protection (Cloudflare/captcha) and cannot be read - try another source');
        }

        const page: WebPageContent = {
            url,
            finalUrl: response.finalUrl,
            title: isHtml ? HtmlText.extractTitle(body) : '',
            text: isHtml ? HtmlText.toText(body) : body.trim(),
            contentType: contentType.split(';')[0] || (isHtml ? 'text/html' : 'text/plain'),
            truncated: response.truncated,
        };
        page.text = page.text.slice(0, MAX_CACHED_CHARS);
        if (page.text.length < MIN_USEFUL_TEXT && WebBrowser.isBotChallengePage(body)) {
            throw new Error('the page is protected by bot protection (Cloudflare/captcha) and cannot be read - try another source');
        }

        this.putInCache(url, page);
        return page;
    }

    private readPageForAgent = async (url: string, startChar: number): Promise<string> => {
        let page: WebPageContent;
        try {
            page = await this.fetchPageText(url);
        } catch (error) {
            return `Could not read ${url}: ${error instanceof Error ? error.message : String(error)}`;
        }

        const text = page.text;
        if (text.trim().length === 0) {
            return `The page ${page.finalUrl} is reachable but no readable text could be extracted from it (it is probably rendered by javascript only). Use a search query instead and read a different source.`;
        }
        if (text.trim().length < MIN_USEFUL_TEXT) {
            return `The page ${page.finalUrl} returned only a little text (${text.trim().length} chars), it is probably rendered by javascript or requires a login. Content: ${WebBrowser.truncate(text.trim(), 500)}\n\nUse a search query instead and read a different source.`;
        }

        const maxChars = this.maxChars;
        // Reserve room for the header/footer so the content itself gets the full budget
        const headerReserve = 700;
        const contentChars = Math.max(maxChars - headerReserve, Math.floor(maxChars * 0.5));
        const from = Math.min(startChar, Math.max(text.length - 1, 0));
        const slice = WebBrowser.sliceAtWordBoundary(text, from, contentChars);
        const remaining = text.length - (from + slice.length);

        const lines: string[] = [];
        lines.push(`Page: ${page.title || '(no title)'}`);
        lines.push(`URL: ${page.finalUrl}`);
        if (page.finalUrl.replace(/\/+$/, '') !== WebBrowser.normalizeForCompare(page.url)) {
            lines.push(`(requested URL: ${page.url})`);
        }
        lines.push(`Content type: ${page.contentType}; text length: ${text.length} chars; showing chars ${from}-${from + slice.length}.`);
        if (page.truncated) lines.push('Note: the downloaded page was truncated because it is very large.');
        lines.push('');
        lines.push(slice);
        if (remaining > 0) {
            lines.push('');
            lines.push(`[Truncated: ${remaining} chars remain. To continue reading, call web_browser with {"url": "${page.finalUrl}", "start_char": ${from + slice.length}}]`);
        }
        return this.limitResult(lines.join('\n'));
    }

    // ------------------------- providers parsers -------------------------

    private static parseDuckDuckGoLite = (html: string, limit: number): WebSearchResult[] => {
        const results: WebSearchResult[] = [];
        const blocks = html.split(/<a\s+[^>]*class=['"]result-link['"]/i).slice(1);
        for (const block of blocks) {
            const href = block.match(/href=['"]([^'"]+)['"]/i);
            const title = block.match(/>([\s\S]*?)<\/a>/i);
            if (!href || !title) continue;
            const url = WebBrowser.normalizeResultUrl(HtmlText.decodeEntities(href[1]));
            const cleanTitle = HtmlText.stripTags(title[1]);
            if (!url || !cleanTitle) continue;
            const snippet = block.match(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i);
            results.push({
                title: cleanTitle,
                url,
                snippet: snippet ? HtmlText.stripTags(snippet[1]) : '',
            });
            if (results.length >= limit) break;
        }
        return results;
    }

    private static parseDuckDuckGoHtml = (html: string, limit: number): WebSearchResult[] => {
        const results: WebSearchResult[] = [];
        const blocks = html.split(/<div class="result results_links[^"]*">/).slice(1);
        for (const block of blocks) {
            const anchor = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
            if (!anchor) continue;
            const url = WebBrowser.normalizeResultUrl(HtmlText.decodeEntities(anchor[1]));
            const cleanTitle = HtmlText.stripTags(anchor[2]);
            if (!url || !cleanTitle) continue;
            const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
            results.push({
                title: cleanTitle,
                url,
                snippet: snippet ? HtmlText.stripTags(snippet[1]) : '',
            });
            if (results.length >= limit) break;
        }
        return results;
    }

    private static parseBingRss = (xml: string, limit: number): WebSearchResult[] => {
        const results: WebSearchResult[] = [];
        for (const item of xml.split(/<item>/i).slice(1)) {
            const title = item.match(/<title>([\s\S]*?)<\/title>/i);
            const link = item.match(/<link>([\s\S]*?)<\/link>/i);
            if (!title || !link) continue;
            const url = WebBrowser.normalizeResultUrl(HtmlText.decodeEntities(link[1].trim()));
            const cleanTitle = HtmlText.stripTags(title[1]);
            if (!url || !cleanTitle) continue;
            const description = item.match(/<description>([\s\S]*?)<\/description>/i);
            results.push({
                title: cleanTitle,
                url,
                snippet: description ? HtmlText.stripTags(description[1]) : '',
            });
            if (results.length >= limit) break;
        }
        return results;
    }

    private static normalizeResultUrl = (url: string): string => {
        let result = (url || '').trim();
        if (result.startsWith('//')) result = 'https:' + result;
        // DuckDuckGo wraps results in a redirect: /l/?uddg=<encoded url>
        const ddgRedirect = result.match(/[?&]uddg=([^&]+)/);
        if (ddgRedirect) {
            try {
                result = decodeURIComponent(ddgRedirect[1]);
            } catch {
                // keep the original value
            }
        }
        return /^https?:\/\//i.test(result) ? result : '';
    }

    private static isBotChallenge = (body: string): boolean => {
        return /bots use DuckDuckGo|anomaly-modal|unusual traffic|verify you are human|are you a robot|captcha/i.test(body.slice(0, 40000));
    }

    /** Detects interstitials served instead of the real page content (Cloudflare, captchas...). */
    private static isBotChallengePage = (body: string): boolean => {
        const head = body.slice(0, 6000);
        if (/<title[^>]*>\s*(just a moment|attention required|access denied|are you a robot)/i.test(head)) return true;
        if (/cf-browser-verification|cf_chl_|cf-challenge|g-recaptcha|h-captcha|hcaptcha\.com/i.test(head)) return true;
        return /checking your browser before accessing|enable javascript and cookies to continue|verify you are (a )?human/i.test(head);
    }

    // ------------------------- http -------------------------

    private get timeoutMs(): number {
        return this.clampNumber(this.app.configuration.web_browser_timeout_s, 5, 120, 20) * 1000;
    }

    private get maxChars(): number {
        // Never exceed the global tool result limit - it is there to protect the context
        const configured = this.clampNumber(this.app.configuration.web_browser_max_chars, 1000, this.app.configuration.MAX_CHARS_TOOL_RETURN, 6000);
        return Math.min(configured, this.app.configuration.MAX_CHARS_TOOL_RETURN);
    }

    private limitResult = (result: string): string => {
        return result.length > this.app.configuration.MAX_CHARS_TOOL_RETURN
            ? result.slice(0, this.app.configuration.MAX_CHARS_TOOL_RETURN) + '\n[Result truncated to fit the tool output limit.]'
            : result;
    }

    private static truncate = (text: string, maxChars: number): string => {
        return text.length > maxChars ? text.slice(0, maxChars - 3) + '...' : text;
    }

    /**
     * Slices the text without cutting the last word in half, so the agent does not
     * see broken words at the end of a chunk.
     */
    private static sliceAtWordBoundary = (text: string, from: number, maxChars: number): string => {
        const end = Math.min(from + maxChars, text.length);
        let slice = text.slice(from, end);
        if (end < text.length) {
            // Back off to the last newline or space, but only a little so we do not lose much
            const lastNewline = slice.lastIndexOf('\n');
            const lastSpace = slice.lastIndexOf(' ');
            const cut = Math.max(lastNewline, lastSpace);
            if (cut > slice.length - 200 && cut > slice.length * 0.8) slice = slice.slice(0, cut);
        }
        return slice;
    }

    private static isTextualContentType = (contentType: string): boolean => {
        return /^(text\/|application\/(json|xml|xhtml\+xml|javascript|ecmascript|ld\+json|rss\+xml|atom\+xml|yaml|x-yaml))/.test(contentType);
    }

    private clampNumber = (value: any, min: number, max: number, fallback: number): number => {
        const parsed = typeof value === 'number' ? value : Number(value);
        if (value === undefined || value === null || value === '' || !Number.isFinite(parsed)) return fallback;
        return Math.min(Math.max(Math.trunc(parsed), min), max);
    }

    private static decodeBody = (response: RawHttpResponse): string => {
        const buffer = WebBrowser.decompress(response.buffer, String(response.headers['content-encoding'] || ''));
        const contentType = String(response.headers['content-type'] || '');
        const charsetMatch = contentType.match(/charset=["']?([-\w]+)/i);
        const charset = charsetMatch ? charsetMatch[1].toLowerCase() : 'utf-8';
        try {
            return new TextDecoder(charset).decode(buffer);
        } catch {
            return buffer.toString('utf-8');
        }
    }

    private static decompress = (buffer: Buffer, encoding: string): Buffer => {
        const normalized = encoding.toLowerCase();
        if (!buffer.length || !normalized) return buffer;
        try {
            if (normalized.includes('br')) return zlib.brotliDecompressSync(buffer);
            if (normalized.includes('gzip')) return zlib.gunzipSync(buffer);
            if (normalized.includes('deflate')) {
                try {
                    return zlib.inflateSync(buffer);
                } catch {
                    return zlib.inflateRawSync(buffer);
                }
            }
        } catch {
            // Some servers send a wrong content-encoding - fall back to the raw bytes
        }
        return buffer;
    }

    private httpGet = (url: string, options: { referer?: string; timeoutMs: number; redirects?: number }): Promise<RawHttpResponse> => {
        const redirects = options.redirects === undefined ? MAX_REDIRECTS : options.redirects;

        return new Promise<RawHttpResponse>((resolve, reject) => {
            let parsed: URL;
            try {
                parsed = new URL(url);
            } catch {
                reject(new Error(`invalid URL "${url}"`));
                return;
            }
            const transport = parsed.protocol === 'https:' ? https : parsed.protocol === 'http:' ? http : undefined;
            if (!transport) {
                reject(new Error(`unsupported protocol "${parsed.protocol}"`));
                return;
            }

            const headers: { [key: string]: string } = {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
            };
            if (options.referer) headers['Referer'] = options.referer;

            const request = transport.request(parsed, { method: 'GET', headers, timeout: options.timeoutMs }, (response) => {
                const status = response.statusCode || 0;
                const location = response.headers.location;

                if ([301, 302, 303, 307, 308].includes(status) && location && redirects > 0) {
                    response.resume();
                    let nextUrl: string;
                    try {
                        nextUrl = new URL(location, parsed).toString();
                    } catch {
                        reject(new Error(`invalid redirect location "${location}"`));
                        return;
                    }
                    resolve(this.httpGet(nextUrl, { ...options, redirects: redirects - 1 }));
                    return;
                }

                const chunks: Buffer[] = [];
                let total = 0;
                let truncated = false;

                response.on('data', (chunk: Buffer) => {
                    total += chunk.length;
                    if (total > MAX_DOWNLOAD_BYTES) {
                        truncated = true;
                        response.destroy();
                        return;
                    }
                    chunks.push(chunk);
                });
                const finish = () => resolve({
                    status,
                    headers: response.headers,
                    buffer: Buffer.concat(chunks),
                    truncated,
                    finalUrl: parsed.toString(),
                });
                response.on('end', finish);
                response.on('error', finish);
            });

            request.on('error', (error) => reject(new Error(error.message)));
            request.on('timeout', () => request.destroy(new Error(`request timed out after ${Math.round(options.timeoutMs / 1000)}s`)));
            request.end();
        });
    }

    // ------------------------- url / ssrf guards -------------------------

    private toAbsoluteUrl = (input: string): string | undefined => {
        let value = (input || '').trim();
        if (!value) return undefined;
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
            value = 'https://' + value.replace(/^\/+/, '');
        }
        try {
            const parsed = new URL(value);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
            if (!parsed.hostname) return undefined;
            return parsed.toString();
        } catch {
            return undefined;
        }
    }

    private static normalizeForCompare = (url: string): string => {
        return (url || '').replace(/\/+$/, '');
    }

    private assertUrlAllowed = async (url: string): Promise<void> => {
        if (this.app.configuration.web_browser_allow_local_urls) return;

        const hostname = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
        if (WebBrowser.isPrivateHostname(hostname)) {
            throw new Error(`access to the local/private address "${hostname}" is blocked (setting web_browser_allow_local_urls enables it)`);
        }
        if (WebBrowser.isIpLiteral(hostname)) return;

        // Resolve the name and check the address - blocks DNS names pointing to private ranges
        const addresses = await WebBrowser.resolveHost(hostname);
        for (const address of addresses) {
            if (WebBrowser.isPrivateHostname(address)) {
                throw new Error(`access to the local/private address "${hostname}" (${address}) is blocked (setting web_browser_allow_local_urls enables it)`);
            }
        }
    }

    private static resolveHost = async (hostname: string): Promise<string[]> => {
        try {
            const records = await dns.promises.lookup(hostname, { all: true });
            return records.map(record => record.address);
        } catch {
            // If the name cannot be resolved, let the http request fail with its own error
            return [];
        }
    }

    private static isIpLiteral = (hostname: string): boolean => {
        return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
    }

    private static isPrivateHostname = (hostname: string): boolean => {
        const host = hostname.toLowerCase();
        if (!host) return true;
        if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;

        const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipv4) {
            const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
            if (a === 0 || a === 10 || a === 127) return true;
            if (a === 169 && b === 254) return true;
            if (a === 172 && b >= 16 && b <= 31) return true;
            if (a === 192 && b === 168) return true;
            if (a === 100 && b >= 64 && b <= 127) return true;
            if (a === 192 && b === 0) return true;
            if (a === 198 && (b === 18 || b === 19)) return true;
            return false;
        }

        if (host.includes(':')) {
            if (host === '::1' || host === '::') return true;
            const mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
            if (mapped) return WebBrowser.isPrivateHostname(mapped[1]);
            if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;   // unique local
            if (/^fe[89ab][0-9a-f]:/.test(host)) return true;   // link local
            return false;
        }

        return false;
    }

    // ------------------------- cache -------------------------

    private getFromCache = (url: string): WebPageContent | undefined => {
        const key = WebBrowser.normalizeForCompare(this.toAbsoluteUrl(url) || url);
        const entry = this.cache.get(key);
        if (!entry) return undefined;
        if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.page;
    }

    private putInCache = (url: string, page: WebPageContent) => {
        const key = WebBrowser.normalizeForCompare(this.toAbsoluteUrl(url) || url);
        if (this.cache.has(key)) this.cache.delete(key);
        this.cache.set(key, { fetchedAt: Date.now(), page });
        while (this.cache.size > CACHE_MAX_ENTRIES) {
            const oldest = this.cache.keys().next().value;
            if (oldest === undefined) break;
            this.cache.delete(oldest);
        }
    }

    public clearCache = () => {
        this.cache.clear();
    }

    public static readonly MIN_USEFUL_TEXT = MIN_USEFUL_TEXT;
}
