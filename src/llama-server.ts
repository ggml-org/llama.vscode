import axios from "axios";
import { Configuration } from "./configuration";
import { PassThrough } from "stream";

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

export class LlamaServer {
    private extConfig: Configuration;
    private readonly defaultRequestParams = {
        top_k: 40,
        top_p: 0.99,
        stream: false,
        samplers: ["top_k", "top_p", "infill"],
        cache_prompt: true,
    } as const;

    constructor(config: Configuration) {
        this.extConfig = config;
    }

    private replacePlaceholders(template: string, replacements: { [key: string]: string }): string {
        return template.replace(/{(\w+)}/g, (_, key) => replacements[key] || "");
    }

    private async handleOpenAICompletion(
        chunks: any[],
        inputPrefix: string,
        inputSuffix: string,
        prompt: string,
        isPreparation = false
    ): Promise<LlamaResponse | void> {
        const client = this.extConfig.openai_client;
        if (!client) return;

        const additional_context = chunks.length > 0 ? "Context:\n\n" + chunks.join("\n") : "";

        const replacements = {
            inputPrefix: inputPrefix.slice(-this.extConfig.n_prefix),
            prompt: prompt,
            inputSuffix: inputSuffix.slice(0, this.extConfig.n_suffix),
        };

        const rsp = await client.completions.create({
            model: this.extConfig.openai_client_model || "",
            prompt: additional_context + this.replacePlaceholders(this.extConfig.openai_prompt_template, replacements),
            max_tokens: this.extConfig.n_predict,
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

    private createRequestPayload(inputPrefix: string, inputSuffix: string, chunks: any[], prompt: string, nindent?: number) {
        return {
            input_prefix: inputPrefix,
            input_suffix: inputSuffix,
            input_extra: chunks,
            prompt,
            n_predict: this.extConfig.n_predict,
            ...this.defaultRequestParams,
            ...(nindent && { n_indent: nindent }),
            t_max_prompt_ms: this.extConfig.t_max_prompt_ms,
            t_max_predict_ms: this.extConfig.t_max_predict_ms,
        };
    }

    getLlamaCompletion = async (
        inputPrefix: string,
        inputSuffix: string,
        prompt: string,
        chunks: any,
        nindent: number
    ): Promise<LlamaResponse | undefined> => {
        // If the server is OpenAI compatible, use the OpenAI API to get the completion
        if (this.extConfig.is_openai_compatible) {
            const response = await this.handleOpenAICompletion(chunks, inputPrefix, inputSuffix, prompt);
            return response || undefined;
        }

        // else, default to llama.cpp
        const response = await axios.post<LlamaResponse>(
            `${this.extConfig.endpoint}/infill`,
            this.createRequestPayload(inputPrefix, inputSuffix, chunks, prompt, nindent),
            this.extConfig.axiosRequestConfig
        );

        return response.status === STATUS_OK ? response.data : undefined;
    };

    prepareLlamaForNextCompletion = (chunks: any[]): void => {
        // If the server is OpenAI compatible, use the OpenAI API to prepare for the next FIM
        if (this.extConfig.is_openai_compatible) {
            // wtg 20250207 - per @igardev ... "This makes sense only if there is a server cache"
            // this.handleOpenAICompletion(chunks, "", "", "", true);
            return;
        }

        // else, make a request to the API to prepare for the next FIM
        axios.post<LlamaResponse>(
            `${this.extConfig.endpoint}/infill`,
            this.createRequestPayload("", "", chunks, "", undefined),
            this.extConfig.axiosRequestConfig
        );
    };
}
