import axios from "axios";
import { Configuration } from "./configuration";

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

  private createOpenAIPrompt(chunks: any[], inputPrefix = "", inputSuffix = "", previousPrompt = "") {
    const contextChunks = chunks.map((chunk: any) => `Related code:\n${chunk}`).join("\n\n");
    const systemPrompt =
      "You are a code completion assistant. Complete the code between <PRE> and <SUF> markers. Only return the completion without any explanation.";

    return {
      systemMessage: { role: "system" as const, content: systemPrompt },
      userMessage: {
        role: "user" as const,
        content: [
          contextChunks,
          `<PRE>${inputPrefix.trim()}`,
          `<SUF>${inputSuffix.trim()}`,
          previousPrompt && `Previous completion attempt: ${previousPrompt.trim()}`,
          "Complete the code between <PRE> and <SUF>. Return ONLY the completion.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    };
  }

  private async handleOpenAICompletion(
    chunks: any[],
    inputPrefix: string,
    inputSuffix: string,
    prompt: string,
    isPreparation = false
  ): Promise<LlamaResponse | void> {
    const openai = this.extConfig.openAiClient;
    if (!openai) return;

    const { systemMessage, userMessage } = this.createOpenAIPrompt(chunks, inputPrefix, inputSuffix, prompt);

    const completion = await openai.chat.completions.create({
      model: this.extConfig.openAiClientModel || "gpt-4",
      messages: [systemMessage, userMessage],
      temperature: 0.1,
      top_p: this.defaultRequestParams.top_p,
      stream: false,
    });

    if (isPreparation) return;

    return {
      content: completion.choices[0].message.content || "",
      generation_settings: {
        finish_reason: completion.choices[0].finish_reason,
        model: completion.model,
        created: completion.created,
      },
      timings: {
        prompt_ms: completion.usage?.prompt_tokens,
        predicted_ms: completion.usage?.completion_tokens,
        predicted_n: completion.usage?.total_tokens,
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
      this.handleOpenAICompletion(chunks, "", "", "", true);
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
