import {Configuration} from "./configuration";
import {ExtraContext} from "./extra-context";
import {LlamaServer} from "./llama-server";
import {LRUCache} from "./lru-cache";
import {Architect} from "./architect";
import {Statusbar} from "./statusbar";
import {Menu} from "./menu";
import {Completion} from "./completion";
import {Logger} from "./logger";
import { ChatWithAi } from "./chat-with-ai";
import { TextEditor } from "./text-editor";
import { ChatContext } from "./chat-context";
import { Prompts } from "./prompts";
import { Git } from "./git";
import { Tools } from "./tools";
import { LlamaAgent } from "./llama-agent";
import {LlamaWebviewProvider} from "./llama-webview-provider"
import * as vscode from "vscode"
import { Persistence } from "./persistence";
import { ModelService } from "./services/model-service";
import { HfModelStrategy } from "./services/hf-model-strategy";
import { LocalModelStrategy } from "./services/local-model-strategy";
import { ExternalModelStrategy } from "./services/external-model-strategy";
import { EnvService } from "./services/env-service";
import { AgentService } from "./services/agent-service";
import { AgentCommandService } from "./services/agent-command-service";
import { ChatService } from "./services/chat-service";
import { Agent, Chat, Env, LlmModel } from "./types";
import { ModelType, PERSISTENCE_KEYS } from "./constants";
import { ApiKeyService } from "./services/api-key-service";
import { OpenAiCompModelStrategy } from "./services/openai-comp-model-strategy";

export class Application {
    
    private static instance: Application;
    public configuration: Configuration;
    public extraContext: ExtraContext;
    public llamaServer: LlamaServer
    public lruResultCache: LRUCache
    public architect: Architect
    public statusbar: Statusbar
    public menu: Menu
    public completion: Completion
    public logger: Logger
    public askAi: ChatWithAi
    public textEditor: TextEditor
    public chatContext: ChatContext
    public prompts: Prompts
    public git: Git
    public tools: Tools
    public llamaAgent: LlamaAgent
    public llamaWebviewProvider: LlamaWebviewProvider
    public persistence: Persistence
    public modelService: ModelService
    public hfModelStrategy: HfModelStrategy
    public localModelStrategy: LocalModelStrategy
    public externalModelStrategy: ExternalModelStrategy
    public openAiCompModelStrategy: OpenAiCompModelStrategy
    public envService: EnvService
    public agentService: AgentService
    public agentCommandService: AgentCommandService
    public chatService: ChatService
    public apiKeyService: ApiKeyService

    private selectedComplModel: LlmModel = ModelService.emptyModel
    private selectedModel: LlmModel = ModelService.emptyModel
    private selectedEmbeddingsModel: LlmModel = ModelService.emptyModel
    private selectedToolsModel: LlmModel = ModelService.emptyModel
    private selectedEnv: Env = {name: ""}
    private selectedAgent: Agent = {name: "", systemInstruction: []}
    private selectedChat: Chat = {name: "", id: ""}

    private constructor(context: vscode.ExtensionContext) {
        this.configuration = new Configuration()
        this.llamaServer = new LlamaServer(this)
        this.extraContext = new ExtraContext(this)
        this.lruResultCache = new LRUCache(this.configuration.max_cache_keys);
        this.architect = new Architect(this);
        this.statusbar = new Statusbar(this)
        this.menu = new Menu(this)
        this.completion = new Completion(this)
        this.logger = new Logger(this)
        this.askAi = new ChatWithAi(this)
        this.textEditor = new TextEditor(this)
        this.chatContext = new ChatContext(this)
        this.prompts = new Prompts(this)
        this.git = new Git(this)
        this.tools = new Tools(this)
        this.llamaAgent = new LlamaAgent(this)
        this.llamaWebviewProvider = new LlamaWebviewProvider(context.extensionUri, this, context)
        this.persistence = new Persistence(this, context)
        // strategies should be initialized before modelService constructor as they are needed there.
        this.hfModelStrategy = new HfModelStrategy(this)
        this.localModelStrategy = new LocalModelStrategy(this)
        this.externalModelStrategy = new ExternalModelStrategy(this)
        this.openAiCompModelStrategy = new OpenAiCompModelStrategy(this)
        this.modelService = new ModelService(this)
        this.envService = new EnvService(this)
        this.agentService = new AgentService(this)
        this.agentCommandService = new AgentCommandService(this)
        this.chatService = new ChatService(this) 
        this.apiKeyService = new ApiKeyService(this)
    }

    public static getInstance(context: vscode.ExtensionContext): Application {
        if (!Application.instance) {
            Application.instance = new Application(context);
        }
        return Application.instance;
    }

    getComplModel = (): LlmModel => {
        return this.selectedComplModel;
    }

    getToolsModel = (): LlmModel => {
        return this.selectedToolsModel;
    }

    getChatModel = (): LlmModel => {
        return this.selectedModel;
    }

    getEmbeddingsModel = (): LlmModel => {
        return this.selectedEmbeddingsModel;
    }

    getEnv = (): Env => {
        return this.selectedEnv;
    }

    getAgent = (): Agent => {
        return this.selectedAgent;
    }

    setAgent = (agent: Agent): void => {
        this.selectedAgent = agent;
    }

    getChat = (): Chat => {
        return this.selectedChat;
    }

    setChat = (chat: Chat) => {
        this.selectedChat = chat;
    }

    isComplModelSelected = (): boolean => {
        return this.selectedComplModel != undefined && this.selectedComplModel.name. trim() != "";
    }

    isChatModelSelected = (): boolean => {
        return this.selectedModel != undefined && this.selectedModel.name. trim() != "";
    }

    isToolsModelSelected = (): boolean => {
        return this.selectedToolsModel != undefined && this.selectedToolsModel.name. trim() != "";
    }

    isEmbeddingsModelSelected = (): boolean => {
        return this.selectedEmbeddingsModel != undefined && this.selectedToolsModel.name. trim() != "";
    }

    isEnvSelected = (): boolean => {
        return this.selectedEnv != undefined && this.selectedEnv.name. trim() != "";
    }

    isAgentSelected = (): boolean => {
        return this.selectedAgent != undefined && this.selectedAgent.name.trim() != "";
    }

    isChatSelected = (): boolean => {
        return this.selectedChat != undefined && this.selectedChat.name.trim() != "";
    }

    

    setSelectedModel = (type: ModelType, model: LlmModel | undefined) => {
        switch (type) {
            case ModelType.Completion:
                this.selectedComplModel = model??ModelService.emptyModel;
                break;
            case ModelType.Chat:
                this.selectedModel = model??ModelService.emptyModel;
                break;
            case ModelType.Embeddings:
                this.selectedEmbeddingsModel = model??ModelService.emptyModel;
                break;
            case ModelType.Tools:
                this.selectedToolsModel = model??ModelService.emptyModel;
                break;
        }
        this.llamaWebviewProvider.updateLlamaView();
    }

    public setSelectedEnv(env: Env): void {
        this.selectedEnv = env;
        this.persistence.setValue(PERSISTENCE_KEYS.SELECTED_ENV, env);
        this.llamaWebviewProvider.updateLlamaView();
    } 
}
