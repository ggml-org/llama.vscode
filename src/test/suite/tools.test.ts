/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { Tools } from '../../tools';
import { Application } from '../../application';
import { Utils } from '../../utils';
import { suite, test, setup, suiteSetup, suiteTeardown } from 'mocha';

// Mock the Application class for testing
class MockApplication {
    configuration = {
        MAX_CHARS_TOOL_RETURN: 10000,
        rag_enabled: false,
        tool_permit_some_terminal_commands: true,
        tool_run_terminal_command_timeout: 300,
        tool_run_terminal_command_max_chars: 5000
    };

    chatContext = {
        getRagContextChunks: (
            _prompt: string,
            options?: { skipEmbeddings?: boolean }
        ) => {
            this.ragCalls.push({ skipEmbeddings: options?.skipEmbeddings });
            return Promise.resolve([{
                content: 'RAG_CHUNK', hash: 'h', uri: '', firstLine: 1, lastLine: 1, embedding: []
            }]);
        },
        getContextChunksInPlainText: (chunks: any[]) => Promise.resolve('RAG:' + chunks.length),
        hasEmbeddingsEndpoint: () => false,
        // A Map, like the real ChatContext (entries.size is what the routing
        // rule reads). indexWorkspaceFiles is deliberately absent: a spy would
        // not prove anything, its absence is the assertion.
        entries: new Map()
    };

    // How the RAG path was called (proves skipEmbeddings is passed).
    ragCalls: Array<{ skipEmbeddings?: boolean }> = [];

    // The RAG-free fallback. `search` records how it was called.
    workspaceSourceSearch = {
        search: async (
            query: string,
            _token?: any,
            _isCancelled?: () => boolean,
            maxOutputChars?: number
        ) => {
            this.sourceSearchCalls.push({ query, maxOutputChars });
            return {
                text: 'FALLBACK',
                chunks: [],
                keywords: [],
                scannedFiles: 0,
                candidateFiles: 0,
                limitReached: undefined,
                noChunks: true,
                noKeywords: false
            };
        }
    };

    sourceSearchCalls: Array<{ query: string; maxOutputChars?: number }> = [];

    logger = {
        addEventLog: () => {}
    };

    llamaServer = {
        executeCommandWithTerminalFeedback: () => Promise.resolve({
            stdout: '', stderr: '', exitCode: 0, timedOut: false, cancelled: false
        })
    };

    git = {
        getLatestChanges: () => Promise.resolve('')
    };
}

// `readFile` refuses paths outside the workspace root(s) and the auto memory
// folder, and this host opens NO workspace folder - so without this the tool
// answers "outside all workspace folders" for the repository's own files. The
// host's `workspaceFolders` is a configurable getter (verified), so it can be
// pointed at the repository for the duration of the suite. The real host is
// unaffected: nothing outside this suite calls it.
const REPO_ROOT = path.resolve(__dirname, '../../..');
const realWorkspaceFolders = Object.getOwnPropertyDescriptor(vscode.workspace, 'workspaceFolders');
const stubWorkspaceFolders = () => {
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        configurable: true,
        get: () => [{
            uri: vscode.Uri.file(REPO_ROOT),
            name: path.basename(REPO_ROOT),
            index: 0
        }]
    });
};

// Use Mocha's suite/test syntax
suite('Tools readFile Function Test Suite', () => {
    let tools: Tools;
    let mockApp: Application;

    suiteSetup(stubWorkspaceFolders);
    suiteTeardown(() => {
        if (realWorkspaceFolders) Object.defineProperty(vscode.workspace, 'workspaceFolders', realWorkspaceFolders);
    });

    setup(() => {
        mockApp = new MockApplication() as unknown as Application;
        tools = new Tools(mockApp);
    });

    test('should read specific lines from a file', async () => {
        console.log('Starting test: should read specific lines from a file');
        
        // Mock the Utils.getAbsolutFilePath to return a valid path
        const originalGetAbsolutFilePath = Utils.getAbsolutFilePath;
        Utils.getAbsolutFilePath = (filePath: string) => {
            console.log(`Mock getAbsolutFilePath called with: ${filePath}`);
            if (filePath === 'src/menu.ts') {
                const resolvedPath = path.resolve(__dirname, '../../../src/menu.ts');
                console.log(`Resolved path: ${resolvedPath}`);
                return resolvedPath;
            }
            return '';
        };

        try {
            // Test reading lines 1-10 from menu.ts
            const args = JSON.stringify({
                file_path: 'src/menu.ts',
                first_line: 1,
                last_line_inclusive: 10
            });

            console.log(`Calling tools.readFile with args: ${args}`);
            const result = await tools.readFile(args);
            console.log(`Result length: ${result.length}`);
            console.log(`Result preview: ${result.substring(0, 200)}...`);
            
            // Verify that the result is not an error message
            assert.ok(!result.includes('Error reading file'), `Expected file content but got error: ${result}`);
            assert.ok(!result.includes('File not found'), `Expected file content but got file not found: ${result}`);
            assert.ok(!result.includes('Invalid line range'), `Expected file content but got invalid line range: ${result}`);
            
            // Verify that the result contains expected content
            assert.ok(result.length > 0, 'Expected non-empty result');
            
            // More detailed assertions
            assert.ok(result.includes('import'), 'Expected to find import statements');
            assert.ok(result.includes('export'), 'Expected to find export statements');
            
            // The content should include the class definition
            assert.ok(result.includes('class Menu') || result.includes('export class Menu'), 
                `Expected to find Menu class definition in the result. Actual content: ${result.substring(0, 500)}`);

        } finally {
            // Restore the original function
            Utils.getAbsolutFilePath = originalGetAbsolutFilePath;
        }
    });

    test('should return error for missing file path', async () => {
        const args = JSON.stringify({
            first_line: 1,
            last_line_inclusive: 10
            // file_path is missing
        });

        const result = await tools.readFile(args);
        assert.strictEqual(result, 'The file is not provided.');
    });

    test('should return error for non-existent file', async () => {
        const originalGetAbsolutFilePath = Utils.getAbsolutFilePath;
        Utils.getAbsolutFilePath = () => path.resolve(__dirname, '../../../definitely-not-present-llama-test.txt');
        try {
            const args = JSON.stringify({
                file_path: 'non-existent-file.txt',
                first_line: 1,
                last_line_inclusive: 10
            });

            const result = await tools.readFile(args);
            assert.ok(result.includes('File not found'), `Expected file not found error but got: ${result}`);
        } finally {
            Utils.getAbsolutFilePath = originalGetAbsolutFilePath;
        }
    });

    test('should return error for invalid line range', async () => {
        // Mock to return a valid path
        const originalGetAbsolutFilePath = Utils.getAbsolutFilePath;
        Utils.getAbsolutFilePath = () => path.resolve(__dirname, '../../../src/menu.ts');

        try {
            const args = JSON.stringify({
                file_path: 'src/menu.ts',
                first_line: 1000, // Invalid line number
                last_line_inclusive: 10 // Invalid range
            });

            const result = await tools.readFile(args);
            assert.strictEqual(result, 'Invalid line range');
        } finally {
            Utils.getAbsolutFilePath = originalGetAbsolutFilePath;
        }
    });

    test('should handle read entire file', async () => {
        // Mock the Utils.getAbsolutFilePath to return a valid path
        const originalGetAbsolutFilePath = Utils.getAbsolutFilePath;
        Utils.getAbsolutFilePath = (filePath: string) => {
            if (filePath === 'src/menu.ts') {
                return path.resolve(__dirname, '../../../src/menu.ts');
            }
            return '';
        };

        try {
            const args = JSON.stringify({
                file_path: 'src/menu.ts',
                should_read_entire_file: true
            });

            const result = await tools.readFile(args);
            
            // Verify that the result is the entire file content
            assert.ok(result.length > 0, 'Expected non-empty result for entire file');
            assert.ok(result.includes('class Menu'), 'Expected to find class definition in entire file');

        } finally {
            Utils.getAbsolutFilePath = originalGetAbsolutFilePath;
        }
    });

    test('debug: test individual components', async () => {
        console.log('=== DEBUG TEST ===');
        
        // Test 1: Check if Utils.getAbsolutFilePath works
        const testPath = Utils.getAbsolutFilePath('src/menu.ts');
        console.log(`Utils.getAbsolutFilePath result: ${testPath}`);
        
        // Test 2: Check if file exists
        const fs = require('fs');
        const fileExists = fs.existsSync(testPath);
        console.log(`File exists: ${fileExists}`);
        
        // Test 3: Check file content
        if (fileExists) {
            const fileContent = fs.readFileSync(testPath, 'utf8');
            console.log(`File content length: ${fileContent.length}`);
            console.log(`First 100 chars: ${fileContent.substring(0, 100)}`);
        }
        
        // Test 4: Check mock application
        console.log(`Mock app configuration:`, mockApp.configuration);
        console.log(`Mock app chatContext:`, mockApp.chatContext);
        
        assert.ok(true, 'Debug test completed');
    });
});

// A denied command now carries its reason (`Reason: <why>.`), so the agent loop
// no longer recognises a refusal by strict equality - it would log a denial as a
// successful tool call and even record the file as changed. These cases pin the
// predicate that replaced the `===` comparisons in llama-agent.ts.
suite('Tool permission denial detection', () => {
    test('a plain refusal is a refusal', () => {
        assert.strictEqual(Utils.isNoUserPermission(Utils.MSG_NO_USER_PERMISSION), true);
    });

    test('a refusal with an appended reason is still a refusal', () => {
        assert.strictEqual(
            Utils.isNoUserPermission(Utils.MSG_NO_USER_PERMISSION + ' Reason: recursive or forced delete: rm -rf.'),
            true);
    });

    test('successful tool output is not a refusal', () => {
        assert.strictEqual(Utils.isNoUserPermission('The todos are created/updated.'), false);
        assert.strictEqual(Utils.isNoUserPermission(''), false);
    });

    test('a non-string result is not a refusal', () => {
        assert.strictEqual(Utils.isNoUserPermission(undefined), false);
        assert.strictEqual(Utils.isNoUserPermission(null), false);
    });

    test('the message is only matched at the start', () => {
        // A model quoting the refusal inside its own prose must not count.
        assert.strictEqual(Utils.isNoUserPermission('The user said: ' + Utils.MSG_NO_USER_PERMISSION), false);
    });
});

// The judging model is an optional dependency: with no chat/tools model selected
// or the server down, getChatCompletion() throws. Before this suite that
// exception escaped runTerminalCommand and reached the agent loop as a 400-char
// slice of a stack trace instead of a permission decision.
suite('Terminal command judge failure handling', () => {
    // The "ask the user" path polls this state every 300 ms, so it must be
    // stubbed or confirmToolPermission throws on an undefined llamaAgent.
    const confirmationState = () => {
        let state = '';
        return {
            stub: {
                setConfirmationState: (value: string) => { state = value; },
                getConfirmationState: () => state,
                // Reached once a command is ALLOWED: the tool reads the session
                // for its abort signal and log destination.
                getCurrentToolSession: () => undefined
            },
            // Answers the pending dialog immediately, like the user clicking No.
            answerNoOnPrompt: () => { state = 'no'; }
        };
    };

    const options = (mode: string, judge: () => Promise<any>) => {
        const agent = confirmationState();
        return {
            configuration: {
                MAX_CHARS_TOOL_RETURN: 10000,
                tool_permit_some_terminal_commands: false,
                tools_permissions_mode: mode,
                tool_run_terminal_command_timeout: 300,
                tool_run_terminal_command_max_chars: 5000,
                telegram_bot_enabled: false
            },
            prompts: { SAFE_COMMAND_JUDGE: '{command}', replacePlaceholders: (p: string) => p },
            logger: { addEventLog: () => { } },
            llamaAgent: agent.stub,
            // The dialog is answered "no" as soon as it is shown, so the polling
            // loop finishes on its first tick instead of waiting for the timeout.
            dialogs: {
                showYesYesdontaskNoDialog: () => {
                    agent.answerNoOnPrompt();
                    return Promise.resolve([false, false]);
                }
            },
            llamaServer: {
                // 'echo hi > out.txt' is deliberately ambiguous: neither obviously
                // safe nor obviously dangerous, so the LLM judge IS asked.
                getChatCompletion: judge,
                executeCommandWithTerminalFeedback: () => Promise.resolve({
                    stdout: '', stderr: '', exitCode: 0, timedOut: false, cancelled: false
                })
            },
            chatContext: { entries: [], removeDocument: () => { } }
        };
    };

    const run = async (app: any) => {
        const tools = new Tools(app as unknown as Application);
        return tools.runTerminalCommand(JSON.stringify({ command: 'echo hi > out.txt' }));
    };

    test('a throwing judge denies instead of crashing (AutoDenyIfUnsure)', async () => {
        const result = await run(options('AutoDenyIfUnsure', () => Promise.reject(new Error('no model'))));
        assert.strictEqual(Utils.isNoUserPermission(result), true, 'expected a denial, got: ' + result);
    });

    test('a throwing judge asks the user instead of crashing (AutoAskIfUnsure)', async () => {
        // Asking the user IS the outcome here; the point is that no exception
        // escapes and the command is not executed on its own (the stub answers no).
        const result = await run(options('AutoAskIfUnsure', () => Promise.reject(new Error('no model'))));
        assert.strictEqual(Utils.isNoUserPermission(result), true, 'expected a denial, got: ' + result);
    });

    test('a judge answer of yes allows the command', async () => {
        const result = await run(options('AutoDenyIfUnsure',
            () => Promise.resolve({ choices: [{ message: { content: 'yes' } }] })));
        assert.strictEqual(Utils.isNoUserPermission(result), false, 'expected the command to run, got: ' + result);
    });

    test('a judge answer wrapped in prose is still read as yes', async () => {
        const result = await run(options('AutoDenyIfUnsure',
            () => Promise.resolve({ choices: [{ message: { content: '  Yes.  ' } }] })));
        assert.strictEqual(Utils.isNoUserPermission(result), false, 'expected the command to run, got: ' + result);
    });

    test('an off-format judge answer is never read as permission', async () => {
        // "yesterday I..." must not be parsed as "yes" - anything that is not a
        // clear yes/no counts as unsure, i.e. denied in AutoDenyIfUnsure.
        const result = await run(options('AutoDenyIfUnsure',
            () => Promise.resolve({ choices: [{ message: { content: 'yesterday this was fine' } }] })));
        assert.strictEqual(Utils.isNoUserPermission(result), true, 'expected a denial, got: ' + result);
    });

    test('an obviously safe command is allowed without asking the model', async () => {
        let asked = false;
        const app = options('AutoDenyIfUnsure', () => { asked = true; return Promise.resolve(undefined); });
        const tools = new Tools(app as unknown as Application);
        const result = await tools.runTerminalCommand(JSON.stringify({ command: 'git status' }));
        assert.strictEqual(asked, false, 'the LLM judge must not be asked for an obviously safe command');
        assert.strictEqual(Utils.isNoUserPermission(result), false, 'expected the command to run, got: ' + result);
    });

    test('an obviously dangerous command is denied without asking the model', async () => {
        let asked = false;
        const app = options('AutoAskIfUnsure', () => { asked = true; return Promise.resolve(undefined); });
        const tools = new Tools(app as unknown as Application);
        const result = await tools.runTerminalCommand(JSON.stringify({ command: 'sudo rm -rf /' }));
        assert.strictEqual(asked, false, 'the LLM judge must not be asked for an obviously dangerous command');
        assert.strictEqual(Utils.isNoUserPermission(result), true, 'expected a denial, got: ' + result);
        // The reason is what stops the model from simply retrying the same command.
        assert.ok(result.includes('Reason:'), 'expected the denial to explain itself, got: ' + result);
    });
});

// Routing of the tool search_source: the RAG index is used only when it actually
// exists, a failing RAG path degrades to the RAG-free fallback, and nothing may
// index the workspace as a side effect of a search.
suite('Tools searchSource routing', () => {
    const createApp = () => new MockApplication();

    const createTools = (app: MockApplication) => new Tools(app as unknown as Application);

    test('rag disabled uses the fallback and never indexes', async () => {
        const app = createApp();
        const tools = createTools(app);

        const result = await tools.searchSource(JSON.stringify({ query: 'search source rag' }));

        assert.strictEqual(result, 'FALLBACK');
        assert.strictEqual(app.sourceSearchCalls.length, 1);
        assert.strictEqual(app.sourceSearchCalls[0].query, 'search source rag');
        // The configured tool output cap is passed through.
        assert.strictEqual(app.sourceSearchCalls[0].maxOutputChars, 10000);
        // indexWorkspaceFiles does not exist on the mock at all - nothing can call it.
        assert.strictEqual((app.chatContext as any).indexWorkspaceFiles, undefined);
        assert.strictEqual((app.chatContext as any).entries.size, 0, 'the RAG index must stay empty');
    });

    test('rag enabled with an index uses the RAG path', async () => {
        const app = createApp();
        (app.configuration as any).rag_enabled = true;
        (app.chatContext as any).entries.set(1, { content: 'x' });
        const tools = createTools(app);

        const result = await tools.searchSource(JSON.stringify({ query: 'rag query' }));

        assert.strictEqual(result, 'RAG:1');
        assert.strictEqual(app.sourceSearchCalls.length, 0, 'the fallback must not run when the index exists');
        // No embeddings endpoint -> the RAG path must not stall for 5 s either.
        assert.strictEqual(app.ragCalls.length, 1);
        assert.strictEqual(app.ragCalls[0].skipEmbeddings, true);
    });

    test('rag enabled but the index is still empty uses the fallback', async () => {
        const app = createApp();
        (app.configuration as any).rag_enabled = true;
        const tools = createTools(app);

        const result = await tools.searchSource(JSON.stringify({ query: 'rag query' }));

        assert.strictEqual(result, 'FALLBACK');
        assert.strictEqual(app.sourceSearchCalls.length, 1);
    });

    test('a throwing RAG path degrades to the fallback', async () => {
        const app = createApp();
        (app.configuration as any).rag_enabled = true;
        (app.chatContext as any).entries.set(1, { content: 'x' });
        (app.chatContext as any).getRagContextChunks = () => { throw new Error('no tools model'); };
        const tools = createTools(app);

        const result = await tools.searchSource(JSON.stringify({ query: 'boom' }));

        // A stack-trace slice must never reach the model.
        assert.strictEqual(result, 'FALLBACK');
        assert.strictEqual(app.sourceSearchCalls.length, 1);
    });

    test('a missing or empty query is reported without searching', async () => {
        const app = createApp();
        const tools = createTools(app);

        assert.strictEqual(await tools.searchSource(JSON.stringify({})), 'The search request is not provided.');
        assert.strictEqual(await tools.searchSource(JSON.stringify({ query: '   ' })), 'The search request is not provided.');
        assert.strictEqual(app.sourceSearchCalls.length, 0);
    });

    test('malformed arguments are reported without throwing', async () => {
        const app = createApp();
        const tools = createTools(app);

        assert.strictEqual(await tools.searchSource('not json'), 'The tool arguments are not valid JSON.');
        assert.strictEqual(app.sourceSearchCalls.length, 0);
    });

    test('the description does not throw on malformed arguments', async () => {
        const app = createApp();
        const tools = createTools(app);

        assert.ok((await tools.searchSourceDesc('not json')).includes('Searching source code for:'));
        assert.ok((await tools.searchSourceDesc(JSON.stringify({ query: 'abc' }))).includes('abc'));
    });
});
