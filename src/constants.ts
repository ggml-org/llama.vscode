
export enum ModelType {
  Completion = 'completion',
  Chat = 'chat',
  Embeddings = 'embeddings',
  Tools = 'tools'
}

export enum UiView {
  Agent = 'agent',
  Environment = 'addenv',
  Embeddings = 'embeddings',
  AiRunner = 'airunner'
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
  // Agent command texts
  enterName: "Enter agent command name",

  // Menu separators and sections
  actions: "Actions",
  entities: "Entities",
  maintenance: "Maintenance",
  help: "Help",

  // Env related
  selectStartEnv: "Select/start env...",
  envSelectDescription: "Stops the currently running models and starts the selected env - (a predefined group of models for completion, chat, embeddings and tools).",
  deselectStopEnv: "Deselect/stop env and models",
  deselectStopEnvDescription: "Deselects/stops env, completion, chat, embeddings and tools models",
  showSelectedEnv: "Show selected env",
  showSelectedEnvDescription: "Shows details about the selected env",
  addEnv: "Add env...",
  addEnvDescription: "Opens a panel for adding an env.",
  viewEnvDetails: "View env details...",
  deleteEnv: "Delete env...",
  exportEnv: "Export env...",
  importEnv: "Import env...",
  downloadUploadEnvsOnline: "Download/upload envs online",

  // Models lists
  envs: "Envs...",
  completionModels: "Completion models...",
  chatModels: "Chat models...",
  embeddingsModels: "Embeddings models...",
  toolsModels: "Tools models...",

  // Common toggles
  disable: "Disable",
  enable: "Enable",
  allCompletions: "All Completions",
  turnOffCompletionsGlobally: "Turn off completions globally",
  turnOnCompletionsGlobally: "Turn on completions globally",
  completionsFor: "Completions for",
  currently: "Currently",
  enabled: "enabled",
  disabled: "disabled",
  rag: "RAG",
  turnOffRAG: "Turn off RAG related features like Chat with AI with project context",
  turnOnRAG: "Turn on RAG related features like Chat with AI with project context",

  // UI actions
  showLlamaAgent: "Show Llama Agent",
  showLlamaAgentDescription: "Shows Llama Agent panel",
  chatWithAI: "Chat with AI",
  chatWithAIDescription: "Opens a chat with AI window inside VS Code using the selected chat model (or setting endpoint_chat)",
  chatWithAIWithProjectContext: "Chat with AI with project context",
  showSelectedModels: "Show selected models",
  showSelectedModelsDescription: "Displays a list of currently selected models",
  useAsLocalAIRunner: "Use as local AI runner",
  localAIRunnerDescription: "Download models automatically from Huggingface and chat with them (as LM Studio, Ollama, etc.)",
  editSettings: "Edit Settings...",
  apiKeys: "API keys...",
  apiKeysDescription: "Edit or remove API keys. New API keys are added on first use of an endpoint.",
  agents: "Agents...",
  agentCommands: "Agent commands...",
  chats: "Chats...",

  // Help and maintenance
  howToUseLlamaVscode: "How to use llama-vscode",
  chatWithAIAboutLlamaVscode: "Chat with AI about llama-vscode",
  chatWithAIAboutLlamaVscodeDescription: "Selects llama-vscode help agent and opens llama agent view for asking ai about llama-vscode",
  howToDeleteModels: "How to delete models",
  howToDeleteModelsDescription: "Explains how to delete the downloaded models",
  viewDocumentation: "View Documentation...",
  startTrainingCompletionModel: "Start training completion model",
  launchTrainingCompletionDescription: "Runs the command from property launch_training_completion",
  startTrainingChatModel: "Start training chat model",
  launchTrainingChatDescription: "Runs the command from property launch_training_chat",
  stopTraining: "Stop training",
  stopTrainingDescription: "Stops training if it was started from llama.vscode menu",

  // API keys
  addAPIKey: "Add API key...",
  editDeleteAPIKey: "Edit/delete API key...",

  // Agent actions
  selectStartAgent: "Select/start agent...",
  deselectStopAgent: "Deselect/stop agent...",
  addAgent: "Add agent...",
  viewAgentDetails: "View agent details...",
  deleteAgent: "Delete agent...",
  exportAgent: "Export agent...",
  importAgent: "Import agent...",

  // Agent command actions
  addAgentCommand: "Add agent command...",
  viewAgentCommandDetails: "View agent command details...",
  deleteAgentCommand: "Delete agent command...",
  exportAgentCommand: "Export agent command...",
  importAgentCommand: "Import agent command...",

  // Chat actions
  selectStartChat: "Select/start chat...",
  deleteChat: "Delete chat...",
  exportChat: "Export chat...",
  importChat: "Import chat...",

  // Model actions for Completion
  selectStartCompletionModel: "Select/start completion model...",
  deselectStopCompletionModel: "Deselect/stop completion model",
  addLocalCompletionModel: "Add local completion model...",
  addExternalCompletionModel: "Add external completion model...",
  addCompletionModelFromHuggingface: "Add completion model from huggingface...",
  viewCompletionModelDetails: "View completion model details...",
  deleteCompletionModel: "Delete completion model...",
  exportCompletionModel: "Export completion model...",
  importCompletionModel: "Import completion model...",

  // Model actions for Chat
  selectStartChatModel: "Select/start chat model...",
  deselectStopChatModel: "Deselect/stop chat model",
  addLocalChatModel: "Add local chat model...",
  addExternalChatModel: "Add external chat model...",
  addChatModelFromHuggingface: "Add chat model from huggingface...",
  viewChatModelDetails: "View chat model details...",
  deleteChatModel: "Delete chat model...",
  exportChatModel: "Export chat model...",
  importChatModel: "Import chat model...",

  // Model actions for Embeddings
  selectStartEmbeddingsModel: "Select/start embeddings model...",
  deselectStopEmbeddingsModel: "Deselect/stop embeddings model",
  addLocalEmbeddingsModel: "Add local embeddings model...",
  addExternalEmbeddingsModel: "Add external embeddings model...",
  addEmbeddingsModelFromHuggingface: "Add embeddings model from huggingface...",
  viewEmbeddingsModelDetails: "View embeddings model details...",
  deleteEmbeddingsModel: "Delete embeddings model...",
  exportEmbeddingsModel: "Export embeddings model...",
  importEmbeddingsModel: "Import embeddings model...",

  // Model actions for Tools
  selectStartToolsModel: "Select/start tools model...",
  deselectStopToolsModel: "Deselect/stop tools model",
  addLocalToolsModel: "Add local tools model...",
  addExternalToolsModel: "Add external tools model...",
  addToolsModelFromHuggingface: "Add tools model from huggingface...",
  viewToolsModelDetails: "View tools model details...",
  deleteToolsModel: "Delete tools model...",
  exportToolsModel: "Export tools model...",
  importToolsModel: "Import tools model...",
} as const;

export const PERSISTENCE_KEYS = {
  SELECTED_CHAT: 'selectedChat' as const,
  SELECTED_AGENT: 'selectedAgent' as const,
  SELECTED_ENV: 'selectedEnv' as const,
} as const;

export const SETTING_NAME_FOR_LIST = {
  COMPLETION_MODELS: MODEL_TYPE_CONFIG[ModelType.Completion].settingName,
  CHAT_MODELS: MODEL_TYPE_CONFIG[ModelType.Chat].settingName,
  EMBEDDINGS_MODELS: MODEL_TYPE_CONFIG[ModelType.Embeddings].settingName,
  TOOLS_MODELS: MODEL_TYPE_CONFIG[ModelType.Tools].settingName,
  ENVS: 'envs_list' as const,
  AGENTS: 'agents_list' as const,
  AGENT_COMMANDS: 'agent_commands' as const
} as const;

export const PREDEFINED_LISTS_KEYS = {
  COMPLETIONS: ModelType.Completion as const,
  CHATS: ModelType.Chat as const,
  EMBEDDINGS: ModelType.Embeddings as const,
  TOOLS: ModelType.Tools as const,
  ENVS: SETTING_NAME_FOR_LIST.ENVS,
  AGENTS: SETTING_NAME_FOR_LIST.AGENTS,
  AGENT_COMMANDS: SETTING_NAME_FOR_LIST.AGENT_COMMANDS,
} as const;