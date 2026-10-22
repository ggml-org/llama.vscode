import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { version } from '../package.json';

export interface WebToolContext {
    sessionId: string;
    signal?: AbortSignal;
}

export const PARALLEL_MCP_URL = 'https://search.parallel.ai/mcp';
export const PARALLEL_USER_AGENT = `llama-vscode/${version}`;

// No environment credentials or shared conversation state: each invocation gets
// its conversation identity and cancellation from the agent dispatcher.
export async function callParallelTool(name: 'web_search' | 'web_fetch', args: Record<string, unknown>, context: WebToolContext): Promise<string> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (context.signal?.aborted) controller.abort();
    context.signal?.addEventListener('abort', abort, { once: true });
    const deadline = setTimeout(abort, 30_000);
    const client = new Client({ name: 'llama-vscode', version });
    const transport = new StreamableHTTPClientTransport(new URL(PARALLEL_MCP_URL), {
        requestInit: { headers: { 'User-Agent': PARALLEL_USER_AGENT } },
        fetch: (input, init) => fetch(input, {
            ...init,
            signal: AbortSignal.any([controller.signal, ...(init?.signal ? [init.signal] : [])]),
        }),
    });
    try {
        if (controller.signal.aborted) throw new Error('Web request cancelled.');
        await client.connect(transport);
        const tools = await client.listTools();
        if (!tools.tools.some(tool => tool.name === name)) throw new Error(`Parallel does not offer ${name}.`);
        const result = await client.callTool({ name, arguments: { ...args, session_id: context.sessionId } }, undefined, { signal: controller.signal });
        const text = (result.content as Array<{ type: string; text?: string }>)
            .filter(part => part.type === 'text').map(part => part.text ?? '').join('\n');
        if (result.isError) throw new Error(text || 'Parallel could not complete the request.');
        return text;
    } catch (error) {
        if (controller.signal.aborted) throw new Error(context.signal?.aborted ? 'Web request cancelled.' : 'Web request timed out after 30 seconds.');
        throw error;
    } finally {
        clearTimeout(deadline);
        context.signal?.removeEventListener('abort', abort);
        await client.close();
    }
}

export function webToolDefinition(name: 'parallel_web_search' | 'parallel_web_fetch') {
    const search = name === 'parallel_web_search';
    return {
        type: 'function',
        function: {
            name,
            description: search
                ? 'Search the web for current information using Parallel. Queries are sent to Parallel after user permission. Returns source URLs and excerpts.'
                : 'Fetch public web pages as text using Parallel. URLs are sent to Parallel after user permission.',
            parameters: {
                type: 'object',
                properties: search ? {
                    objective: { type: 'string', description: 'The information to find.' },
                    search_queries: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Related keyword queries.' },
                } : {
                    urls: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20, description: 'Public HTTP or HTTPS page URLs.' },
                },
                required: search ? ['objective', 'search_queries'] : ['urls'],
                additionalProperties: false,
            },
        },
    };
}
