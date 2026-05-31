import * as vscode from 'vscode';
import axios from 'axios';
import { Application } from './application';
import type { RequestTraceContext } from './llama-server';
import {
    buildRuntimePropsUrl,
    DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
    estimateTokenCount,
    extractRuntimeContextSize,
    isLikelyLlamaCppProvider,
    OpenAICompatibleModel,
    resolveModelTokenLimits,
    resolveBoundedMaxOutputTokens,
    resolveRequestMaxOutputTokens,
} from './language-model-token-limits';
import { Utils } from './utils';

const VENDOR = 'llama-vscode';

interface OpenAIModelsResponse {
    data: OpenAICompatibleModel[];
}

interface ProviderApiError {
    message: string;
    type?: string;
    status?: number;
    n_prompt_tokens?: number;
    n_ctx?: number;
    [key: string]: unknown;
}

type OpenAIToolCall = {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
};

type OpenAIChatMessage =
    | {
          role: 'user' | 'assistant';
          content: string | null;
          tool_calls?: OpenAIToolCall[];
      }
    | {
          role: 'tool';
          content: string;
          tool_call_id: string;
      };

type ConversationTraceState = {
    conversationId: string;
    anchorKey: string;
    turn: number;
    lastPromptTokens?: number;
    lastMessageCount: number;
    lastSeenAt: number;
};

export class LlamaChatModelProvider implements vscode.LanguageModelChatProvider {
    private readonly _onDidChangeLanguageModelChatInformation = new vscode.EventEmitter<void>();
    readonly onDidChangeLanguageModelChatInformation: vscode.Event<void> =
        this._onDidChangeLanguageModelChatInformation.event;
    private conversationCounter = 0;
    private activeConversation: ConversationTraceState | undefined;

    constructor(private readonly app: Application) {}

    /** Called by the configuration change handler to notify VS Code that models may have changed. */
    notifyModelsChanged(): void {
        this._onDidChangeLanguageModelChatInformation.fire();
    }

    async provideLanguageModelChatInformation(
        _options: vscode.PrepareLanguageModelChatModelOptions,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelChatInformation[]> {
        const { endpoint, requestConfig } = this.getChatRequestDetails();
        if (!endpoint) {
            return [];
        }

        try {
            const response = await axios.get<OpenAIModelsResponse>(
                `${Utils.trimTrailingSlash(endpoint)}/${this.app.configuration.ai_api_version}/models`,
                requestConfig
            );

            if (!response.data?.data?.length) {
                return [];
            }

            const runtimeContextSizes = await this.getRuntimeContextSizes(endpoint, response.data.data, requestConfig);

            return response.data.data.map((model) => {
                const tokenLimits = resolveModelTokenLimits(model, {
                    configuredMaxInputTokens: this.app.configuration.lm_max_input_tokens,
                    configuredMaxOutputTokens: this.app.configuration.lm_max_output_tokens,
                    runtimeContextSize: runtimeContextSizes.get(model.id),
                });

                return {
                    id: model.id,
                    name: model.id,
                    family: VENDOR,
                    version: '1',
                    maxInputTokens: tokenLimits.maxInputTokens,
                    maxOutputTokens: tokenLimits.maxOutputTokens,
                    capabilities: {
                        toolCalling: true,
                        imageInput: false,
                    },
                };
            });
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
        const { endpoint, requestConfig } = this.getChatRequestDetails();
        if (!endpoint) {
            throw new Error('No chat endpoint configured');
        }

        const openaiMessages = this.toOpenAIMessages(messages);

        const tools = options.tools?.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
            },
        }));
        const toolChoice = this.mapToolMode(options.toolMode, tools?.length ?? 0);

        if (tools?.length) {
            openaiMessages.unshift({
                role: 'user',
                content: 'You are operating in tool-calling mode. Never claim that files were created, read, changed, listed, or that commands were run unless you first emit the corresponding tool call and then receive its tool result. When tools are available and the task depends on tools, emit tool calls instead of prose. Do not describe intended tool usage.',
            });
        }

        const requestBody: Record<string, unknown> = {
            model: model.id,
            messages: openaiMessages,
            stream: true,
            ...(options.modelOptions?.temperature !== undefined && {
                temperature: options.modelOptions.temperature,
            }),
            ...(tools?.length && { tools }),
            ...(toolChoice && {
                tool_choice: toolChoice,
            }),
        };

        const abortController = new AbortController();
        token.onCancellationRequested(() => abortController.abort());

        const runtimeTokenLimits = await this.getRuntimeTokenLimitsForRequest(
            endpoint,
            model.id,
            requestConfig,
            model.maxInputTokens,
            model.maxOutputTokens,
        );

        const trace = this.getConversationTrace(openaiMessages);
        this.logConversationTextSnapshot(messages, trace);
        this.logConversationPartSnapshot(messages, trace);
        const exactPromptTokens = await this.getExactPromptTokens(
            openaiMessages,
            endpoint,
            model.id,
            requestConfig,
            trace,
            tools,
            toolChoice
        );
        const promptTokenEstimate = exactPromptTokens ?? this.estimatePromptTokens(openaiMessages);
        if (exactPromptTokens === undefined) {
            this.app.llamaServer.logBudgetFallback(trace, {
                endpoint,
                model: model.id,
                fallbackPromptTokens: promptTokenEstimate,
                fallbackReason: 'exact_count_unavailable',
            });
        }
        this.recordConversationBudget(trace, promptTokenEstimate, openaiMessages.length);
        const boundedMaxOutputTokens = resolveBoundedMaxOutputTokens({
            maxInputTokens: runtimeTokenLimits.maxInputTokens,
            maxOutputTokens: this.getPositiveTokenLimit(runtimeTokenLimits.maxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS),
            defaultMaxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
        });
        const chosenMaxTokens = resolveRequestMaxOutputTokens({
            maxInputTokens: runtimeTokenLimits.maxInputTokens,
            maxOutputTokens: boundedMaxOutputTokens,
            promptTokenEstimate,
            defaultMaxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
            contextSafetyMarginTokens: DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS,
        });
        this.app.llamaServer.logBudgetDecision(trace, {
            endpoint,
            model: model.id,
            promptTokens: promptTokenEstimate,
            promptCountSource: exactPromptTokens === undefined ? 'fallback' : 'exact',
            maxInputTokens: runtimeTokenLimits.maxInputTokens,
            maxOutputTokens: boundedMaxOutputTokens,
            chosenMaxTokens,
            safetyMarginTokens: DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS,
        });

        if (exactPromptTokens !== undefined && promptTokenEstimate >= runtimeTokenLimits.maxInputTokens) {
            this.app.logger.addEventLog(
                'BUDGET',
                'REQUEST_REJECTED',
                [
                    `request_id=${trace.requestId}`,
                    `caller=${trace.caller}`,
                    trace.conversationId ? `conversation_id=${trace.conversationId}` : '',
                    typeof trace.conversationTurn === 'number' ? `conversation_turn=${trace.conversationTurn}` : '',
                    `endpoint=${endpoint}`,
                    `model=${model.id}`,
                    `prompt_tokens=${promptTokenEstimate}`,
                    `max_input_tokens=${runtimeTokenLimits.maxInputTokens}`,
                    'reason=prompt_exceeds_context_window',
                ].filter(Boolean).join(' | ')
            );

            throw this.createContextWindowExceededError(
                promptTokenEstimate,
                runtimeTokenLimits.maxInputTokens,
                `Prompt token count was measured exactly before sending.`
            );
        }

        const completionsUrl = `${Utils.trimTrailingSlash(endpoint)}/${this.app.configuration.ai_api_version}/chat/completions`;
        let streamResponse: { data: NodeJS.ReadableStream };
        try {
            streamResponse = await axios.post<NodeJS.ReadableStream>(
                completionsUrl,
                {
                    ...requestBody,
                    max_tokens: chosenMaxTokens,
                },
                { ...requestConfig, responseType: 'stream' as const, signal: abortController.signal }
            );
        } catch (error) {
            this.logProviderApiError('CHAT_COMPLETIONS_POST_ERROR', completionsUrl, error, trace, `model=${model.id}`);
            throw this.toProviderError(this.extractProviderApiError(error), error);
        }

        await new Promise<void>((resolve, reject) => {
            const readable = streamResponse.data;
            let buffer = '';
            const toolCalls: { id: string; name: string; arguments: string }[] = [];
            let settled = false;
            let reportedResponsePart = false;
            let payloadCount = 0;
            let contentChunkCount = 0;
            let reasoningChunkCount = 0;
            let reasoningCharCount = 0;
            let toolCallDeltaCount = 0;
            let doneReceived = false;
            let lastFinishReason: string | undefined;
            let responseUsage: Record<string, unknown> | undefined;

            const resolveOnce = () => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve();
            };

            const rejectOnce = (error: Error) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(error);
            };

            const reportTextPart = (content: string) => {
                if (!content) {
                    return;
                }

                reportedResponsePart = true;
                contentChunkCount += 1;
                progress.report(new vscode.LanguageModelTextPart(content));
            };

            const rejectStreamError = (apiError: ProviderApiError, rawError: unknown) => {
                this.logProviderApiError('CHAT_COMPLETIONS_STREAM_ERROR', completionsUrl, apiError, trace, `model=${model.id}`);
                rejectOnce(this.toProviderError(apiError, rawError));
                readable.removeAllListeners();
            };

            const collectReasoningDelta = (delta: Record<string, unknown>) => {
                const reasoningContent =
                    typeof delta.reasoning_content === 'string'
                        ? delta.reasoning_content
                        : typeof delta.reasoningContent === 'string'
                            ? delta.reasoningContent
                            : undefined;

                if (!reasoningContent) {
                    return;
                }

                reasoningChunkCount += 1;
                reasoningCharCount += reasoningContent.length;
            };

            const processPayload = (payload: string): boolean => {
                if (payload === '[DONE]') {
                    doneReceived = true;
                    finalize();
                    readable.removeAllListeners();
                    return true;
                }

                try {
                    payloadCount += 1;
                    const json = JSON.parse(payload);
                    if (json?.usage && typeof json.usage === 'object') {
                        responseUsage = json.usage as Record<string, unknown>;
                    }
                    if (json?.error) {
                        rejectStreamError(this.normalizeProviderApiError(json.error), json.error);
                        return true;
                    }

                    const choice = json.choices?.[0];
                    if (!choice) {
                        return false;
                    }

                    if (choice.error) {
                        rejectStreamError(this.normalizeProviderApiError(choice.error), choice.error);
                        return true;
                    }

                    if (typeof choice.finish_reason === 'string') {
                        lastFinishReason = choice.finish_reason;
                    }

                    const delta = (choice.delta ?? {}) as Record<string, unknown>;
                    collectReasoningDelta(delta);
                    if (typeof delta.content === 'string') {
                        reportTextPart(delta.content);
                    }

                    if (Array.isArray(delta.tool_calls)) {
                        toolCallDeltaCount += delta.tool_calls.length;
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

                return false;
            };

            const processBufferedLines = (chunkText: string, flushPartialLine = false): boolean => {
                buffer += chunkText;
                const lines = buffer.split(/\r?\n/);

                if (!flushPartialLine) {
                    buffer = lines.pop() ?? '';
                } else {
                    buffer = '';
                }

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data:')) {
                        continue;
                    }

                    const payload = trimmed.slice(5).trim();
                    if (processPayload(payload)) {
                        return true;
                    }
                }

                return false;
            };

            const finalize = () => {
                for (const tc of toolCalls) {
                    if (tc.id && tc.name) {
                        try {
                            reportedResponsePart = true;
                            progress.report(
                                new vscode.LanguageModelToolCallPart(tc.id, tc.name, JSON.parse(tc.arguments || '{}'))
                            );
                        } catch (e) {
                            console.warn('[llama-vscode] Failed to parse tool call arguments:', e);
                        }
                    }
                }

                this.app.logger.addEventLog(
                    'API',
                    'CHAT_COMPLETIONS_POST_RESPONSE',
                    [
                        completionsUrl,
                        `request_id=${trace.requestId}`,
                        `caller=${trace.caller}`,
                        trace.conversationId ? `conversation_id=${trace.conversationId}` : '',
                        typeof trace.conversationTurn === 'number' ? `conversation_turn=${trace.conversationTurn}` : '',
                        `model=${model.id}`,
                        `chosen_max_tokens=${chosenMaxTokens}`,
                        lastFinishReason ? `finish_reason=${lastFinishReason}` : '',
                        ...this.formatUsageLogFields(responseUsage),
                    ].filter(Boolean).join(' | ')
                );

                if (!reportedResponsePart) {
                    this.app.logger.addEventLog(
                        'API',
                        'CHAT_COMPLETIONS_EMPTY_RESPONSE',
                        [
                            `request_id=${trace.requestId}`,
                            `caller=${trace.caller}`,
                            trace.conversationId ? `conversation_id=${trace.conversationId}` : '',
                            typeof trace.conversationTurn === 'number' ? `conversation_turn=${trace.conversationTurn}` : '',
                            `model=${model.id}`,
                            `payloads=${payloadCount}`,
                            `content_chunks=${contentChunkCount}`,
                            `reasoning_chunks=${reasoningChunkCount}`,
                            `reasoning_chars=${reasoningCharCount}`,
                            `tool_call_deltas=${toolCallDeltaCount}`,
                            `final_tool_calls=${toolCalls.filter(tc => tc.id && tc.name).length}`,
                            `done_received=${doneReceived}`,
                            lastFinishReason ? `finish_reason=${lastFinishReason}` : '',
                        ].filter(Boolean).join(' | ')
                    );

                    rejectOnce(
                        reasoningChunkCount > 0 && lastFinishReason === 'length'
                            ? this.createReasoningOnlyEmptyResponseError()
                            : this.createEmptyResponseError()
                    );
                    return;
                }

                resolveOnce();
            };

            token.onCancellationRequested(() => {
                (readable as any).destroy?.();
                resolveOnce();
            });

            readable.on('data', (chunk: Buffer) => {
                processBufferedLines(chunk.toString('utf8'));
                if (settled) {
                    return;
                }
            });

            readable.on('end', () => {
                if (processBufferedLines('', true)) {
                    return;
                }
                finalize();
            });

            readable.on('error', (err: Error) => {
                rejectStreamError(this.extractProviderApiError(err), err);
            });
        });
    }

    provideTokenCount(
        model: vscode.LanguageModelChatInformation,
        text: string | vscode.LanguageModelChatRequestMessage,
        _token: vscode.CancellationToken
    ): Thenable<number> {
        // VS Code can call provideTokenCount very frequently while preparing and
        // updating chat UI state. Do not make network round-trips here.
        //
        // Exact server-side counting is still used on the actual send path when
        // we clamp request max_tokens. This callback should stay cheap and local.
        if (typeof text === 'string') {
            const tokenCount = estimateTokenCount(text);
            return Promise.resolve(tokenCount);
        }

        const openaiMessages = [this.toOpenAIMessage(text)];
        const tokenCount = this.estimatePromptTokens(openaiMessages);
        return Promise.resolve(tokenCount);
    }

    private getChatRequestDetails(): { endpoint: string; requestConfig: object } {
        const selectedModel = this.app.getToolsModel();
        if (selectedModel?.endpoint) {
            if (selectedModel.isKeyRequired) {
                const apiKey = this.app.persistence.getApiKey(selectedModel.endpoint);
                if (apiKey) {
                    return {
                        endpoint: selectedModel.endpoint,
                        requestConfig: {
                            headers: {
                                Authorization: `Bearer ${apiKey}`,
                                'Content-Type': 'application/json',
                            },
                        },
                    };
                }
            }

            return {
                endpoint: selectedModel.endpoint,
                requestConfig: this.app.configuration.axiosRequestConfigTools,
            };
        }
        if (this.app.configuration.endpoint_chat) {
            return {
                endpoint: this.app.configuration.endpoint_chat,
                requestConfig: this.app.configuration.axiosRequestConfigChat,
            };
        }
        if (this.app.configuration.endpoint_tools) {
            return {
                endpoint: this.app.configuration.endpoint_tools,
                requestConfig: this.app.configuration.axiosRequestConfigTools,
            };
        }

        return {
            endpoint: '',
            requestConfig: this.app.configuration.axiosRequestConfigTools,
        };
    }

    private logProviderApiError(
        event: string,
        url: string,
        error: unknown,
        trace: RequestTraceContext,
        details = ''
    ): void {
        const apiError = this.extractProviderApiError(error);
        this.app.logger.addEventLog(
            'API',
            event,
            [
                url,
                `request_id=${trace.requestId}`,
                `caller=${trace.caller}`,
                trace.conversationId ? `conversation_id=${trace.conversationId}` : '',
                typeof trace.conversationTurn === 'number' ? `conversation_turn=${trace.conversationTurn}` : '',
                details,
                `error=${apiError.message.replace(/\r?\n/g, ' ')}`,
                apiError.status ? `status=${apiError.status}` : '',
                apiError.type ? `type=${apiError.type}` : '',
                typeof apiError.n_prompt_tokens === 'number' ? `n_prompt_tokens=${apiError.n_prompt_tokens}` : '',
                typeof apiError.n_ctx === 'number' ? `n_ctx=${apiError.n_ctx}` : '',
            ].filter(Boolean).join(' | ')
        );
    }

    private getConversationTrace(messages: OpenAIChatMessage[]): RequestTraceContext {
        const anchorKey = this.getConversationAnchorKey(messages);
        const shouldStartNewConversation = !this.activeConversation
            || (
                messages.length <= 3
                && anchorKey !== ''
                && anchorKey !== this.activeConversation.anchorKey
            );

        if (shouldStartNewConversation) {
            this.conversationCounter += 1;
            this.activeConversation = {
                conversationId: `conv-${Date.now().toString(36)}-${this.conversationCounter.toString(36)}`,
                anchorKey,
                turn: 0,
                lastMessageCount: messages.length,
                lastSeenAt: Date.now(),
            };
        }

        const conversation = this.activeConversation;
        if (!conversation) {
            return this.app.llamaServer.createRequestTrace('lm-provider');
        }

        conversation.turn += 1;
        conversation.lastSeenAt = Date.now();
        conversation.lastMessageCount = messages.length;
        if (!conversation.anchorKey && anchorKey) {
            conversation.anchorKey = anchorKey;
        }

        const trace = this.app.llamaServer.createRequestTrace('lm-provider');
        trace.conversationId = conversation.conversationId;
        trace.conversationTurn = conversation.turn;
        return trace;
    }

    private recordConversationBudget(
        trace: RequestTraceContext,
        promptTokens: number,
        messageCount: number,
    ): void {
        if (!this.activeConversation || this.activeConversation.conversationId !== trace.conversationId) {
            return;
        }

        const previousPromptTokens = this.activeConversation.lastPromptTokens;
        const previousMessageCount = this.activeConversation.lastMessageCount;
        if (
            typeof previousPromptTokens === 'number'
            && promptTokens + 2048 < previousPromptTokens
            && messageCount <= previousMessageCount + 2
        ) {
            this.app.logger.addEventLog(
                'CONVERSATION',
                'COMPACTED',
                [
                    `conversation_id=${trace.conversationId}`,
                    `conversation_turn=${trace.conversationTurn ?? 'unknown'}`,
                    `prompt_tokens_before=${previousPromptTokens}`,
                    `prompt_tokens_after=${promptTokens}`,
                    `messages_before=${previousMessageCount}`,
                    `messages_after=${messageCount}`,
                ].join(' | ')
            );
        }

        this.activeConversation.lastPromptTokens = promptTokens;
        this.activeConversation.lastMessageCount = messageCount;
        this.activeConversation.lastSeenAt = Date.now();
    }

    private logConversationTextSnapshot(
        messages: readonly vscode.LanguageModelChatRequestMessage[],
        trace: RequestTraceContext,
    ): void {
        const textMessages = messages
            .map((message) => {
                const text = this.extractTextFromParts(message.content)
                    .replace(/\s+/g, ' ')
                    .trim();

                if (!text) {
                    return undefined;
                }

                return {
                    role: message.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
                    text,
                };
            })
            .filter((message): message is { role: 'user' | 'assistant'; text: string } => message !== undefined)
            .slice(-5);

        this.app.logger.addEventLog(
            'CONVERSATION',
            'TEXT_SNAPSHOT',
            [
                `conversation_id=${trace.conversationId ?? 'unknown'}`,
                `conversation_turn=${trace.conversationTurn ?? 'unknown'}`,
                `messages=${textMessages.length}`,
                ...textMessages.map((message, index) => `${index + 1}:${message.role}:${this.toLogSnippet(message.text)}`),
            ].join('\n')
        );
    }

    private logConversationPartSnapshot(
        messages: readonly vscode.LanguageModelChatRequestMessage[],
        trace: RequestTraceContext,
    ): void {
        const snapshotLines = messages
            .slice(-5)
            .map((message, messageIndex) => {
                const role = message.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant';
                const parts = message.content
                    .map((part, partIndex) => `${partIndex + 1}:${this.describePart(part)}`)
                    .join(' || ');
                return `${messageIndex + 1}:${role}:${parts || 'no-parts'}`;
            });

        this.app.logger.addEventLog(
            'CONVERSATION',
            'PART_SNAPSHOT',
            [
                `conversation_id=${trace.conversationId ?? 'unknown'}`,
                `conversation_turn=${trace.conversationTurn ?? 'unknown'}`,
                `messages=${Math.min(messages.length, 5)}`,
                ...snapshotLines,
            ].join('\n')
        );
    }

    private getConversationAnchorKey(messages: OpenAIChatMessage[]): string {
        const firstUserMessage = messages.find(
            (message) => message.role === 'user' && typeof message.content === 'string' && message.content.trim() !== ''
        );
        if (!firstUserMessage || typeof firstUserMessage.content !== 'string') {
            return '';
        }

        return firstUserMessage.content
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120)
            .toLowerCase();
    }

    private toOpenAIMessages(
        messages: readonly vscode.LanguageModelChatRequestMessage[],
    ): OpenAIChatMessage[] {
        const openaiMessages: OpenAIChatMessage[] = [];

        for (const msg of messages) {
            const textParts: string[] = [];
            const toolCalls: OpenAIToolCall[] = [];
            const toolResults: Array<{ callId: string; content: string }> = [];

            for (const part of msg.content) {
                if (part instanceof vscode.LanguageModelToolCallPart) {
                    toolCalls.push({
                        id: part.callId,
                        type: 'function',
                        function: {
                            name: part.name,
                            arguments: JSON.stringify(part.input ?? {}),
                        },
                    });
                    continue;
                }

                if (part instanceof vscode.LanguageModelToolResultPart) {
                    toolResults.push({
                        callId: part.callId,
                        content: this.stringifyToolResult(part.content),
                    });
                    continue;
                }

                const extractedText = this.extractTextFromPart(part);
                if (extractedText) {
                    textParts.push(extractedText);
                }
            }

            const textContent = textParts.join('');
            const role =
                msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant';

            if (role === 'assistant') {
                if (textContent || toolCalls.length > 0) {
                    openaiMessages.push({
                        role,
                        content: textContent || null,
                        ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
                    });
                }
                continue;
            }

            if (textContent) {
                openaiMessages.push({
                    role,
                    content: textContent,
                });
            }

            for (const toolResult of toolResults) {
                openaiMessages.push({
                    role: 'tool',
                    tool_call_id: toolResult.callId,
                    content: toolResult.content,
                });
            }
        }

        return openaiMessages;
    }

    private stringifyToolResult(content: readonly unknown[]): string {
        return content
            .map((item) => this.extractTextFromPart(item) || JSON.stringify(item))
            .filter((item) => item && item !== 'null' && item !== 'undefined')
            .join('\n');
    }

    private mapToolMode(
        toolMode: vscode.LanguageModelChatToolMode | undefined,
        toolCount: number,
    ): 'auto' | 'required' | undefined {
        if (!toolCount || toolMode === undefined) {
            return undefined;
        }

        if (toolMode === vscode.LanguageModelChatToolMode.Required) {
            return 'required';
        }

        return 'auto';
    }

    private async getRuntimeContextSizes(
        endpoint: string,
        models: OpenAICompatibleModel[],
        requestConfig: object
    ): Promise<Map<string, number>> {
        if (this.app.configuration.lm_max_input_tokens > 0 || !isLikelyLlamaCppProvider(models)) {
            return new Map();
        }

        if (models.length === 1) {
            const runtimeContextSize = await this.fetchRuntimeContextSize(
                buildRuntimePropsUrl(endpoint),
                requestConfig
            );
            return runtimeContextSize === undefined ? new Map() : new Map([[models[0].id, runtimeContextSize]]);
        }

        const runtimeContexts = await Promise.all(
            models.map(async (model) => {
                const runtimeContextSize = await this.fetchRuntimeContextSize(
                    buildRuntimePropsUrl(endpoint, model.id),
                    requestConfig
                );
                return [model.id, runtimeContextSize] as const;
            })
        );

        return new Map(
            runtimeContexts.filter(
                (entry): entry is readonly [string, number] => entry[1] !== undefined
            )
        );
    }

    private async fetchRuntimeContextSize(
        propsUrl: string,
        requestConfig: object
    ): Promise<number | undefined> {
        try {
            const propsResponse = await axios.get(propsUrl, requestConfig);
            return extractRuntimeContextSize(propsResponse.data);
        } catch {
            return undefined;
        }
    }

    private async getRuntimeTokenLimitsForRequest(
        endpoint: string,
        modelId: string,
        requestConfig: object,
        fallbackMaxInputTokens: number,
        fallbackMaxOutputTokens: number,
    ): Promise<{ maxInputTokens: number; maxOutputTokens: number }> {
        try {
            const response = await axios.get<OpenAIModelsResponse>(
                `${Utils.trimTrailingSlash(endpoint)}/${this.app.configuration.ai_api_version}/models`,
                requestConfig
            );

            const models = response.data?.data ?? [];
            const matchedModel =
                models.find((candidate) => candidate.id === modelId)
                ?? (models.length === 1 ? models[0] : undefined);

            if (!matchedModel) {
                return {
                    maxInputTokens: fallbackMaxInputTokens,
                    maxOutputTokens: fallbackMaxOutputTokens,
                };
            }

            let runtimeContextSize: number | undefined;
            if (this.app.configuration.lm_max_input_tokens <= 0 && isLikelyLlamaCppProvider([matchedModel])) {
                const propsUrl = models.length === 1
                    ? buildRuntimePropsUrl(endpoint)
                    : buildRuntimePropsUrl(endpoint, matchedModel.id);
                runtimeContextSize = await this.fetchRuntimeContextSize(propsUrl, requestConfig);
            }

            return resolveModelTokenLimits(matchedModel, {
                configuredMaxInputTokens: this.app.configuration.lm_max_input_tokens,
                configuredMaxOutputTokens: this.app.configuration.lm_max_output_tokens,
                runtimeContextSize,
                defaultMaxInputTokens: fallbackMaxInputTokens,
                defaultMaxOutputTokens: fallbackMaxOutputTokens,
            });
        } catch {
            return {
                maxInputTokens: fallbackMaxInputTokens,
                maxOutputTokens: fallbackMaxOutputTokens,
            };
        }
    }

    private getPositiveTokenLimit(value: number, fallback: number): number {
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }

    private formatUsageLogFields(usage: Record<string, unknown> | undefined): string[] {
        const completionTokenDetails = this.getRecordField(usage, 'completion_tokens_details');
        const promptTokenDetails = this.getRecordField(usage, 'prompt_tokens_details');

        return [
            `prompt_tokens=${this.getNumberField(usage, 'prompt_tokens') ?? 'unknown'}`,
            `completion_tokens=${this.getNumberField(usage, 'completion_tokens') ?? 'unknown'}`,
            `total_tokens=${this.getNumberField(usage, 'total_tokens') ?? 'unknown'}`,
            `reasoning_tokens=${this.getNumberField(completionTokenDetails, 'reasoning_tokens') ?? 'unknown'}`,
            `cached_prompt_tokens=${this.getNumberField(promptTokenDetails, 'cached_tokens') ?? 'unknown'}`,
        ];
    }

    private getRecordField(record: Record<string, unknown> | undefined, field: string): Record<string, unknown> | undefined {
        const value = record?.[field];
        return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
    }

    private getNumberField(record: Record<string, unknown> | undefined, field: string): number | undefined {
        const value = record?.[field];
        return typeof value === 'number' ? value : undefined;
    }

    private async getExactPromptTokens(
        messages: OpenAIChatMessage[],
        endpoint: string,
        modelId: string,
        requestConfig: object,
        trace: RequestTraceContext,
        tools?: unknown[],
        toolChoice?: 'auto' | 'required'
    ): Promise<number | undefined> {
        return this.app.llamaServer.countToolsPromptTokens(messages as any, '', {
            endpoint,
            model: modelId,
            requestConfig,
            trace,
            tools,
            toolChoice,
        });
    }

    private estimatePromptTokens(messages: readonly OpenAIChatMessage[]): number {
        // Fallback only: prefer server-side apply-template + tokenize whenever available.
        return estimateTokenCount(messages);
    }

    private extractTextFromParts(parts: readonly unknown[]): string {
        return parts
            .map((part) => this.extractTextFromPart(part))
            .filter((value): value is string => Boolean(value))
            .join('');
    }

    private extractProviderApiError(error: unknown): ProviderApiError {
        if (axios.isAxiosError(error)) {
            const responseData = error.response?.data as { error?: ProviderApiError } | ProviderApiError | undefined;
            if (responseData && typeof responseData === 'object' && 'error' in responseData && responseData.error) {
                return this.normalizeProviderApiError(responseData.error);
            }

            if (responseData && typeof responseData === 'object' && 'message' in responseData) {
                return this.normalizeProviderApiError(responseData);
            }

            return this.normalizeProviderApiError({
                message: error.message,
                ...(typeof error.response?.status === 'number' && { status: error.response.status }),
            });
        }

        if (error instanceof Error) {
            return { message: error.message };
        }

        return this.normalizeProviderApiError(error);
    }

    private normalizeProviderApiError(error: unknown): ProviderApiError {
        if (error && typeof error === 'object') {
            const record = error as Record<string, unknown>;
            return {
                message: typeof record.message === 'string' ? record.message : JSON.stringify(error),
                ...(typeof record.type === 'string' && { type: record.type }),
                ...(typeof record.status === 'number' && { status: record.status }),
                ...(typeof record.n_prompt_tokens === 'number' && { n_prompt_tokens: record.n_prompt_tokens }),
                ...(typeof record.n_ctx === 'number' && { n_ctx: record.n_ctx }),
            };
        }

        if (typeof error === 'string') {
            return { message: error };
        }

        return { message: String(error) };
    }

    private toProviderError(apiError: ProviderApiError, rawError: unknown): Error {
        if (apiError.status === 401 || apiError.status === 403) {
            return vscode.LanguageModelError.NoPermissions(apiError.message);
        }

        if (apiError.status === 404) {
            return vscode.LanguageModelError.NotFound(apiError.message);
        }

        if (apiError.status === 429) {
            return vscode.LanguageModelError.Blocked(apiError.message);
        }

        if (this.isContextWindowExceededError(apiError)) {
            const error = this.createContextWindowExceededError(apiError.n_prompt_tokens, apiError.n_ctx);
            error.cause = rawError;
            return error;
        }

        const error = new Error(apiError.message) as Error & { cause?: unknown };
        error.cause = rawError;
        error.name = 'LanguageModelProviderError';
        return error;
    }

    private isContextWindowExceededError(apiError: ProviderApiError): boolean {
        return /context_length_exceeded|exceeds the available context size|exceeds the context size/i.test(apiError.message);
    }

    private createContextWindowExceededError(
        promptTokens: number | undefined,
        maxInputTokens: number | undefined,
        details?: string,
    ): Error & { cause?: unknown } {
        const promptTokenText = typeof promptTokens === 'number' ? promptTokens.toString() : 'unknown';
        const maxInputTokenText = typeof maxInputTokens === 'number' ? maxInputTokens.toString() : 'unknown';
        const error = new Error(
            `This chat request exceeds the model context window (${promptTokenText} prompt tokens for a ${maxInputTokenText}-token limit). Start a new chat, compact the conversation again, or reduce the included context.${details ? ` ${details}` : ''}`
        ) as Error & { cause?: unknown };
        error.name = 'LanguageModelProviderError';
        // VS Code's chat fetch path formats verbose errors as
        // `${error.message}: ${error.stack}`. For this user-correctable preflight
        // case, suppress the stack so the UI doesn't duplicate the message.
        error.stack = undefined;
        return error;
    }

    private createEmptyResponseError(): Error & { cause?: unknown } {
        const error = new Error(
            'The model returned an empty response. Try again, compact the conversation again, or start a new chat.'
        ) as Error & { cause?: unknown };
        error.name = 'LanguageModelProviderError';
        error.stack = undefined;
        return error;
    }

    private createReasoningOnlyEmptyResponseError(): Error & { cause?: unknown } {
        const error = new Error(
            'The model used the entire output budget on internal reasoning and returned no visible answer. Try again, compact the conversation again, start a new chat, or disable reasoning for this model.'
        ) as Error & { cause?: unknown };
        error.name = 'LanguageModelProviderError';
        error.stack = undefined;
        return error;
    }

    private extractTextFromPart(part: unknown, depth = 0): string {
        if (depth > 4 || part === undefined || part === null) {
            return '';
        }

        if (typeof part === 'string') {
            return part;
        }

        if (part instanceof vscode.LanguageModelTextPart) {
            return part.value;
        }

        if (part instanceof vscode.LanguageModelDataPart) {
            const mimeType = part.mimeType.toLowerCase();
            if (mimeType.startsWith('text/') || mimeType === 'application/json') {
                return Buffer.from(part.data).toString('utf8');
            }
            return '';
        }

        if (part instanceof vscode.LanguageModelPromptTsxPart) {
            return this.extractTextFromPart(part.value, depth + 1);
        }

        if (Array.isArray(part)) {
            return part.map((item) => this.extractTextFromPart(item, depth + 1)).join('');
        }

        if (typeof part === 'object') {
            const record = part as Record<string, unknown>;
            const candidateKeys = ['text', 'value', 'content', 'children', 'prompt', 'message'];
            return candidateKeys
                .filter((key) => key in record)
                .map((key) => this.extractTextFromPart(record[key], depth + 1))
                .join('');
        }

        return '';
    }

    private describePart(part: unknown): string {
        if (part instanceof vscode.LanguageModelTextPart) {
            return `Text(${this.toLogSnippet(part.value)})`;
        }

        if (part instanceof vscode.LanguageModelToolCallPart) {
            return `ToolCall(${part.name})`;
        }

        if (part instanceof vscode.LanguageModelToolResultPart) {
            return `ToolResult(${part.callId}, parts=${part.content.length})`;
        }

        if (part instanceof vscode.LanguageModelPromptTsxPart) {
            return `PromptTsx(${this.toLogSnippet(this.previewUnknown(part.value))})`;
        }

        if (part instanceof vscode.LanguageModelDataPart) {
            const preview = part.mimeType.startsWith('text/') || part.mimeType === 'application/json'
                ? this.toLogSnippet(Buffer.from(part.data).toString('utf8'))
                : `bytes=${part.data.byteLength}`;
            return `Data(${part.mimeType}, ${preview})`;
        }

        if (typeof part === 'string') {
            return `String(${this.toLogSnippet(part)})`;
        }

        return `${this.getPartKind(part)}(${this.toLogSnippet(this.previewUnknown(part))})`;
    }

    private getPartKind(part: unknown): string {
        if (part === null) {
            return 'Null';
        }

        if (part === undefined) {
            return 'Undefined';
        }

        if (typeof part !== 'object') {
            return typeof part;
        }

        const constructorName = (part as { constructor?: { name?: string } }).constructor?.name;
        return constructorName || 'Object';
    }

    private previewUnknown(part: unknown): string {
        try {
            if (typeof part === 'string') {
                return part;
            }

            return JSON.stringify(part);
        } catch {
            return String(part);
        }
    }

    private toLogSnippet(text: string): string {
        if (text.length <= 60) {
            return text;
        }

        return `${text.slice(0, 60)}...`;
    }

    private toOpenAIMessage(msg: vscode.LanguageModelChatRequestMessage): OpenAIChatMessage {
        return {
            role: msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
            content: this.extractTextFromParts(msg.content),
        };
    }
}
