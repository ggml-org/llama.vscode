import axios from 'axios';
import { Configuration } from './configuration';

const STATUS_OK = 200

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

export class LlamaServer{
    private extConfig: Configuration

    constructor(config: Configuration) {
            this.extConfig = config
        }

    // Class field is used instead of a function to make "this" available
    getLlamaCompletion = async (inputPrefix: string, inputSuffix: string, prompt: string, chunks: any, nindent: number): Promise<LlamaResponse | undefined> => {
        const requestPayload = {
            input_prefix: inputPrefix,
            input_suffix: inputSuffix,
            input_extra: chunks,
            prompt: prompt,
            n_predict: this.extConfig.n_predict,
            // Basic sampling parameters (adjust as needed)
            top_k: 40,
            top_p: 0.99,
            stream: false,
            n_indent: nindent,
            samplers: ["top_k", "top_p", "infill"],
            cache_prompt: true,
            t_max_prompt_ms: this.extConfig.t_max_prompt_ms,
            t_max_predict_ms: this.extConfig.t_max_predict_ms
        };
        const response = await axios.post<LlamaResponse>(this.extConfig.endpoint + "/infill", requestPayload, this.extConfig.axiosRequestConfig);
        if (response.status != STATUS_OK || !response.data ) return undefined
        else return response.data;
    }

    prepareLlamaForNextCompletion = (chunks: any[]): void => {
        // Make a request to the API to prepare for the next FIM
        const requestPayload = {
            input_prefix: "",
            input_suffix: "",
            input_extra: chunks,
            prompt: "",
            n_predict: 1,
            top_k: 40,
            top_p: 0.99,
            stream: false,
            samplers: ["temperature"],
            cache_prompt: true,
            t_max_prompt_ms: 1,
            t_max_predict_ms: 1
        };

        axios.post<LlamaResponse>(this.extConfig.endpoint + "/infill", requestPayload, this.extConfig.axiosRequestConfig);
    }
}
