import * as vscode from 'vscode';
import axios from 'axios';
import { Application } from './application';
import { Utils } from './utils';

const VENDOR = 'llama-vscode';

// Default token limits used when the server does not report them
const DEFAULT_MAX_INPUT_TOKENS = 8192;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

interface OpenAIModel {
    id: string;
    object?: string;
}

interface OpenAIModelsResponse {
    data: OpenAIModel[];
}

export class LlamaChatModelProvider implements vscode.LanguageModelChatProvider {
    private readonly _onDidChangeLanguageModelChatInformation = new vscode.EventEmitter<void>();
    readonly onDidChangeLanguageModelChatInformation: vscode.Event<void> =
        this._onDidChangeLanguageModelChatInformation.event;

    constructor(private readonly app: Application) {}

    /** Called by the configuration change handler to notify VS Code that models may have changed. */
    notifyModelsChanged(): void {
        this._onDidChangeLanguageModelChatInformation.fire();
    }

    async provideLanguageModelChatInformation(
        _options: vscode.PrepareLanguageModelChatModelOptions,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelChatInformation[]> {
        const endpoint = this.getChatEndpoint();
        if (!endpoint) {
            return [];
        }

        try {
            const requestConfig = this.app.configuration.axiosRequestConfigChat;
            const response = await axios.get<OpenAIModelsResponse>(
                `${Utils.trimTrailingSlash(endpoint)}/${this.app.configuration.ai_api_version}/models`,
                requestConfig
            );

            if (!response.data?.data?.length) {
                return [];
            }

            return response.data.data.map((model) => ({
                id: model.id,
                name: model.id,
                family: VENDOR,
                version: '1',
                maxInputTokens: DEFAULT_MAX_INPUT_TOKENS,
                maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
                capabilities: {
                    toolCalling: true,
                    imageInput: false,
                },
            }));
        } catch {
            return [];
        }
    }

    async provideLanguageModelChatResponse(
        model: vscode.LanguageModelChatInformation,
        messages: readonly vscode.LanguageModelChatRequestMessage[],
        options: vscode.ProvideLanguageModelChatResponseOptions,
        progress: vscode.Progress<vscode.LanguageModelResponsePart>,
        token: vscode.CancellationToken
    ): Promise<void> {
        const endpoint = this.getChatEndpoint();
        if (!endpoint) {
            throw new Error('No chat endpoint configured');
        }

        const openaiMessages = messages.map((msg) => ({
            role: msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
            content: msg.content
                .map((part) => (part instanceof vscode.LanguageModelTextPart ? part.value : ''))
                .join(''),
        }));

        const tools = options.tools?.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
            },
        }));

        const requestBody: Record<string, unknown> = {
            model: model.id,
            messages: openaiMessages,
            stream: true,
            max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
            ...(options.modelOptions?.temperature !== undefined && {
                temperature: options.modelOptions.temperature,
            }),
            ...(tools?.length && { tools }),
        };

        const abortController = new AbortController();
        token.onCancellationRequested(() => abortController.abort());

        const requestConfig = this.app.configuration.axiosRequestConfigChat;
        const streamResponse = await axios.post<NodeJS.ReadableStream>(
            `${Utils.trimTrailingSlash(endpoint)}/${this.app.configuration.ai_api_version}/chat/completions`,
            requestBody,
            { ...requestConfig, responseType: 'stream' as const, signal: abortController.signal }
        );

        await new Promise<void>((resolve, reject) => {
            const readable = streamResponse.data;
            let buffer = '';
            // Accumulated tool call data indexed by call index
            const toolCalls: { id: string; name: string; arguments: string }[] = [];

            const finalize = () => {
                // Emit any completed tool calls that weren't emitted yet
                for (const tc of toolCalls) {
                    if (tc.id && tc.name) {
                        try {
                            progress.report(
                                new vscode.LanguageModelToolCallPart(tc.id, tc.name, JSON.parse(tc.arguments || '{}'))
                            );
                        } catch (e) {
                            console.warn('[llama-vscode] Failed to parse tool call arguments:', e);
                        }
                    }
                }
                resolve();
            };

            token.onCancellationRequested(() => {
                (readable as any).destroy?.();
                resolve();
            });

            readable.on('data', (chunk: Buffer) => {
                buffer += chunk.toString('utf8');
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data:')) {
                        continue;
                    }
                    const payload = trimmed.slice(5).trim();
                    if (payload === '[DONE]') {
                        finalize();
                        readable.removeAllListeners();
                        return;
                    }
                    try {
                        const json = JSON.parse(payload);
                        const choice = json.choices?.[0];
                        if (!choice) {
                            continue;
                        }
                        const delta = choice.delta ?? {};
                        if (typeof delta.content === 'string' && delta.content) {
                            progress.report(new vscode.LanguageModelTextPart(delta.content));
                        }
                        if (Array.isArray(delta.tool_calls)) {
                            for (const tc of delta.tool_calls) {
                                const idx: number = typeof tc.index === 'number' ? tc.index : 0;
                                if (!toolCalls[idx]) {
                                    toolCalls[idx] = { id: '', name: '', arguments: '' };
                                }
                                if (tc.id) {
                                    toolCalls[idx].id = tc.id;
                                }
                                if (tc.function?.name) {
                                    toolCalls[idx].name = tc.function.name;
                                }
                                if (tc.function?.arguments) {
                                    toolCalls[idx].arguments += tc.function.arguments;
                                }
                            }
                        }
                    } catch {
                        // Skip malformed SSE chunks
                    }
                }
            });

            readable.on('end', () => {
                finalize();
            });

            readable.on('error', (err: Error) => {
                reject(err);
            });
        });
    }

    provideTokenCount(
        _model: vscode.LanguageModelChatInformation,
        text: string | vscode.LanguageModelChatRequestMessage,
        _token: vscode.CancellationToken
    ): Thenable<number> {
        const content =
            typeof text === 'string'
                ? text
                : text.content
                      .map((p) => (p instanceof vscode.LanguageModelTextPart ? p.value : ''))
                      .join('');
        // Rough approximation: 1 token ≈ 4 characters. The llama.cpp server does not expose a
        // tokenization endpoint via the standard OpenAI API, so we use this heuristic.
        // Actual token counts may differ depending on the model's tokenizer.
        return Promise.resolve(Math.ceil(content.length / 4));
    }

    private getChatEndpoint(): string {
        const selectedModel = this.app.getChatModel();
        if (selectedModel?.endpoint) {
            return selectedModel.endpoint;
        }
        if (this.app.configuration.endpoint_chat) {
            return this.app.configuration.endpoint_chat;
        }
        if (this.app.configuration.endpoint_tools) {
            return this.app.configuration.endpoint_tools;
        }
        return '';
    }
}
