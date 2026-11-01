import * as vscode from 'vscode';
import { Utils } from '../utils';
import {
    buildDirtyDocumentMap,
    createWorkspaceTextSearchHost,
    DEFAULT_MAX_FILE_BYTES,
    DEFAULT_MAX_OUTPUT_CHARS,
    DEFAULT_SCAN_CONCURRENCY,
    MAX_CANDIDATE_FILES,
    normalizeWorkspaceTextSearchInclude,
    readWorkspaceFileText,
    WorkspaceTextSearchHost
} from './workspace-text-search';
import {
    createWorkspaceFileExclude,
    WorkspaceIgnoreFileCache
} from './workspace-file-catalog';

// RAG-free semantic-ish search over the workspace files for the agent tool
// `search_source`.
//
// Why it exists: the tool used to answer from the RAG chunk index only, and that
// index exists only when `rag_enabled` is true and `rag_max_files > 0`. With RAG
// disabled the tool even triggered a whole-workspace indexing run as a side
// effect of a *search* (with a notification, minutes of work), and with
// `rag_max_files = 0` it returned an empty answer forever. This service scans
// the workspace files on demand instead: no index, no indexing progress, no
// embeddings, nothing persisted.
//
// Why deterministic keywords: a model request for keyword extraction would add a
// second round trip per search, fail when only a tools model is configured, and
// make the result non-deterministic (and untestable). The tokenizer is a verbatim
// copy of ChatContext.tokenize so query and document tokenization cannot drift
// apart, and ranking is plain BM25 (Utils.computeBM25Stats / bm25Score) plus a
// bonus for an exact phrase match.
//
// Why the caps: an unbounded scan of a monorepo inside a single tool call is not
// acceptable - it would freeze the agent for minutes. Reading stops at
// maxFiles / maxChunkedChars / timeBudgetMs / a hard chunk cap, and the answer
// says so. Ranking is computed over at most MAX_SOURCE_CHUNK_HARD_CAP chunks.
//
// No Application dependency, no model calls, no VS Code globals outside the host:
// the whole service is unit-testable without an extension host beyond vscode.Uri.

// ---- limits -------------------------------------------------------------

// Fragments returned to the model.
export const DEFAULT_SOURCE_MAX_CHUNKS = 3;
// Files actually read per call.
export const DEFAULT_SOURCE_MAX_FILES = 2000;
// Stop reading after ~4 MiB of decoded text (tokenizer cost scales with chars).
export const DEFAULT_SOURCE_MAX_CHUNKED_CHARS = 4 * 1024 * 1024;
export const DEFAULT_SOURCE_TIME_BUDGET_MS = 10_000;
// Mirrors rag_max_lines_per_chunk.
export const DEFAULT_SOURCE_LINES_PER_CHUNK = 40;
// One fragment must never eat the whole answer.
export const DEFAULT_SOURCE_MAX_CHUNK_CHARS = 1500;
// One file must not fill the answer.
export const DEFAULT_SOURCE_MAX_CHUNKS_PER_FILE = 2;
export const MAX_SOURCE_KEYWORDS = 12;
// Clips absurdly long lines in the OUTPUT only (memory guard, not a relevance
// decision - see the tokenizer note in the chunking loop).
export const MAX_SOURCE_CHUNK_LINE_CHARS = 1000;
// Exact phrase (whole query) match bonus.
export const SOURCE_PHRASE_BONUS = 1.5;
// Hard stop on the number of in-memory chunks: BM25 builds a term -> doc index
// over all of them, so this is the real memory guard, not maxChunks.
export const MAX_SOURCE_CHUNK_HARD_CAP = 4000;
// Chars held back for the trailing notes when applying the output cap.
const OUTPUT_CAP_RESERVE = 400;
// A query echoed back in the "nothing found" message is clipped to this.
const MAX_ECHOED_QUERY_CHARS = 200;

// ---- result types -------------------------------------------------------

export interface SourceSearchChunk {
    // host.asRelativePath(uri)
    relativePath: string;
    // 1-based, inclusive.
    firstLine: number;
    // 1-based, inclusive.
    lastLine: number;
    // The chunk lines, clipped to MAX_SOURCE_CHUNK_LINE_CHARS per line.
    content: string;
    score: number;
}

export interface SourceSearchResult {
    // Model-ready, never ''.
    text: string;
    // The chunks that made it into `text`.
    chunks: SourceSearchChunk[];
    // For tests/diagnostics.
    keywords: string[];
    // Files whose text was read.
    scannedFiles: number;
    // Files left after exclude + gitignore filtering.
    candidateFiles: number;
    limitReached: 'files' | 'chars' | 'time' | 'chunks' | undefined;
    noChunks: boolean;
    // The query had no usable keywords at all.
    noKeywords: boolean;
}

export interface SourceSearchOptions {
    maxChunks?: number;
    maxFiles?: number;
    maxChunkedChars?: number;
    timeBudgetMs?: number;
    linesPerChunk?: number;
    maxChunkChars?: number;
    maxChunksPerFile?: number;
}

// Internal chunk representation: `tokens` never leaves this module.
interface ScoredSourceChunk {
    relativePath: string;
    firstLine: number;
    lastLine: number;
    content: string;
    tokens: string[];
}

// ---- keyword extraction (pure, exported for tests) ----------------------

// Verbatim copy of ChatContext.tokenize so query and document tokenization
// cannot drift apart. Do NOT "improve" it here: the ranking assumes the same
// splitter on both sides.
export const tokenizeSourceText = (text: string): string[] =>
    text.split(/([A-Z]?[a-z]+)|[_\-\.\s]+/).filter(Boolean).map(word => word.toLowerCase());

const SOURCE_STOPWORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
    'and', 'or', 'not', 'no', 'but', 'if', 'then', 'than', 'so', 'as', 'of', 'to', 'in', 'on', 'at', 'for',
    'with', 'without', 'from', 'by', 'into', 'over', 'under', 'about', 'this', 'that', 'these', 'those',
    'it', 'its', 'i', 'you', 'we', 'they', 'me', 'my', 'your', 'our', 'them', 'their',
    'do', 'does', 'did', 'done', 'how', 'what', 'where', 'when', 'why', 'which', 'who', 'whom',
    'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must', 'have', 'has', 'had',
    'please', 'there', 'here', 'all', 'any', 'some', 'more', 'most', 'very', 'also', 'just', 'only'
]);

// Code words ('get', 'file', 'class', 'function') are deliberately NOT
// stopwords: BM25's idf already discounts them, and removing them loses real
// signal (getRagContextChunks -> get rag context chunks).
export const extractSourceQueryKeywords = (
    query: string,
    maxKeywords: number = MAX_SOURCE_KEYWORDS
): string[] => {
    const trimmed = query.trim();
    if (trimmed === '') return [];
    const seen = new Set<string>();
    const keywords: string[] = [];
    for (const term of tokenizeSourceText(trimmed)) {
        // Single chars are noise ('a', '1').
        if (term.length < 2) continue;
        if (SOURCE_STOPWORDS.has(term)) continue;
        if (seen.has(term)) continue;
        seen.add(term);
        keywords.push(term);
        if (keywords.length >= maxKeywords) break;
    }
    // A query with only stopwords (or non-latin script, which the tokenizer
    // emits as one opaque token) still has to search for something.
    if (keywords.length === 0) keywords.push(trimmed.toLowerCase());
    return keywords;
};

// True when the query has no usable keyword at all (only stopwords, only single
// characters or a non-latin phrase), i.e. the raw-query fallback had to be used.
export const hasNoSourceKeywords = (query: string): boolean =>
    tokenizeSourceText(query.trim())
        .filter(term => term.length >= 2 && !SOURCE_STOPWORDS.has(term))
        .length === 0;

const pathDepth = (relativePath: string): number =>
    relativePath.replace(/\\/g, '/').split('/').length - 1;

// ---- the service --------------------------------------------------------

export class WorkspaceSourceSearch {
    // Same argument order rule as WorkspaceTextSearch: a required parameter must
    // not follow a defaulted one, so the ignore cache comes first.
    constructor(
        private readonly ignoreFiles: WorkspaceIgnoreFileCache,
        private readonly host: WorkspaceTextSearchHost = createWorkspaceTextSearchHost(),
        private readonly options: SourceSearchOptions = {}
    ) {}

    async search(
        query: string,
        token?: vscode.CancellationToken,
        // The agent Stop button is an AbortController, not a CancellationToken
        // (AgentSession.abortController), so a plain predicate is accepted too.
        isCancelled?: () => boolean,
        // Per-call override; Tools passes configuration.MAX_CHARS_TOOL_RETURN.
        maxOutputChars?: number
    ): Promise<SourceSearchResult> {
        // Never throw: the agent loop turns a throw into a 400-char slice of the
        // stack trace handed to the model.
        try {
            return await this.searchInternal(query, token, isCancelled, maxOutputChars);
        } catch (err) {
            return this.result('Source search failed: ' + String((err as Error)?.message ?? err), {
                noChunks: true
            });
        }
    }

    private async searchInternal(
        query: string,
        token: vscode.CancellationToken | undefined,
        isCancelled: (() => boolean) | undefined,
        maxOutputChars: number | undefined
    ): Promise<SourceSearchResult> {
        const maxChunks = this.options.maxChunks ?? DEFAULT_SOURCE_MAX_CHUNKS;
        const maxFiles = this.options.maxFiles ?? DEFAULT_SOURCE_MAX_FILES;
        const maxChunkedChars = this.options.maxChunkedChars ?? DEFAULT_SOURCE_MAX_CHUNKED_CHARS;
        const timeBudgetMs = this.options.timeBudgetMs ?? DEFAULT_SOURCE_TIME_BUDGET_MS;
        const linesPerChunk = Math.max(1, this.options.linesPerChunk ?? DEFAULT_SOURCE_LINES_PER_CHUNK);
        const maxChunkChars = this.options.maxChunkChars ?? DEFAULT_SOURCE_MAX_CHUNK_CHARS;
        const maxChunksPerFile = Math.max(1, this.options.maxChunksPerFile ?? DEFAULT_SOURCE_MAX_CHUNKS_PER_FILE);

        const roots = (this.host.workspaceFolders ?? []).map(folder => folder.uri.fsPath);
        if (roots.length === 0) {
            // Do not call findFiles: there is nothing to search.
            return this.result('No workspace folder is open.', { noChunks: true });
        }

        const keywords = extractSourceQueryKeywords(query);
        const context = { keywords, noKeywords: keywords.length === 0 || hasNoSourceKeywords(query) };

        // ---- candidate discovery (identical globs to regex_search) --------
        const includeGlob = normalizeWorkspaceTextSearchInclude(undefined);
        const baseExclude = createWorkspaceFileExclude(
            this.host.getConfiguration('files').get<Record<string, unknown>>('exclude', {}),
            this.host.getConfiguration('search').get<Record<string, unknown>>('exclude', {}));

        let uris: vscode.Uri[];
        try {
            uris = await this.host.findFiles(includeGlob, baseExclude, MAX_CANDIDATE_FILES, token);
        } catch (err) {
            return this.result('Source search failed: ' + (err as Error).message, {
                noChunks: true,
                ...context
            });
        }

        // findFiles does not apply .gitignore, so the shared ignore cache does.
        const rules = await this.ignoreFiles.getRules(roots, token);
        const files = uris.filter(uri => !rules.ignores(uri.fsPath));
        const candidateFiles = files.length;

        if (candidateFiles === 0) {
            return this.result(this.nothingFoundText(query), {
                noChunks: true,
                candidateFiles,
                ...context
            });
        }

        // ---- cheap ordering by path, before reading anything --------------
        // asRelativePath is an RPC-ish call and the comparator runs O(n log n)
        // times, so it is resolved once per file and reused below.
        const relPaths = new Map<vscode.Uri, string>();
        for (const uri of files) relPaths.set(uri, this.host.asRelativePath(uri));

        const lowerKeywords = keywords.map(keyword => keyword.toLowerCase());
        const scorePath = (relativePath: string): number => {
            const haystack = relativePath.replace(/\\/g, '/').toLowerCase();
            let hits = 0;
            for (const keyword of lowerKeywords) if (haystack.includes(keyword)) hits++;
            return hits;
        };
        const pathHits = new Map<vscode.Uri, number>();
        for (const uri of files) pathHits.set(uri, scorePath(relPaths.get(uri) ?? ''));

        files.sort((a, b) => {
            const pathA = relPaths.get(a) ?? '';
            const pathB = relPaths.get(b) ?? '';
            // Most path keywords first.
            const byHits = (pathHits.get(b) ?? 0) - (pathHits.get(a) ?? 0);
            if (byHits !== 0) return byHits;
            // Shallower files first.
            const byDepth = pathDepth(pathA) - pathDepth(pathB);
            if (byDepth !== 0) return byDepth;
            // Deterministic tie-break (the unit tests rely on it).
            return pathA.localeCompare(pathB);
        });

        if (token?.isCancellationRequested || isCancelled?.()) {
            return this.result(this.nothingFoundText(query), {
                noChunks: true,
                candidateFiles,
                ...context
            });
        }

        // ---- read + chunk (8 workers, hard caps) -------------------------
        const dirtyDocuments = buildDirtyDocumentMap(this.host);
        const chunks: ScoredSourceChunk[] = [];
        const startedAt = Date.now();
        let cursor = 0;
        let stop = false;
        let readChars = 0;
        let scanned = 0;
        // Scan slots are claimed synchronously, right after the index is taken and
        // before the only await. Otherwise several workers would pass the
        // `scanned >= maxFiles` test in the same tick and the cap would be
        // overshot; claiming makes 'files' exact (a slot spent on a file that is
        // then skipped is still spent, because reading it was the cost).
        let claimedSlots = 0;
        let limitReached: SourceSearchResult['limitReached'];

        const worker = async (): Promise<void> => {
            while (!stop) {
                const index = cursor++;
                if (index >= files.length) return;
                if (token?.isCancellationRequested || isCancelled?.()) {
                    stop = true;
                    return;
                }
                // '>=' so a budget of 0 stops deterministically (unit tests).
                if (Date.now() - startedAt >= timeBudgetMs) {
                    limitReached ??= 'time';
                    stop = true;
                    return;
                }
                if (claimedSlots++ >= maxFiles) {
                    limitReached ??= 'files';
                    stop = true;
                    return;
                }
                if (readChars >= maxChunkedChars) {
                    limitReached ??= 'chars';
                    stop = true;
                    return;
                }

                const uri = files[index];
                const text = await readWorkspaceFileText(this.host, uri, {
                    maxFileBytes: DEFAULT_MAX_FILE_BYTES,
                    dirtyDocuments
                });
                // Unreadable / empty / binary / oversized: skip, never abort.
                if (text === undefined) continue;
                scanned++;
                readChars += text.length;

                const relativePath = relPaths.get(uri) ?? this.host.asRelativePath(uri);
                const lines = text.split(/\r?\n/);

                // Non-overlapping line windows of `linesPerChunk` lines, like
                // ChatContext.addDocument. A window that is too long is shrunk to
                // the lines that fit (at least one) and the scan continues at the
                // first line that did not fit, so no content is skipped.
                let windowStart = 0;
                while (windowStart < lines.length) {
                    const windowEnd = Math.min(lines.length, windowStart + linesPerChunk);
                    // 1-based inclusive range covered by this chunk.
                    const firstLine = windowStart + 1;
                    let endLine = windowEnd;
                    let content = this.joinLines(lines, windowStart, endLine);
                    if (content.length > maxChunkChars) {
                        // One line always fits: MAX_SOURCE_CHUNK_LINE_CHARS (1000)
                        // is below DEFAULT_SOURCE_MAX_CHUNK_CHARS (1500).
                        endLine = windowStart + 1;
                        content = this.joinLines(lines, windowStart, endLine);
                        while (endLine < windowEnd) {
                            // The joining '\n' counts toward the budget.
                            const candidate = this.joinLines(lines, windowStart, endLine + 1);
                            if (candidate.length > maxChunkChars) break;
                            endLine++;
                            content = candidate;
                        }
                    }
                    // Advance past this chunk before any early exit, so the loop
                    // can never spin on the same window.
                    windowStart = endLine;
                    const tokens = tokenizeSourceText(content);
                    if (tokens.length === 0) continue;
                    chunks.push({ relativePath, firstLine, lastLine: endLine, content, tokens });
                    if (chunks.length >= MAX_SOURCE_CHUNK_HARD_CAP) {
                        limitReached ??= 'chunks';
                        stop = true;
                        return;
                    }
                }
            }
        };

        await Promise.all(Array.from({ length: Math.max(1, DEFAULT_SCAN_CONCURRENCY) }, worker));

        const counters = { candidateFiles, scannedFiles: scanned, limitReached, ...context };

        // ---- ranking (BM25 + phrase bonus) -------------------------------
        // GOTCHA: Utils.computeBM25Stats divides by totalDocs and bm25Score
        // divides by stats.avgDocLength, so an empty chunk list would be 0/0 =
        // NaN. The guard is mandatory.
        const nonEmpty = chunks.filter(chunk => chunk.tokens.length > 0);
        if (nonEmpty.length === 0) {
            return this.result(this.nothingFoundText(query) + this.limitNote(limitReached, scanned, timeBudgetMs),
                { noChunks: true, ...counters });
        }

        const stats = Utils.computeBM25Stats(nonEmpty.map(chunk => chunk.tokens));
        const queryTerms = Array.from(new Set(keywords));
        const phrase = query.trim().toLowerCase();

        const scored = nonEmpty
            .map((chunk, index) => ({
                chunk,
                score: Utils.bm25Score(queryTerms, index, stats) +
                    (phrase.length > 0 && chunk.content.toLowerCase().includes(phrase) ? SOURCE_PHRASE_BONUS : 0)
            }))
            // Threshold 0, strictly greater (like search_tools).
            .filter(scoredChunk => scoredChunk.score > 0)
            // Three keys: worker interleaving makes the push order
            // non-deterministic, so the score alone is not a total order.
            .sort((a, b) => b.score - a.score
                || a.chunk.relativePath.localeCompare(b.chunk.relativePath)
                || a.chunk.firstLine - b.chunk.firstLine);

        if (scored.length === 0) {
            return this.result(this.nothingFoundText(query) + this.limitNote(limitReached, scanned, timeBudgetMs),
                { noChunks: true, ...counters });
        }

        const selected: SourceSearchChunk[] = [];
        const perFile = new Map<string, number>();
        for (const { chunk, score } of scored) {
            const used = perFile.get(chunk.relativePath) ?? 0;
            if (used >= maxChunksPerFile) continue;
            perFile.set(chunk.relativePath, used + 1);
            selected.push({
                relativePath: chunk.relativePath,
                firstLine: chunk.firstLine,
                lastLine: chunk.lastLine,
                content: chunk.content,
                score
            });
            if (selected.length >= maxChunks) break;
        }

        // ---- assemble the text -------------------------------------------
        const cap = maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
        const budget = cap - OUTPUT_CAP_RESERVE;
        let text = 'Here are pieces of code from different files of the project: \n';
        const included: SourceSearchChunk[] = [];
        let truncated = false;
        for (const chunk of selected) {
            // The leading "\n" before File Name is part of today's format.
            const fragment = '\nFile Name: ' + chunk.relativePath +
                '\nFrom line: ' + chunk.firstLine +
                '\nTo line: ' + chunk.lastLine +
                '\nContent:\n' + chunk.content + '\n\n';
            if (text.length + fragment.length <= budget) {
                text += fragment;
                included.push(chunk);
                continue;
            }
            truncated = true;
            break;
        }
        if (truncated) {
            text += '\n[Result truncated to fit the tool output limit. ' +
                'Use read_file with the given line numbers to read more.]';
        }
        text += this.limitNote(limitReached, scanned, timeBudgetMs);
        // The transport adds the newlines; the text itself must not end with one
        // (the format mirrors the RAG path byte for byte otherwise).
        text = text.replace(/\s+$/, '');

        return this.result(text, { chunks: included, ...counters });
    }

    // One trailing note describing why the scan stopped early, or ''.
    private limitNote(
        limitReached: SourceSearchResult['limitReached'],
        scannedFiles: number,
        timeBudgetMs: number
    ): string {
        if (limitReached === 'time') {
            return '\n[Search stopped after ' + Math.round(timeBudgetMs / 1000) + 's - results may be incomplete. ' +
                'Use regex_search for an exact match.]';
        }
        if (limitReached !== undefined) {
            return '\n[Only the first ' + scannedFiles + ' files were scanned - results may be incomplete. ' +
                'Use regex_search for an exact match.]';
        }
        return '';
    }

    // Lines [start, end) joined with '\n', each clipped for the output only.
    private joinLines(lines: string[], start: number, end: number): string {
        const parts: string[] = [];
        for (let index = start; index < end; index++) {
            const line = lines[index] ?? '';
            parts.push(line.length > MAX_SOURCE_CHUNK_LINE_CHARS
                ? line.slice(0, MAX_SOURCE_CHUNK_LINE_CHARS) + '…'
                : line);
        }
        return parts.join('\n');
    }

    private nothingFoundText(query: string): string {
        const echoed = query.trim().slice(0, MAX_ECHOED_QUERY_CHARS);
        return "No relevant source code found for the query '" + echoed +
            "'. Try regex_search with an exact function name or expression.";
    }

    private result(text: string, overrides: Partial<SourceSearchResult>): SourceSearchResult {
        return {
            text,
            chunks: [],
            keywords: [],
            scannedFiles: 0,
            candidateFiles: 0,
            limitReached: undefined,
            noChunks: false,
            noKeywords: false,
            ...overrides
        };
    }
}
