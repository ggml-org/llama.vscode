import axios from 'axios';
import { Configuration } from './configuration';
import { EventEmitter } from 'events';
import * as cp from 'child_process';
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
    private childProcess: cp.ChildProcess | undefined;
    private childProcessStdErr: string = "";
    private eventEmitter: EventEmitter;

    constructor(config: Configuration) {
            this.extConfig = config,
            this.eventEmitter = new EventEmitter();
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

    public onlaunchCmdClose(callback: (data: { code: number, stderr: string }) => void): void {
        this.eventEmitter.on('processClosed', callback);
    }

    public launchCmd(): void {
        const launchCmd = this.extConfig.launch_cmd;
        if (!launchCmd) {
            return;
        }
        this.childProcess = cp.spawn(launchCmd, [], { shell: true });
        if (this.childProcess.stderr) {
            this.childProcess.stderr.on('data', (data) => {
                this.childProcessStdErr += data;
            });
        }
        this.childProcess.on('close', (code) => {
            this.eventEmitter.emit('processClosed', { code, stderr: this.childProcessStdErr });
            this.childProcessStdErr = "";
        });
    }

    public killCmd(): void {
        if (this.childProcess) {
            this.childProcess.kill(); 
        }
    }
}
