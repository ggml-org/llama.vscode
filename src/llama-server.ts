import axios from "axios";
import {Application} from "./application";
import vscode, { Terminal } from "vscode";
import { LlmModel, LlamaChatResponse, LlamaResponse, ChatMessage } from "./types";
import { Utils } from "./utils";
import * as cp from 'child_process';
import * as util from 'util';

const STATUS_OK = 200;

export interface LlamaToolsResponse {
    choices: [{
        message:{content?: string, tool_calls?:[{id:string, function: {name:string, arguments: string}}]},
        finish_reason?: string,
        
    }];
}

export interface LlamaEmbeddingsResponse {
    "model": string,
    "object": string,
    "usage": {
        "prompt_tokens": number,
        "total_tokens": number
    },
    "data": [
        {
        "embedding": number[],
        "index": number,
        "object": string
        }
    ]
}

export class LlamaServer {
    private app: Application
    private vsCodeFimTerminal: Terminal | undefined;
    private vsCodeChatTerminal: Terminal | undefined;
    private vsCodeEmbeddingsTerminal: Terminal | undefined;
    private vsCodeTrainTerminal: Terminal | undefined;
    private vsCodeCommandTerminal: Terminal | undefined;
    private vsCodeToolsTerminal: Terminal | undefined;
    private aiModel = "";
    private readonly defaultRequestParams = {
        top_k: 40,
        top_p: 0.99,
        stream: false,
        samplers: ["top_k", "top_p", "infill"],
        cache_prompt: true,
    } as const;

    constructor(application: Application) {
        this.app = application;
        this.vsCodeFimTerminal = undefined;
        this.vsCodeChatTerminal = undefined;
        this.vsCodeEmbeddingsTerminal = undefined;
        this.vsCodeTrainTerminal = undefined;
        this.vsCodeCommandTerminal = undefined;
        this.vsCodeToolsTerminal = undefined;
    }

    private async handleOpenAICompletion(
        chunks: any[],
        inputPrefix: string,
        inputSuffix: string,
        prompt: string,
        isPreparation = false
    ): Promise<LlamaResponse | void> {
        const client = this.app.configuration.openai_client;
        if (!client) return;

        const additional_context = chunks.length > 0 ? "Context:\n\n" + chunks.join("\n") : "";

        const replacements = {
            inputPrefix: inputPrefix.slice(-this.app.configuration.n_prefix),
            prompt: prompt,
            inputSuffix: inputSuffix.slice(0, this.app.configuration.n_suffix),
        };

        const rsp = await client.completions.create({
            model: this.app.configuration.openai_client_model || "",
            prompt: additional_context + this. app.prompts.replacePlaceholders(this.app.configuration.openai_prompt_template, replacements),
            max_tokens: this.app.configuration.n_predict,
            temperature: 0.1,
            top_p: this.defaultRequestParams.top_p,
            stream: this.defaultRequestParams.stream,
        });

        if (isPreparation) return;

        return {
            content: rsp.choices[0].text,
            generation_settings: {
                finish_reason: rsp.choices[0].finish_reason,
                model: rsp.model,
                created: rsp.created,
            },
            timings: {
                prompt_ms: rsp.usage?.prompt_tokens,
                predicted_ms: rsp.usage?.completion_tokens,
                predicted_n: rsp.usage?.total_tokens,
            },
        };
    }

    private createRequestPayload(noPredict: boolean, inputPrefix: string, inputSuffix: string, chunks: any[], prompt: string, model: string, nindent?: number) {
        if (noPredict) {
            return {
                input_prefix: inputPrefix,
                input_suffix: inputSuffix,
                input_extra: chunks,
                prompt,
                n_predict: 0,
                samplers: [],
                cache_prompt: true,
                t_max_prompt_ms: this.app.configuration.t_max_prompt_ms,
                t_max_predict_ms: 1,
                ...(this.app.configuration.lora_completion.trim() != "" && { lora: [{ id: 0, scale: 0.5 }] })
            };
        }

        return {
            input_prefix: inputPrefix,
            input_suffix: inputSuffix,
            input_extra: chunks,
            prompt,
            n_predict: this.app.configuration.n_predict,
            ...this.defaultRequestParams,
            ...(nindent && { n_indent: nindent }),
            t_max_prompt_ms: this.app.configuration.t_max_prompt_ms,
            t_max_predict_ms: this.app.configuration.t_max_predict_ms,
            ...(this.app.configuration.lora_completion.trim() != "" && { lora: [{ id: 0, scale: 0.5 }] }),
            ...(model.trim() != "" && { model: model})
        };
    }

    private createChatEditRequestPayload(instructions: string, originalText: string, context: string, model: string) {
        const replacements = {
            instructions: instructions,
            originalText: originalText,
        }
        return {
            "messages": [
              {
                "role": "system",
                "content": "You are an expert coder."
              },
              {
                "role": "user",
                "content": this.app.prompts.replacePlaceholders(this.app.prompts.CHAT_EDIT_TEXT, replacements)
              }
            ],
            "stream": false,
            "cache_prompt": true,
            "temperature": 0.8,
            "top_p": 0.95,
            ...(this.app.configuration.lora_chat.trim() != "" && { lora: [{ id: 0, scale: 0.5 }] }),
            ...(model.trim() != "" && { model: model}),
          };
    }

    // Helper – removes every thought block, regardless of format
    // -------------------------------------------------------------
    /**
     * Strip all “thought” sections from a message string.
     *
     * Supported formats:
     *   <think> … </think>
     *   <|channel|>analysis<|message|> … <|end|>
     *
     * If the input is `null` the function returns `null` unchanged.
     */
    private stripThoughts(content: string | null): string | null {
        if (content === null) return null;

        // Opening tags: <think>  OR  <|channel|>analysis<|message|>
        const OPEN = /<think>|<\|channel\|>analysis<\|message\|>/g;

        // Closing tags: </think>  OR  <|end|>
        const CLOSE = /<\/think>|<\|end\|>/g;

        // Build a single regex that matches an opening tag, anything (lazy),
        // then a closing tag.
        const THOUGHT_BLOCK = new RegExp(
            `(?:${OPEN.source})[\\s\\S]*?(?:${CLOSE.source})`,
            'g'
        );

        // Remove every thought block and trim the result.
        return content.replace(THOUGHT_BLOCK, '').trim();
    }

    // -------------------------------------------------------------
    // Public utility – filter thought from an array of messages
    // -------------------------------------------------------------
    private filterThoughtFromMsgs(messages:any) {
    return messages.map((msg:any) => {
        // Non‑assistant messages never contain thoughts, return them untouched.
        if (msg.role !== 'assistant') {
        return msg;
        }

        // `msg.content` is guaranteed to be a string for assistants,
        // but we stay defensive and accept `null` as well.
        const originalContent = msg.content as string | null;
        const cleanedContent = this.stripThoughts(originalContent);

        // Preserve every other field (name, function_call, …) unchanged.
        return {
        ...msg,
        content: cleanedContent,
        };
    });
    }

    private createChatRequestPayload(content: string, model: string) {
        return {
            "messages": [
              {
                "role": "system",
                "content": "You are an expert coder."
              },
              {
                "role": "user",
                "content": content
              }
            ],
            "stream": false,
            "temperature": 0.8,
            ...(this.app.configuration.lora_chat.trim() != "" && { lora: [{ id: 0, scale: 0.5 }] }),
            ...(model.trim() != "" && { model: model}),
          };
    }

    private createToolsRequestPayload(messages: ChatMessage[], model: string, stream = false) {
        this.app.tools.addSelectedTools();
        let filteredMsgs = this.filterThoughtFromMsgs(messages)
        return {
            "messages": filteredMsgs,
            "stream": stream,
            "temperature": 0.8,
            "top_p": 0.95,
            ...(model.trim() != "" && { model: model}),
            "tools": [...this.app.tools.tools,  ...this.app.tools.vscodeTools],
            "tool_choice": "auto"
        };
    }

    private createGetSummaryRequestPayload(messages: ChatMessage[], model: string) {
        let filteredMsgs = this.filterThoughtFromMsgs(messages)
        const summaryPromptMsgs: ChatMessage[] = [
            {
            role: 'system',
            content: `Summarize the conversation concisely, preserving technical details and code solutions.`
            },
            ...filteredMsgs
        ];
        return {
            "messages": summaryPromptMsgs,
            "stream": false,
            "temperature": 0.8,
            "top_p": 0.95,
            ...(model.trim() != "" && { model: model})
        };
    }

    getFIMCompletion = async (
        inputPrefix: string,
        inputSuffix: string,
        prompt: string,
        chunks: any,
        nindent: number
    ): Promise<LlamaResponse | undefined> => {
        // If the server is OpenAI compatible, use the OpenAI API to get the completion
        if (this.app.configuration.use_openai_endpoint) {
            const response = await this.handleOpenAICompletion(chunks, inputPrefix, inputSuffix, prompt);
            return response || undefined;
        }

        // else, default to llama.cpp
        let { endpoint, model, requestConfig } = this.getComplModelProperties();
        if (!endpoint) { 
            const selectionMessate =  "Select a completion model or an env with completion model to use code completion (code suggestions by AI)."
            const shouldSelectModel = await Utils.showUserChoiceDialog(selectionMessate, "Select Env")
            if (shouldSelectModel){
                this.app.menu.showEnvView();
                vscode.window.showInformationMessage("After the completion model is loaded, try again using code completion.")
                return;
            } else {
                const shouldDisable = await Utils.showYesNoDialog("Do you want to disable completions? (You could enable them from llama-vscode menu.)")
                if (shouldDisable) {
                    await this.app.menu.setCompletion(false);
                    vscode.window.showInformationMessage("The completions are disabled. You could enable them from llama-vscode menu.")
                }
                else vscode.window.showErrorMessage("No endpoint for the completion (fim) model. Select an env with completion model or enter the endpoint of a running llama.cpp server with completion (fim) model in setting endpoint. ")
                return;
            }
        }

        const response = await axios.post<LlamaResponse>(
            `${Utils.trimTrailingSlash(endpoint)}/infill`,
            this.createRequestPayload(false, inputPrefix, inputSuffix, chunks, prompt, model, nindent),
            requestConfig
        );

        return response.status === STATUS_OK ? response.data : undefined;
    };

    getChatEditCompletion = async (
        instructions: string,
        originalText: string,
        context: string,
        chunks: any,
        nindent: number
    ): Promise<LlamaChatResponse | undefined> => {
        let selectedModel: LlmModel = this.app.menu.getChatModel();
        let { endpoint, model, requestConfig } = this.getChatModelProperties(selectedModel);

        const response = await axios.post<LlamaChatResponse>(
            `${Utils.trimTrailingSlash(endpoint)}/${this.app.configuration.ai_api_version}/chat/completions`,
            this.createChatEditRequestPayload(instructions, originalText, context, model),
            requestConfig
        );

        return response.status === STATUS_OK ? response.data : undefined;
    };

    getChatCompletion = async (
        prompt: string,
    ): Promise<LlamaChatResponse | undefined> => {
        let selectedModel: LlmModel = this.app.menu.getChatModel();
        let { endpoint, model, requestConfig } = this.getChatModelProperties(selectedModel);

        const response = await axios.post<LlamaChatResponse>(
            `${Utils.trimTrailingSlash(endpoint)}/${this.app.configuration.ai_api_version}/chat/completions`,
            this.createChatRequestPayload(prompt, model),
            requestConfig
        );

        return response.status === STATUS_OK ? response.data : undefined;
    };

    getAgentCompletion = async (
        messages: ChatMessage[],
        isSummarization = false,
        onDelta?: (delta: string) => void,
        abortSignal?: AbortSignal
    ): Promise<LlamaToolsResponse | undefined> => {
        let selectedModel: LlmModel = this.app.menu.getToolsModel();
        let model = this.app.configuration.ai_model;
        if (selectedModel?.aiModel !== undefined && selectedModel.aiModel) model = selectedModel.aiModel;

        let endpoint = this.app.configuration.endpoint_tools;
        if (selectedModel?.endpoint !== undefined && selectedModel.endpoint) endpoint = selectedModel.endpoint;
        
        let requestConfig = this.app.configuration.axiosRequestConfigTools;
        if (selectedModel?.isKeyRequired !== undefined && selectedModel.isKeyRequired){
            const apiKey = this.app.persistence.getApiKey(selectedModel.endpoint??"");
            if (apiKey){
                requestConfig = {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                }
            }
        }
        
        let uri = `${Utils.trimTrailingSlash(endpoint)}/${this.app.configuration.ai_api_version}/chat/completions`;
        let request: any;
        
        if (isSummarization) {
            request = this.createGetSummaryRequestPayload(messages, model);
            const response = await axios.post<LlamaToolsResponse>(
                uri,
                request,
                { ...requestConfig, signal: abortSignal }
            );
            return response.status === STATUS_OK ? response.data : undefined;
        }

        // Streaming branch for tools/agent calls
        request = this.createToolsRequestPayload(messages, model, true);

        try {
            const streamResponse = await axios.post<any>(
                uri,
                request,
                { ...requestConfig, responseType: 'stream' as const, signal: abortSignal }
            );

            return await new Promise<LlamaToolsResponse | undefined>((resolve) => {
                const readable = streamResponse.data as NodeJS.ReadableStream;
                let buffer = "";
                let fullContent = "";
                let finishReason: string | undefined = undefined;
                const toolCalls: any[] = [];
                const message: any = { role: 'assistant', content: null as string | null };

                const finalize = () => {
                    message.content = fullContent || null;
                    if (toolCalls.length > 0) message.tool_calls = toolCalls;
                    resolve({
                        choices: [{
                            message,
                            finish_reason: finishReason,
                        }]
                    });
                };

                // Handle abort signal
                if (abortSignal) {
                    abortSignal.addEventListener('abort', () => {
                        (readable as any).destroy?.();
                        resolve(undefined);
                    });
                }

                readable.on('data', (chunk: Buffer) => {
                    buffer += chunk.toString('utf8');
                    const lines = buffer.split(/\r?\n/);
                    buffer = lines.pop() || "";
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        if (!trimmed.startsWith('data:')) continue;
                        const payload = trimmed.slice(5).trim();
                        if (payload === '[DONE]') {
                            finalize();
                            readable.removeAllListeners();
                            return;
                        }
                        try {
                            const json = JSON.parse(payload);
                            const choice = json.choices && json.choices[0] ? json.choices[0] : undefined;
                            if (!choice) continue;

                            // Finish reason may appear on a later chunk
                            if (choice.finish_reason) finishReason = choice.finish_reason;

                            const delta = choice.delta || choice.message || {};
                            if (delta.role && !message.role) message.role = delta.role;

                            if (typeof delta.content === 'string') {
                                fullContent += delta.content;
                                if (onDelta) onDelta(delta.content);
                            }

                            if (Array.isArray(delta.tool_calls)) {
                                for (const tc of delta.tool_calls) {
                                    const idx = typeof tc.index === 'number' ? tc.index : 0;
                                    if (!toolCalls[idx]) {
                                        toolCalls[idx] = { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
                                    }
                                    const tgt = toolCalls[idx];
                                    if (tc.id) tgt.id = tc.id;
                                    if (tc.function) {
                                        if (tc.function.name) tgt.function.name = tc.function.name;
                                        if (tc.function.arguments) tgt.function.arguments = (tgt.function.arguments || '') + tc.function.arguments;
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore malformed chunks
                        }
                    }
                });

                readable.on('end', () => {
                    if (!finishReason) finishReason = 'stop';
                    finalize();
                });

                readable.on('error', () => {
                    resolve(undefined);
                });
            });
        } catch (err) {
            return undefined;
        }
    };

    

    updateExtraContext = (chunks: any[]): void => {
        // If the server is OpenAI compatible, use the OpenAI API to prepare for the next FIM
        if (this.app.configuration.use_openai_endpoint) {
            return;
        }

        // else, make a request to the API to prepare for the next FIM
        let { endpoint, model, requestConfig } = this.getComplModelProperties();
        axios.post<LlamaResponse>(
            `${Utils.trimTrailingSlash(endpoint)}/infill`,
            this.createRequestPayload(true, "", "", chunks, "", model, undefined),
            requestConfig
        );
    };

    getEmbeddings = async (text: string): Promise<LlamaEmbeddingsResponse | undefined> => {
        try {
            let selectedModel: LlmModel = this.app.menu.getEmbeddingsModel();
            let model = this.app.configuration.ai_model;
            if (selectedModel.aiModel) model = selectedModel.aiModel;

            let endpoint = this.app.configuration.endpoint_embeddings;
            if (selectedModel.endpoint) endpoint = selectedModel.endpoint;
            
            let requestConfig = this.app.configuration.axiosRequestConfigEmbeddings;
            if (selectedModel.isKeyRequired){
                const apiKey = this.app.persistence.getApiKey(selectedModel.endpoint??"");
                if (apiKey){
                    requestConfig = {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            "Content-Type": "application/json",
                        },
                    }
                }
            }
            
            const response = await axios.post<LlamaEmbeddingsResponse>(
                `${Utils.trimTrailingSlash(endpoint)}/v1/embeddings`,
                {
                    "input": text,
                    // "model": "GPT-4",
                    ...(model.trim() != "" && { model: model}),
                    "encoding_format": "float"
                },
                requestConfig
            );
            return response.data;
        } catch (error: any) {
            console.error('Failed to get embeddings:', error);
            vscode.window.showInformationMessage(this.app.configuration.getUiText("Error getting embeddings") + " " + error.message);
            return undefined;
        }


    };

    shellFimCmd = (launchCmd: string): void => {
        if (!launchCmd) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("There is no command to execute.")??"");
            return;
        }
        try {
            this.vsCodeFimTerminal = vscode.window.createTerminal({
                name: 'llama.cpp Completion Terminal'
            });
            this.vsCodeFimTerminal.show(true);
            this.vsCodeFimTerminal.sendText(launchCmd);
        } catch(err){
            if (err instanceof Error) {
                vscode.window.showInformationMessage(this.app.configuration.getUiText("Error executing command") + " " + launchCmd +" : " + err.message);
            }
        }
    }

    shellChatCmd = (launchCmd: string): void => {
        if (!launchCmd) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("There is no command to execute.")??"");
            return;
        }
        try {
            this.vsCodeChatTerminal = vscode.window.createTerminal({
                name: 'llama.cpp Chat Terminal'
            });
            this.vsCodeChatTerminal.show(true);
            this.vsCodeChatTerminal.sendText(launchCmd);
        } catch(err){
            if (err instanceof Error) {
                vscode.window.showInformationMessage(this.app.configuration.getUiText("Error executing command") + " " + launchCmd +" : " + err.message);
            }
        }
    }

    shellEmbeddingsCmd = (launchCmd: string): void => {
        if (!launchCmd) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("There is no command to execute.")??"");
            return;
        }
        try {
            this.vsCodeEmbeddingsTerminal = vscode.window.createTerminal({
                name: 'llama.cpp Embeddings Terminal'
            });
            this.vsCodeEmbeddingsTerminal.show(true);
            this.vsCodeEmbeddingsTerminal.sendText(launchCmd);
        } catch(err){
            if (err instanceof Error) {
                vscode.window.showInformationMessage(this.app.configuration.getUiText("Error executing command") + " " + launchCmd +" : " + err.message);
            }
        }
    }

    shellToolsCmd = (launchCmd: string): void => {
        if (!launchCmd) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("There is no command to execute.")??"");
            return;
        }
        try {
            this.vsCodeToolsTerminal = vscode.window.createTerminal({
                name: 'llama.cpp Tools Terminal'
            });
            this.vsCodeToolsTerminal.show(true);
            this.vsCodeToolsTerminal.sendText(launchCmd);
        } catch(err){
            if (err instanceof Error) {
                vscode.window.showInformationMessage(this.app.configuration.getUiText("Error executing command") + " " + launchCmd +" : " + err.message);
            }
        }
    }

    shellTrainCmd = (trainCmd: string): void => {
        if (!trainCmd) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("There is no command to execute.")??"");
            return;
        }
        try {
            this.vsCodeTrainTerminal = vscode.window.createTerminal({
                name: 'llama.cpp Train Terminal'
            });
            this.vsCodeTrainTerminal.show(true);
            this.vsCodeTrainTerminal.sendText(trainCmd);
        } catch(err){
            if (err instanceof Error) {
                vscode.window.showInformationMessage(this.app.configuration.getUiText("Error executing command") + " " + trainCmd +" : " + err.message);
            }
        }
    }

    shellCommandCmd = (cmd: string): void => {
        if (!cmd) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("There is no command to execute.")??"");
            return;
        }
        try {
            this.vsCodeCommandTerminal = vscode.window.createTerminal({
                name: 'Command Terminal'
            });
            this.vsCodeCommandTerminal.show(true);
            this.vsCodeCommandTerminal.sendText(cmd);
        } catch(err){
            if (err instanceof Error) {
                vscode.window.showInformationMessage(this.app.configuration.getUiText("Error executing command") + " " + cmd +" : " + err.message);
            }
        }
    }

    executeCommandWithTerminalFeedback = async (
        command: string
    ): Promise<{ stdout: string; stderr: string }> => {
        const exec = util.promisify(cp.exec);
        this.killCommandCmd();
        // Create terminal for user feedback
        // const terminal = vscode.window.createTerminal(terminalName);
        // if (!this.vsCodeCommandTerminal){
            this.vsCodeCommandTerminal = vscode.window.createTerminal({
                name: 'llama-vscode Command Terminal'
            });
        // }
        
        this.vsCodeCommandTerminal.show(true);
        this.vsCodeCommandTerminal.sendText(`echo "Executing: ${command}"`);
        try {
            // Execute command programmatically for reliable output
            const { stdout, stderr } = await exec(command);
            // Show output in   terminal
            this.vsCodeCommandTerminal.sendText(`echo "Command completed successfully"`);
            this.vsCodeCommandTerminal.sendText(`echo "Output: ${stdout.trim()}"`);
            
            return { stdout, stderr };
        } catch (error: any) {
            this.vsCodeCommandTerminal.sendText(`echo "Command failed: ${error.message}"`);
            return { stdout: "", stderr: error.message };
        } finally {
            // Keep terminal open for a bit, then dispose
            // setTimeout(() => terminal.dispose(), 5000);
        }
    }

    killFimCmd = (): void => {
        if (this.vsCodeFimTerminal) {
            this.vsCodeFimTerminal.dispose();
            this.vsCodeFimTerminal = undefined;
        }
    }

    isFimRunning = (): boolean => {
        if (this.vsCodeFimTerminal) return true;
        else return false;
    }

    killChatCmd = (): void => {
        if (this.vsCodeChatTerminal) {
            this.vsCodeChatTerminal.dispose();
            this.vsCodeChatTerminal = undefined;
        }
    }

    isChatRunning = (): boolean => {
        if (this.vsCodeChatTerminal) return true;
        else return false;
    }

    killEmbeddingsCmd = (): void => {
        if (this.vsCodeEmbeddingsTerminal) {
            this.vsCodeEmbeddingsTerminal.dispose();
            this.vsCodeEmbeddingsTerminal = undefined;
        }
    }

    isEmbeddingsRunning = (): boolean => {
        if (this.vsCodeEmbeddingsTerminal) return true;
        else return false;
    }

    isToolsRunning = (): boolean => {
        if (this.vsCodeToolsTerminal) return true;
        else return false;
    }

    killTrainCmd = (): void => {
        if (this.vsCodeTrainTerminal) {
            this.vsCodeTrainTerminal.dispose();
            this.vsCodeChatTerminal = undefined;
        }
    }

    killCommandCmd = (): void => {
        if (this.vsCodeCommandTerminal) {
            this.vsCodeCommandTerminal.dispose();
            this.vsCodeCommandTerminal = undefined;
        }
    }
    
    killToolsCmd = (): void => {
        if (this.vsCodeToolsTerminal) {
            this.vsCodeToolsTerminal.dispose();
            this.vsCodeToolsTerminal = undefined;
        }
    }



    private getChatModelProperties(selectedModel: LlmModel) {
        let model = this.app.configuration.ai_model;
        if (selectedModel?.aiModel !== undefined && selectedModel.aiModel) model = selectedModel.aiModel;

        let endpoint = this.app.configuration.endpoint_chat;
        if (selectedModel?.endpoint !== undefined && selectedModel.endpoint) endpoint = selectedModel.endpoint;

        let requestConfig = this.app.configuration.axiosRequestConfigChat;
        if (selectedModel?.isKeyRequired !== undefined && selectedModel.isKeyRequired) {
            const apiKey = this.app.persistence.getApiKey(selectedModel.endpoint??"");
            if (apiKey) {
                requestConfig = {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                };
            }
        }
        return { endpoint, model, requestConfig };
    }

    private getComplModelProperties() {
        const selectedComplModel: LlmModel = this.app.menu.getComplModel();
        let model = this.app.configuration.ai_model;
        if (selectedComplModel?.aiModel !== undefined && selectedComplModel.aiModel) model = selectedComplModel.aiModel;

        let endpoint = this.app.configuration.endpoint;
        if (selectedComplModel?.endpoint !== undefined && selectedComplModel.endpoint) endpoint = selectedComplModel.endpoint;

        let requestConfig = this.app.configuration.axiosRequestConfigCompl;
        if (selectedComplModel?.isKeyRequired !== undefined && selectedComplModel.isKeyRequired) {
            const apiKey = this.app.persistence.getApiKey(selectedComplModel.endpoint??"");
            if (apiKey) {
                requestConfig = {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                };
            }
        }
        return { endpoint, model, requestConfig };
    }
}
