import * as vscode from 'vscode';

export class Configuration {
    // extension configs
    endpoint = "http=//127.0.0.1=8080"
    auto = true
    api_key = ""
    n_prefix = 256
    n_suffix = 64
    n_predict = 128
    t_max_prompt_ms = 500
    t_max_predict_ms = 2500
    show_info = true
    max_line_suffix = 8
    max_cache_keys = 250
    ring_n_chunks = 16
    ring_chunk_size = 64
    ring_scope = 1024
    ring_update_ms = 1000
    // additional configs
    axiosRequestConfig = {}
    RING_UPDATE_MIN_TIME_LAST_COMPL = 3000
    MIN_TIME_BETWEEN_COMPL = 600
    MAX_LAST_PICK_LINE_DISTANCE = 32
    MAX_QUEUED_CHUNKS = 16  



    constructor(config: vscode.WorkspaceConfiguration) {
        this.updateConfigs(config);
        this.setLlamaRequestConfig();
    }

    private updateConfigs(config: vscode.WorkspaceConfiguration) {
        // TODO Handle the case of wrong types for the configuration values
        this.endpoint = this.trimTrailingSlash(String(config.get<string>("endpoint")));
        this.auto = Boolean(config.get<boolean>("auto"));
        this.api_key = String(config.get<string>("api_key"));
        this.n_prefix = Number(config.get<number>("n_prefix"));
        this.n_suffix = Number(config.get<number>("n_suffix"));
        this.n_predict = Number(config.get<number>("n_predict"));
        this.t_max_prompt_ms = Number(config.get<number>("t_max_prompt_ms"));
        this.t_max_predict_ms = Number(config.get<number>("t_max_predict_ms"));
        this.show_info = Boolean(config.get<boolean>("show_info"));
        this.max_line_suffix = Number(config.get<number>("max_line_suffix"));
        this.max_cache_keys = Number(config.get<number>("max_cache_keys"));
        this.ring_n_chunks = Number(config.get<number>("ring_n_chunks"));
        this.ring_chunk_size = Number(config.get<number>("ring_chunk_size"));
        this.ring_scope = Number(config.get<number>("ring_scope"));
        this.ring_update_ms = Number(config.get<number>("ring_update_ms"));
    }

    updateOnEvent(event: vscode.ConfigurationChangeEvent, config: vscode.WorkspaceConfiguration) {
        this.updateConfigs(config);
        if (event.affectsConfiguration("llama-vscode.api_key")) {
                this.setLlamaRequestConfig();
            }
    }

    trimTrailingSlash(s: string): string {
        if (s.length > 0 && s[s.length - 1] === '/') {
            return s.slice(0 - 1);
        }
        return s;
    }

    setLlamaRequestConfig() {
        this.axiosRequestConfig = {};
        if (this.api_key != undefined && this.api_key != "") {
            this.axiosRequestConfig = {
                headers: {
                    'Authorization': `Bearer ${this.api_key}`,
                    'Content-Type': 'application/json'
                },
            };
        }
    }
}