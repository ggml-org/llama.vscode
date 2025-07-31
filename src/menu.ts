import {Application} from "./application";
import vscode from "vscode";

export class Menu {
    private app: Application
    private completionModels = new Map<string, string>([
        ["Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)", "llama-server --fim-qwen-1.5b-default -ngl 99"],
        ["Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)", "llama-server --fim-qwen-3b-default -ngl 99"],
        ["Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)", "llama-server --fim-qwen-7b-default -ngl 99"],
        ["Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)", "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256"],
    ]);
    private selectedComplModel: [string, string] = ["", ""]
    private chatModels = new Map<string, string>([
        ["Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (<= 8GB VRAM)", "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF -ngl 99 -fa -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256"],
        ["Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF (<= 16GB VRAM)", "llama-server -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF -ngl 99 -fa -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256"],
        ["Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF (> 16GB VRAM)", "llama-server -hf ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF -ngl 99 -fa -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256"],
        ["Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (CPU Only)", "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256"],
    ]);
    private selectedChatModel: [string, string] = ["", ""]
    private embeddingsModels = new Map<string, string>([
        ["Nomic-Embed-Text-V2-GGUF", "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ub 2048 -b 2048 --ctx-size 2048 --embeddings"],
    ]);
    private selectedEmbeddingsModel: [string, string] = ["", ""]
    private toolsModels = new Map<string, string>([
        ["Z.AI: GLM 4.5 - 128,000 context, $0.60/M input tokens, $2.20/M output tokens", "z-ai/glm-4.5"],
        ["Z.AI: GLM 4.5 Air - 128,000 context, $0.20/M input tokens, $1.10/M output tokens", "z-ai/glm-4.5-air"],
        ["Qwen: Qwen3 Coder (free) - 262K context, $0/M input tokens, $0/M output tokens", "qwen/qwen3-coder:free"],
        ["Qwen: Qwen3 235B A22B Thinking 2507 - 262,144 context, $0.118/M input tokens, $0.118/M output tokens", "qwen/qwen3-235b-a22b-thinking-2507"],
        ["Qwen: Qwen3 Coder - 262K context, $0,30/M input tokens, $1,20/M output tokens", "qwen/qwen3-coder"],
        ["Qwen: Qwen3 235B A22B Instruct 2507 - 262K context, $0,12/M input tokens, $0,59/M output tokens", "qwen/qwen3-235b-a22b-2507"],
        ["MoonshotAI: Kimi K2 (free) - 131K context, $0/M input tokens, $0/M output tokens", "moonshotai/kimi-k2:free"],
        ["MoonshotAI: Kimi K2 - 131K context, $0,55/M input tokens, $2,20/M output tokens", "moonshotai/kimi-k2"],
        ["Google: Gemini 2.5 Flash Lite - 1,05M context, $0,10/M input tokens, $0,40/M output tokens", "google/gemini-2.5-flash-lite"],
        ["Google: Gemini 2.5 Flash - 1,05M context, $0,30/M input tokens, $2,50/M output tokens, $1,238/K input imgs", "google/gemini-2.5-flash"],
    ]);
    private selectedToolsModel: [string, string] = ["", ""]
    constructor(application: Application) {
        this.app = application;
    }

    createMenuItems = (currentLanguage: string | undefined, isLanguageEnabled: boolean): vscode.QuickPickItem[] => {
        let menuItems = [
            {
                label: `${this.app.configuration.enabled ?  this.app.configuration.getUiText('Disable') :  this.app.configuration.getUiText('Enable')} ${this.app.configuration.getUiText("All Completions")}`,
                description: `${this.app.configuration.enabled ? this.app.configuration.getUiText('Turn off completions globally') : this.app.configuration.getUiText('Turn on completions globally')}`
            },
            currentLanguage ? {
                label: `${isLanguageEnabled ?  this.app.configuration.getUiText('Disable') :  this.app.configuration.getUiText('Enable')} ${ this.app.configuration.getUiText("Completions for")} ${currentLanguage}`,
                description: `${ this.app.configuration.getUiText("Currently")} ${isLanguageEnabled ?  this.app.configuration.getUiText('enabled') :  this.app.configuration.getUiText('disabled')}`
            } : null,
            {
                label: `${this.app.configuration.rag_enabled ?  this.app.configuration.getUiText('Disable') :  this.app.configuration.getUiText('Enable')} RAG`,
                description: `${this.app.configuration.rag_enabled ? this.app.configuration.getUiText('Turn off RAG related features like Chat with AI with project context') : this.app.configuration.getUiText('Turn on RAG related features like Chat with AI with project context')}`
            },
            {
                label: "$(gear) " + this.app.configuration.getUiText("Edit Settings..."),
            },
            {
                label: "$(book) " + this.app.configuration.getUiText("View Documentation..."),
            },
            {
                label: this.app.configuration.getUiText("Show running servers"),
                description: this.app.configuration.getUiText("Displays a list of currently running servers")
            },
            {
                label: "Install/upgrade llama.cpp",
                description: "Installs/upgrades llama.cpp server"
            },]
        menuItems.push(
            {
                label: this.app.configuration.getUiText("Show Llama Agent") ?? "",
                description: this.app.configuration.getUiText(`Shows Llama Agent panel`)
            })
        if (this.app.configuration.endpoint_chat && this.app.configuration.endpoint_chat.trim() != "")
            menuItems.push(
                {
                    label: this.app.configuration.getUiText("Chat with AI") ?? "",
                    description: this.app.configuration.getUiText(`Opens a chat with AI window inside VS Code using server from property endpoint_chat`)
                })
        if (this.app.configuration.rag_enabled){
            menuItems.push({
                label: this.app.configuration.getUiText("Chat with AI with project context") ?? "",
                description: this.app.configuration.getUiText(`Opens a chat with AI window with project context inside VS Code using server from property endpoint_chat`)
            })
        }
        menuItems.push(
            {
                label: this.app.configuration.getUiText('Start/change completion model...')??""
            })
        if (!this.app.llamaServer.isFimRunning()){
            menuItems.push(
            {
                label: this.app.configuration.getUiText("Start completion llama.cpp server")??"",
                description: this.app.configuration.getUiText(`Runs the command from property launch_completion`)
            })
        } else {
            menuItems.push(
            {
                label: this.app.configuration.getUiText("Stop completion llama.cpp server")??"",
                description: this.app.configuration.getUiText(`Stops completion llama.cpp server if it was started from llama.vscode menu`)
            })
        }
        menuItems.push(
            {
                label: this.app.configuration.getUiText('Start/change chat model...')??""
            })
        if (!this.app.llamaServer.isChatRunning()){
            menuItems.push(
            {
                label: this.app.configuration.getUiText("Start chat llama.cpp server")??"",
                description: this.app.configuration.getUiText(`Runs the command from property launch_chat`)
            })
        } else {
            menuItems.push(
                {
                    label: this.app.configuration.getUiText("Stop chat llama.cpp server")??"",
                    description: this.app.configuration.getUiText(`Stops chat llama.cpp server if it was started from llama.vscode menu`)
                })
        }
        menuItems.push(
            {
                label: this.app.configuration.getUiText('Start/change embeddings model...')??""
            })

        if (!this.app.llamaServer.isEmbeddingsRunning()){
            menuItems.push(
            {
                label: this.app.configuration.getUiText("Start embeddings llama.cpp server")??"",
                description: this.app.configuration.getUiText(`Runs the command from property launch_embeddings`)
            }
            )
        } else {
            menuItems.push(
                {
                    label: this.app.configuration.getUiText("Stop embeddings llama.cpp server")??"",
                    description: this.app.configuration.getUiText(`Stops embeddings llama.cpp server if it was started from llama.vscode menu`)
                })
        }
        menuItems.push(
            {
                label: this.app.configuration.getUiText('Select/change AI with tools model from OpenRouter...')??""
            })

        menuItems.push(
            {
                label: this.app.configuration.getUiText('Start all models'),
                description: this.app.configuration.getUiText(`Starts completion, chat and embeddings models`)
            })
            menuItems.push(
            {
                label: this.app.configuration.getUiText('Stop all models'),
                description: this.app.configuration.getUiText(`Stops completion, chat and embeddings models`)
            })
            

        if (this.app.configuration.launch_training_completion.trim() != "") {
            menuItems.push(
            {
                label: this.app.configuration.getUiText("Start training completion model")??"",
                description: this.app.configuration.getUiText(`Runs the command from property launch_training_completion`)
            })
        }
        if (this.app.configuration.launch_training_chat.trim() != "") {
                menuItems.push(
            {
                label: this.app.configuration.getUiText("Start training chat model")??"",
                description: this.app.configuration.getUiText(`Runs the command from property launch_training_chat`)
            })
        }
        if (this.app.configuration.launch_training_completion.trim() != "" || this.app.configuration.launch_training_chat.trim() != "") {
            menuItems.push(
            {
                label: this.app.configuration.getUiText("Stop training")??"",
                description: this.app.configuration.getUiText(`Stops training if it was started from llama.vscode menu`)
            })
        }

        return menuItems.filter(Boolean) as vscode.QuickPickItem[];
    }

    handleMenuSelection = async (selected: vscode.QuickPickItem, currentLanguage: string | undefined, languageSettings: Record<string, boolean>, context: vscode.ExtensionContext) => {      
        const PRESET_PLACEHOLDER = "[preset]";
        const MODEL_PLACEHOLDER = "[model]";

        let { port, portChat, portEmbedding } = this.getPorts();

        let llmTemplate = " llama-server -hf " + MODEL_PLACEHOLDER
        let llmTemplateVram = " llama-server --" + PRESET_PLACEHOLDER + " --port " + port
        let llmChatVram = " llama-server -hf " + MODEL_PLACEHOLDER + " --port " + portChat + " -ngl 99 -fa -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 "
        let llmEmbedding = " llama-server -hf " + MODEL_PLACEHOLDER + " --port " + portEmbedding + " -ub 2048 -b 2048 --ctx-size 2048 --embeddings"
        
        if (selected.label.startsWith(this.app.configuration.getUiText('Start completion model')??"")){
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(llmTemplate.replace(MODEL_PLACEHOLDER, this.selectedComplModel[1]) +  " --port " + port);
                this.app.statusbar.updateStatusBarText();
                return;
        } else if (selected.label.startsWith(this.app.configuration.getUiText('Start chat model')??"")){
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(llmTemplate.replace(MODEL_PLACEHOLDER, this.selectedChatModel[1]) +  " --port " + portChat);
                this.app.statusbar.updateStatusBarText();
                return; 
        } else if (selected.label.startsWith(this.app.configuration.getUiText('Start embeddings model')??"")){
                await this.app.llamaServer.killEmbeddingsCmd();
                await this.app.llamaServer.shellEmbeddingsCmd(llmTemplate.replace(MODEL_PLACEHOLDER, this.selectedEmbeddingsModel[1]) +  " --port " + portEmbedding);
                this.app.statusbar.updateStatusBarText();
                return;
        }
        
        switch (selected.label) {
            case this.app.configuration.getUiText('Show running servers'):
                vscode.window.showInformationMessage("Tools: " + this.selectedToolsModel[0]  + " (" + this.selectedToolsModel[1] + ") | " + 
                    "Completion: " + this.selectedComplModel[0] + " (" + this.selectedComplModel[1] + ") | " + 
                    "Chat: " + this.selectedChatModel[0] + " (" + this.selectedChatModel[1] + ") | " +  
                    "Embeddings: " + this.selectedEmbeddingsModel[0] + " (" + this.selectedEmbeddingsModel[1] + ")");
                break;
            case this.app.configuration.getUiText("Start/change completion model..."):
                const selectedModel = await vscode.window.showQuickPick(Array.from(this.completionModels.keys()));
                if (selectedModel) {
                    this.selectedComplModel = [selectedModel,  this.completionModels.get(selectedModel)??""];
                    let { port, portChat, portEmbedding } = this.getPorts();
                    await this.app.llamaServer.killFimCmd();
                    await this.app.llamaServer.shellFimCmd(this.selectedComplModel[1] +  " --port " + port);
                    if (!this.app.configuration.launch_completion) await this.app.configuration.config.update('launch_completion', this.selectedComplModel[1] + " --port " + port, true);
                }
                break;
            case this.app.configuration.getUiText("Start/change chat model..."):
                const chatModel = await vscode.window.showQuickPick(Array.from(this.chatModels.keys()));
                if (chatModel) {
                    this.selectedChatModel = [chatModel ,this.chatModels.get(chatModel)??""];
                    let { port, portChat, portEmbedding } = this.getPorts();
                    await this.app.llamaServer.killChatCmd();
                    await this.app.llamaServer.shellChatCmd(this.selectedChatModel[1] +  " --port " + portChat);
                    if (!this.app.configuration.launch_chat) await this.app.configuration.config.update('launch_chat', this.selectedChatModel[1] + " --port " + portChat, true);
                }
                break;
            case this.app.configuration.getUiText("Start/change embeddings model..."):
                const embeddingsModel = await vscode.window.showQuickPick(Array.from(this.embeddingsModels.keys()));
                if (embeddingsModel) {
                    this.selectedEmbeddingsModel = [embeddingsModel ,this.embeddingsModels.get(embeddingsModel)??""];
                    let { port, portChat, portEmbedding } = this.getPorts();
                    await this.app.llamaServer.killEmbeddingsCmd();
                    await this.app.llamaServer.shellEmbeddingsCmd(this.selectedEmbeddingsModel[1] +  " --port " + portEmbedding);
                    if (!this.app.configuration.launch_embeddings) await this.app.configuration.config.update('launch_embeddings', this.selectedEmbeddingsModel[1] + " --port " + portEmbedding, true);
                }
                break;
            case this.app.configuration.getUiText("Select/change AI with tools model from OpenRouter..."):
                await this.selectAiWithToolsModel();
                break;
            case "$(gear) " +  this.app.configuration.getUiText("Edit Settings..."):
                await vscode.commands.executeCommand('workbench.action.openSettings', 'llama-vscode');
                break;
            case this.app.configuration.getUiText('Start all models'):
                if (this.app.configuration.launch_completion){
                    await this.app.llamaServer.killFimCmd();
                    await this.app.llamaServer.shellChatCmd(this.app.configuration.launch_completion);
                    this.selectedComplModel = ["launch_completion", this.app.configuration.launch_completion]
                } else vscode.window.showInformationMessage("launch_completion setting is empty. Completion server can't be started.");
                if (this.app.configuration.launch_chat){
                    await this.app.llamaServer.killChatCmd();
                    await this.app.llamaServer.shellChatCmd(this.app.configuration.launch_chat);
                    this.selectedChatModel = ["launch_chat", this.app.configuration.launch_chat]
                } else vscode.window.showInformationMessage("launch_chat setting is empty. Chat server can't be started.");
                if (this.app.configuration.launch_chat){
                    await this.app.llamaServer.killEmbeddingsCmd();
                    await this.app.llamaServer.shellEmbeddingsCmd(this.app.configuration.launch_embeddings);
                    this.selectedEmbeddingsModel = ["launch_embeddings", this.app.configuration.launch_embeddings]
                } else vscode.window.showInformationMessage("launch_embeddings setting is empty. Embeddings server can't be started.");
                break;
            case this.app.configuration.getUiText('Stop all models'):
                await this.app.llamaServer.killFimCmd();
                this.selectedComplModel = ["", ""]
                await this.app.llamaServer.killChatCmd();
                this.selectedChatModel = ["", ""]
                await this.app.llamaServer.killEmbeddingsCmd();
                this.selectedEmbeddingsModel = ["", ""]
                break;
            case this.app.configuration.getUiText('Start completion llama.cpp server'):
                await this.app.llamaServer.killFimCmd();
                let commandCompletion = this.app.configuration.launch_completion
                if ( this.app.configuration.lora_completion != undefined
                    && this.app.configuration.lora_completion.trim() != "undefined"
                    && this.app.configuration.lora_completion.trim() != "") commandCompletion += " --lora " + this.app.configuration.lora_completion
                await this.app.llamaServer.shellFimCmd(commandCompletion);
                this.selectedComplModel = ["launch_completion", this.app.configuration.launch_completion]
                break;
            case this.app.configuration.getUiText('Start chat llama.cpp server'):
                await this.app.llamaServer.killChatCmd();
                let commandChat = this.app.configuration.launch_chat
                if (this.app.configuration.lora_chat != undefined
                    && this.app.configuration.lora_chat.trim() != "undefined"
                    && this.app.configuration.lora_chat.trim() != "") commandChat += " --lora " + this.app.configuration.lora_chat
                await this.app.llamaServer.shellChatCmd(commandChat);
                this.selectedChatModel = ["launch_chat", this.app.configuration.launch_chat]
                break;
            case this.app.configuration.getUiText('Start embeddings llama.cpp server'):
                await this.app.llamaServer.killEmbeddingsCmd();
                let commandEmbeddings = this.app.configuration.launch_embeddings
                await this.app.llamaServer.shellEmbeddingsCmd(commandEmbeddings);
                this.selectedEmbeddingsModel = ["launch_embeddings", this.app.configuration.launch_embeddings]
                break;
            case this.app.configuration.getUiText('Start training completion model'):
                await this.app.llamaServer.killTrainCmd();
                await this.app.llamaServer.shellTrainCmd(this.app.configuration.launch_training_completion);
                break;
            case this.app.configuration.getUiText('Start training chat model'):
                await this.app.llamaServer.killTrainCmd();
                await this.app.llamaServer.shellTrainCmd(this.app.configuration.launch_training_chat);
                break;
            case this.app.configuration.getUiText("Stop completion llama.cpp server"):
                await this.app.llamaServer.killFimCmd();
                this.selectedComplModel = ["", ""];
                break;
            case this.app.configuration.getUiText("Stop embeddings llama.cpp server"):
                await this.app.llamaServer.killEmbeddingsCmd();
                this.selectedEmbeddingsModel = ["", ""];
                break;
            case this.app.configuration.getUiText("Stop chat llama.cpp server"):
                await this.app.llamaServer.killChatCmd();
                this.selectedChatModel = ["", ""];
                break;
            case this.app.configuration.getUiText("Stop training"):
                await this.app.llamaServer.killTrainCmd();
                break;
            case "$(book) " + this.app.configuration.getUiText("View Documentation..."):
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggml-org/llama.vscode'));
                break;
            case this.app.configuration.getUiText("Chat with AI"):
                this.app.askAi.showChatWithAi(false, context);
                break;
            case "Install/upgrade llama.cpp":
                if (process.platform != 'darwin' && process.platform != 'win32') {
                    vscode.window.showInformationMessage("Automatic install/upgrade is supported only for Mac and Windows for now. Download llama.cpp package manually and add the folder to the path. Visit github.com/ggml-org/llama.vscode/wiki for details.")
                    return;
                }
                await this.app.llamaServer.killCommandCmd();
                let terminalCommand = process.platform === 'darwin' ? "brew install llama.cpp" : process.platform === 'win32' ? "winget install llama.cpp" : ""
                await this.app.llamaServer.shellCommandCmd(terminalCommand);
                break;
            case this.app.configuration.getUiText("Show Llama Agent"):
                vscode.commands.executeCommand('extension.showLlamaWebview');
                break;
            case this.app.configuration.getUiText("Chat with AI with project context"):
                this.app.askAi.showChatWithAi(true, context)
                break;
            default:
                await this.handleCompletionToggle(selected.label, currentLanguage, languageSettings);
                await this.handleRagToggle(selected.label, currentLanguage, languageSettings);
                break;
        }
        this.app.statusbar.updateStatusBarText();
    }

    getPorts = () => {
        const DEFAULT_PORT_FIM_MODEL = "8012"
        const DEFAULT_PORT_CHAT_MODEL = "8011"
        const DEFAULT_PORT_TOOLS_MODEL = "8080"
        const DEFAULT_PORT_EMBEDDINGS_MODEL = "8010"

        let endpointParts = this.app.configuration.endpoint.split(":");
        let endpointChatParts = this.app.configuration.endpoint_chat.split(":");
        let endpointToolsParts = this.app.configuration.endpoint_tools.split(":");
        let endpointEmbeddingParts = this.app.configuration.endpoint_embeddings.split(":");

        let port = endpointParts[endpointParts.length - 1];
        let portChat = endpointChatParts[endpointChatParts.length - 1];
        let portTools = endpointChatParts[endpointToolsParts.length - 1];
        let portEmbedding = endpointEmbeddingParts[endpointEmbeddingParts.length - 1];

        if (!Number.isInteger(Number(port))) port = DEFAULT_PORT_FIM_MODEL;
        if (!Number.isInteger(Number(portChat))) portChat = DEFAULT_PORT_CHAT_MODEL;
        if (!Number.isInteger(Number(portTools))) portTools = DEFAULT_PORT_TOOLS_MODEL;
        if (!Number.isInteger(Number(portEmbedding))) portEmbedding = DEFAULT_PORT_EMBEDDINGS_MODEL;

        // TODO Return portTools if needed
        return { port, portChat, portEmbedding };
    }

    selectAiWithToolsModel = async () => {
        const toolsModel = await vscode.window.showQuickPick(Array.from(this.toolsModels.keys()));
        if (toolsModel) {
            this.selectedToolsModel = [toolsModel, this.toolsModels.get(toolsModel) ?? ""];
            const config = this.app.configuration.config;
            await config.update('endpoint_tools', "https://openrouter.ai/api", true);
            await config.update('ai_model', this.selectedToolsModel[1], true);
            vscode.window.showInformationMessage("Make sure the extension setting Api_key_tools contains your OpenRouter API key.");

        }
    }

    private async handleCompletionToggle(label: string, currentLanguage: string | undefined, languageSettings: Record<string, boolean>) {
        const config = this.app.configuration.config;
        if (label.includes(this.app.configuration.getUiText('All Completions')??"")) {
            await config.update('enabled', !this.app.configuration.enabled, true);
        } else if (currentLanguage && label.includes(currentLanguage)) {
            const isLanguageEnabled = languageSettings[currentLanguage] ?? true;
            languageSettings[currentLanguage] = !isLanguageEnabled;
            await config.update('languageSettings', languageSettings, true);
        }
    }

    private async handleRagToggle(label: string, currentLanguage: string | undefined, languageSettings: Record<string, boolean>) {
        const config = this.app.configuration.config;
        if (label.includes("RAG")) {
            await config.update('rag_enabled', !this.app.configuration.rag_enabled, true);
        } 
    }

    showMenu = async (context: vscode.ExtensionContext) => {
        const currentLanguage = vscode.window.activeTextEditor?.document.languageId;
        const isLanguageEnabled = currentLanguage ? this.app.configuration.isCompletionEnabled(undefined, currentLanguage) : true;

        const items = this.app.menu.createMenuItems(currentLanguage, isLanguageEnabled);
        const selected = await vscode.window.showQuickPick(items, { title: "Llama Menu" });

        if (selected) {
            await this.handleMenuSelection(selected, currentLanguage, this.app.configuration.languageSettings, context);
        }
    }

    getToolsModel = (): string => {
        return this.selectedToolsModel[0];
    }

}
