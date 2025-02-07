import * as vscode from "vscode";
import OpenAI from "openai";

export class Configuration {
<<<<<<< HEAD
    // extension configs
    enabled = true;
    endpoint = "http=//127.0.0.1:8012";
    is_openai_compatible = false;
    openai_client: OpenAI | null = null;
    openai_client_model: string = "";
    openai_prompt_template: string = "<|fim_prefix|>{inputPrefix}{prompt}<|fim_suffix|>{inputSuffix}<|fim_middle|>";
    auto = true;
    api_key = "";
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
    // additional configs
    axiosRequestConfig = {};
    disabledLanguages: string[] = [];
    RING_UPDATE_MIN_TIME_LAST_COMPL = 3000;
    MIN_TIME_BETWEEN_COMPL = 600;
    MAX_LAST_PICK_LINE_DISTANCE = 32;
    MAX_QUEUED_CHUNKS = 16;
    DELAY_BEFORE_COMPL_REQUEST = 150;
    MAX_EVENTS_IN_LOG = 250;
=======
  // extension configs
  enabled = true;
  endpoint = "http=//127.0.0.1:8012";
  is_openai_compatible = false;
  openAiClient: OpenAI | null = null;
  openAiClientModel: string | null = null;
  opeanAiPromptTemplate: string = "<|fim_prefix|>{inputPrefix}{prompt}<|fim_suffix|>{inputSuffix}<|fim_middle|>";
  auto = true;
  api_key = "";
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
  // additional configs
  axiosRequestConfig = {};
  disabledLanguages: string[] = [];
  RING_UPDATE_MIN_TIME_LAST_COMPL = 3000;
  MIN_TIME_BETWEEN_COMPL = 600;
  MAX_LAST_PICK_LINE_DISTANCE = 32;
  MAX_QUEUED_CHUNKS = 16;
  DELAY_BEFORE_COMPL_REQUEST = 150;
>>>>>>> 52135f7 (fixed config and completions to work with FIM models by default)

    private languageBg = new Map<string, string>([
        ["no suggestion", "нямам предложение"],
        ["thinking...", "мисля..."],
    ]);
    private languageEn = new Map<string, string>([
        ["no suggestion", "no suggestion"],
        ["thinking...", "thinking..."],
    ]);
    private languageDe = new Map<string, string>([
        ["no suggestion", "kein Vorschlag"],
        ["thinking...", "Ich denke..."],
    ]);
    private languageRu = new Map<string, string>([
        ["no suggestion", "нет предложения"],
        ["thinking...", "думаю..."],
    ]);
    private languageEs = new Map<string, string>([
        ["no suggestion", "ninguna propuesta"],
        ["thinking...", "pensando..."],
    ]);
    private languageCn = new Map<string, string>([
        ["no suggestion", "无建议"],
        ["thinking...", "思考..."],
    ]);
    private languageFr = new Map<string, string>([
        ["no suggestion", "pas de suggestion"],
        ["thinking...", "pense..."],
    ]);

    languages = new Map<string, Map<string, string>>([
        ["bg", this.languageBg],
        ["en", this.languageEn],
        ["de", this.languageDe],
        ["ru", this.languageRu],
        ["es", this.languageEs],
        ["cn", this.languageCn],
        ["fr", this.languageFr],
    ]);

<<<<<<< HEAD
    constructor(config: vscode.WorkspaceConfiguration) {
        this.updateConfigs(config);
        this.setLlamaRequestConfig();
        this.setOpenAiClient();
=======
  constructor(config: vscode.WorkspaceConfiguration) {
    this.updateConfigs(config);
    this.setLlamaRequestConfig();
    this.setOpenAiClient();
  }

  private updateConfigs = (config: vscode.WorkspaceConfiguration) => {
    // TODO Handle the case of wrong types for the configuration values
    this.endpoint = this.trimTrailingSlash(String(config.get<string>("endpoint")));
    this.is_openai_compatible = Boolean(config.get<boolean>("is_openai_compatible"));
    this.openAiClientModel = String(config.get<string>("openAiClientModel"));
    this.opeanAiPromptTemplate = String(config.get<string>("opeanAiPromptTemplate"));
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
    this.language = String(config.get<string>("language"));
    this.disabledLanguages = config.get<string[]>("disabledLanguages") || [];
    this.enabled = Boolean(config.get<boolean>("enabled", true));
  };

  getUiText = (uiText: string): string | undefined => {
    let langTexts = this.languages.get(this.language);
    if (langTexts == undefined) langTexts = this.languages.get("en");
    return langTexts?.get(uiText);
  };

  updateOnEvent = (event: vscode.ConfigurationChangeEvent, config: vscode.WorkspaceConfiguration) => {
    this.updateConfigs(config);
    if (event.affectsConfiguration("llama-vscode.api_key")) {
      this.setLlamaRequestConfig();
      this.setOpenAiClient();
>>>>>>> 35adb98 (added openAiClientModel to config; tested with local vllm server)
    }

    private updateConfigs = (config: vscode.WorkspaceConfiguration) => {
        // TODO Handle the case of wrong types for the configuration values
        this.endpoint = this.trimTrailingSlash(String(config.get<string>("endpoint")));
        this.is_openai_compatible = Boolean(config.get<boolean>("is_openai_compatible"));
        this.openai_client_model = String(config.get<string>("openai_client_model"));
        this.openai_prompt_template = String(config.get<string>("openai_prompt_template"));
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
        this.language = String(config.get<string>("language"));
        this.disabledLanguages = config.get<string[]>("disabledLanguages") || [];
        this.enabled = Boolean(config.get<boolean>("enabled", true));
    };

    getUiText = (uiText: string): string | undefined => {
        let langTexts = this.languages.get(this.language);
        if (langTexts == undefined) langTexts = this.languages.get("en");
        return langTexts?.get(uiText);
    };

    updateOnEvent = (event: vscode.ConfigurationChangeEvent, config: vscode.WorkspaceConfiguration) => {
        this.updateConfigs(config);
        if (event.affectsConfiguration("llama-vscode.api_key")) {
            this.setLlamaRequestConfig();
            this.setOpenAiClient();
        }
    };

    trimTrailingSlash = (s: string): string => {
        if (s.length > 0 && s[s.length - 1] === "/") {
            return s.slice(0, -1);
        }
        return s;
    };

    setLlamaRequestConfig = () => {
        this.axiosRequestConfig = {};
        if (this.api_key != undefined && this.api_key != "") {
            this.axiosRequestConfig = {
                headers: {
                    Authorization: `Bearer ${this.api_key}`,
                    "Content-Type": "application/json",
                },
            };
        }
    };

    setOpenAiClient = () => {
        this.openai_client = null;
        if (this.is_openai_compatible && this.api_key != undefined && this.api_key != "") {
            const openai = new OpenAI({
                apiKey: this.api_key,
                baseURL: this.endpoint,
            });

            this.openai_client = openai;
        }
    };
}
