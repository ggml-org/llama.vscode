import axios from "axios";
import {Application} from "./application";
import vscode, { Terminal } from "vscode";
import {Utils} from "./utils";

const STATUS_OK = 200;

export interface LlamaResponse {
    content?: string;
    generation_settings?: any;
    tokens_cached?: number;
    truncated?: boolean;
    timings?: {
        prompt_n?: number;
        prompt_ms?: number;
        prompt_per_second?: number;
        predicted_n?: number;
        predicted_ms?: number;
        predicted_per_second?: number;
    };
}

export interface LlamaChatResponse {
    choices: [{message:{content?: string}}];
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
    }

    private async handleOpenAICompletion(
        chunks: any[],
        inputPrefix: string,
        inputSuffix: string,
        prompt: string,
        isPreparation = false
    ): Promise<LlamaResponse | void> {
        const client = this.app.extConfig.openai_client;
        if (!client) return;

        const additional_context = chunks.length > 0 ? "Context:\n\n" + chunks.join("\n") : "";

        const replacements = {
            inputPrefix: inputPrefix.slice(-this.app.extConfig.n_prefix),
            prompt: prompt,
            inputSuffix: inputSuffix.slice(0, this.app.extConfig.n_suffix),
        };

        const rsp = await client.completions.create({
            model: this.app.extConfig.openai_client_model || "",
            prompt: additional_context + this. app.prompts.replacePlaceholders(this.app.extConfig.openai_prompt_template, replacements),
            max_tokens: this.app.extConfig.n_predict,
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

    private createRequestPayload(noPredict: boolean, inputPrefix: string, inputSuffix: string, chunks: any[], prompt: string, nindent?: number) {
        if (noPredict) {
            return {
                input_prefix: inputPrefix,
                input_suffix: inputSuffix,
                input_extra: chunks,
                prompt,
                n_predict: 0,
                samplers: [],
                cache_prompt: true,
                t_max_prompt_ms: this.app.extConfig.t_max_prompt_ms,
                t_max_predict_ms: 1,
                ...(this.app.extConfig.lora_completion.trim() != "" && { lora: [{ id: 0, scale: 0.5 }] })
            };
        }

        return {
            input_prefix: inputPrefix,
            input_suffix: inputSuffix,
            input_extra: chunks,
            prompt,
            n_predict: this.app.extConfig.n_predict,
            ...this.defaultRequestParams,
            ...(nindent && { n_indent: nindent }),
            t_max_prompt_ms: this.app.extConfig.t_max_prompt_ms,
            t_max_predict_ms: this.app.extConfig.t_max_predict_ms,
            ...(this.app.extConfig.lora_completion.trim() != "" && { lora: [{ id: 0, scale: 0.5 }] })
        };
    }

    private createChatEditRequestPayload(noPredict: boolean, instructions: string, originalText: string, chunks: any[], context: string, nindent?: number) {
        const CHUNKS_PLACEHOLDER = "[chunks]";
        const INSTRUCTIONS_PLACEHOLDER = "[instructions]";
        const ORIGINAL_TEXT_PLACEHOLDER = "[originalText]";
        const CONTEXT_PLACEHOLDER = "[context]";
        // let editTextTemplate = `${CHUNKS_PLACEHOLDER}\n\nModify the following original code according to the instructions. Output only the modified code. No explanations.\n\ninstructions:\n${INSTRUCTIONS_PLACEHOLDER}\n\noriginal code:\n${ORIGINAL_TEXT_PLACEHOLDER}\n\nmodified code:`
        if (noPredict) {
            return {
                // input_extra: chunks,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert coder."
                    },
                    {
                        "role": "user",
                        "content": context
                    }
                ],
                n_predict: 0,
                samplers: [],
                cache_prompt: true,
                t_max_prompt_ms: this.app.extConfig.t_max_prompt_ms,
                t_max_predict_ms: 1,
                ...(this.app.extConfig.lora_completion.trim() != "" && { lora: [{ id: 0, scale: 0.5 }] })
            };
        }
        const replacements = {
            chunks: Utils.getChunksInPlainText(chunks),
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
            "samplers": "edkypmxt",
            "temperature": 0.8,
            "dynatemp_range": 0,
            "dynatemp_exponent": 1,
            "top_k": 40,
            "top_p": 0.95,
            "min_p": 0.05,
            "typical_p": 1,
            "xtc_probability": 0,
            "xtc_threshold": 0.1,
            "repeat_last_n": 64,
            "repeat_penalty": 1,
            "presence_penalty": 0,
            "frequency_penalty": 0,
            "dry_multiplier": 0,
            "dry_base": 1.75,
            "dry_allowed_length": 2,
            "dry_penalty_last_n": -1,
            "max_tokens": -1,
            "timings_per_token": false,
            ...(this.app.extConfig.lora_chat.trim() != "" && { lora: [{ id: 0, scale: 0.5 }] })
          };
    }

    private createChatRequestPayload(content: string) {
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
            "cache_prompt": true,
            "samplers": "edkypmxt",
            "temperature": 0.8,
            "dynatemp_range": 0,
            "dynatemp_exponent": 1,
            "top_k": 40,
            "top_p": 0.95,
            "min_p": 0.05,
            "typical_p": 1,
            "xtc_probability": 0,
            "xtc_threshold": 0.1,
            "repeat_last_n": 64,
            "repeat_penalty": 1,
            "presence_penalty": 0,
            "frequency_penalty": 0,
            "dry_multiplier": 0,
            "dry_base": 1.75,
            "dry_allowed_length": 2,
            "dry_penalty_last_n": -1,
            "max_tokens": -1,
            "timings_per_token": false,
            ...(this.app.extConfig.lora_chat.trim() != "" && { lora: [{ id: 0, scale: 0.5 }] })
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
        if (this.app.extConfig.use_openai_endpoint) {
            const response = await this.handleOpenAICompletion(chunks, inputPrefix, inputSuffix, prompt);
            return response || undefined;
        }

        // else, default to llama.cpp
        const response = await axios.post<LlamaResponse>(
            `${this.app.extConfig.endpoint}/infill`,
            this.createRequestPayload(false, inputPrefix, inputSuffix, chunks, prompt, nindent),
            this.app.extConfig.axiosRequestConfig
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
        const response = await axios.post<LlamaChatResponse>(
            `${this.app.extConfig.endpoint_chat}/v1/chat/completions`,
            this.createChatEditRequestPayload(false, instructions, originalText, chunks, context, nindent),
            this.app.extConfig.axiosRequestConfig
        );

        return response.status === STATUS_OK ? response.data : undefined;
    };

    getChatCompletion = async (
        prompt: string,
    ): Promise<LlamaChatResponse | undefined> => {
        const response = await axios.post<LlamaChatResponse>(
            `${this.app.extConfig.endpoint_chat}/v1/chat/completions`,
            this.createChatRequestPayload(prompt),
            this.app.extConfig.axiosRequestConfig
        );

        return response.status === STATUS_OK ? response.data : undefined;
    };

    updateExtraContext = (chunks: any[]): void => {
        // If the server is OpenAI compatible, use the OpenAI API to prepare for the next FIM
        if (this.app.extConfig.use_openai_endpoint) {
            return;
        }

        // else, make a request to the API to prepare for the next FIM
        axios.post<LlamaResponse>(
            `${this.app.extConfig.endpoint}/infill`,
            this.createRequestPayload(true, "", "", chunks, "", undefined),
            this.app.extConfig.axiosRequestConfig
        );
    };

    getEmbeddings = async (text: string): Promise<LlamaEmbeddingsResponse | undefined> => {
        try {
            const response = await axios.post<LlamaEmbeddingsResponse>(
                `${this.app.extConfig.endpoint_embeddings}/v1/embeddings`,
                {
                    "input": text,
                    "model": "GPT-4",
                    "encoding_format": "float"
                },
                this.app.extConfig.axiosRequestConfig
            );
            return response.data;
        } catch (error: any) {
            console.error('Failed to get embeddings:', error);
            vscode.window.showInformationMessage(this.app.extConfig.getUiText("Error getting embeddings") + " " + error.message);
            return undefined;
        }


    };

    shellFimCmd = (launchCmd: string): void => {
        if (!launchCmd) {
            vscode.window.showInformationMessage(this.app.extConfig.getUiText("There is no command to execute.")??"");
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
                vscode.window.showInformationMessage(this.app.extConfig.getUiText("Error executing command") + " " + launchCmd +" : " + err.message);
            }
        }
    }

    shellChatCmd = (launchCmd: string): void => {
        if (!launchCmd) {
            vscode.window.showInformationMessage(this.app.extConfig.getUiText("There is no command to execute.")??"");
            return;
        }
        try {
            this.vsCodeChatTerminal = vscode.window.createTerminal({
                name: 'llama.cpp Completion Terminal'
            });
            this.vsCodeChatTerminal.show(true);
            this.vsCodeChatTerminal.sendText(launchCmd);
        } catch(err){
            if (err instanceof Error) {
                vscode.window.showInformationMessage(this.app.extConfig.getUiText("Error executing command") + " " + launchCmd +" : " + err.message);
            }
        }
    }

    shellEmbeddingsCmd = (launchCmd: string): void => {
        if (!launchCmd) {
            vscode.window.showInformationMessage(this.app.extConfig.getUiText("There is no command to execute.")??"");
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
                vscode.window.showInformationMessage(this.app.extConfig.getUiText("Error executing command") + " " + launchCmd +" : " + err.message);
            }
        }
    }

    shellTrainCmd = (trainCmd: string): void => {
        if (!trainCmd) {
            vscode.window.showInformationMessage(this.app.extConfig.getUiText("There is no command to execute.")??"");
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
                vscode.window.showInformationMessage(this.app.extConfig.getUiText("Error executing command") + " " + trainCmd +" : " + err.message);
            }
        }
    }

    killFimCmd = (): void => {
        if (this.vsCodeFimTerminal) this.vsCodeFimTerminal.dispose();
    }

    killChatCmd = (): void => {
        if (this.vsCodeChatTerminal) this.vsCodeChatTerminal.dispose();
    }

    killEmbeddingsCmd = (): void => {
        if (this.vsCodeEmbeddingsTerminal) this.vsCodeEmbeddingsTerminal.dispose();
    }

    killTrainCmd = (): void => {
        if (this.vsCodeTrainTerminal) this.vsCodeTrainTerminal.dispose();
    }
}
