/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup, teardown } from 'mocha';
import { Tools } from '../../tools';
import { LlamaAgent, AgentSession } from '../../llama-agent';
import { LlamaServer } from '../../llama-server';
import { AgentService } from '../../services/agent-service';
import { Configuration } from '../../configuration';
import { Architect } from '../../architect';
import { PARALLEL_MCP_URL, PARALLEL_USER_AGENT } from '../../parallel-search';
import { Utils } from '../../utils';
import { HooksEvents, PERSISTENCE_KEYS } from '../../constants';
import { Chat } from '../../types';
import { version, contributes } from '../../../package.json';

suite('Parallel web tools through the agent dispatcher', () => {
    let app: any;
    let agent: LlamaAgent;
    let originalFetch: typeof fetch;
    let requests: Array<{ url: string; headers: Headers; body: any }>;
    let mode: 'ok' | 'quota' | 'http' | 'malformed' | 'hang' | 'hang_call';
    let allow: boolean;
    let completed: AgentSession[];
    const query = { objective: 'Find TypeScript documentation', search_queries: ['TypeScript handbook'] };
    const docUrl = 'https://www.typescriptlang.org/docs/';

    setup(() => {
        requests = [];
        completed = [];
        allow = true;
        mode = 'ok';
        originalFetch = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
            const req = new Request(input, init);
            const body = req.method === 'POST' ? JSON.parse(await req.text()) : {};
            requests.push({ url: req.url, headers: req.headers, body });
            if (req.signal.aborted) throw new Error('aborted');
            if (mode === 'hang' || mode === 'hang_call' && body.method === 'tools/call') return new Promise((_resolve, reject) => {
                req.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            });
            if (req.method !== 'POST') return new Response('', { status: 405 });
            if (!('id' in body)) return new Response(null, { status: 202 });
            if (mode === 'http') return new Response('Service unavailable', { status: 503 });
            if (mode === 'malformed') return new Response('not JSON', { headers: { 'content-type': 'application/json' } });
            let result: any;
            switch (body.method) {
                case 'initialize':
                    result = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } }; break;
                case 'tools/list':
                    result = { tools: ['web_search', 'web_fetch'].map(name => ({ name, inputSchema: { type: 'object' } })) }; break;
                case 'tools/call':
                    result = { content: [{ type: 'text', text: mode === 'quota' ? 'Anonymous quota exceeded' : `TypeScript handbook: ${docUrl}` }], isError: mode === 'quota' }; break;
                default: throw new Error(`Unexpected MCP method ${body.method}`);
            }
            return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { headers: { 'content-type': 'application/json' } });
        };
        app = {
            configuration: {
                tool_parallel_web_search_enabled: true, tool_parallel_web_fetch_enabled: true,
                tools_custom: [], agents_list: [], MAX_CHARS_TOOL_RETURN: 10000,
                updateConfigValue: async (key: string, value: unknown) => { app.configuration[key] = value; },
            },
            prompts: { TOOLS_SYSTEM_PROMPT_ACTION: '' },
            isAgentSelected: () => false,
            dialogs: { confirmAction: async () => allow },
            llamaWebviewProvider: { updateContextFilesInfo: () => {}, updateLlamaView: () => {} },
            hooks: { processHooks: async () => ({ stopLoop: false, stopTool: true, resultInfo: 'Blocked by hook' }) },
            setAgent: () => {},
            persistence: { setValue: async () => {} },
            chatService: { addChatToHistory: async () => {}, selectUpdateChat: async () => {} },
            getChat: () => ({ name: '', id: '' }),
            isChatSelected: () => false,
        };
        app.tools = new Tools(app);
        app.tools.init();
        agent = new LlamaAgent(app);
        app.llamaAgent = agent;
        // Script the model output while retaining askAgent's production session
        // lifecycle, normal tool registry, dispatcher and tool-message consumer.
        (agent as any).executeSession = async (session: AgentSession) => {
            const name = session.originalQuery === 'fetch' ? 'parallel_web_fetch' : 'parallel_web_search';
            await dispatch(session, name, name === 'parallel_web_fetch' ? { urls: [docUrl] } : query);
            completed.push(session);
            return session.messages[session.messages.length - 1].content;
        };
    });

    teardown(() => { globalThis.fetch = originalFetch; });

    async function dispatch(session: AgentSession, name: string, args: unknown, hooks?: Map<string, any[]>) {
        // Additional direct-dispatch checks can use a session whose turn ended.
        if (!session.abortController) session.abortController = new AbortController();
        await (agent as any).processToolCallsForSession({ choices: [{ message: { tool_calls: [{ id: 'call-1', function: { name, arguments: JSON.stringify(args) } }] } }] }, hooks, session);
    }
    const ask = (query = 'search', background = false) => agent.askAgent(query, undefined, false, { useInMemoryTodo: true, logDestination: 'memory', background });
    const calls = () => requests.filter(r => r.body.method === 'tools/call');

    test('fresh no-key registry advertises search/fetch and consumes URLs using the actual MCP SDK', async () => {
        assert.strictEqual(contributes.configuration.properties['llama-vscode.tool_parallel_web_search_enabled'].default, true);
        assert.strictEqual(contributes.configuration.properties['llama-vscode.tool_parallel_web_fetch_enabled'].default, true);
        assert.deepStrictEqual(app.tools.getTools().map((t: any) => t.function.name), ['parallel_web_search', 'parallel_web_fetch']);
        const result = await ask();
        assert.ok(result.includes(docUrl));
        assert.strictEqual(completed[0].messages.at(-1)?.role, 'tool');
        assert.ok(requests.some(r => r.body.method === 'initialize'));
        assert.ok(requests.some(r => r.body.method === 'tools/list'));
        for (const request of requests) {
            assert.strictEqual(request.url, PARALLEL_MCP_URL);
            assert.strictEqual(request.headers.get('user-agent'), PARALLEL_USER_AGENT);
            assert.strictEqual(request.headers.has('authorization'), false);
        }
        assert.strictEqual(PARALLEL_USER_AGENT, `llama-vscode/${version}`);
        assert.deepStrictEqual(calls()[0].body.params.arguments.search_queries, query.search_queries);
        assert.match(calls()[0].body.params.arguments.session_id, /^[a-f0-9-]{36}$/);
    });

    test('automatic default and saved-agent restoration preserve explicit disables', async () => {
        app.getAgent = () => ({ name: '' });
        app.persistence.getGlobalValue = () => false;
        let savedAgent: any;
        let savedChat: any;
        app.persistence.getValue = (key: string) => key === PERSISTENCE_KEYS.SELECTED_AGENT ? savedAgent : savedChat;
        app.persistence.setValue = async (_key: string, value: unknown) => { savedAgent = value; };
        app.persistence.setGlobalValue = async () => {};
        app.agentCommandScheduler = { start: () => {} };
        app.agentService = new AgentService(app);
        const architect = new Architect(app);
        (architect as any).installUpgradeLlamaCpp = async () => {};
        await architect.init();
        app.tools.init();
        assert.ok(app.tools.getTools().some((tool: any) => tool.function.name === 'parallel_web_search'));
        assert.ok((await ask()).includes(docUrl));
        app.configuration.tool_parallel_web_search_enabled = false;
        assert.ok(savedAgent.tools.includes('parallel_web_search'));
        await architect.init();
        app.tools.init();
        assert.ok(!app.tools.getTools().some((tool: any) => tool.function.name === 'parallel_web_search'));
        assert.ok(app.tools.getTools().some((tool: any) => tool.function.name === 'parallel_web_fetch'));
        savedChat = { name: 'restored chat' };
        app.chatService.selectUpdateChat = async () => { app.configuration.tool_parallel_web_search_enabled = true; };
        (architect as any).restoreLastUsedEnv = async () => { app.configuration.tool_parallel_web_search_enabled = true; };
        await architect.init();
        app.tools.init();
        assert.ok(!app.tools.getTools().some((tool: any) => tool.function.name === 'parallel_web_search'));
        savedAgent = undefined;
        await architect.init();
        app.tools.init();
        assert.ok(!app.tools.getTools().some((tool: any) => tool.function.name === 'parallel_web_search'));
    });

    test('normal agent loop offers web tools and consumes results in the next scripted model turn', async () => {
        (agent as any).executeSession = (LlamaAgent.prototype as any).executeSession;
        app.configuration.tools_max_iterations = 3;
        app.hooks.getHooks = () => new Map();
        app.isToolsModelSelected = () => true;
        app.agentReminder = { getRemindersWithSession: () => '' };
        const server = new LlamaServer(app);
        let turns = 0;
        app.llamaServer = {
            getAgentCompletion: async (messages: any[]) => {
                const request = (server as any).createToolsRequestPayload(messages, 'scripted-test-model');
                assert.ok(request.tools.some((tool: any) => tool.function.name === 'parallel_web_search'));
                turns++;
                if (turns === 1) return { choices: [{ finish_reason: 'tool_calls', message: {
                    role: 'assistant', content: '', tool_calls: [{ id: 'web', function: { name: 'parallel_web_search', arguments: JSON.stringify(query) } }],
                } }] };
                assert.ok(request.messages.some((message: any) => message.role === 'tool' && message.content.includes(docUrl)));
                return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: `Read ${docUrl}` } }] };
            },
        };
        assert.strictEqual(await ask('search', true), `Read ${docUrl}`);
        assert.strictEqual(turns, 2);
        assert.strictEqual(calls().length, 1);
    });

    test('search, fetch, follow-up, quota and retry retain the conversation UUID', async () => {
        await ask(); await ask('fetch');
        mode = 'quota'; assert.match(await ask(), /quota exceeded/);
        mode = 'ok'; await ask();
        assert.strictEqual(new Set(calls().map(c => c.body.params.arguments.session_id)).size, 1);
        assert.deepStrictEqual(calls()[1].body.params.arguments.urls, [docUrl]);
        agent.resetMessages(); await ask();
        assert.notStrictEqual(calls().at(-1)!.body.params.arguments.session_id, calls()[0].body.params.arguments.session_id);
    });

    test('parallel background runs remain isolated from each other and foreground follow-ups', async () => {
        await ask();
        await Promise.all([ask('search', true), ask('fetch', true), ask()]);
        const ids = calls().map(c => c.body.params.arguments.session_id);
        assert.strictEqual(ids[0], ids[3]);
        assert.strictEqual(new Set(ids).size, 3);
    });

    test('saved chats preserve opaque identity and imported personal identifiers are replaced', async () => {
        await ask();
        const chat: Chat = { id: 'saved', name: 'saved', searchSessionId: completed[0].searchSessionId, messages: completed[0].messages };
        await agent.selectChat(chat); await ask('fetch');
        assert.strictEqual(calls()[0].body.params.arguments.session_id, calls()[1].body.params.arguments.session_id);
        await agent.selectChat({ id: 'imported', name: 'imported', searchSessionId: 'person@example.com' }); await ask();
        assert.match(calls().at(-1)!.body.params.arguments.session_id, /^[a-f0-9-]{36}$/);
        assert.notStrictEqual(calls().at(-1)!.body.params.arguments.session_id, 'person@example.com');
    });

    test('saved agent lists and explicit disable controls remain authoritative', async () => {
        const service = new AgentService(app);
        await service.selectAgent({ name: 'saved', tools: ['read_file'], systemInstruction: [] }, false);
        app.tools.init();
        assert.ok(!app.tools.getTools().some((t: any) => t.function.name.startsWith('parallel_')));
        assert.match(await ask(), /disabled/);
        assert.strictEqual(requests.length, 0);
        assert.strictEqual(app.configuration.tool_read_file_enabled, true);
        const configuration = new Configuration();
        assert.ok(configuration.isToolChanged({ affectsConfiguration: (key: string) => key === 'llama-vscode.tool_parallel_web_fetch_enabled' } as any));
    });

    test('custom overrides and installed MCP selections survive initialization', async () => {
        app.configuration.tools_custom = [{ enabled: true, tool: { type: 'function', function: { name: 'parallel_web_search' } }, tool_function: 'override' }];
        const original = (require('../../plugin').Plugin as any).getFunction;
        (require('../../plugin').Plugin as any).getFunction = () => async () => 'Custom provider';
        try {
            app.tools.vscodeToolsSelected.set('existing_mcp_search', true);
            app.tools.init();
            assert.strictEqual(app.tools.getTools().filter((t: any) => t.function.name === 'parallel_web_search').length, 1);
            assert.strictEqual(await ask(), 'Custom provider');
            assert.ok(app.tools.vscodeToolsSelected.has('existing_mcp_search'));
            assert.strictEqual(requests.length, 0);
            app.configuration.tools_custom[0].enabled = false;
            app.tools.init();
            assert.ok((await ask()).includes(docUrl));
            assert.strictEqual(calls().length, 1);
            app.configuration.tools_custom[0].enabled = true;
            app.tools.init();
            assert.strictEqual(await ask(), 'Custom provider');
            app.configuration.tools_custom = [];
            app.tools.init();
            assert.ok((await ask()).includes(docUrl));
            assert.strictEqual(calls().length, 2);
        } finally { (require('../../plugin').Plugin as any).getFunction = original; }
    });

    test('permission denial and hooks prevent all network requests', async () => {
        allow = false;
        assert.strictEqual(await ask(), Utils.MSG_NO_USER_PERMISSION);
        assert.strictEqual(requests.length, 0);
        allow = true;
        await dispatch(completed[0], 'parallel_web_search', query, new Map([[HooksEvents.preToolUse, [{}]]]));
        assert.strictEqual(completed[0].messages.at(-1)?.content, 'Blocked by hook');
        assert.strictEqual(requests.length, 0);
    });

    test('validates URL schemes and input before requesting permission', async () => {
        let prompts = 0;
        app.dialogs.confirmAction = async () => { prompts++; return true; };
        await ask();
        for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'https://user:password@example.com', 'invalid']) {
            await dispatch(completed[0], 'parallel_web_fetch', { urls: [url] });
            assert.match(completed[0].messages.at(-1)!.content!, /HTTP or HTTPS/);
        }
        await dispatch(completed[0], 'parallel_web_search', { objective: '', search_queries: [] });
        assert.strictEqual(prompts, 1);
        assert.strictEqual(calls().length, 1);
    });

    test('HTTP and malformed responses become tool errors without fallback', async () => {
        mode = 'http'; assert.match(await ask(), /Service unavailable/);
        mode = 'malformed'; assert.match(await ask(), /Error during the execution/);
        assert.strictEqual(calls().length, 0);
    });

    test('cancellation aborts an in-flight tool call and does not change conversation identity', async () => {
        mode = 'hang_call';
        const pending = ask();
        while (!calls().length) await new Promise(resolve => setTimeout(resolve, 1));
        for (const session of (agent as any).activeSessions.values()) session.abortController.abort();
        assert.match(await pending, /cancelled/);
        const id = completed[0].searchSessionId;
        mode = 'ok'; await ask();
        assert.strictEqual(calls()[1].body.params.arguments.session_id, id);
    });

    test('timeout aborts the SDK request and reaches the tool result', async () => {
        mode = 'hang';
        const original = globalThis.setTimeout;
        globalThis.setTimeout = ((callback: any, delay: number, ...args: any[]) => original(callback, delay === 30_000 ? 5 : delay, ...args)) as typeof setTimeout;
        try { assert.match(await ask(), /timed out after 30 seconds/); }
        finally { globalThis.setTimeout = original; }
    });
});
