
export enum ModelType {
  Completion = 'completion',
  Chat = 'chat',
  Embeddings = 'embeddings',
  Tools = 'tools'
}

export enum Action {
  Select = 'select',
  AddLocal = 'addLocal',
  AddExternal = 'addExternal',
  AddHuggingface = 'addHuggingface',
  Delete = 'delete',
  View = 'view',
  DeselectStop = 'deselectStop',
  Export = 'export',
  Import = 'import'
}

export const MODEL_TYPE_CONFIG = {
  [ModelType.Completion]: {
    settingName: 'completion_models_list',
    portSetting: 'new_completion_model_port',
    hostSetting: 'new_completion_model_host',
    launchSetting: 'launch_completion',
    killCmdName: 'killFimCmd',
    shellCmdName: 'shellFimCmd',
    propName: 'selectedComplModel' as const
  },
  [ModelType.Chat]: {
    settingName: 'chat_models_list',
    portSetting: 'new_chat_model_port',
    hostSetting: 'new_chat_model_host',
    launchSetting: 'launch_chat',
    killCmdName: 'killChatCmd',
    shellCmdName: 'shellChatCmd',
    propName: 'selectedChatModel' as const
  },
  [ModelType.Embeddings]: {
    settingName: 'embeddings_models_list',
    portSetting: 'new_embeddings_model_port',
    hostSetting: 'new_embeddings_model_host',
    launchSetting: 'launch_embeddings',
    killCmdName: 'killEmbeddingsCmd',
    shellCmdName: 'shellEmbeddingsCmd',
    propName: 'selectedEmbeddingsModel' as const
  },
  [ModelType.Tools]: {
    settingName: 'tools_models_list',
    portSetting: 'new_tools_model_port',
    hostSetting: 'new_tools_model_host',
    launchSetting: 'launch_tools',
    killCmdName: 'killToolsCmd',
    shellCmdName: 'shellToolsCmd',
    propName: 'selectedToolsModel' as const
  }
} as const;

export const LOCAL_MODEL_TEMPLATES = {
  [ModelType.Completion]: 'llama-server -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF> -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 --port PORT_PLACEHOLDER --host HOST_PLACEHOLDER',
  [ModelType.Chat]: 'llama-server -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF> -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port PORT_PLACEHOLDER --host HOST_PLACEHOLDER',
  [ModelType.Embeddings]: 'llama-server -hf <model name from hugging face, i.e: ggml-org/Nomic-Embed-Text-V2-GGUF> -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port PORT_PLACEHOLDER --host HOST_PLACEHOLDER',
  [ModelType.Tools]: 'llama-server -hf <model name from hugging face, i.e: unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF:Q8_0> --jinja  -ngl 99 -c 0 -ub 1024 -b 1024 --cache-reuse 256 --port PORT_PLACEHOLDER --host HOST_PLACEHOLDER'
} as const;

export const HF_MODEL_TEMPLATES = {
  [ModelType.Completion]: 'llama-server -hf MODEL_PLACEHOLDER -ngl 99 -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256 --port PORT_PLACEHOLDER --host HOST_PLACEHOLDER',
  [ModelType.Chat]: 'llama-server -hf MODEL_PLACEHOLDER -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port PORT_PLACEHOLDER --host HOST_PLACEHOLDER',
  [ModelType.Embeddings]: 'llama-server -hf MODEL_PLACEHOLDER -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port PORT_PLACEHOLDER --host HOST_PLACEHOLDER',
  [ModelType.Tools]: 'llama-server -hf MODEL_PLACEHOLDER --jinja  -ngl 99 -c 0 -ub 1024 -b 1024 --cache-reuse 256 --port PORT_PLACEHOLDER --host HOST_PLACEHOLDER'
} as const;

export const SETTING_TO_MODEL_TYPE: Record<string, ModelType> = {
  'completion_models_list': ModelType.Completion,
  'chat_models_list': ModelType.Chat,
  'embeddings_models_list': ModelType.Embeddings,
  'tools_models_list': ModelType.Tools
} as const;

export enum AGENT_NAME {
  default = 'default',
  llamaVscodeHelp = 'llama-vscode help'
}

export const UI_TEXT_KEYS = {
  // Note: These are keys for getUiText calls; actual strings not extracted here to avoid touching getUiText parameters.
  // Example: selectEnv: 'Select/start env...',
  // Map all relevant keys as needed in future phases.
} as const;