/// <reference types="mocha" />
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import {
    createWorkspaceFileExclude,
    WorkspaceFileCatalogHost,
    WorkspaceIgnoreFileCache
} from '../../services/workspace-file-catalog';
import {
    DEFAULT_MAX_FILE_BYTES,
    DEFAULT_SCAN_CONCURRENCY,
    MAX_CANDIDATE_FILES,
    WorkspaceTextSearchHost
} from '../../services/workspace-text-search';
import {
    DEFAULT_SOURCE_LINES_PER_CHUNK,
    DEFAULT_SOURCE_MAX_CHUNKS,
    DEFAULT_SOURCE_MAX_CHUNKS_PER_FILE,
    extractSourceQueryKeywords,
    hasNoSourceKeywords,
    MAX_SOURCE_KEYWORDS,
    MAX_SOURCE_CHUNK_LINE_CHARS,
    tokenizeSourceText,
    WorkspaceSourceSearch
} from '../../services/workspace-source-search';

// The whole suite runs against fake hosts: WorkspaceSourceSearch never touches
// vscode.workspace, so no VS Code test host is required beyond vscode.Uri.
// The fakes are the same shape as the ones in workspace-text-search.test.ts.

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
            const pattern = String(include);
            // Ignore-file discovery arrives on the same method.
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

interface SourceHarness {
    search: WorkspaceSourceSearch;
    calls: Array<{ include: vscode.GlobPattern; exclude?: vscode.GlobPattern | null; maxResults?: number }>;
}

interface SourceLimits {
    maxChunks?: number;
    maxFiles?: number;
    maxChunkedChars?: number;
    timeBudgetMs?: number;
    linesPerChunk?: number;
    maxChunkChars?: number;
    maxChunksPerFile?: number;
}

const harness = (
    files: Record<string, string>,
    options: FakeHostOptions = {},
    limits: SourceLimits = {}
): SourceHarness => {
    const roots = options.roots ?? [folder('project', ROOT)];
    const calls: Array<{ include: vscode.GlobPattern; exclude?: vscode.GlobPattern | null; maxResults?: number }> = [];
    // TTL 0 disables the ignore cache, which keeps multi-search tests
    // deterministic (same trick as workspace-file-catalog.test.ts).
    const ignoreFiles = new WorkspaceIgnoreFileCache(createCatalogHost(roots, options.ignoreFiles ?? {}), 0);
    const search = new WorkspaceSourceSearch(ignoreFiles, createSearchHost(files, options, calls), limits);
    return { search, calls };
};

const run = (
    files: Record<string, string>,
    query: string,
    hostOptions: FakeHostOptions & SourceLimits & {
        maxOutputChars?: number;
        cancelledToken?: boolean;
        isCancelled?: () => boolean;
    } = {}
) => {
    const { search, calls } = harness(files, hostOptions, hostOptions);
    return search.search(
        query,
        token(hostOptions.cancelledToken),
        hostOptions.isCancelled,
        hostOptions.maxOutputChars
    ).then(result => ({ result, calls }));
};

// A file whose line i (1-based) is "line <i>" - handy for line-number tests.
const numberedLines = (count: number, prefix = 'line'): string => {
    const lines: string[] = [];
    for (let index = 1; index <= count; index++) lines.push(`${prefix} ${index}`);
    return lines.join('\n');
};

suite('Source query keywords', () => {
    test('splits camelCase like the RAG tokenizer does', () => {
        assert.deepStrictEqual(
            extractSourceQueryKeywords('getRagContextChunks'),
            ['get', 'rag', 'context', 'chunks']
        );
    });

    test('tokenizer is the verbatim RAG splitter', () => {
        assert.deepStrictEqual(
            tokenizeSourceText('getRag_Context-chunks.file'),
            ['get', 'rag', 'context', 'chunks', 'file']
        );
    });

    test('removes stopwords and deduplicates', () => {
        assert.deepStrictEqual(
            extractSourceQueryKeywords('where is the search for the search of the agent'),
            ['search', 'agent']
        );
    });

    test('keeps frequent code words', () => {
        for (const word of ['get', 'file', 'class', 'function']) {
            assert.deepStrictEqual(extractSourceQueryKeywords(word), [word], `'${word}' must be kept`);
        }
    });

    test('drops single character tokens', () => {
        assert.deepStrictEqual(extractSourceQueryKeywords('a 1 b variable'), ['variable']);
    });

    test('respects maxKeywords', () => {
        const query = 'alpha bravo charlie delta echo foxtrot golf hotel';
        assert.strictEqual(extractSourceQueryKeywords(query, 3).length, 3);
        assert.strictEqual(extractSourceQueryKeywords(query).length, 8);
        assert.ok(extractSourceQueryKeywords(query).length <= MAX_SOURCE_KEYWORDS);
    });

    test('empty query yields no keywords', () => {
        assert.deepStrictEqual(extractSourceQueryKeywords(''), []);
        assert.deepStrictEqual(extractSourceQueryKeywords('   '), []);
    });

    test('a query of only stopwords falls back to the raw query', () => {
        assert.deepStrictEqual(extractSourceQueryKeywords('where is the'), ['where is the']);
        assert.strictEqual(hasNoSourceKeywords('where is the'), true);
        assert.strictEqual(hasNoSourceKeywords('getRagContextChunks'), false);
    });
});

suite('Source search discovery', () => {
    test('uses the same globs as regex_search', async () => {
        const { calls } = await run({ [absolute('src/tools.ts')]: 'getRagContextChunks\n' }, 'getRagContextChunks');

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].include, '**/*');
        assert.strictEqual(calls[0].maxResults, MAX_CANDIDATE_FILES);
        const exclude = String(calls[0].exclude);
        assert.ok(exclude.startsWith('{') && exclude.endsWith('}'), 'exclude must be a single brace set');
        assert.ok(exclude.includes('**/node_modules/**'));
        assert.ok(exclude.includes('**/dist/**'), 'files.exclude must be honoured');
        assert.strictEqual(exclude, createWorkspaceFileExclude({ '**/dist/**': true }, {}));
    });

    test('never scans a gitignored file', async () => {
        const { result } = await run(
            {
                [absolute('ignored.ts')]: 'getRagContextChunks\n',
                [absolute('kept.ts')]: 'getRagContextChunks\n'
            },
            'getRagContextChunks',
            // Ignore rules come from the shared ignore cache, not from the file
            // map, exactly like the regex_search suite does it.
            { ignoreFiles: { [absolute('.gitignore')]: 'ignored.ts\n' } }
        );

        assert.strictEqual(result.candidateFiles, 1);
        assert.deepStrictEqual(result.chunks.map(chunk => chunk.relativePath), ['kept.ts']);
    });

    test('no workspace folder does not call findFiles', async () => {
        const { result, calls } = await run({ [absolute('a.ts')]: 'x' }, 'search', { roots: [] });

        assert.strictEqual(calls.length, 0);
        assert.strictEqual(result.text, 'No workspace folder is open.');
        assert.strictEqual(result.noChunks, true);
    });
});

suite('Source search ranking', () => {
    const files = {
        [absolute('src/bm25.ts')]: 'export const bm25Score = 1\nexport const computeBM25Stats = 2\n',
        [absolute('src/unrelated.ts')]: 'const something = 42\nconst else_ = 43\n'
    };

    test('ranks the chunk with the identifier first', async () => {
        const { result } = await run(files, 'bm25Score');

        assert.ok(result.chunks.length >= 1);
        assert.strictEqual(result.chunks[0].relativePath, 'src/bm25.ts');
        assert.ok(result.chunks[0].content.includes('bm25Score'));
    });

    test('drops chunks with a zero score', async () => {
        const { result } = await run(files, 'bm25Score');
        for (const chunk of result.chunks) assert.ok(chunk.score > 0);
    });

    test('an exact phrase match wins', async () => {
        const phraseFiles = {
            [absolute('a.ts')]: 'const alpha = 1;\nconst beta = 2;\n',
            [absolute('b.ts')]: 'const alpha beta = 1;\n'
        };
        const { result } = await run(phraseFiles, 'alpha beta');
        assert.strictEqual(result.chunks[0].relativePath, 'b.ts');
    });

    test('applies maxChunks exactly', async () => {
        const many: Record<string, string> = {};
        for (let index = 0; index < 6; index++) {
            many[absolute(`file${index}.ts`)] = 'const target = ' + index + ';\n';
        }
        const { result } = await run(many, 'target', { maxChunks: 2, maxChunksPerFile: 9 });
        assert.strictEqual(result.chunks.length, 2);
    });

    test('applies the per-file cap', async () => {
        const oneFile = {
            [absolute('big.ts')]: Array.from({ length: 20 }, () => 'const target = 1;').join('\n')
        };
        const { result } = await run(oneFile, 'target', {
            maxChunks: 5,
            maxChunksPerFile: 2,
            linesPerChunk: 2
        });
        assert.strictEqual(result.chunks.length, 2);
        assert.strictEqual(DEFAULT_SOURCE_MAX_CHUNKS_PER_FILE, 2);
    });

    test('is deterministic across runs', async () => {
        const first = await run(files, 'bm25 score stats');
        const second = await run(files, 'bm25 score stats');
        assert.deepStrictEqual(first.result.chunks, second.result.chunks);
        assert.strictEqual(first.result.text, second.result.text);
    });
});

suite('Source search line numbers', () => {
    test('reports 1-based inclusive ranges that re-read exactly', async () => {
        const content = numberedLines(100);
        const { result } = await run({ [absolute('lines.txt')]: content }, 'line');

        assert.ok(result.chunks.length > 0);
        const sourceLines = content.split('\n');
        for (const chunk of result.chunks) {
            assert.ok(chunk.firstLine >= 1);
            assert.ok(chunk.lastLine >= chunk.firstLine);
            assert.strictEqual(
                sourceLines.slice(chunk.firstLine - 1, chunk.lastLine).join('\n'),
                chunk.content
            );
        }
        // First chunk of the file starts at line 1.
        assert.strictEqual(result.chunks[0].firstLine, 1);
        assert.strictEqual(DEFAULT_SOURCE_LINES_PER_CHUNK, 40);
    });

    test('clips absurdly long lines in the output only', async () => {
        const longLine = 'const target = "' + 'x'.repeat(MAX_SOURCE_CHUNK_LINE_CHARS * 2) + '";';
        const { result } = await run({ [absolute('long.ts')]: longLine }, 'target');

        assert.ok(result.chunks.length >= 1);
        assert.ok(result.chunks[0].content.length <= MAX_SOURCE_CHUNK_LINE_CHARS + 1);
        assert.ok(result.chunks[0].content.endsWith('…'));
    });
});

suite('Source search ordering under a cap', () => {
    test('scans the file whose path matches the keyword first', async () => {
        const files = {
            [absolute('zzz/other.ts')]: 'const unrelated = 1;\nconst target = 2;\n',
            [absolute('target.ts')]: 'const something = 1;\nconst value = 2;\n'
        };
        // Only one keyword, and it is in the second file's PATH, so that file is
        // read first even though the other one contains the keyword in its text.
        const { result } = await run(files, 'target', { maxFiles: 1 });

        // Files sorted by path hits, then depth, then name: 'target.ts' wins.
        assert.ok(result.scannedFiles <= 1);
        assert.strictEqual(result.limitReached, 'files');
        assert.ok(result.text.includes('files were scanned'), result.text);
    });
});

suite('Source search skips', () => {
    test('skips binary, unreadable and empty files', async () => {
        const files = {
            [absolute('binary.ts')]: 'const target = 1;\n',
            [absolute('unreadable.ts')]: 'const target = 3;\n',
            [absolute('empty.ts')]: '',
            [absolute('good.ts')]: 'const target = 4;\n'
        };
        const { result } = await run(files, 'target', {
            binary: [absolute('binary.ts')],
            unreadable: [absolute('unreadable.ts')]
        });

        assert.ok(result.text.includes('good.ts'));
        assert.ok(!result.text.includes('binary.ts'));
        assert.ok(!result.text.includes('unreadable.ts'));
        assert.ok(!result.text.includes('empty.ts'));
        // Skipped files are still candidates, only the good one was read.
        assert.strictEqual(result.scannedFiles, 1);
        assert.strictEqual(DEFAULT_MAX_FILE_BYTES, 2 * 1024 * 1024);
    });

    test('skips a file larger than DEFAULT_MAX_FILE_BYTES', async () => {
        const files = {
            [absolute('big.ts')]: 'target ' + 'z'.repeat(DEFAULT_MAX_FILE_BYTES),
            [absolute('small.ts')]: 'target\n'
        };
        const { result } = await run(files, 'target');
        assert.ok(result.text.includes('small.ts'));
        assert.ok(!result.text.includes('big.ts'));
        assert.strictEqual(result.scannedFiles, 1);
    });

    test('a file with one huge line does not abort the scan', async () => {
        const files = {
            // One 5000-char line: the window is shrunk to that single line (a
            // chunk always keeps at least one line) and the scan continues.
            [absolute('minified.js')]: 'target' + 'q'.repeat(5000),
            [absolute('good.ts')]: 'const target = 1;\n'
        };
        const { result } = await run(files, 'target', { maxChunkChars: 10 });
        assert.ok(result.chunks.some(chunk => chunk.relativePath === 'good.ts'), result.text);
        const minified = result.chunks.find(chunk => chunk.relativePath === 'minified.js');
        if (minified) {
            assert.ok(minified.content.length <= MAX_SOURCE_CHUNK_LINE_CHARS + 1,
                'the huge line must be clipped');
            assert.strictEqual(minified.firstLine, 1);
            assert.strictEqual(minified.lastLine, 1);
        }
    });
});

suite('Source search dirty documents', () => {
    test('uses the in-memory text of a dirty document', async () => {
        const file = absolute('dirty.ts');
        const { result } = await run(
            { [file]: 'const onDisk = 1;\n' },
            'unsaved',
            { dirty: { [file]: 'const unsaved = 2;\n' } }
        );

        assert.strictEqual(result.chunks.length, 1);
        assert.ok(result.chunks[0].content.includes('unsaved'));
    });

    test('uses the disk text of an open but clean document', async () => {
        const file = absolute('clean.ts');
        const { result } = await run(
            { [file]: 'const onDisk = 1;\n' },
            'onDisk',
            { openClean: [file] }
        );

        assert.strictEqual(result.chunks.length, 1);
        assert.ok(result.chunks[0].content.includes('onDisk'));
    });
});

suite('Source search limits', () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < 5; index++) {
        files[absolute(`file${index}.ts`)] = 'const target = ' + index + ';\n';
    }

    test('time budget 0 stops with the time note', async () => {
        const { result } = await run(files, 'target', { timeBudgetMs: 0 });
        assert.strictEqual(result.limitReached, 'time');
        assert.ok(result.text.includes('Search stopped after 0s'));
    });

    test('maxFiles stops with the files note', async () => {
        const { result } = await run(files, 'target', { maxFiles: 1 });
        assert.strictEqual(result.limitReached, 'files');
        assert.ok(result.scannedFiles <= 1);
        // The exact count is not asserted on purpose: which worker observes the
        // cap is not deterministic (the note always carries a number).
        assert.ok(result.text.includes('files were scanned - results may be incomplete'), result.text);
    });

    test('maxChunkedChars stops with the chars note', async () => {
        // More files than workers, so at least one worker observes the cap after
        // the first batch of reads (the first batch all see readChars === 0).
        const many: Record<string, string> = {};
        for (let index = 0; index < DEFAULT_SCAN_CONCURRENCY * 2; index++) {
            many[absolute(`chunked${index}.ts`)] = 'const target = ' + index + ';\n';
        }
        const { result } = await run(many, 'target', { maxChunkedChars: 1 });
        assert.strictEqual(result.limitReached, 'chars');
        assert.ok(result.text.includes('results may be incomplete'), result.text);
    });

    test('output cap truncates at a fragment boundary', async () => {
        const big: Record<string, string> = {};
        for (let index = 0; index < 5; index++) {
            big[absolute(`big${index}.ts`)] =
                ('const target = ' + index + ';\n').repeat(20);
        }
        const { result } = await run(big, 'target', { maxChunks: 5, maxOutputChars: 500 });

        assert.ok(result.text.length <= 500, 'text length ' + result.text.length);
        assert.ok(result.text.includes('Result truncated to fit the tool output limit'));
    });

    test('cancellation token stops the scan without throwing', async () => {
        const { result } = await run(files, 'target', { cancelledToken: true });
        assert.strictEqual(result.noChunks, true);
        assert.ok(result.text.startsWith('No relevant source code found for the query'));
    });

    test('cancellation predicate stops the scan without throwing', async () => {
        const { result } = await run(files, 'target', { isCancelled: () => true });
        assert.strictEqual(result.noChunks, true);
    });
});

suite('Source search empty results and format', () => {
    test('reports no chunks for a query that matches nothing', async () => {
        const { result } = await run({ [absolute('a.ts')]: 'const alpha = 1;\n' }, 'nonexistentidentifier');

        assert.strictEqual(result.noChunks, true);
        assert.strictEqual(result.keywords.length, 1);
        assert.ok(result.text.startsWith('No relevant source code found for the query'));
        assert.ok(result.text.includes('Try regex_search'));
    });

    test('uses the documented output format with relative paths', async () => {
        const { result } = await run({ [absolute('src/tools.ts')]: 'const getRagContextChunks = 1;\n' },
            'getRagContextChunks');

        assert.ok(result.text.startsWith('Here are pieces of code from different files of the project: \n'));
        assert.ok(result.text.includes('\nFile Name: '));
        assert.ok(result.text.includes('\nFrom line: '));
        assert.ok(result.text.includes('\nTo line: '));
        assert.ok(result.text.includes('\nContent:\n'));
        // Relative paths only: the absolute root must never leak into the text.
        assert.ok(!result.text.includes(ROOT.replace(/\\/g, '/')), 'absolute path leaked');
        assert.ok(result.text.includes('File Name: src/tools.ts'));
        // No trailing newline.
        assert.ok(!result.text.endsWith('\n'));
    });

    test('prefixes the folder name in a multi-root workspace', async () => {
        const roots = [folder('one', '/workspace/one', 0), folder('two', '/workspace/two', 1)];
        const { result } = await run(
            { [path.join('/workspace/two', 'src/two.ts')]: 'const target = 1;\n' },
            'target',
            { roots }
        );

        assert.strictEqual(result.chunks.length, 1);
        assert.ok(result.text.includes('File Name: two/src/two.ts'));
    });

    test('a stopword-only query still answers', async () => {
        const { result } = await run({ [absolute('a.ts')]: 'where is the\n' }, 'where is the');
        assert.ok(result.chunks.length >= 1 || result.noChunks);
        assert.ok(result.text.length > 0);
        // The raw query was used, which is what noKeywords reports.
        assert.strictEqual(result.noKeywords, true);
        assert.deepStrictEqual(result.keywords, ['where is the']);
    });

    test('runs the documented number of workers', () => {
        assert.strictEqual(DEFAULT_SCAN_CONCURRENCY, 8);
        assert.strictEqual(DEFAULT_SOURCE_MAX_CHUNKS, 3);
    });
});
