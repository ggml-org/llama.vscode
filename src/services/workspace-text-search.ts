import * as vscode from 'vscode';
import {
    createWorkspaceFileExclude,
    WorkspaceIgnoreFileCache
} from './workspace-file-catalog';

// Full-text regex search over the workspace files for the agent tool
// `regex_search`.
//
// Why it exists: the tool used to search the RAG chunk index, which only exists
// when `rag_enabled` is true, so with RAG off it always answered "No matches
// found" (and on a cold cache it silently triggered a whole-workspace indexing
// run). Reported line numbers were also shifted by the 5 header lines the index
// stores in front of every chunk, and long lines were truncated before matching.
// Searching the files themselves fixes all of that at once.
//
// Which API: stable, published VS Code APIs only.
//  * `vscode.workspace.findTextInFiles` is still a proposed API (microsoft/vscode
//    #191224 / #226671) and proposed APIs cannot ship in a Marketplace
//    extension.
//  * ripgrep is not a dependency of this extension, and the copy that ships
//    inside the VS Code application directory is neither documented nor stable.
// Therefore: `workspace.findFiles` for discovery (measured: 44-330 ms) plus
// `workspace.fs.readFile` for scanning (measured ~126-140 MiB/s of pure JS with
// 8 workers). `openTextDocument` was measured at ~7 ms/file and pollutes the
// open-editor model, so it is never used here.
//
// `workspace.findFiles` does NOT apply `.gitignore` (VS Code calls its own
// implementation with `useIgnoreFiles: { local: false }`), so ignore files are
// applied through the shared WorkspaceIgnoreFileCache of the file picker.
//
// Regex semantics: the tool has always tested one line at a time, so `^`, `$`
// and `\b` are per-line. A whole-file test would silently under-report `^`/`$`
// patterns, hence the whole-text prefilter is compiled with the 'm' flag and the
// per-line loop remains the authority for the reported matches.

// ---- limits -------------------------------------------------------------

export const DEFAULT_MAX_MATCHES = 50;
export const DEFAULT_TIME_BUDGET_MS = 10_000;
// One pathological file must not eat the whole budget.
export const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
// Measured: 4, 8 and 16 concurrent workers all land in the same throughput band
// (the cost is Buffer#toString plus split, not I/O), so there is nothing to gain
// above 8.
export const DEFAULT_SCAN_CONCURRENCY = 8;
export const BINARY_SNIFF_BYTES = 8192;
// Hard cap handed to findFiles: a runaway glob must not enqueue 100k files.
export const MAX_CANDIDATE_FILES = 20_000;
// One minified line would otherwise consume the whole output budget.
export const MAX_OUTPUT_LINE_CHARS = 400;
// Mirrors Configuration.MAX_CHARS_TOOL_RETURN. This service has no Application
// reference, so Tools passes the configured value per call instead.
export const DEFAULT_MAX_OUTPUT_CHARS = 5000;

// ---- options / result ---------------------------------------------------

export interface WorkspaceTextSearchOptions {
    regex: string;
    includePattern?: string;
    excludePattern?: string;
}

export interface WorkspaceTextSearchResult {
    // Already formatted for the model ('' is never returned: a completed empty
    // search says "No matches found").
    text: string;
    matches: number;
    // Files whose content was actually searched (diagnostics and tests).
    scannedFiles: number;
    // Files left after include/exclude/gitignore filtering.
    candidateFiles: number;
    truncated: boolean;
    limitReached: 'matches' | 'time' | undefined;
    // True only for a completed search with zero hits.
    noMatches: boolean;
    invalidRegex: boolean;
}

// ---- host (injectable, mirrors WorkspaceFileCatalogHost) ----------------

export interface WorkspaceTextSearchDocument {
    uri: vscode.Uri;
    isDirty: boolean;
    getText(): string;
}

export interface WorkspaceTextSearchHost {
    readonly workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
    findFiles(
        include: vscode.GlobPattern,
        exclude?: vscode.GlobPattern | null,
        maxResults?: number,
        token?: vscode.CancellationToken
    ): Thenable<vscode.Uri[]>;
    readFile(uri: vscode.Uri): Thenable<Uint8Array>;
    getConfiguration(section: string): vscode.WorkspaceConfiguration;
    asRelativePath(pathOrUri: string | vscode.Uri, includeWorkspaceFolder?: boolean): string;
    // Open (possibly dirty) documents, so unsaved buffers are searched.
    textDocuments: readonly WorkspaceTextSearchDocument[];
}

// Everything is read at call time: the workspace folders may still be unknown
// while the extension is activating, a folder can be added or removed later, and
// `workspace.textDocuments` changes all the time. In particular the folders must
// NOT be captured as a plain property, which would snapshot them.
export const createWorkspaceTextSearchHost = (): WorkspaceTextSearchHost => ({
    get workspaceFolders() {
        return vscode.workspace.workspaceFolders;
    },
    findFiles: (include, exclude, maxResults, token) =>
        vscode.workspace.findFiles(include, exclude, maxResults, token),
    readFile: uri => vscode.workspace.fs.readFile(uri),
    getConfiguration: section => vscode.workspace.getConfiguration(section),
    asRelativePath: (pathOrUri, includeWorkspaceFolder) =>
        vscode.workspace.asRelativePath(pathOrUri, includeWorkspaceFolder),
    get textDocuments() {
        return vscode.workspace.textDocuments as readonly WorkspaceTextSearchDocument[];
    }
});

// Bare `*.ts` only matches the workspace root, so the tool description's advice
// to pass bare extensions has to be normalized. Patterns are matched relative to
// the workspace folder, which is exactly what findFiles does.
export const normalizeWorkspaceTextSearchInclude = (pattern: string | undefined): string => {
    const raw = (pattern ?? '').trim().replace(/\\/g, '/');
    if (raw === '') return '**/*';
    return raw.includes('/') ? raw : '**/' + raw;
};

export class WorkspaceTextSearch {
    // A required parameter must not follow a parameter with a default, so the
    // shared ignore cache comes first and everything after it is optional.
    constructor(
        private readonly ignoreFiles: WorkspaceIgnoreFileCache,
        private readonly host: WorkspaceTextSearchHost = createWorkspaceTextSearchHost(),
        private readonly maxMatches: number = DEFAULT_MAX_MATCHES,
        private readonly timeBudgetMs: number = DEFAULT_TIME_BUDGET_MS,
        private readonly maxFileBytes: number = DEFAULT_MAX_FILE_BYTES,
        private readonly concurrency: number = DEFAULT_SCAN_CONCURRENCY
    ) {}

    async search(
        options: WorkspaceTextSearchOptions,
        token?: vscode.CancellationToken,
        // The agent's Stop button is an AbortController, not a CancellationToken,
        // so a plain predicate is accepted as well. Optional: tests ignore it.
        isCancelled?: () => boolean,
        // Per-call override of DEFAULT_MAX_OUTPUT_CHARS. Tools passes
        // app.configuration.MAX_CHARS_TOOL_RETURN here.
        maxOutputChars?: number
    ): Promise<WorkspaceTextSearchResult> {
        const roots = (this.host.workspaceFolders ?? []).map(folder => folder.uri.fsPath);
        if (roots.length === 0) {
            return this.result('No workspace folder is open.', { noMatches: true });
        }

        let lineRegex: RegExp;
        let wholeTextRegex: RegExp;
        try {
            // '' flags: RegExp#test with 'g'/'y' is stateful (lastIndex).
            lineRegex = new RegExp(options.regex);
            // 'm' flag: the prefilter runs against the whole file, so ^ and $
            // must still match at line boundaries.
            wholeTextRegex = new RegExp(options.regex, 'm');
        } catch (err) {
            // Never throw: the agent loop turns a throw into a 400-char slice of
            // the stack trace.
            return this.result(
                'Invalid regex: ' + (err as Error).message +
                '. Escape special regex characters when needed.',
                { invalidRegex: true }
            );
        }

        const includeGlob = normalizeWorkspaceTextSearchInclude(options.includePattern);
        const baseExclude = createWorkspaceFileExclude(
            this.host.getConfiguration('files').get<Record<string, unknown>>('exclude', {}),
            this.host.getConfiguration('search').get<Record<string, unknown>>('exclude', {}));
        const extraExclude = (options.excludePattern ?? '').trim();
        // createWorkspaceFileExclude always returns a single brace set, so the
        // user pattern is merged into it rather than replacing it.
        const excludeGlob = extraExclude
            ? `{${baseExclude.slice(1, -1)},${extraExclude}}`
            : baseExclude;

        let uris: vscode.Uri[];
        try {
            uris = await this.host.findFiles(includeGlob, excludeGlob, MAX_CANDIDATE_FILES, token);
        } catch (err) {
            return this.result('Search failed: ' + (err as Error).message, {});
        }

        const rules = await this.ignoreFiles.getRules(roots, token);
        if (token?.isCancellationRequested) {
            return this.result('Search was cancelled.', {});
        }

        // Open dirty documents are few, so one map per call is cheap and gives
        // the agent the content the user is looking at, not stale bytes.
        const dirtyDocuments = new Map<string, WorkspaceTextSearchDocument>();
        for (const document of this.host.textDocuments) {
            if (document.isDirty) dirtyDocuments.set(document.uri.fsPath, document);
        }

        const collected: string[] = [];
        const startedAt = Date.now();
        let cursor = 0;
        let stop = false;
        let scanned = 0;
        let candidates = 0;
        let limitReached: 'matches' | 'time' | undefined;

        const worker = async (): Promise<void> => {
            while (!stop) {
                const index = cursor++;
                if (index >= uris.length) return;
                if (token?.isCancellationRequested || isCancelled?.()) return;
                // '>=' rather than '>': a budget of 0 then stops deterministically
                // on the first file, which is what the unit tests exercise. For a
                // real budget the difference is one millisecond.
                if (Date.now() - startedAt >= this.timeBudgetMs) {
                    limitReached ??= 'time';
                    stop = true;
                    return;
                }

                const uri = uris[index];
                if (rules.ignores(uri.fsPath)) continue;
                candidates++;

                let text: string;
                const openDocument = dirtyDocuments.get(uri.fsPath);
                if (openDocument) {
                    // Unsaved buffer wins: no size or binary checks, the user's
                    // own document is text by definition.
                    text = openDocument.getText();
                } else {
                    let bytes: Uint8Array;
                    try {
                        bytes = await this.host.readFile(uri);
                    } catch {
                        // A permissions error, a file deleted mid-scan or an
                        // unsupported URI scheme must not abort the whole scan.
                        continue;
                    }
                    if (bytes.length === 0 || bytes.length > this.maxFileBytes) continue;
                    if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) continue;
                    text = Buffer.from(bytes).toString('utf8');
                }
                if (text.length === 0 || !wholeTextRegex.test(text)) continue;
                scanned++;

                const lines = text.split('\n');
                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    // Tested untrimmed, so ^/$ keep their per-line meaning.
                    if (!lineRegex.test(lines[lineIndex])) continue;
                    collected.push(
                        `${this.host.asRelativePath(uri)}:${lineIndex + 1}: ${this.clipLine(lines[lineIndex])}`
                    );
                    if (collected.length >= this.maxMatches) {
                        limitReached = 'matches';
                        stop = true;
                        return;
                    }
                }
            }
        };

        await Promise.all(Array.from({ length: Math.max(1, this.concurrency) }, worker));

        if (token?.isCancellationRequested || isCancelled?.()) {
            return this.result('Search was cancelled.', { candidateFiles: candidates, scannedFiles: scanned });
        }

        // Workers can overshoot the cap in the same tick before any of them
        // observes it, so the slice is what makes the cap exact.
        const matches = collected.slice(0, this.maxMatches);
        if (collected.length >= this.maxMatches) limitReached = 'matches';

        let text = matches.length > 0 ? '\n' + matches.join('\n') : 'No matches found';
        if (limitReached === 'matches') {
            text += `\n[Showing the first ${this.maxMatches} matches. ` +
                'Narrow include_pattern or exclude_pattern to see more.]';
        } else if (limitReached === 'time') {
            text += `\n[Search stopped after ${Math.round(this.timeBudgetMs / 1000)}s - results are partial. ` +
                'Narrow include_pattern or exclude_pattern.]';
        }

        const cap = maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
        if (text.length > cap) {
            // Cut at the last complete line that fits, like web-browser.ts does.
            text = text.slice(0, cap).replace(/\n[^\n]*$/, '') +
                '\n[Result truncated to fit the tool output limit.]';
        }

        return {
            text,
            matches: matches.length,
            scannedFiles: scanned,
            candidateFiles: candidates,
            truncated: limitReached !== undefined,
            limitReached,
            noMatches: matches.length === 0 && limitReached === undefined,
            invalidRegex: false
        };
    }

    // Clipping happens only in the reported line, never before the match test,
    // so it cannot change which lines match.
    private clipLine(line: string): string {
        return line.length > MAX_OUTPUT_LINE_CHARS
            ? line.slice(0, MAX_OUTPUT_LINE_CHARS) + '…'
            : line;
    }

    private result(text: string, overrides: Partial<WorkspaceTextSearchResult>): WorkspaceTextSearchResult {
        return {
            text,
            matches: 0,
            scannedFiles: 0,
            candidateFiles: 0,
            truncated: false,
            limitReached: undefined,
            noMatches: false,
            invalidRegex: false,
            ...overrides
        };
    }
}
