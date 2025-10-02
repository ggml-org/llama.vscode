import {Application} from "./application";
import vscode, { QuickPickItem } from "vscode";
import { HuggingfaceFile, HuggingfaceModel, LlmModel, ModelTypeDetails, Env, Agent, Chat, AgentCommand } from "./types";
import { Utils } from "./utils";
import { Configuration } from "./configuration";
import * as fs from 'fs';
import * as path from 'path';
import { ModelType, AGENT_NAME, UI_TEXT_KEYS, PERSISTENCE_KEYS, PREDEFINED_LISTS_KEYS } from "./constants";
import { PREDEFINED_LISTS } from "./lists";

export class Menu {
    private static readonly emptyModel = {name: ""};
    private app: Application
    private selectedComplModel: LlmModel = Menu.emptyModel
    private selectedModel: LlmModel = Menu.emptyModel 
    private selectedEmbeddingsModel: LlmModel = Menu.emptyModel
    private selectedToolsModel: LlmModel = Menu.emptyModel
    private selectedEnv: Env = {name: ""}
    private selectedAgent: Agent = {name: "", systemInstruction: []}
    private selectedChat: Chat = {name:"", id:""}

    private readonly startModelDetail = "Selects the model and if local also downloads the model (if not yet done) and starts a llama-server with it.";

    constructor(application: Application) {
        this.app = application;
    }

    private uiCache: Record<string, string> = {};

    createMenuItems = (currentLanguage: string | undefined, isLanguageEnabled: boolean): vscode.QuickPickItem[] => {
        let menuItems = [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.actions),
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartEnv) ?? "",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.envSelectDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopEnv),
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopEnvDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedEnv),
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedEnvDescription)
            },
            {
                label: (this.app.configuration.getUiText(UI_TEXT_KEYS.showLlamaAgent) ?? "") + " (Ctrl+Shif+A)",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.showLlamaAgentDescription)
            },
            {
                label: (this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAI) ?? "") + " (Ctrl+;)",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAIDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedModels),
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedModelsDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.useAsLocalAIRunner),
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.localAIRunnerDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.entities),
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.envs) ?? "",
            },
            
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.completionModels) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.chatModels) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.embeddingsModels) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.toolsModels) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.apiKeys),
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.apiKeysDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.agents),
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.agentCommands),
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.chats),
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.maintenance),
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: "Install/upgrade llama.cpp",
                description: "Installs/upgrades llama.cpp server"
            },
            {
                label: `${this.app.configuration.enabled ?  this.app.configuration.getUiText(UI_TEXT_KEYS.disable) :  this.app.configuration.getUiText(UI_TEXT_KEYS.enable)} ${this.app.configuration.getUiText(UI_TEXT_KEYS.allCompletions)}`,
                description: `${this.app.configuration.enabled ? this.app.configuration.getUiText(UI_TEXT_KEYS.turnOffCompletionsGlobally) : this.app.configuration.getUiText(UI_TEXT_KEYS.turnOnCompletionsGlobally)}`
            },
            currentLanguage ? {
                label: `${isLanguageEnabled ?  this.app.configuration.getUiText(UI_TEXT_KEYS.disable) :  this.app.configuration.getUiText(UI_TEXT_KEYS.enable)} ${ this.app.configuration.getUiText(UI_TEXT_KEYS.completionsFor)} ${currentLanguage}`,
                description: `${ this.app.configuration.getUiText(UI_TEXT_KEYS.currently)} ${isLanguageEnabled ?  this.app.configuration.getUiText(UI_TEXT_KEYS.enabled) :  this.app.configuration.getUiText(UI_TEXT_KEYS.disabled)}`
            } : null,
            {
                label: `${this.app.configuration.rag_enabled ?  this.app.configuration.getUiText(UI_TEXT_KEYS.disable) :  this.app.configuration.getUiText(UI_TEXT_KEYS.enable)} ${this.app.configuration.getUiText(UI_TEXT_KEYS.rag)}`,
                description: `${this.app.configuration.rag_enabled ? this.app.configuration.getUiText(UI_TEXT_KEYS.turnOffRAG) : this.app.configuration.getUiText(UI_TEXT_KEYS.turnOnRAG)}`
            },
            {
                label: "$(gear) " + this.app.configuration.getUiText(UI_TEXT_KEYS.editSettings),
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.help),
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.howToUseLlamaVscode),
            },
            {
                label: (this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAIAboutLlamaVscode) ?? ""),
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAIAboutLlamaVscodeDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.howToDeleteModels),
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.howToDeleteModelsDescription)
            },
            {
                label: "$(book) " + this.app.configuration.getUiText(UI_TEXT_KEYS.viewDocumentation),
            },
            ]                          

        if (this.app.configuration.launch_training_completion.trim() != "") {
            menuItems.push(
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.startTrainingCompletionModel) ?? "",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.launchTrainingCompletionDescription)
            })
        }
        if (this.app.configuration.launch_training_chat.trim() != "") {
                menuItems.push(
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.startTrainingChatModel) ?? "",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.launchTrainingChatDescription)
            })
        }
        if (this.app.configuration.launch_training_completion.trim() != "" || this.app.configuration.launch_training_chat.trim() != "") {
            menuItems.push(
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.stopTraining) ?? "",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.stopTrainingDescription)
            })
        }

        return menuItems.filter(Boolean) as vscode.QuickPickItem[];
    }

    handleMenuSelection = async (selected: vscode.QuickPickItem, currentLanguage: string | undefined, languageSettings: Record<string, boolean>, context: vscode.ExtensionContext) => {              
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartEnv):
                await this.app.envService.selectEnv(this.app.configuration.envs_list, true);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopEnv):
                await this.app.envService.stopEnv();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedEnv):
                this.showCurrentEnv();
                break;
             case this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAI) + " (Ctrl+;)":
                this.app.askAi.showChatWithAi(false, context);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAIAboutLlamaVscode):
                const helpAgent = this.app.configuration.agents_list.find(a => a.name === AGENT_NAME.llamaVscodeHelp);
                if (helpAgent) {
                    await this.app.agentService.selectAgent(helpAgent);
                }
                this.showAgentView();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.showLlamaAgent) + " (Ctrl+Shif+A)":
                await this.showAgentView();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAIWithProjectContext) + " (Ctrl+Shift+;)":
                if (this.app.configuration.rag_enabled){
                    this.app.askAi.showChatWithAi(true, context)
                } else {
                    vscode.window.showInformationMessage("RAG is not enabled. Please enable it from llama-vscode before using this feature.")
                }
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedModels):
                this.showCurrentEnv();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.useAsLocalAIRunner):
                vscode.commands.executeCommand('extension.showLlamaWebview');
                this.app.llamaWebviewProvider.setView("airunner")
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.completionModels) ?? "":
                await this.processModelActions(ModelType.Completion);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chatModels) ?? "":
                await this.processModelActions(ModelType.Chat);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.embeddingsModels) ?? "":
                await this.processModelActions(ModelType.Embeddings);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.toolsModels) ?? "":
                await this.processModelActions(ModelType.Tools);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.envs) ?? "":
                let envsActions: vscode.QuickPickItem[] = this.app.envService.getActions();
                let envSelected = await vscode.window.showQuickPick(envsActions);
                if (envSelected) await this.app.envService.processActions(envSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.agents) ?? "":
                let agentsActions: vscode.QuickPickItem[] = this.app.agentService.getActions();
                let actionSelected = await vscode.window.showQuickPick(agentsActions);
                if (actionSelected) await this.app.agentService.processActions(actionSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.agentCommands) ?? "":
                let agentCommandsActions: vscode.QuickPickItem[] = this.getAgentCommandsActions();
                let agentCommandSelected = await vscode.window.showQuickPick(agentCommandsActions);
                if (agentCommandSelected) this.processAgentCommandsActions(agentCommandSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chats) ?? "":
                let chatsActions: vscode.QuickPickItem[] = this.getChatActions();
                let chatSelected = await vscode.window.showQuickPick(chatsActions);
                if (chatSelected) this.processChatActions(chatSelected);
                break;
            case "$(gear) " +  this.app.configuration.getUiText(UI_TEXT_KEYS.editSettings):
                await vscode.commands.executeCommand('workbench.action.openSettings', 'llama-vscode');
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.startTrainingCompletionModel):
                await this.app.llamaServer.killTrainCmd();
                await this.app.llamaServer.shellTrainCmd(this.app.modelService.sanitizeCommand(this.app.configuration.launch_training_completion));
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.startTrainingChatModel):
                await this.app.llamaServer.killTrainCmd();
                await this.app.llamaServer.shellTrainCmd(this.app.modelService.sanitizeCommand(this.app.configuration.launch_training_chat));
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.stopTraining):
                await this.app.llamaServer.killTrainCmd();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.apiKeys):
                let apiKeysActions: vscode.QuickPickItem[] = [
                    {
                        label: this.app.configuration.getUiText(UI_TEXT_KEYS.addAPIKey) ?? ""
                    },
                    {
                        label: this.app.configuration.getUiText(UI_TEXT_KEYS.editDeleteAPIKey) ?? ""
                    },
                ]
                let apiKeyActionSelected = await vscode.window.showQuickPick(apiKeysActions);
                if (apiKeyActionSelected) this.processApiKeyActions(apiKeyActionSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.howToDeleteModels):
                Utils.showOkDialog("The automatically downloaded models (llama-server started with -hf option) are stored as follows: \nIn Windows in folder C:\\Users\\<user_name>\\AppData\\Local\\llama.cpp. \nIn Mac or Linux the folder could be /users/<user_name>/Library/Caches/llama.cpp. \nYou could delete them from the folder.")
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.howToUseLlamaVscode):
                this.showHowToUseLlamaVscode();
                break;
            case "$(book) " + this.app.configuration.getUiText(UI_TEXT_KEYS.viewDocumentation):
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggml-org/llama.vscode/wiki'));
                break;
            case "Install/upgrade llama.cpp":
                await this.installLlamacpp();
                break;
            default:
                await this.handleCompletionToggle(selected.label, currentLanguage, languageSettings);
                await this.handleRagToggle(selected.label, currentLanguage, languageSettings);
                break;
        }
        this.app.statusbar.updateStatusBarText();
    }


    selectChatFromList = async () => {
        let chatsList = this.app.persistence.getChats()
        if (!chatsList || chatsList.length == 0){
            vscode.window.showInformationMessage("No chats in the history.")
            return;
        }
        const chatsItems: QuickPickItem[] = this.getStandardQpList(chatsList, "");
        const chat = await vscode.window.showQuickPick(chatsItems);
        if (chat) {
            let futureChat: Chat;
            futureChat = chatsList[parseInt(chat.label.split(". ")[0], 10) - 1]
            if(!futureChat){
                vscode.window.showWarningMessage("No chat selected.");
                return;
            }
            await this.selectUpdateChat(futureChat)
        }
    }

    selectUpdateChat = async (chatToSelect: Chat) => {
        if (chatToSelect.id != this.selectedChat.id){
            await this.updateChatHistory();
            this.selectedChat = chatToSelect;
            await this.app.persistence.setValue(PERSISTENCE_KEYS.SELECTED_CHAT, this.selectedChat);
            this.app.llamaAgent.selectChat(this.selectedChat);
            this.app.llamaWebviewProvider.updateLlamaView();
        } else {
            this.selectedChat = chatToSelect;
            await this.app.persistence.setValue(PERSISTENCE_KEYS.SELECTED_CHAT, this.selectedChat);
        }       
    }

    deleteChatFromList = async (chatList: Chat[]) => {
        const chatsItems: QuickPickItem[] = this.getStandardQpList(chatList, "");
        const chat = await vscode.window.showQuickPick(chatsItems);
        if (chat) {
            const shoulDeleteChat = await Utils.confirmAction("Are you sure you want to delete the chat below?", 
                "name: " + chat.label + "\ndescription: " + chat.description
            );
            if (shoulDeleteChat) {
                let chatToDelIndex = parseInt(chat.label.split(". ")[0], 10) - 1
                chatList.splice(chatToDelIndex, 1);
                await this.app.persistence.setChats(chatList);  
                vscode.window.showInformationMessage("The chat is deleted: " + chat.label)          
            }
        }
    }

    updateChatHistory = async () => {
        // if chat exists - update it, otherwise, just add it
        if (this.isChatSelected()){
            let chatToAdd = this.selectedChat;
            await this.addChatToHistory(chatToAdd);
        }
    }
    
    

    public setSelectedAgent(agent: Agent): void {
        this.selectedAgent = agent;
    }

    private async processModelActions(modelType: ModelType) {
        let modelActions: vscode.QuickPickItem[] = this.app.modelService.getActions(modelType);
        let actionSelected = await vscode.window.showQuickPick(modelActions);
        if (actionSelected) {
            await this.app.modelService.processActions(modelType, actionSelected);
        }
    }

    public async showAgentView() {
        let isModelAvailable = await this.checkForToolsModel();
        if (isModelAvailable) {
            vscode.commands.executeCommand('extension.showLlamaWebview');
            this.app.llamaWebviewProvider.updateLlamaView();
            setTimeout(() => {
                if (this.app.llamaWebviewProvider.webview) {
                    this.app.llamaWebviewProvider.webview.webview.postMessage({
                        command: 'focusTextarea'
                    });
                }
            }, 100);
        }
    }

    private async addChatToHistory(chatToAdd: Chat) {
        let chats = this.app.persistence.getChats();
        if (!chats) chats = [];
        const index = chats.findIndex((ch: Chat) => ch.id === chatToAdd.id);
        if (index !== -1) {
            chats.splice(index, 1);
        }
        chats.push(chatToAdd);
        if (chats.length > this.app.configuration.chats_max_history) chats.shift();
        await this.app.persistence.setChats(chats);
        vscode.window.showInformationMessage("The chat '" + chatToAdd.name + "' is added/updated.");
    }

    public async checkForToolsModel() {
        let toolsModel = this.app.menu.getToolsModel();
        let targetUrl = this.app.configuration.endpoint_tools ? this.app.configuration.endpoint_tools + "/" : "";
        if (toolsModel && toolsModel.endpoint) {
            const toolsEndpoint = Utils.trimTrailingSlash(toolsModel.endpoint);
            targetUrl = toolsEndpoint ? toolsEndpoint + "/" : "";
        }
        if (!targetUrl) {
            const shouldSelectEnv = await Utils.showUserChoiceDialog("Select a tools model or an env with tools model to use Llama Agent.", "Select");
            if (shouldSelectEnv) {
                // await this.app.menu.selectEnvFromList(this.app.configuration.envs_list.filter(item => item.tools != undefined && item.tools.name));
                this.showEnvView()
                vscode.window.showInformationMessage("After the tools model is loaded, try again opening llama agent.");
            } else {
                vscode.window.showErrorMessage("No endpoint for the tools model. Select an env with tools model or enter the endpoint of a running llama.cpp server with tools model in setting endpoint_tools. ");
            }
            return false;
        }
        else return true;
    }

    // selectEnv moved to EnvService.selectStartEnv (with inheritance)

    public async installLlamacpp() {
        if (process.platform != 'darwin' && process.platform != 'win32') {
            vscode.window.showInformationMessage("Automatic install/upgrade is supported only for Mac and Windows for now. Download llama.cpp package manually and add the folder to the path. Visit github.com/ggml-org/llama.vscode/wiki for details.");
        } else {
            await this.app.llamaServer.killCommandCmd();
            let terminalCommand = process.platform === 'darwin' ? "brew install llama.cpp" : process.platform === 'win32' ? "winget install llama.cpp" : "";
            // await this.app.llamaServer.shellCommandCmd(terminalCommand);
            await this.app.llamaServer.executeCommandWithTerminalFeedback(terminalCommand)
        }
    }

    private async activateModel(selModelPropName: string, killCmd: () => void, shellCmd: (message: string) => void) {
        let selModel = this[selModelPropName as keyof Menu] as LlmModel
        this.app.modelService.addApiKey(selModel);
        await this.app.persistence.setValue(selModelPropName, selModel);
        await killCmd();
        if (selModel.localStartCommand) await shellCmd(this.app.modelService.sanitizeCommand(selModel.localStartCommand ?? ""));
        this.app.llamaWebviewProvider.updateLlamaView();
    }

    

    

        
    

    private getChatActions(): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartChat) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deleteChat) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.exportChat) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.importChat) ?? ""
            },
        ];
    }

    public showCurrentEnv() {
        Utils.showOkDialog(this.getSelectionsAsString());
    }

    public showHowToUseLlamaVscode() {
        Utils.showOkDialog("How to use llama-vscode" +
            "\n\nTL;DR: install llama.cpp, select env, start using" +
            "\n\nllama-vscode is an extension for code completion, chat with ai and agentic coding, focused on local model usage with llama.cpp." +
            "\n\n1. Install llama.cpp " +
            "\n  - Show the extension menu by clicking llama-vscode in the status bar or by Ctrl+Shift+M and select 'Install/upgrade llama.cpp' (sometimes restart is needed to adjust the paths to llama-server)" +
            "\n\n2. Select env (group of models) for your needs from llama-vscode menu." +
            "\n  - This will download (only the first time) the models and run llama.cpp servers locally (or use external servers endpoints, depends on env)" +
            "\n\n3. Start using llama-vscode" +
            "\n  - For code completion - just start typing (uses completion model)" +
            "\n  - For edit code with AI - select code, right click and select 'llama-vscode Edit Selected Text with AI' (uses chat model, no tools support required)" +
            "\n  - For chat with AI (quick questions to (local) AI instead of searching with google) - select 'Chat with AI' from llama.vscode menu (uses chat model, no tools support required, llama.cpp server should run on model endpoint.)" +
            "\n  - For agentic coding - select 'Show Llama Agent' from llama.vscode menu (or Ctrl+Shift+A) and start typing your questions or requests (uses tools model and embeddings model for some tools, most intelligence needed, local usage supported, but you could also use external, paid providers for better results)" +
            "\n\n If you want to use llama-vscode only for code completion - you could disable RAG from llama-vscode menu to avoid indexing files." +
            "\n\n If you are an existing user - you could continue using llama-vscode as before." +
            "\n\n For more details - select 'Chat with AI about llama.vscode' or 'View Documentation' from llama-vscode menu" +
            "\n\n Enjoy!"
        );
    }

    

    

    

    private async viewAgentCommandFromList(agentCommands: any[]) {
        let allAgentCommands = agentCommands.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as Agent[])
        let agentComandItems: QuickPickItem[] = this.getStandardQpList(agentCommands, "");
        agentComandItems = agentComandItems.concat(this.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as Agent[], "(predefined) ", agentCommands.length));
        let agentCommand = await vscode.window.showQuickPick(agentComandItems);
        if (agentCommand) {
            let agentCommandIndex = parseInt(agentCommand.label.split(". ")[0], 10) - 1;
            let selectedAgentCommand =  allAgentCommands[agentCommandIndex];
            await this.showAgentCommandDetails(selectedAgentCommand);
        }
    }

    private async deleteAgentCommandFromList(agentCommands: AgentCommand[], settingName: string) {
        const modelsItems: QuickPickItem[] = this.getStandardQpList(agentCommands, "");
        const model = await vscode.window.showQuickPick(modelsItems);
        if (model) {
            let modelIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            const shoulDeleteModel = await Utils.confirmAction("Are you sure you want to delete the agent command below?", 
                this.getAgentCommandDetailsAsString(agentCommands[modelIndex])
            );
            if (shoulDeleteModel) {
                agentCommands.splice(modelIndex, 1);
                this.app.configuration.updateConfigValue(settingName, agentCommands);
                vscode.window.showInformationMessage("The agent command is deleted.")
            }
        }
    }

    public async showAgentCommandDetails(selectedAgentCommand: any) {
        await Utils.showOkDialog(
            this.getAgentCommandDetailsAsString(selectedAgentCommand)
        );
    }

    private getAgentCommandDetailsAsString(selectedAgentCommand: AgentCommand): string {
        return "Agent command details: " +
            "\nname: " + selectedAgentCommand.name +
            "\ndescription: " + selectedAgentCommand.description +
            "\nprompt: \n" + selectedAgentCommand.prompt.join("\n") +
            "\n\ncontext: " + (selectedAgentCommand.context ? selectedAgentCommand.context.join(", ") : "");
    }

    

    private async persistAgentCommandToSetting(newAgentCommand: AgentCommand, agentCommands: any[], settingName: string) {
        let modelDetails = this.getAgentCommandDetailsAsString(newAgentCommand);
        const shouldAddModel = await Utils.confirmAction("A new agent command will be added. Do you want to add the agent command?", modelDetails);

        if (shouldAddModel) {
            agentCommands.push(newAgentCommand);
            this.app.configuration.updateConfigValue(settingName, agentCommands);
            vscode.window.showInformationMessage("The agent command is added.");
        }
    }

    

    private async importAgentCommandToList(agentCommands: any[], settingName: string) {
        let name = "";
        const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Import Agent Command',
                filters: {
                    'Agent Command Files': ['json'],
                    'All Files': ['*']
                },
            });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const newAgent = JSON.parse(fileContent);
        // Sanitize imported agent command
        if (newAgent.name) newAgent.name = this.app.modelService.sanitizeInput(newAgent.name);
        if (newAgent.description) newAgent.description = this.app.modelService.sanitizeInput(newAgent.description);
        if (newAgent.prompt) newAgent.prompt = newAgent.prompt.map((s: string) => this.app.modelService.sanitizeInput(s));
        if (newAgent.context) newAgent.context = newAgent.context.map((s: string) => this.app.modelService.sanitizeInput(s));

        await this.persistAgentCommandToSetting(newAgent, agentCommands, settingName);
    }
    

    private async importChatToList() {
        let name = "";
        const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Import Chat',
                filters: {
                    'Chat Files': ['json'],
                    'All Files': ['*']
                },
            });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const newChat = JSON.parse(fileContent);
        // Sanitize imported chat
        if (newChat.name) newChat.name = this.app.modelService.sanitizeInput(newChat.name);
        if (newChat.description) newChat.description = this.app.modelService.sanitizeInput(newChat.description);
        if (newChat.messages) {
            newChat.messages = newChat.messages.map((msg: any) => ({
                ...msg,
                content: this.app.modelService.sanitizeInput(msg.content || ''),
                role: this.app.modelService.sanitizeInput(msg.role || '')
            }));
        }

        await this.addChatToHistory(newChat);
    }

    private getSelectionsAsString() {
        return "Selected env and models: " +
            "\nenv: " + this.selectedEnv.name +
            "\nenv description: " + this.selectedEnv.description +
            "\n\ncompletion model: " +
            "\nname: " + this.selectedComplModel?.name +
            "\nlocal start command: " + this.selectedComplModel.localStartCommand +
            "\nendpoint: " + this.selectedComplModel.endpoint +
            "\nmodel name for provider: " + this.selectedComplModel.aiModel +
            "\napi key required: " + this.selectedComplModel.isKeyRequired +
            "\n\nchat model: " +
            "\nname: " + this.selectedModel.name +
            "\nlocal start command: " + this.selectedModel.localStartCommand +
            "\nendpoint: " + this.selectedModel.endpoint +
            "\nmodel name for provider: " + this.selectedModel.aiModel +
            "\napi key required: " + this.selectedModel.isKeyRequired +
            "\n\nembeddings model: " +
            "\nname: " + this.selectedEmbeddingsModel.name +
            "\nlocal start command: " + this.selectedEmbeddingsModel.localStartCommand +
            "\nendpoint: " + this.selectedEmbeddingsModel.endpoint +
            "\nmodel name for provider: " + this.selectedEmbeddingsModel.aiModel +
            "\napi key required: " + this.selectedEmbeddingsModel.isKeyRequired +
            "\n\ntools model: " +
            "\nname: " + this.selectedToolsModel.name +
            "\nlocal start command: " + this.selectedToolsModel.localStartCommand +
            "\nendpoint: " + this.selectedToolsModel.endpoint +
            "\nmodel name for provider: " + this.selectedToolsModel.aiModel +
            "\napi key required: " + this.selectedToolsModel.isKeyRequired;
    }

    

    private async exportAgentCommandFromList(agentCommands: any[]) {
        let allAgentCommands = agentCommands.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as Agent[])
        let agentComandItems: QuickPickItem[] = this.getStandardQpList(agentCommands, "");
        agentComandItems = agentComandItems.concat(this.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as Agent[], "(predefined) ", agentCommands.length));
        let agentCommand = await vscode.window.showQuickPick(agentComandItems);
        if (agentCommand) {
            let modelIndex = parseInt(agentCommand.label.split(". ")[0], 10) - 1;
            let selectedAgentCommand =  allAgentCommands[modelIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following agent command? \n\n" +
            this.getAgentCommandDetailsAsString(selectedAgentCommand)
            );

            if (shouldExport){
                const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedAgentCommand.name+'.json')),
                        filters: {
                            'Agent Command Files': ['json'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export Agent Command'
                    });

                if (!uri) {
                    return;
                }

                const jsonContent = JSON.stringify(selectedAgentCommand, null, 2);
                fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                vscode.window.showInformationMessage("Agent command is saved.")
            }
        }
    }

    private async exportChatFromList(chatsList: any[]) {
        const chatsItems: QuickPickItem[] = this.getStandardQpList(chatsList, "");
        let chat = await vscode.window.showQuickPick(chatsItems);
        if (chat) {
            let modelIndex = parseInt(chat.label.split(". ")[0], 10) - 1;
            let selectedChat =  chatsList[modelIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following chat? \n\n" +
                "name: " + chat.label +
                "\ndescription: " + chat.description
            );

            if (shouldExport){
                const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedChat.name+'.json')),
                        filters: {
                            'Chat Files': ['json'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export Chat'
                    });

                if (!uri) {
                    return;
                }

                const jsonContent = JSON.stringify(selectedChat, null, 2);
                fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                vscode.window.showInformationMessage("Chat is saved.")
            }
        }
    }
    

    private getStandardQpList(list:any[], prefix: string, lastModelNumber: number = 0) {
        const items: QuickPickItem[] = [];
        let i = lastModelNumber;
        for (let elem of list) {
            i++;
            items.push({
                label: i + ". " + prefix + elem.name,
                description: elem.description,
            });
        }
        return items;
    }  
    
    public async setCompletion(enabled: boolean){
        await this.app.configuration.updateConfigValue('enabled', enabled);
    }

    private async handleCompletionToggle(label: string, currentLanguage: string | undefined, languageSettings: Record<string, boolean>) {
        if (label.includes(this.app.configuration.getUiText(UI_TEXT_KEYS.allCompletions)??"")) {
            await this.app.configuration.updateConfigValue('enabled', !this.app.configuration.enabled);
        } else if (currentLanguage && label.includes(currentLanguage)) {
            const isLanguageEnabled = languageSettings[currentLanguage] ?? true;
            languageSettings[currentLanguage] = !isLanguageEnabled;
            await this.app.configuration.updateConfigValue('languageSettings', languageSettings);
        }
    }

    private async handleRagToggle(label: string, currentLanguage: string | undefined, languageSettings: Record<string, boolean>) {
        if (label.includes(this.app.configuration.getUiText(UI_TEXT_KEYS.rag)??"")) {
            await this.app.configuration.updateConfigValue('rag_enabled', !this.app.configuration.rag_enabled);
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

    clearModel = (type: ModelType) => {
        switch (type) {
            case ModelType.Completion:
                this.selectedComplModel = Menu.emptyModel;
                break;
            case ModelType.Chat:
                this.selectedModel = Menu.emptyModel;
                break;
            case ModelType.Embeddings:
                this.selectedEmbeddingsModel = Menu.emptyModel;
                break;
            case ModelType.Tools:
                this.selectedToolsModel = Menu.emptyModel;
                break;
        }
        this.app.llamaWebviewProvider.updateLlamaView();
    }

    public async deselectAndClearModel(modelType: ModelType) {
        await this.app.modelService.deselectModel(modelType, this.app.modelService.getTypeDetails(modelType));
        this.app.menu.clearModel(modelType);
        this.app.llamaWebviewProvider.updateLlamaView();
    }

    setSelectedModel = (type: ModelType, model: LlmModel | undefined) => {
        switch (type) {
            case ModelType.Completion:
                this.selectedComplModel = model??Menu.emptyModel;
                break;
            case ModelType.Chat:
                this.selectedModel = model??Menu.emptyModel;
                break;
            case ModelType.Embeddings:
                this.selectedEmbeddingsModel = model??Menu.emptyModel;
                break;
            case ModelType.Tools:
                this.selectedToolsModel = model??Menu.emptyModel;
                break;
        }
        this.app.llamaWebviewProvider.updateLlamaView();
    }

    public async selectAndSetModel(modelType: ModelType, modelsList: LlmModel[]) {
        let model = await this.app.modelService.selectModel(modelType, modelsList);
        this.app.menu.setSelectedModel(modelType, model);
    }

    public setSelectedEnv(env: Env): void {
        this.selectedEnv = env;
        this.app.persistence.setValue(PERSISTENCE_KEYS.SELECTED_ENV, env);
        this.app.llamaWebviewProvider.updateLlamaView();
    }

    getEnv = (): Env => {
        return this.selectedEnv;
    }

    getAgent = (): Agent => {
        return this.selectedAgent;
    }

    getChat = (): Chat => {
        return this.selectedChat;
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

    private getAgentCommandsActions(): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.addAgentCommand) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.viewAgentCommandDetails) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgentCommand) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.exportAgentCommand) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.importAgentCommand) ?? ""
            },
        ];
    }

    processAgentCommandsActions = async (selected:vscode.QuickPickItem) => {
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addAgentCommand):
                // await this.addModelToList(toolsTypeDetails);
                Utils.showOkDialog("You could add an agent command in setting agent_commands or use export, modify and import.")
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgentCommand):
                await this.deleteAgentCommandFromList(this.app.configuration.agent_commands, "agent_commands");
                // Utils.showOkDialog("You could delete an agent command in setting agent_commands")
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.viewAgentCommandDetails):
                await this.viewAgentCommandFromList(this.app.configuration.agent_commands)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportAgentCommand):
                await this.exportAgentCommandFromList(this.app.configuration.agent_commands)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importAgentCommand):
                await this.importAgentCommandToList(this.app.configuration.agent_commands, "agent_commands")
                break;
        }
    }

    processChatActions = async (selected:vscode.QuickPickItem) => {
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartChat):
                await this.selectChatFromList();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteChat):
                await this.deleteChatFromList(this.app.persistence.getChats());
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportChat):
                await this.exportChatFromList(this.app.persistence.getChats())
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importChat):
                await this.importChatToList()
                break;
        }
    }

    processApiKeyActions = async (selected:vscode.QuickPickItem) => {
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.editDeleteAPIKey):
                const apiKeysMap = this.app.persistence.getAllApiKeys();
                const apiKeysQuickPick = Array.from(apiKeysMap.entries()).map(([key, value]) => ({
                                            label: key,
                                            description: "..." + value.slice(-5)
                                        }));
                const selectedItem = await vscode.window.showQuickPick(apiKeysQuickPick);
                if (selectedItem) {
                    let result = await vscode.window.showInputBox({
                            placeHolder: 'Enter your new api key for ' + selectedItem.label + ". Leave empty to remove it.",
                            prompt: 'your api key',
                            value: ''
                        })
                    result = this.app.modelService.sanitizeInput(result || '');
                    if (!result || result === "") this.app.persistence.deleteApiKey(selectedItem.label);
                    else this.app.persistence.setApiKey(selectedItem.label, result);
                }
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addAPIKey) ?? "":
                let endpoint = await vscode.window.showInputBox({
                            placeHolder: 'Enter the endpoint, exactly as in the model',
                            prompt: 'Endpoint (url)',
                            value: ''
                        })
                endpoint = this.app.modelService.sanitizeInput(endpoint || '');
                let apiKey = await vscode.window.showInputBox({
                            placeHolder: 'Enter your new api key for ' + endpoint,
                            prompt: 'your api key',
                            value: ''
                        })
                apiKey = this.app.modelService.sanitizeInput(apiKey || '');
                if (endpoint && apiKey) 
                    {
                        this.app.persistence.setApiKey(endpoint, apiKey);
                        vscode.window.showInformationMessage("Api key is added.")
                    }
                else vscode.window.showErrorMessage("API key was not added. Please provide both endpoint and API key.")
                break;
        }
    }

    public showEnvView() {
        vscode.commands.executeCommand('extension.showLlamaWebview');
        setTimeout(() => this.app.llamaWebviewProvider.setView("addenv"), 500);
    }    
}
