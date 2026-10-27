/// <reference types="mocha" />
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { suite, suiteSetup, suiteTeardown, test } from 'mocha';
import {
    createWorkspaceFileExclude,
    createWorkspaceFileSearchPattern,
    createWorkspaceIgnoreRules,
    escapeFileSearchGlob,
    matchesWorkspaceFileQuery,
    rankWorkspaceFiles,
    WorkspaceFileCatalog,
    WorkspaceFileCatalogHost,
    WorkspaceFileList
} from '../../services/workspace-file-catalog';

const folder = (name: string, root: string): vscode.WorkspaceFolder => ({
    name,
    index: 0,
    uri: vscode.Uri.file(root)
});

const configuration = (exclude: Record<string, unknown> = {}): vscode.WorkspaceConfiguration => ({
    get: <T>(section: string, defaultValue?: T) => section === 'exclude' ? exclude as T : defaultValue as T
} as unknown as vscode.WorkspaceConfiguration);

const token = (): vscode.CancellationToken => new vscode.CancellationTokenSource().token;

const createHost = (
    roots: vscode.WorkspaceFolder[],
    paths: string[],
    calls: Array<{ include: vscode.GlobPattern; maxResults?: number }> = [],
    ignoreFiles: Record<string, string> = {}
): WorkspaceFileCatalogHost => ({
    workspaceFolders: roots,
    findFiles: async (include, _exclude, maxResults) => {
        calls.push({ include, maxResults });
        // Ignore-file discovery is just another findFiles call, so answer it
        // from the supplied map instead of touching a real filesystem. The
        // match is exact: "**/.ignore" must not answer for ".ragignore".
        const pattern = String(include);
        if (pattern.startsWith('**/.')) {
            return Object.keys(ignoreFiles)
                .filter(file => pattern === '**/' + path.posix.basename(file))
                .map(file => vscode.Uri.file(file));
        }
        const limit = maxResults ?? paths.length;
        return paths.slice(0, limit).map(file => vscode.Uri.file(file));
    },
    readFile: async uri => Buffer.from(ignoreFiles[uri.fsPath] ?? '', 'utf8'),
    getConfiguration: () => configuration(),
    asRelativePath: uri => {
        const file = typeof uri === 'string' ? uri : uri.fsPath;
        const owner = roots.find(root => file.startsWith(root.uri.fsPath + path.sep));
        if (!owner) return file;
        const relative = path.relative(owner.uri.fsPath, file);
        return roots.length > 1 ? `${owner.name}/${relative}` : relative;
    }
});

suite('Workspace File Catalog', () => {
    test('does not search or require a RAG index when no workspace is open', async () => {
        let findCalls = 0;
        const catalog = new WorkspaceFileCatalog({
            workspaceFolders: undefined,
            findFiles: async () => {
                findCalls++;
                return [];
            },
            readFile: async () => new Uint8Array(),
            getConfiguration: () => configuration(),
            asRelativePath: value => String(value)
        });

        const result = await catalog.search('', token());
        assert.strictEqual(findCalls, 0);
        assert.strictEqual(result.workspaceEmpty, true);
        assert.deepStrictEqual(result.files, []);
    });

    test('discovers metadata independently of ChatContext and preserves attachment paths', async () => {
        const root = folder('project', path.resolve('/workspace/project'));
        const absolute = path.join(root.uri.fsPath, 'src', 'AgentView.tsx');
        const calls: Array<{ include: vscode.GlobPattern; maxResults?: number }> = [];
        const catalog = new WorkspaceFileCatalog(createHost([root], [absolute], calls), 10);

        const result = await catalog.search('agentview', token());
        // One search for the files, then one per ignore-file name. The first
        // call is the search that must never consult the RAG index.
        assert.strictEqual(calls[0].include, createWorkspaceFileSearchPattern('agentview'));
        assert.deepStrictEqual(calls.slice(1).map(call => call.include), ['**/.gitignore', '**/.ignore']);
        assert.deepStrictEqual(result.files, [`AgentView.tsx | ${absolute}`]);
        assert.strictEqual(result.fileDetails[result.files[0]], 'src/AgentView.tsx');
        assert.strictEqual(result.truncated, false);
    });

    test('uses workspace-folder-qualified paths in multi-root workspaces and deduplicates URIs', async () => {
        const first = folder('frontend', path.resolve('/workspace/frontend'));
        const second = folder('backend', path.resolve('/workspace/backend'));
        const one = path.join(first.uri.fsPath, 'src', 'index.ts');
        const two = path.join(second.uri.fsPath, 'src', 'index.ts');
        const catalog = new WorkspaceFileCatalog(createHost([first, second], [one, two, one]), 10);

        const result = await catalog.search('', token());
        assert.strictEqual(result.files.length, 2);
        assert.deepStrictEqual(Object.values(result.fileDetails).sort(), ['backend/src/index.ts', 'frontend/src/index.ts']);
    });

    test('matches every query term against basename and path, case-insensitively', () => {
        assert.strictEqual(matchesWorkspaceFileQuery('AgentView.tsx', 'ui/components/agent/AgentView.tsx', 'COMPONENTS agent'), true);
        assert.strictEqual(matchesWorkspaceFileQuery('AgentView.tsx', 'ui/components/agent/AgentView.tsx', 'components missing'), false);
        assert.strictEqual(matchesWorkspaceFileQuery('literal[1]*?.ts', 'src/literal[1]*?.ts', '[1]*?'), true);
    });

    test('escapes glob operators and makes alphabetic search terms case-insensitive', () => {
        assert.strictEqual(escapeFileSearchGlob('a*?[x]{y}'), '[aA][*][?][[][xX][]][{][yY][}]');
        assert.strictEqual(createWorkspaceFileSearchPattern(''), '**/*');
        assert.ok(createWorkspaceFileSearchPattern('src').includes('[sS][rR][cC]'));
        assert.ok(createWorkspaceFileSearchPattern('src\\agent').includes('[sS][rR][cC]/[aA][gG][eE][nN][tT]'));
    });

    test('ranks exact and basename matches before path matches without changing raw identity', () => {
        const files = [
            { name: 'other.ts', relativePath: 'src/agent/other.ts' },
            { name: 'agent-helper.ts', relativePath: 'src/agent-helper.ts' },
            { name: 'agent.ts', relativePath: 'z/agent.ts' },
            { name: 'Agent.ts', relativePath: 'a/Agent.ts' }
        ];
        const ranked = rankWorkspaceFiles(files, 'agent');
        assert.deepStrictEqual(ranked.map(file => file.relativePath), [
            'a/Agent.ts',
            'src/agent-helper.ts',
            'z/agent.ts',
            'src/agent/other.ts'
        ]);
    });

    test('reports a capped result set as truncated', async () => {
        const root = folder('project', path.resolve('/workspace/project'));
        const paths = ['a.ts', 'b.ts', 'c.ts'].map(name => path.join(root.uri.fsPath, name));
        const catalog = new WorkspaceFileCatalog(createHost([root], paths), 2);
        const result = await catalog.search('', token());
        assert.strictEqual(result.files.length, 2);
        assert.strictEqual(result.truncated, true);
    });

    test('returns no candidates when discovery is cancelled', async () => {
        const root = folder('project', path.resolve('/workspace/project'));
        const cancellation = new vscode.CancellationTokenSource();
        cancellation.cancel();
        const catalog = new WorkspaceFileCatalog(createHost([root], [path.join(root.uri.fsPath, 'a.ts')]), 10);
        const result = await catalog.search('', cancellation.token);
        assert.deepStrictEqual(result.files, []);
        assert.strictEqual(result.truncated, false);
    });

    test('merges standard excludes without using RAG ignore settings', () => {
        const exclude = createWorkspaceFileExclude(
            { '**/dist/**': true, '**/conditional/**': { when: '$(basename).ts' }, '**/visible/**': false },
            { '**/coverage/**': true }
        );
        assert.ok(exclude.includes('**/node_modules/**'));
        assert.ok(exclude.includes('**/.git/**'));
        assert.ok(exclude.includes('**/dist/**'));
        assert.ok(exclude.includes('**/conditional/**'));
        assert.ok(exclude.includes('**/coverage/**'));
        assert.ok(!exclude.includes('**/visible/**'));
        assert.ok(!exclude.includes('.ragignore'));
    });
});

suite('Workspace File Catalog ignore rules', () => {
    const root = folder('project', path.resolve('/workspace/project'));
    const absolute = (relative: string) => path.join(root.uri.fsPath, relative);

    const search = async (
        query: string,
        ignoreFiles: Record<string, string>,
        paths: string[] = []
    ): Promise<WorkspaceFileList> => {
        const catalog = new WorkspaceFileCatalog(createHost([root], paths, [], ignoreFiles), 100);
        return catalog.search(query, token());
    };

    test('hides ignored files from the unfiltered list', async () => {
        const paths = [
            absolute('src/AgentView.tsx'),
            absolute('dist/bundle.js'),
            absolute('debug.log'),
            absolute('keep.log'),
            absolute('docs/agent.md')
        ];
        const result = await search('', {
            [absolute('.gitignore')]: 'dist/\n*.log\n!keep.log\n',
            [absolute('docs/.gitignore')]: 'agent.md\n'
        }, paths);

        assert.deepStrictEqual(Object.values(result.fileDetails).sort(), ['keep.log', 'src/AgentView.tsx']);
    });

    test('keeps a file that a nested ignore file re-includes', async () => {
        const result = await search('', {
            [absolute('.gitignore')]: 'dist/*\n!dist/keep.ts\n',
            [absolute('dist/.gitignore')]: ''
        }, [absolute('dist/bundle.js'), absolute('dist/keep.ts')]);

        assert.deepStrictEqual(Object.values(result.fileDetails), ['dist/keep.ts']);
    });

    test('hides files below a folder that is ignored without a trailing slash', async () => {
        const result = await search('', {
            [absolute('.gitignore')]: 'build\nout/*\n'
        }, [
            absolute('build/a/b/c.js'),
            absolute('out/generated.js'),
            absolute('src/kept.ts')
        ]);

        assert.deepStrictEqual(Object.values(result.fileDetails).sort(), ['src/kept.ts']);
    });

    test('keeps ignored files out of typed searches as well', async () => {
        const result = await search('bundle', {
            [absolute('.gitignore')]: 'dist/\n'
        }, [absolute('dist/bundle.js')]);

        // The picker mirrors the Explorer; its "Choose file..." action is the
        // way to attach a file that an ignore file hides.
        assert.deepStrictEqual(result.files, []);
    });

    test('applies each workspace folder its own ignore files', async () => {
        const frontend = folder('frontend', path.resolve('/workspace/frontend'));
        const backend = folder('backend', path.resolve('/workspace/backend'));
        const frontendFile = path.join(frontend.uri.fsPath, 'generated.ts');
        const backendFile = path.join(backend.uri.fsPath, 'generated.ts');
        const catalog = new WorkspaceFileCatalog(createHost(
            [frontend, backend],
            [frontendFile, backendFile],
            [],
            { [path.join(backend.uri.fsPath, '.gitignore')]: 'generated.ts\n' }
        ), 100);

        const result = await catalog.search('', token());
        assert.deepStrictEqual(Object.values(result.fileDetails), ['frontend/generated.ts']);
    });

    test('matches gitignore globs, anchoring and folder rules', () => {
        const rules = createWorkspaceIgnoreRules([
            { absolutePath: absolute('.gitignore'), content: '/root-only\n**/anywhere\nsrc/*.tmp\nsrc/temp/\n' }
        ], [root.uri.fsPath]);

        assert.strictEqual(rules.ignores(absolute('root-only')), true);
        assert.strictEqual(rules.ignores(absolute('root-only/file.ts')), true);
        assert.strictEqual(rules.ignores(absolute('sub/root-only/file.ts')), false);
        assert.strictEqual(rules.ignores(absolute('deep/anywhere/x.ts')), true);
        assert.strictEqual(rules.ignores(absolute('src/generated.tmp')), true);
        assert.strictEqual(rules.ignores(absolute('src/nested/generated.tmp')), false);
        assert.strictEqual(rules.ignores(absolute('src/temp/a.ts')), true);
        assert.strictEqual(rules.ignores(absolute('src/temp/sub/b.ts')), true);
        assert.strictEqual(rules.ignores(absolute('src/kept.ts')), false);
        // Files outside the workspace are never hidden by these rules.
        assert.strictEqual(rules.ignores(path.resolve('/elsewhere/src/temp/a.ts')), false);
    });

    test('scopes a nested ignore file to its own folder', () => {
        const rules = createWorkspaceIgnoreRules([
            { absolutePath: absolute('docs/.gitignore'), content: 'generated.md\n' }
        ], [root.uri.fsPath]);

        assert.strictEqual(rules.ignores(absolute('docs/generated.md')), true);
        assert.strictEqual(rules.ignores(absolute('docs/deep/generated.md')), true);
        assert.strictEqual(rules.ignores(absolute('src/generated.md')), false);
    });

    test('leaves the workspace untouched when no ignore files exist', async () => {
        const result = await search('', {}, [absolute('a.ts'), absolute('src/b.ts')]);
        assert.deepStrictEqual(Object.values(result.fileDetails).sort(), ['a.ts', 'src/b.ts']);
    });

    test('re-reads ignore files once the cache expires', async () => {
        const ignorePath = absolute('.gitignore');
        const ignoreFiles: Record<string, string> = { [ignorePath]: 'a.ts\n' };
        const files = [absolute('a.ts'), absolute('b.ts')];
        const catalog = new WorkspaceFileCatalog(createHost([root], files, [], ignoreFiles), 100, 0);

        assert.deepStrictEqual(Object.values((await catalog.search('', token())).fileDetails), ['b.ts']);
        ignoreFiles[ignorePath] = 'b.ts\n';
        assert.deepStrictEqual(Object.values((await catalog.search('', token())).fileDetails), ['a.ts']);
    });

    test('ignores unsupported ignore files that the settings never opted into', async () => {
        // RAG's rag_ignore_file stays independent: only real ignore files apply.
        const result = await search('', {
            [absolute('.ragignore')]: 'a.ts\n'
        }, [absolute('a.ts'), absolute('.ragignore')]);

        assert.deepStrictEqual(Object.values(result.fileDetails).sort(), ['.ragignore', 'a.ts']);
    });
});

suite('Workspace File Catalog VS Code filesystem search', () => {
    const fixtureDirectory = 'llama-file-catalog-test-fixture';
    let root = '';
    let fixtureRoot = '';
    let ownsFixture = false;
    let host: WorkspaceFileCatalogHost;

    // workspace.findFiles reads VS Code's own file index, which is built at
    // startup and then updated asynchronously, so files written by this suite
    // are not guaranteed to be visible. Statement-level tests above cover the
    // search-pattern behaviour; these tests only run where the index already
    // knows the fixture (a dedicated runner can supply
    // LLAMA_FILE_CATALOG_TEST_ROOT with a pre-indexed folder).
    const requireIndexedFixture = (context: Mocha.Context): void => {
        if (process.env.LLAMA_FILE_CATALOG_TEST_ROOT) return;
        context.skip();
    };

    const write = (relative: string) => {
        const absolute = path.join(fixtureRoot, relative);
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, `// ${relative}\n`);
    };

    const find = async (query: string, excludes = '{}'): Promise<string[]> => {
        const uris = await vscode.workspace.findFiles(
            createWorkspaceFileSearchPattern(query),
            excludes,
            100,
            token()
        );
        return uris.map(uri => path.relative(root, uri.fsPath).replace(/\\/g, '/')).sort();
    };

    suiteSetup(() => {
        // findFiles intentionally searches only workspace folders. A dedicated
        // runner opens the supplied temporary directory; normal suite runs can
        // still execute these tests against the repository itself.
        root = process.env.LLAMA_FILE_CATALOG_TEST_ROOT
            || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            || fs.mkdtempSync(path.join(os.tmpdir(), 'llama-file-catalog-'));
        ownsFixture = !process.env.LLAMA_FILE_CATALOG_TEST_ROOT && !vscode.workspace.workspaceFolders?.[0];
        if (!root) throw new Error('A workspace is required for findFiles integration tests');
        fixtureRoot = path.join(root, fixtureDirectory);
        write('src/components/CatalogAgentViewMarker.tsx');
        write('src/components/CatalogOtherMarker.ts');
        write('src/CatalogAgentHelperMarker.ts');
        write('src/literal[1]*?.ts');
        write('docs/readme.md');
        write('node_modules/pkg/crowded.ts');
        write('rag-hidden.ts');
        write('.ragignore');
        const workspaceRoot = folder('catalog-fixture', root);
        host = {
            workspaceFolders: [workspaceRoot],
            findFiles: (...args) => vscode.workspace.findFiles(...args),
            readFile: uri => vscode.workspace.fs.readFile(uri),
            getConfiguration: section => section === 'files'
                ? configuration({ '**/.git/**': true })
                : configuration({ '**/docs/**': true }),
            asRelativePath: uri => path.relative(root, typeof uri === 'string' ? uri : uri.fsPath)
        };
    });

    suiteTeardown(() => {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
        if (ownsFixture) fs.rmSync(root, { recursive: true, force: true });
    });

    test('finds mixed-case basenames', async function (this: Mocha.Context) {
        requireIndexedFixture(this);
        assert.deepStrictEqual(await find('catalogagentviewmarker'), [`${fixtureDirectory}/src/components/CatalogAgentViewMarker.tsx`]);
        assert.deepStrictEqual(await find('CATALOGAGENTHELPERMARKER'), [`${fixtureDirectory}/src/CatalogAgentHelperMarker.ts`]);
    });

    test('finds files below a directory-only query', async function (this: Mocha.Context) {
        requireIndexedFixture(this);
        const result = await find(`${fixtureDirectory}/src/components`);
        assert.deepStrictEqual(result, [
            `${fixtureDirectory}/src/components/CatalogAgentViewMarker.tsx`,
            `${fixtureDirectory}/src/components/CatalogOtherMarker.ts`
        ]);
    });

    test('treats glob characters literally', async function (this: Mocha.Context) {
        requireIndexedFixture(this);
        assert.deepStrictEqual(await find('[1]*?'), ['src/literal[1]*?.ts']);
    });

    test('honors merged standard excludes but not rag_ignore_file', async function (this: Mocha.Context) {
        requireIndexedFixture(this);
        const catalog = new WorkspaceFileCatalog(host, 20);
        const result = await catalog.search(fixtureDirectory, token());
        const relative = Object.values(result.fileDetails).sort();
        assert.ok(relative.includes(`${fixtureDirectory}/src/components/CatalogAgentViewMarker.tsx`));
        assert.ok(relative.includes(`${fixtureDirectory}/rag-hidden.ts`));
        assert.ok(relative.includes(`${fixtureDirectory}/.ragignore`));
        assert.ok(!relative.includes(`${fixtureDirectory}/docs/readme.md`));
        assert.ok(!relative.includes(`${fixtureDirectory}/node_modules/pkg/crowded.ts`));
    });
});
