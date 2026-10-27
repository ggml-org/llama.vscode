import * as path from 'path';
import ignore from 'ignore';
import * as vscode from 'vscode';

export const DEFAULT_WORKSPACE_FILE_RESULT_LIMIT = 2000;
// Ignore files are small, but a repository can contain a lot of them.
export const MAX_WORKSPACE_IGNORE_FILES = 5000;
// Discovery runs once per keystroke (debounced). Re-reading every nested
// .gitignore each time is wasteful, so the result is reused briefly. A stale
// entry can only be a few seconds old, so an edited ignore file is picked up by
// the next search without any change-listener plumbing.
export const DEFAULT_IGNORE_CACHE_TTL_MS = 3000;
// Git and VS Code both treat these as the local ignore files of a directory.
export const WORKSPACE_IGNORE_FILES = ['.gitignore', '.ignore'];

export interface WorkspaceFileList {
    files: string[];
    // Workspace-relative paths keyed by the existing "name | absolutePath"
    // payload. The payload itself stays compatible with context attachments.
    fileDetails: Record<string, string>;
    truncated: boolean;
    workspaceEmpty: boolean;
}

export interface WorkspaceFileDescriptor {
    name: string;
    relativePath: string;
}

// Kept small and injectable so discovery can be tested without an Application,
// RAG index, model server, or real filesystem.
export interface WorkspaceFileCatalogHost {
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
}

// Read through the workspace filesystem so remote/virtual workspaces work and
// nothing is created eagerly: the host is resolved on demand because the
// workspace folders are unknown while the extension is activating.
export const createWorkspaceFileCatalogHost = (): WorkspaceFileCatalogHost => ({
    workspaceFolders: vscode.workspace.workspaceFolders,
    findFiles: (include, exclude, maxResults, token) =>
        vscode.workspace.findFiles(include, exclude, maxResults, token),
    readFile: uri => vscode.workspace.fs.readFile(uri),
    getConfiguration: section => vscode.workspace.getConfiguration(section),
    asRelativePath: (pathOrUri, includeWorkspaceFolder) =>
        vscode.workspace.asRelativePath(pathOrUri, includeWorkspaceFolder)
});

const DEFAULT_EXCLUDES = [
    '**/.git', '**/.git/**', '**/.svn/**', '**/.hg/**',
    '**/node_modules/**', '**/bower_components/**'
];

// Supplying an exclude glob replaces VS Code's default excludes, so include the
// effective standard settings explicitly. RAG ignore files deliberately do not
// participate: they control semantic indexing, not explicit user attachments.
export const createWorkspaceFileExclude = (
    filesExclude: Record<string, unknown> = {},
    searchExclude: Record<string, unknown> = {}
): string => {
    const patterns = new Set(DEFAULT_EXCLUDES);
    for (const excludes of [filesExclude, searchExclude]) {
        for (const [pattern, enabled] of Object.entries(excludes)) {
            // files.exclude can also contain conditional-rule objects.
            if (enabled) patterns.add(pattern);
        }
    }
    return `{${Array.from(patterns).join(',')}}`;
};

const GLOB_LITERALS: Record<string, string> = {
    '*': '[*]',
    '?': '[?]',
    '[': '[[]',
    ']': '[]]',
    '{': '[{]',
    '}': '[}]'
};

export const escapeFileSearchGlob = (value: string): string => {
    return Array.from(value.replace(/\\/g, '/'))
        .map(character => {
            const escaped = GLOB_LITERALS[character];
            if (escaped) return escaped;
            // findFiles' glob matching can be case-sensitive on Linux. Match
            // both cases explicitly so the picker remains case-insensitive.
            const lower = character.toLocaleLowerCase();
            const upper = character.toLocaleUpperCase();
            return lower !== upper && lower.length === 1 && upper.length === 1
                ? `[${lower}${upper}]`
                : character;
        })
        .join('');
};

export const workspaceFileSearchTerms = (query: string): string[] => {
    return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
};

export const matchesWorkspaceFileQuery = (
    name: string,
    relativePath: string,
    query: string
): boolean => {
    const terms = workspaceFileSearchTerms(query);
    if (terms.length === 0) return true;
    const haystack = `${name} ${relativePath}`.replace(/\\/g, '/').toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
};

// Use one literal term to narrow VS Code's search, then apply all terms below.
// This also supports filters such as "components agent" without interpreting
// user input as a glob. Escaping prevents *, ?, [], and {} from broadening it.
export const createWorkspaceFileSearchPattern = (query: string): string => {
    const firstTerm = query.trim().split(/\s+/).filter(Boolean)[0] ?? '';
    const escaped = escapeFileSearchGlob(firstTerm);
    if (!escaped) return '**/*';
    // A path filter must also match files below a matching directory. The
    // basename alternative keeps plain queries such as "agent" useful.
    return `**/*{${escaped},${escaped}/**}*`;
};

const rank = (name: string, relativePath: string, query: string): number => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return 0;
    const lowerName = name.toLocaleLowerCase();
    const lowerPath = relativePath.replace(/\\/g, '/').toLocaleLowerCase();
    if (lowerName === needle) return 0;
    if (lowerName.startsWith(needle)) return 1;
    if (lowerName.includes(needle)) return 2;
    if (lowerPath.includes(needle)) return 3;
    return 4;
};

export const rankWorkspaceFiles = <T extends WorkspaceFileDescriptor>(items: T[], query: string): T[] => {
    return items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            const score = rank(a.item.name, a.item.relativePath, query) - rank(b.item.name, b.item.relativePath, query);
            if (score !== 0) return score;
            const byPath = a.item.relativePath.localeCompare(b.item.relativePath);
            return byPath !== 0 ? byPath : a.index - b.index;
        })
        .map(({ item }) => item);
};

// One ignore file of the workspace and the rules it contributes.
export interface WorkspaceIgnoreFile {
    absolutePath: string;
    content: string;
}

// Cached ignore files plus the workspace-folder snapshot they were read for, so
// the cache is dropped when folders are added or removed.
export interface WorkspaceIgnoreCacheEntry {
    ignoreFiles: WorkspaceIgnoreFile[];
    snapshot: string;
    readAt: number;
}

export interface WorkspaceIgnoreRules {
    // True when the file is excluded by the ignore rules of the workspace folder
    // that owns it.
    ignores(fsPath: string): boolean;
}

const normalizePath = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '');

export const isWorkspaceIgnoreFileName = (name: string): boolean => WORKSPACE_IGNORE_FILES.includes(name);

// Matches one workspace folder's ignore files, deepest rule first.
const createFolderMatcher = (
    ignoreFiles: WorkspaceIgnoreFile[],
    root: string
): Array<{ directory: string; matcher: ignore.Ignore }> => {
    const prefix = root + '/';
    const sources: Array<{ directory: string; content: string; depth: number }> = [];

    for (const file of ignoreFiles) {
        const absolutePath = normalizePath(file.absolutePath);
        if (!absolutePath.startsWith(prefix)) continue;
        // Only real ignore files contribute rules, whatever the host returned.
        if (!isWorkspaceIgnoreFileName(path.posix.basename(absolutePath))) continue;
        const directory = path.posix.dirname(absolutePath.slice(prefix.length));
        sources.push({
            directory: directory === '.' ? '' : directory,
            content: file.content,
            // A folder root is depth 0, like a nested file one level below it.
            depth: directory === '.' ? 0 : directory.split('/').length
        });
    }

    // Sorted from the folder root downwards, so iterating backwards in
    // isIgnoredValue() starts with the closest ignore file.
    return sources
        .sort((a, b) => a.depth - b.depth || a.directory.localeCompare(b.directory))
        .map(source => ({ directory: source.directory, matcher: ignore().add(source.content) }));
};

// Builds one matcher per workspace folder. Per-folder matching is required in a
// multi-root workspace, where a folder's ignore files must not affect a sibling.
// `.gitignore` semantics apply: the closest rule wins, and anything below an
// excluded folder stays excluded (git never descends into an ignored folder).
export const createWorkspaceIgnoreRules = (
    ignoreFiles: WorkspaceIgnoreFile[],
    workspaceRoots: string[]
): WorkspaceIgnoreRules => {
    const folders = workspaceRoots
        .map(normalizePath)
        .filter(root => root !== '')
        // Longest first, so a nested folder wins over its parent.
        .sort((a, b) => b.length - a.length)
        .map(root => ({ prefix: root + '/', matchers: createFolderMatcher(ignoreFiles, root) }));

    const governsAnything = folders.some(folder => folder.matchers.length > 0);
    if (!governsAnything) return { ignores: () => false };

    return {
        ignores(fsPath: string): boolean {
            const file = normalizePath(fsPath);
            for (const folder of folders) {
                if (!file.startsWith(folder.prefix)) continue;
                if (folder.matchers.length === 0) return false;
                return isIgnoredInFolder(folder.matchers, file.slice(folder.prefix.length));
            }
            // A file outside every workspace folder is not ours to hide.
            return false;
        }
    };
};

const isIgnoredInFolder = (
    matchers: Array<{ directory: string; matcher: ignore.Ignore }>,
    relativePath: string
): boolean => {
    if (!relativePath) return false;
    const segments = relativePath.split('/');
    // A folder that is excluded must also hide its files: git cannot re-include
    // anything below an ignored folder, and `dist/` matches a folder, not the
    // file `dist/bundle.js`, so every parent path is tested as well.
    for (let index = segments.length; index >= 1; index--) {
        if (isIgnoredValue(matchers, segments.slice(0, index).join('/'))) return true;
    }
    return false;
};

const isIgnoredValue = (
    matchers: Array<{ directory: string; matcher: ignore.Ignore }>,
    value: string
): boolean => {
    for (let position = matchers.length - 1; position >= 0; position--) {
        const { directory, matcher } = matchers[position];
        let candidate = value;
        if (directory !== '') {
            // This ignore file only governs its own subtree, so it neither
            // ignores nor un-ignores anything outside it. Skipping those keeps
            // the per-file cost proportional to the folder depth instead of the
            // total number of ignore files in the workspace.
            if (!candidate.startsWith(directory + '/')) continue;
            candidate = candidate.slice(directory.length + 1);
        }
        if (!candidate) continue;
        // Both forms are tested because git cannot tell a file from a folder:
        // \`dist/\` excludes the folder, not the file \`dist/bundle.js\`.
        for (const form of [candidate, candidate + '/']) {
            const result = matcher.test(form);
            if (result.ignored) return true;
            // A negation in the closest matching ignore file wins.
            if (result.unignored) return false;
        }
    }
    return false;
};

export class WorkspaceFileCatalog {
    private ignoreCache: WorkspaceIgnoreCacheEntry | undefined;

    constructor(
        private readonly host: WorkspaceFileCatalogHost = createWorkspaceFileCatalogHost(),
        private readonly resultLimit: number = DEFAULT_WORKSPACE_FILE_RESULT_LIMIT,
        private readonly ignoreCacheTtlMs: number = DEFAULT_IGNORE_CACHE_TTL_MS
    ) {}

    async search(query: string, token: vscode.CancellationToken): Promise<WorkspaceFileList> {
        const workspaceEmpty = !this.host.workspaceFolders || this.host.workspaceFolders.length === 0;
        if (workspaceEmpty) {
            return { files: [], fileDetails: {}, truncated: false, workspaceEmpty: true };
        }

        const filesExclude = this.host.getConfiguration('files').get<Record<string, unknown>>('exclude', {});
        const searchExclude = this.host.getConfiguration('search').get<Record<string, unknown>>('exclude', {});
        const uris = await this.host.findFiles(
            createWorkspaceFileSearchPattern(query),
            createWorkspaceFileExclude(filesExclude, searchExclude),
            this.resultLimit + 1,
            token
        );
        if (token.isCancellationRequested) {
            return { files: [], fileDetails: {}, truncated: false, workspaceEmpty: false };
        }

        const roots = this.host.workspaceFolders!.map(folder => folder.uri.fsPath);
        const ignoreRules = await this.getIgnoreRules(roots, token);
        if (token.isCancellationRequested) {
            return { files: [], fileDetails: {}, truncated: false, workspaceEmpty: false };
        }

        const seenPaths = new Set<string>();
        const candidates: Array<WorkspaceFileDescriptor & { absolutePath: string }> = [];
        for (const uri of uris) {
            if (seenPaths.has(uri.fsPath)) continue;
            seenPaths.add(uri.fsPath);
            const name = path.basename(uri.fsPath);
            const relativePath = this.host.asRelativePath(uri).replace(/\\/g, '/');
            if (!matchesWorkspaceFileQuery(name, relativePath, query)) continue;
            // The picker offers what the Explorer shows, so ignore files apply
            // to typed searches too: "dist" must not resurface build output.
            // The picker's "Choose file..." action still reaches any file.
            if (ignoreRules.ignores(uri.fsPath)) continue;
            candidates.push({ name, relativePath, absolutePath: uri.fsPath });
        }

        const ranked = rankWorkspaceFiles(candidates, query);
        const selected = ranked.slice(0, this.resultLimit);
        const files: string[] = [];
        const fileDetails: Record<string, string> = {};
        for (const item of selected) {
            const raw = `${item.name} | ${item.absolutePath}`;
            files.push(raw);
            fileDetails[raw] = item.relativePath;
        }

        return {
            files,
            fileDetails,
            truncated: uris.length > this.resultLimit || ranked.length > this.resultLimit,
            workspaceEmpty: false
        };
    }

    // Reads every local ignore file of the workspace folders. Ignore-file
    // support lives here because workspace.findFiles deliberately passes
    // `useIgnoreFiles: { local: false }`, i.e. VS Code never applies
    // `.gitignore` to an extension's own file search.
    private async getIgnoreRules(workspaceRoots: string[], token: vscode.CancellationToken): Promise<WorkspaceIgnoreRules> {
        const snapshot = workspaceRoots.join('\n');
        const now = Date.now();
        const cached = this.ignoreCache;
        if (cached && cached.snapshot === snapshot && now - cached.readAt < this.ignoreCacheTtlMs) {
            return createWorkspaceIgnoreRules(cached.ignoreFiles, workspaceRoots);
        }

        const uris: vscode.Uri[] = [];
        const seen = new Set<string>();
        for (const name of WORKSPACE_IGNORE_FILES) {
            let found: vscode.Uri[] = [];
            try {
                // No exclude glob: `.gitignore` is commonly listed in
                // files.exclude and still has to be read.
                found = await this.host.findFiles('**/' + name, null, MAX_WORKSPACE_IGNORE_FILES, token);
            } catch (err) {
                console.error('Failed to find ignore files:', err);
            }
            for (const uri of found) {
                if (seen.has(uri.fsPath)) continue;
                seen.add(uri.fsPath);
                uris.push(uri);
            }
        }

        const contents = await Promise.all(uris.map(async uri => {
            try {
                // Uint8Array#toString would join the byte values, so decode.
                const data = await this.host.readFile(uri);
                return { absolutePath: uri.fsPath, content: Buffer.from(data).toString('utf8') };
            } catch (err) {
                // An unreadable ignore file must not hide the whole picker.
                console.error(`Failed to read ignore file ${uri.fsPath}:`, err);
                return undefined;
            }
        }));

        const ignoreFiles = contents.filter(
            (item): item is WorkspaceIgnoreFile => item !== undefined
        );
        this.ignoreCache = { ignoreFiles, snapshot, readAt: now };
        return createWorkspaceIgnoreRules(ignoreFiles, workspaceRoots);
    }
}
