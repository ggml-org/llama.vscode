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
import path from "path";
import { Persistence } from "./persistence";

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
    }

    public static getInstance(context: vscode.ExtensionContext): Application {
        if (!Application.instance) {
            Application.instance = new Application(context);
        }
        return Application.instance;
    }

}
