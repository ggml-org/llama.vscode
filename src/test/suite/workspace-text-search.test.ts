/// <reference types="mocha" />
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import {
    createWorkspaceFileExclude,
    WorkspaceFileCatalogHost,
    WorkspaceIgnoreFileCache,
    createWorkspaceFileCatalogHost
} from '../../services/workspace-file-catalog';
import {
    BINARY_SNIFF_BYTES,
    DEFAULT_MAX_MATCHES,
    DEFAULT_MAX_OUTPUT_CHARS,
    MAX_OUTPUT_LINE_CHARS,
    normalizeWorkspaceTextSearchInclude,
    WorkspaceTextSearch,
    WorkspaceTextSearchHost,
    WorkspaceTextSearchOptions
} from '../../services/workspace-text-search';

// The whole suite runs against fake hosts: WorkspaceTextSearch never touches
// vscode.workspace, so no VS Code test host is required beyond vscode.Uri.

const ROOT = path.resolve('/workspace/project');

const folder = (name: string, root: string, index = 0): vscode.WorkspaceFolder => ({
    name,
    index,
    uri: vscode.Uri.file(root)
});

const configuration = (exclude: Record<string, unknown> = {}): vscode.WorkspaceConfiguration => ({
    get: <T>(section: string, defaultValue?: T) => section === 'exclude' ? exclude as T : defaultValue as T
} as unknown as vscode.WorkspaceConfiguration);

const token = (cancelled = false): vscode.CancellationToken => {
    const source = new vscode.CancellationTokenSource();
    if (cancelled) source.cancel();
    return source.token;
};

const absolute = (relative: string, root = ROOT): string => path.join(root, relative);

interface FakeHostOptions {
    ignoreFiles?: Record<string, string>;
    // Absolute paths of files that must fail to read.
    unreadable?: string[];
    // Absolute path -> in-memory text of an open, DIRTY document.
    dirty?: Record<string, string>;
    // Absolute paths of open documents that are NOT dirty.
    openClean?: string[];
    // Absolute paths that must be returned as binary content.
    binary?: string[];
    roots?: vscode.WorkspaceFolder[];
    filesExclude?: Record<string, unknown>;
    searchExclude?: Record<string, unknown>;
}

// The service needs two different hosts: a WorkspaceFileCatalogHost for the
// ignore-file cache and a WorkspaceTextSearchHost for everything else.
const createSearchHost = (
    files: Record<string, string>,
    options: FakeHostOptions = {},
    calls: Array<{ include: vscode.GlobPattern; exclude?: vscode.GlobPattern | null; maxResults?: number }> = []
): WorkspaceTextSearchHost => {
    const roots = options.roots ?? [folder('project', ROOT)];
    const dirty = options.dirty ?? {};
    const openClean = options.openClean ?? [];
    const binary = options.binary ?? [];
    const unreadable = options.unreadable ?? [];

    const resolveRelative = (value: string): string => {
        const file = value.replace(/\\/g, '/');
        const owner = roots.find(root => file.startsWith(root.uri.fsPath.replace(/\\/g, '/') + '/'));
        if (!owner) return file;
        const relative = file.slice(owner.uri.fsPath.replace(/\\/g, '/').length + 1);
        // Multi-root paths are prefixed with the folder name, like VS Code does.
        return roots.length > 1 ? `${owner.name}/${relative}` : relative;
    };

    const documents: Array<{ uri: vscode.Uri; isDirty: boolean; getText(): string }> = [
        ...Object.entries(dirty).map(([file, text]) => ({
            uri: vscode.Uri.file(file),
            isDirty: true,
            getText: () => text
        })),
        ...openClean.map(file => ({
            uri: vscode.Uri.file(file),
            isDirty: false,
            getText: () => files[file] ?? ''
        }))
    ];

    return {
        workspaceFolders: roots,
        findFiles: async (include, exclude, maxResults) => {
            // Ignore-file discovery arrives on the same method; answer it from
            // the supplied ignore-file map.
            const pattern = String(include);
            if (pattern.startsWith('**/.')) {
                return Object.keys(options.ignoreFiles ?? {})
                    .filter(file => pattern === '**/' + path.posix.basename(file))
                    .map(file => vscode.Uri.file(file));
            }
            calls.push({ include, exclude, maxResults });
            const limit = maxResults ?? Object.keys(files).length;
            return Object.keys(files).slice(0, limit).map(file => vscode.Uri.file(file));
        },
        readFile: async uri => {
            if (unreadable.includes(uri.fsPath)) throw new Error('EACCES: permission denied');
            if (binary.includes(uri.fsPath)) {
                // NUL byte in the first sniff window.
                const prefix = Buffer.alloc(4);
                return new Uint8Array(Buffer.concat([prefix, Buffer.from(files[uri.fsPath] ?? '', 'utf8')]));
            }
            return new Uint8Array(Buffer.from(files[uri.fsPath] ?? '', 'utf8'));
        },
        getConfiguration: section => section === 'files'
            ? configuration(options.filesExclude ?? { '**/dist/**': true })
            : configuration(options.searchExclude ?? {}),
        asRelativePath: value => resolveRelative(typeof value === 'string' ? value : value.fsPath),
        textDocuments: documents
    };
};

const createCatalogHost = (
    roots: vscode.WorkspaceFolder[],
    ignoreFiles: Record<string, string>
): WorkspaceFileCatalogHost => ({
    workspaceFolders: roots,
    findFiles: async (include) => {
        const pattern = String(include);
        if (!pattern.startsWith('**/.')) return [];
        return Object.keys(ignoreFiles)
            .filter(file => pattern === '**/' + path.posix.basename(file))
            .map(file => vscode.Uri.file(file));
    },
    readFile: async uri => new Uint8Array(Buffer.from(ignoreFiles[uri.fsPath] ?? '', 'utf8')),
    getConfiguration: () => configuration(),
    asRelativePath: value => String(typeof value === 'string' ? value : value.fsPath)
});

interface SearchHarness {
    search: WorkspaceTextSearch;
    calls: Array<{ include: vscode.GlobPattern; exclude?: vscode.GlobPattern | null; maxResults?: number }>;
}

const harness = (
    files: Record<string, string>,
    options: FakeHostOptions = {},
    limits: { maxMatches?: number; timeBudgetMs?: number; maxFileBytes?: number; concurrency?: number } = {}
): SearchHarness => {
    const roots = options.roots ?? [folder('project', ROOT)];
    const calls: Array<{ include: vscode.GlobPattern; exclude?: vscode.GlobPattern | null; maxResults?: number }> = [];
    // TTL 0 disables the ignore cache, which keeps multi-search tests
    // deterministic (same trick as workspace-file-catalog.test.ts).
    const ignoreFiles = new WorkspaceIgnoreFileCache(createCatalogHost(roots, options.ignoreFiles ?? {}), 0);
    const search = new WorkspaceTextSearch(
        ignoreFiles,
        createSearchHost(files, options, calls),
        limits.maxMatches,
        limits.timeBudgetMs,
        limits.maxFileBytes,
        limits.concurrency
    );
    return { search, calls };
};

const run = (files: Record<string, string>, options: WorkspaceTextSearchOptions, hostOptions: FakeHostOptions & {
    maxMatches?: number;
    timeBudgetMs?: number;
    maxFileBytes?: number;
    concurrency?: number;
    maxOutputChars?: number;
} = {}) => {
    const { search, calls } = harness(files, hostOptions, hostOptions);
    return search.search(options, token(), undefined, hostOptions.maxOutputChars)
        .then(result => ({ result, calls }));
};

suite('Workspace Text Search discovery', () => {
    test('normalizes bare globs so they are not limited to the workspace root', async () => {
        const { result, calls } = await run(
            { [absolute('src/tools.ts')]: 'getRegexpMatches\n' },
            { regex: 'getRegexpMatches', includePattern: '*.ts' }
        );

        assert.strictEqual(calls.length, 1);
        // '*.ts' would only match the workspace root, so it is prefixed.
        assert.strictEqual(calls[0].include, '**/*.ts');
        assert.strictEqual(result.matches, 1);
        assert.strictEqual(result.text, '\nsrc/tools.ts:1: getRegexpMatches');
    });

    test('passes a path-bearing glob through unchanged', async () => {
        const { calls } = await run(
            { [absolute('src/tools.ts')]: 'x\n' },
            { regex: 'x', includePattern: 'src/**/*.ts' }
        );
        assert.strictEqual(calls[0].include, 'src/**/*.ts');
    });

    test('searches everything for an empty or missing include pattern', async () => {
        const missing = await run({ [absolute('a.ts')]: 'x\n' }, { regex: 'x' });
        assert.strictEqual(missing.calls[0].include, '**/*');
        const empty = await run({ [absolute('a.ts')]: 'x\n' }, { regex: 'x', includePattern: '  ' });
        assert.strictEqual(empty.calls[0].include, '**/*');
    });

    test('normalizes a pattern helper independently of the service', () => {
        assert.strictEqual(normalizeWorkspaceTextSearchInclude(undefined), '**/*');
        assert.strictEqual(normalizeWorkspaceTextSearchInclude(''), '**/*');
        assert.strictEqual(normalizeWorkspaceTextSearchInclude('*.ts'), '**/*.ts');
        assert.strictEqual(normalizeWorkspaceTextSearchInclude('src\\**\\*.ts'), 'src/**/*.ts');
        assert.strictEqual(normalizeWorkspaceTextSearchInclude('src/'), 'src/');
    });

    test('merges the user exclude pattern into the standard brace set', async () => {
        const { calls } = await run(
            { [absolute('src/a.ts')]: 'x\n' },
            { regex: 'x', excludePattern: '**/generated/**' }
        );
        const exclude = String(calls[0].exclude);
        // One brace set, standard excludes preserved, the user pattern inside.
        assert.ok(exclude.startsWith('{'));
        assert.ok(exclude.endsWith('}'));
        assert.strictEqual(exclude.slice(1, -1).includes('},{'), false);
        assert.ok(exclude.includes('**/node_modules/**'));
        assert.ok(exclude.includes('**/.git/**'));
        assert.ok(exclude.includes('**/generated/**'));
    });

    test('uses only the standard excludes when no exclude pattern is given', async () => {
        const { calls } = await run({ [absolute('a.ts')]: 'x\n' }, { regex: 'x' });
        assert.strictEqual(String(calls[0].exclude), createWorkspaceFileExclude({ '**/dist/**': true }, {}));
    });

    test('applies search.exclude from the settings', async () => {
        const { calls } = await run(
            { [absolute('a.ts')]: 'x\n' },
            { regex: 'x' },
            { filesExclude: { '**/dist/**': true }, searchExclude: { '**/coverage/**': true } }
        );
        assert.ok(String(calls[0].exclude).includes('**/coverage/**'));
    });

    test('caps discovery with the candidate file limit', async () => {
        const { calls } = await run({ [absolute('a.ts')]: 'x\n' }, { regex: 'x' });
        assert.strictEqual(calls[0].maxResults, 20000);
    });

    test('derives the relative output path from the host, so multi-root works', async () => {
        const first = folder('frontend', path.resolve('/workspace/frontend'), 0);
        const second = folder('backend', path.resolve('/workspace/backend'), 1);
        const { result } = await run(
            { [absolute('src/hit.ts', second.uri.fsPath)]: 'needle\n' },
            { regex: 'needle' },
            { roots: [first, second] }
        );
        assert.strictEqual(result.text, '\nbackend/src/hit.ts:1: needle');
    });
});

suite('Workspace Text Search correctness', () => {
    test('reports real 1-based line numbers (regression for the +5 RAG shift)', async () => {
        const { result } = await run({
            [absolute('file.ts')]: 'first line\nsecond line\nconst hit = 1;\nfourth line\n'
        }, { regex: 'const hit' });

        assert.strictEqual(result.matches, 1);
        assert.strictEqual(result.text, '\nfile.ts:3: const hit = 1;');
    });

    test('anchors ^ and $ per line through the multiline prefilter', async () => {
        const file = 'import a from "a"\nconst x = 1\nimport b from "b"\n';
        const imports = await run({ [absolute('m.ts')]: file }, { regex: '^import' });
        assert.strictEqual(imports.result.matches, 2);
        assert.ok(imports.result.text.includes('m.ts:1: import a from "a"'));
        assert.ok(imports.result.text.includes('m.ts:3: import b from "b"'));

        const dollars = await run({ [absolute('m.ts')]: file }, { regex: 'const x = 1$' });
        assert.strictEqual(dollars.result.matches, 1);
    });

    test('honours word boundaries', async () => {
        const { result } = await run(
            { [absolute('w.ts')]: 'foo bar\nfoobar\nfoo\n' },
            { regex: '\\bfoo\\b' }
        );
        assert.strictEqual(result.matches, 2);
        assert.ok(result.text.includes('w.ts:1: foo bar'));
        assert.ok(result.text.includes('w.ts:3: foo'));
    });

    test('does not trim lines before testing them', async () => {
        // A leading space would be removed by a pre-trim, turning ' x$' into a
        // full-line match and changing the result.
        const { result } = await run({ [absolute('t.ts')]: ' x\nx\n' }, { regex: '^ x$' });
        assert.strictEqual(result.matches, 1);
        assert.ok(result.text.includes('t.ts:1:'));
    });

    test('skips binary files even when the bytes spell out the pattern', async () => {
        const binaryFile = absolute('image.png');
        const { result } = await run(
            { [binaryFile]: 'needle in a binary', [absolute('a.ts')]: 'needle\n' },
            { regex: 'needle' },
            { binary: [binaryFile] }
        );
        assert.strictEqual(result.matches, 1);
        assert.ok(result.text.includes('a.ts:1: needle'));
    });

    test('skips the binary sniff window for a NUL byte past the first bytes', async () => {
        const { result } = await run(
            { [absolute('a.bin')]: 'needle' },
            { regex: 'needle' },
            { binary: [absolute('a.bin')] }
        );
        assert.strictEqual(result.matches, 0);
        assert.strictEqual(result.text, 'No matches found');
        assert.ok(BINARY_SNIFF_BYTES > 4);
    });

    test('skips empty files and files over the size limit without failing', async () => {
        const big = 'x'.repeat(40);
        const { result } = await run(
            { [absolute('empty.ts')]: '', [absolute('big.ts')]: 'needle\n' + big },
            { regex: 'needle' },
            { maxFileBytes: 10 }
        );
        assert.strictEqual(result.matches, 0);
        assert.strictEqual(result.text, 'No matches found');
        assert.strictEqual(result.noMatches, true);
    });

    test('one unreadable file does not abort the search', async () => {
        const broken = absolute('broken.ts');
        const { result } = await run(
            { [broken]: 'needle\n', [absolute('ok.ts')]: 'needle\n' },
            { regex: 'needle' },
            { unreadable: [broken] }
        );
        assert.strictEqual(result.matches, 1);
        assert.ok(result.text.includes('ok.ts:1: needle'));
    });

    test('counts candidates and scanned files consistently', async () => {
        const { result } = await run({
            [absolute('a.ts')]: 'needle\n',
            [absolute('b.ts')]: 'nothing here\n',
            [absolute('c.ts')]: ''
        }, { regex: 'needle' });

        assert.strictEqual(result.candidateFiles, 3);
        // The empty file is skipped before the prefilter.
        assert.strictEqual(result.scannedFiles, 1);
        assert.strictEqual(result.matches, 1);
    });

    test('keeps the leading newline before the first match', async () => {
        const { result } = await run({ [absolute('a.ts')]: 'needle\n' }, { regex: 'needle' });
        assert.strictEqual(result.text.startsWith('\n'), true);
    });
});

suite('Workspace Text Search limits', () => {
    test('stops at exactly maxMatches and annotates the result', async () => {
        const lines = Array.from({ length: 40 }, (_, index) => `needle ${index}`).join('\n');
        const files: Record<string, string> = {};
        for (let index = 0; index < 6; index++) files[absolute(`f${index}.ts`)] = lines;

        // Concurrency 8 means several workers can overshoot before any of them
        // observes the cap; the slice after Promise.all keeps it exact.
        const { result } = await run(files, { regex: 'needle' }, { maxMatches: 7, concurrency: 8 });
        assert.strictEqual(result.matches, 7);
        assert.strictEqual(result.limitReached, 'matches');
        assert.strictEqual(result.truncated, true);
        assert.strictEqual(result.noMatches, false);
        assert.strictEqual(result.text.split('\n').length - 1, 8); // 7 matches + note
        assert.ok(result.text.includes('[Showing the first 7 matches.'));
    });

    test('defaults to 50 matches', async () => {
        const lines = Array.from({ length: 60 }, (_, index) => `needle ${index}`).join('\n');
        const { result } = await run({ [absolute('a.ts')]: lines }, { regex: 'needle' });
        assert.strictEqual(result.matches, DEFAULT_MAX_MATCHES);
        assert.strictEqual(result.limitReached, 'matches');
    });

    test('reports a time-budget stop with the partial-results note', async () => {
        const { result } = await run(
            { [absolute('a.ts')]: 'needle\n' },
            { regex: 'needle' },
            { timeBudgetMs: 0 }
        );
        assert.strictEqual(result.limitReached, 'time');
        assert.strictEqual(result.truncated, true);
        assert.strictEqual(result.matches, 0);
        assert.strictEqual(result.noMatches, false);
        assert.ok(result.text.includes('results are partial'));
        assert.strictEqual(result.text.startsWith('No matches found'), true);
    });

    test('clips the whole result to the output cap at a line boundary', async () => {
        const lines = Array.from({ length: 30 }, (_, index) => `needle ${index} ${'y'.repeat(20)}`).join('\n');
        const { result } = await run(
            { [absolute('a.ts')]: lines },
            { regex: 'needle' },
            { maxOutputChars: 200 }
        );
        assert.ok(result.text.length <= 200 + '\n[Result truncated to fit the tool output limit.]'.length);
        assert.ok(result.text.includes('[Result truncated to fit the tool output limit.]'));
        // The last kept line is complete, i.e. the cut did not leave a fragment.
        const kept = result.text.slice(0, result.text.indexOf('\n[Result truncated'));
        assert.ok(kept.endsWith('y'.repeat(20)) || kept.includes('needle'));
        assert.strictEqual(/needle \d+ [y]{1,19}$/.test(kept), false);
    });

    test('uses the module default cap when no override is given', async () => {
        const lines = Array.from({ length: 400 }, (_, index) => `needle ${index} ${'z'.repeat(30)}`).join('\n');
        const { result } = await run({ [absolute('a.ts')]: lines }, { regex: 'needle' }, { maxMatches: 400 });
        // 400 matches survive the match cap but not the 5000-char output cap.
        assert.ok(result.text.length > DEFAULT_MAX_OUTPUT_CHARS);
        assert.ok(result.text.includes('[Result truncated to fit the tool output limit.]'));
    });

    test('clips one very long line to 400 characters but still reports the match', async () => {
        const long = 'needle ' + 'a'.repeat(1200);
        const { result } = await run({ [absolute('min.js')]: long }, { regex: 'needle' });
        assert.strictEqual(result.matches, 1);
        const reported = result.text.split('\n')[1];
        assert.ok(reported.endsWith('…'));
        assert.strictEqual(reported.slice(reported.indexOf(': ') + 2).length, MAX_OUTPUT_LINE_CHARS + 1);
    });
});

suite('Workspace Text Search errors and edge cases', () => {
    test('answers No workspace folder is open without searching', async () => {
        const { search, calls } = harness({}, { roots: [] });
        const result = await search.search({ regex: 'x' });
        assert.strictEqual(result.text, 'No workspace folder is open.');
        assert.strictEqual(result.noMatches, true);
        assert.strictEqual(calls.length, 0);
    });

    test('answers No matches found for a completed empty search', async () => {
        const { result } = await run({ [absolute('a.ts')]: 'nothing\n' }, { regex: 'needle' });
        assert.strictEqual(result.text, 'No matches found');
        assert.strictEqual(result.noMatches, true);
        assert.strictEqual(result.matches, 0);
        assert.strictEqual(result.limitReached, undefined);
    });

    test('returns a message instead of throwing for an invalid regex', async () => {
        const { result } = await run({ [absolute('a.ts')]: 'x\n' }, { regex: '(' });
        assert.strictEqual(result.invalidRegex, true);
        assert.ok(result.text.startsWith('Invalid regex:'));
        assert.strictEqual(result.noMatches, false);
    });

    test('returns a message when discovery fails', async () => {
        const failing = new WorkspaceTextSearch(
            new WorkspaceIgnoreFileCache(createCatalogHost([folder('project', ROOT)], {}), 0),
            {
                ...createSearchHost({ [absolute('a.ts')]: 'x\n' }),
                findFiles: async () => { throw new Error('disk on fire'); }
            }
        );
        const result = await failing.search({ regex: 'x' });
        assert.ok(result.text.startsWith('Search failed:'));
        assert.strictEqual(result.matches, 0);
    });

    test('stops on an already cancelled token', async () => {
        const { search } = harness({ [absolute('a.ts')]: 'needle\n' });
        const result = await search.search({ regex: 'needle' }, token(true));
        assert.strictEqual(result.text, 'Search was cancelled.');
        assert.strictEqual(result.matches, 0);
    });

    test('stops through the isCancelled callback used by the Stop button', async () => {
        const { search } = harness({ [absolute('a.ts')]: 'needle\n' });
        const result = await search.search({ regex: 'needle' }, undefined, () => true);
        assert.strictEqual(result.text, 'Search was cancelled.');
    });

    test('does not throw when the callback is absent', async () => {
        const { search } = harness({ [absolute('a.ts')]: 'needle\n' });
        const result = await search.search({ regex: 'needle' });
        assert.strictEqual(result.matches, 1);
    });
});

suite('Workspace Text Search ignore files', () => {
    test('does not search a gitignored file', async () => {
        const { result } = await run(
            { [absolute('dist/bundle.js')]: 'needle\n', [absolute('src/a.ts')]: 'needle\n' },
            { regex: 'needle' },
            { ignoreFiles: { [absolute('.gitignore')]: 'dist/\n' } }
        );
        assert.strictEqual(result.matches, 1);
        assert.ok(result.text.includes('src/a.ts:1: needle'));
        assert.strictEqual(result.candidateFiles, 1);
    });

    test('scopes a nested ignore file to its own subtree', async () => {
        const { result } = await run(
            { [absolute('docs/generated.md')]: 'needle\n', [absolute('src/generated.md')]: 'needle\n' },
            { regex: 'needle' },
            { ignoreFiles: { [absolute('docs/.gitignore')]: 'generated.md\n' } }
        );
        assert.strictEqual(result.matches, 1);
        assert.ok(result.text.includes('src/generated.md'));
    });

    test('applies each workspace folder its own ignore files', async () => {
        const first = folder('frontend', path.resolve('/workspace/frontend'), 0);
        const second = folder('backend', path.resolve('/workspace/backend'), 1);
        const { result } = await run(
            {
                [absolute('generated.ts', first.uri.fsPath)]: 'needle\n',
                [absolute('generated.ts', second.uri.fsPath)]: 'needle\n'
            },
            { regex: 'needle' },
            { roots: [first, second], ignoreFiles: { [absolute('.gitignore', second.uri.fsPath)]: 'generated.ts\n' } }
        );
        assert.strictEqual(result.matches, 1);
        assert.ok(result.text.includes('frontend/generated.ts'));
    });
});

suite('Workspace Text Search unsaved documents', () => {
    test('searches the in-memory text of a dirty document', async () => {
        const file = absolute('open.ts');
        const { result } = await run(
            { [file]: 'stale disk content\n' },
            { regex: 'fresh' },
            { dirty: { [file]: 'fresh in memory\n' } }
        );
        assert.strictEqual(result.matches, 1);
        assert.ok(result.text.includes('open.ts:1: fresh in memory'));
    });

    test('ignores the on-disk content of a dirty document', async () => {
        const file = absolute('open.ts');
        const { result } = await run(
            { [file]: 'disk-only needle\n' },
            { regex: 'disk-only' },
            { dirty: { [file]: 'replaced\n' } }
        );
        assert.strictEqual(result.matches, 0);
    });

    test('reads the disk content of a document that is open but not dirty', async () => {
        const file = absolute('clean.ts');
        const { result } = await run(
            { [file]: 'disk needle\n' },
            { regex: 'needle' },
            { openClean: [file] }
        );
        assert.strictEqual(result.matches, 1);
        assert.ok(result.text.includes('clean.ts:1: disk needle'));
    });
});

// createWorkspaceFileCatalogHost is the production host of the ignore cache; the
// suite always injects a fake instead (this reference keeps the import honest
// and documents that the default is never evaluated in tests).
void createWorkspaceFileCatalogHost;
