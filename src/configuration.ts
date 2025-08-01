import * as vscode from "vscode";
import OpenAI from "openai";
import https from "https";
import fs from "fs";
import {translations} from "./translations"

export class Configuration {
    // extension configs
    enabled = true;
    launch_completion = ""
    launch_chat = ""
    launch_embeddings = ""
    launch_training_completion = ""
    launch_training_chat = ""
    lora_completion = ""
    lora_chat = ""
    endpoint = "http=//127.0.0.1:8012";
    endpoint_chat = "http=//127.0.0.1:8011";
    endpoint_tools = "http=//127.0.0.1:8011";
    endpoint_embeddings = "http=//127.0.0.1:8010";
    auto = true;
    api_key = "";
    api_key_chat = "";
    api_key_tools = "";
    api_key_embeddings = ""
    self_signed_certificate = "";
    n_prefix = 256;
    n_suffix = 64;
    n_predict = 128;
    t_max_prompt_ms = 500;
    t_max_predict_ms = 2500;
    show_info = true;
    max_line_suffix = 8;
    max_cache_keys = 250;
    ring_n_chunks = 16;
    ring_chunk_size = 64;
    ring_scope = 1024;
    ring_update_ms = 1000;
    language = "en";

    // experimental - avoid using
    use_openai_endpoint = false;
    openai_client: OpenAI | null = null;
    openai_client_model: string = "";
    openai_prompt_template: string = "<|fim_prefix|>{inputPrefix}{prompt}<|fim_suffix|>{inputSuffix}<|fim_middle|>";

    rag_enabled = true;
    rag_chunk_max_chars = 800
    rag_max_lines_per_chunk = 40
    rag_max_chars_per_chunk_line = 300
    rag_max_files = 10000
    rag_max_chunks = 50000
    rag_max_bm25_filter_chunks = 47
    rag_max_embedding_filter_chunks = 5
    rag_max_context_files = 3
    rag_max_context_file_chars = 10000

    tool_run_terminal_command_enabled = true;
    tool_search_source_enabled = true;
    tool_read_file_enabled = true;
    tool_list_directory_enabled = true;
    tool_regex_search_enabled = true;
    tool_delete_file_enabled = true;
    tool_permit_some_terminal_commands = false;
    tool_permit_file_changes = false
    tool_get_diff_enabled = false;
    tool_edit_file_enabled = true;
    tool_ask_user_enabled = true;
    tool_custom_tool_enabled = false;
    tool_custom_tool_description = "";
    tool_custom_tool_source = ""
    tool_custom_eval_tool_enabled = ""
    tool_custom_eval_tool_description = ""
    tool_custom_eval_tool_property_description = ""
    tool_custom_eval_tool_code = "";
    tools_max_iterations = 50;
    tools_log_calls = false;
    // AI_API_VERSION = "v1beta/openai";
    ai_api_version = "v1";
    // AI_MODEL = "gemini-2.5-flash";
    ai_model = "google/gemini-2.5-flash"
    // additional configs`
    // TODO: change to snake_case for consistency
    axiosRequestConfigCompl = {};
    axiosRequestConfigChat = {};
    axiosRequestConfigTools = {};
    axiosRequestConfigEmbeddings = {};
    disabledLanguages: string[] = [];
    languageSettings:Record<string, boolean> = {}

    // TODO: change to snake_case for consistency
    RING_UPDATE_MIN_TIME_LAST_COMPL = 3000;
    MIN_TIME_BETWEEN_COMPL = 600;
    MAX_LAST_PICK_LINE_DISTANCE = 32;
    MAX_QUEUED_CHUNKS = 16;
    DELAY_BEFORE_COMPL_REQUEST = 150;
    MAX_EVENTS_IN_LOG = 250;
    MAX_CHARS_TOOL_RETURN = 5000
    
    
    config: vscode.WorkspaceConfiguration;

    private uiLanguages = new Map<string, Map<string, string>>([])
    private langIndexes = new Map<number, string>([
        [0, "en"],
        [1, "bg"],
        [2, "de"],
        [3, "ru"],
        [4, "es"],
        [5, "cn"],
        [6, "fr"],
    ]);

    constructor() {
        this.config = vscode.workspace.getConfiguration("llama-vscode");
        this.initUiLanguages()
        this.updateConfigs(this.config);
        this.setLlamaRequestConfig();
        this.setOpenAiClient();
    }

    private initUiLanguages(){
        let totalLanguages = 0;
        if (translations.length > 0) totalLanguages = translations[0].length
        for (let langInd = 0; langInd < totalLanguages; langInd++){
            let lang =  new Map(translations.map(transl => [transl[0], transl[langInd]]));
            this.uiLanguages.set(this.langIndexes.get(langInd) ?? "", lang);
        }
    }

    private updateConfigs = (config: vscode.WorkspaceConfiguration) => {
        // TODO Handle the case of wrong types for the configuration values
        this.endpoint = this.trimTrailingSlash(String(config.get<string>("endpoint")));
        this.endpoint_chat = this.trimTrailingSlash(String(config.get<string>("endpoint_chat")));
        this.endpoint_tools = this.trimTrailingSlash(String(config.get<string>("endpoint_tools")));
        this.endpoint_embeddings = this.trimTrailingSlash(String(config.get<string>("endpoint_embeddings")));
        this.launch_completion = String(config.get<string>("launch_completion"));
        this.launch_chat = String(config.get<string>("launch_chat"));
        this.launch_embeddings = String(config.get<string>("launch_embeddings"));
        this.launch_training_completion = String(config.get<string>("launch_training_completion"));
        this.launch_training_chat = String(config.get<string>("launch_training_chat"));
        this.ai_model = String(config.get<string>("ai_model"));
        this.ai_api_version = String(config.get<string>("ai_api_version"));
        this.lora_completion = String(config.get<string>("lora_completion"));
        this.lora_chat = String(config.get<string>("lora_chat"));
        this.use_openai_endpoint = Boolean(config.get<boolean>("use_openai_endpoint"));
        this.openai_client_model = String(config.get<string>("openai_client_model"));
        this.openai_prompt_template = String(config.get<string>("openai_prompt_template"));
        this.auto = Boolean(config.get<boolean>("auto"));
        this.api_key = String(config.get<string>("api_key"));
        this.api_key_chat = String(config.get<string>("api_key_chat"));
        this.api_key_tools = String(config.get<string>("api_key_tools"));
        this.api_key_embeddings = String(config.get<string>("api_key_embeddings"));
        this.self_signed_certificate = String(config.get<string>("self_signed_certificate"));
        this.n_prefix = Number(config.get<number>("n_prefix"));
        this.n_suffix = Number(config.get<number>("n_suffix"));
        this.n_predict = Number(config.get<number>("n_predict"));
        this.rag_chunk_max_chars = Number(config.get<number>("rag_chunk_max_chars"));
        this.t_max_prompt_ms = Number(config.get<number>("t_max_prompt_ms"));
        this.t_max_predict_ms = Number(config.get<number>("t_max_predict_ms"));
        this.show_info = Boolean(config.get<boolean>("show_info"));
        this.max_line_suffix = Number(config.get<number>("max_line_suffix"));
        this.max_cache_keys = Number(config.get<number>("max_cache_keys"));
        this.ring_n_chunks = Number(config.get<number>("ring_n_chunks"));
        this.ring_chunk_size = Number(config.get<number>("ring_chunk_size"));
        this.ring_scope = Number(config.get<number>("ring_scope"));
        this.ring_update_ms = Number(config.get<number>("ring_update_ms"));
        this.rag_enabled = Boolean(config.get<boolean>("rag_enabled"));
        this.rag_max_lines_per_chunk = Number(config.get<number>("rag_max_lines_per_chunk"));
        this.rag_max_chars_per_chunk_line = Number(config.get<number>("rag_max_chars_per_chunk_line"));
        this.rag_max_files = Number(config.get<number>("rag_max_files"));
        this.rag_max_chunks = Number(config.get<number>("rag_max_chunks"));
        this.rag_max_bm25_filter_chunks = Number(config.get<number>("rag_max_bm25_filter_chunks"));
        this.rag_max_embedding_filter_chunks = Number(config.get<number>("rag_max_embedding_filter_chunks"));
        this.rag_max_context_files = Number(config.get<number>("rag_max_context_files"));
        this.rag_max_context_file_chars = Number(config.get<number>("rag_max_context_file_chars"));
        this.tool_run_terminal_command_enabled = Boolean(config.get<boolean>("tool_run_terminal_command_enabled"));
        this.tool_search_source_enabled = Boolean(config.get<boolean>("tool_search_source_enabled"));
        this.tool_read_file_enabled = Boolean(config.get<boolean>("tool_read_file_enabled"));
        this.tool_list_directory_enabled = Boolean(config.get<boolean>("tool_list_directory_enabled"));
        this.tool_regex_search_enabled = Boolean(config.get<boolean>("tool_regex_search_enabled"));
        this.tool_delete_file_enabled = Boolean(config.get<boolean>("tool_delete_file_enabled"));
        this.tool_permit_some_terminal_commands = Boolean(config.get<boolean>("tool_permit_some_terminal_commands"));
        this.tool_permit_file_changes = Boolean(config.get<boolean>("tool_permit_file_changes"));
        this.tool_get_diff_enabled = Boolean(config.get<boolean>("tool_get_diff_enabled"));
        this.tool_edit_file_enabled = Boolean(config.get<boolean>("tool_edit_file_enabled"));
        this.tool_ask_user_enabled = Boolean(config.get<boolean>("tool_ask_user_enabled"));
        this.tool_custom_tool_enabled = Boolean(config.get<boolean>("tool_custom_tool_enabled"));
        this.tool_custom_tool_description = String(config.get<string>("tool_custom_tool_description"));
        this.tool_custom_tool_source = String(config.get<string>("tool_custom_tool_source"));
        this.tool_custom_eval_tool_enabled = String(config.get<string>("tool_custom_eval_tool_enabled"));
        this.tool_custom_eval_tool_property_description = String(config.get<string>("tool_custom_eval_tool_property_description"));
        this.tool_custom_eval_tool_description = String(config.get<string>("tool_custom_eval_tool_description"));
        this.tool_custom_eval_tool_code = String(config.get<string>("tool_custom_eval_tool_code"));
        this.tools_max_iterations = Number(config.get<number>("tools_max_iterations"));
        this.tools_log_calls = Boolean(config.get<boolean>("tools_log_calls"));
        this.language = String(config.get<string>("language"));
        this.disabledLanguages = config.get<string[]>("disabledLanguages") || [];
        this.enabled = Boolean(config.get<boolean>("enabled", true));
        this.languageSettings = config.get<Record<string, boolean>>('languageSettings') || {};
    };

    getUiText = (uiText: string): string | undefined => {
        let langTexts = this.uiLanguages.get(this.language);
        if (langTexts == undefined) langTexts = this.uiLanguages.get("en");
        return langTexts?.get(uiText);
    };

    updateOnEvent = (event: vscode.ConfigurationChangeEvent, config: vscode.WorkspaceConfiguration) => {
        this.updateConfigs(config);
        if (event.affectsConfiguration("llama-vscode.api_key")
            || event.affectsConfiguration("llama-vscode.api_key_tools")
            || event.affectsConfiguration("llama-vscode.api_key_chat")
            || event.affectsConfiguration("llama-vscode.api_key_embeddings")
            || event.affectsConfiguration("llama-vscode.self_signed_certificate")) {
            this.setLlamaRequestConfig();
            this.setOpenAiClient();
        }
    };

    isRagConfigChanged = (event: vscode.ConfigurationChangeEvent) => {
        return event.affectsConfiguration("llama-vscode.rag_chunk_max_chars")
        || event.affectsConfiguration("llama-vscode.rag_max_lines_per_chunk")
        || event.affectsConfiguration("llama-vscode.rag_max_files")
        || event.affectsConfiguration("llama-vscode.rag_max_chars_per_chunk_line")
        || event.affectsConfiguration("llama-vscode.rag_enabled");
    }

    isToolChanged = (event: vscode.ConfigurationChangeEvent) => {
        return event.affectsConfiguration("llama-vscode.tool_run_terminal_command_enabled")
        || event.affectsConfiguration("llama-vscode.tool_search_source_enabled")
        || event.affectsConfiguration("llama-vscode.tool_list_directory_enabled")
        || event.affectsConfiguration("llama-vscode.tool_read_file_enabled")
        || event.affectsConfiguration("llama-vscode.tool_regex_search_enabled")
        || event.affectsConfiguration("llama-vscode.tool_custom_tool_source")
        || event.affectsConfiguration("llama-vscode.tool_custom_tool_description")
        || event.affectsConfiguration("llama-vscode.tool_custom_tool_enabled")
        || event.affectsConfiguration("llama-vscode.tool_ask_user_enabled")
        || event.affectsConfiguration("llama-vscode.tool_delete_file_enabled")
        || event.affectsConfiguration("llama-vscode.tool_edit_file_enabled")
        || event.affectsConfiguration("llama-vscode.tool_get_diff_enabled")
        || event.affectsConfiguration("llama-vscode.tool_custom_eval_tool_enabled")
        || event.affectsConfiguration("llama-vscode.tool_custom_eval_tool_description")
        || event.affectsConfiguration("llama-vscode.tool_custom_eval_tool_property_description")
    }

    trimTrailingSlash = (s: string): string => {
        if (s.length > 0 && s[s.length - 1] === "/") {
            return s.slice(0, -1);
        }
        return s;
    };

    setLlamaRequestConfig = () => {
        this.axiosRequestConfigCompl = {};
        if (this.api_key != undefined && this.api_key.trim() != "") {
            this.axiosRequestConfigCompl = {
                headers: {
                    Authorization: `Bearer ${this.api_key.trim()}`,
                    "Content-Type": "application/json",
                },
            };
        }
        if (this.self_signed_certificate != undefined && this.self_signed_certificate.trim() != "") {
            const httpsAgent = new https.Agent({
                ca: fs.readFileSync(this.self_signed_certificate.trim()),
            });
            this.axiosRequestConfigCompl = {
                ...this.axiosRequestConfigCompl,
                httpsAgent,
            };
        }

        this.axiosRequestConfigChat = {};
        if (this.api_key_chat != undefined && this.api_key_chat.trim() != "") {
            this.axiosRequestConfigChat = {
                headers: {
                    Authorization: `Bearer ${this.api_key_chat.trim()}`,
                    "Content-Type": "application/json",
                },
            };
        }

        this.axiosRequestConfigTools = {};
        if (this.api_key_tools != undefined && this.api_key_tools.trim() != "") {
            this.axiosRequestConfigTools = {
                headers: {
                    Authorization: `Bearer ${this.api_key_tools.trim()}`,
                    "Content-Type": "application/json",
                },
            };
        }

        this.axiosRequestConfigEmbeddings = {};
        if (this.api_key_embeddings != undefined && this.api_key_embeddings.trim() != "") {
            this.axiosRequestConfigEmbeddings = {
                headers: {
                    Authorization: `Bearer ${this.api_key_embeddings.trim()}`,
                    "Content-Type": "application/json",
                },
            };
        }
    };

    setOpenAiClient = () => {
        this.openai_client = null;
        if (this.use_openai_endpoint) {
            this.openai_client = new OpenAI({
                apiKey: this.api_key || "empty",
                baseURL: this.endpoint,
            });
        }
    };

    isCompletionEnabled = (document?: vscode.TextDocument, language?: string): boolean =>  {
        if (!this.enabled) return false;

        const languageToCheck = language ?? document?.languageId;
        if (languageToCheck) {
            return this.languageSettings[languageToCheck] ?? true;
        }

        return true;
    }
}
