import {Application} from "./application";
import vscode, { QuickPickItem } from "vscode";
import { HuggingfaceFile, HuggingfaceModel, LlmModel, ModelTypeDetails, Env, Agent, Chat, AgentCommand } from "./types";
import { Utils } from "./utils";
import { Configuration } from "./configuration";
import * as fs from 'fs';
import * as path from 'path';
import axios from "axios";
import { ModelType, LOCAL_MODEL_TEMPLATES, HF_MODEL_TEMPLATES, SETTING_TO_MODEL_TYPE, MODEL_TYPE_CONFIG, AGENT_NAME, UI_TEXT_KEYS, PERSISTENCE_KEYS } from "./constants";

export class Menu {
    private app: Application
    private selectedComplModel: LlmModel = {name: ""}
    private selectedChatModel: LlmModel = {name: ""} 
    private selectedEmbeddingsModel: LlmModel = {name: ""}
    private selectedToolsModel: LlmModel = {name: ""}
    private selectedEnv: Env = {name: ""}
    private selectedAgent: Agent = {name: "", systemInstruction: []}
    private selectedChat: Chat = {name:"", id:""}
    private readonly startModelDetail = "Selects the model and if local also downloads the model (if not yet done) and starts a llama-server with it.";

    constructor(application: Application) {
        this.app = application;
        // Cache UI texts (assumes Configuration has getAllUiTexts() returning Record<string, string>)
        // this.uiCache = this.app.configuration.getAllUiTexts();
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
                this.selectEnvFromList(this.app.configuration.envs_list);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopEnv):
                await this.stopEnv()
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedEnv):
                this.showCurrentEnv();
                break;
             case this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAI) + " (Ctrl+;)":
                this.app.askAi.showChatWithAi(false, context);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAIAboutLlamaVscode):
                this.selectAgent(this.app.configuration.agents_list.find(a => a.name === AGENT_NAME.llamaVscodeHelp));
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
                let complModelActions: vscode.QuickPickItem[] = this.getModelActions(ModelType.Completion);
                let complModelSelected = await vscode.window.showQuickPick(complModelActions);
                if (complModelSelected) this.processComplModelsActions(complModelSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chatModels) ?? "":
                let chatModelActions: vscode.QuickPickItem[] = this.getModelActions(ModelType.Chat);
                let chatModelSelected = await vscode.window.showQuickPick(chatModelActions);
                if (chatModelSelected) this.processChatModelsActions(chatModelSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.embeddingsModels) ?? "":
                let embsModelActions: vscode.QuickPickItem[] = this.getModelActions(ModelType.Embeddings)
                let embsModelSelected = await vscode.window.showQuickPick(embsModelActions);
                if (embsModelSelected) this.processEmbsModelsActions(embsModelSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.toolsModels) ?? "":
                let toolsModelActions: vscode.QuickPickItem[] = this.getModelActions(ModelType.Tools);
                let toolsActionSelected = await vscode.window.showQuickPick(toolsModelActions);
                if (toolsActionSelected) this.processToolsModelsActions(toolsActionSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.envs) ?? "":
                let envsActions: vscode.QuickPickItem[] = this.getEnvActions()
                let envSelected = await vscode.window.showQuickPick(envsActions);
                if (envSelected) this.processEnvActions(envSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.agents) ?? "":
                let agentsActions: vscode.QuickPickItem[] = this.getAgentActions();
                let actionSelected = await vscode.window.showQuickPick(agentsActions);
                if (actionSelected) this.processAgentsActions(actionSelected);
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
                await this.app.llamaServer.shellTrainCmd(this.sanitizeCommand(this.app.configuration.launch_training_completion));
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.startTrainingChatModel):
                await this.app.llamaServer.killTrainCmd();
                await this.app.llamaServer.shellTrainCmd(this.sanitizeCommand(this.app.configuration.launch_training_chat));
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

    selectEnvFromList = async (envsList: Env[]) => {
        const envsItems: QuickPickItem[] = this.getStandardQpList(envsList);
        let lastUsedEnv = this.app.persistence.getValue("selectedEnv")
        if (lastUsedEnv) envsItems.push({ label: (envsItems.length+1) + ". Last used env", description: lastUsedEnv.name });
        const env = await vscode.window.showQuickPick(envsItems);
        if (env) {
            let futureEnv: Env;
            if (env.label.includes("Last used env")){
                futureEnv = lastUsedEnv;
                if(!futureEnv){
                    vscode.window.showWarningMessage("No environment selected. There is no last used environment.");
                    return;
                }
            } else {
                futureEnv = envsList[parseInt(env.label.split(". ")[0], 10) - 1]
            }
            await this.selectEnv(futureEnv, true);
        }
    }

    selectChatFromList = async () => {
        let chatsList = this.app.persistence.getChats()
        if (!chatsList || chatsList.length == 0){
            vscode.window.showInformationMessage("No chats in the history.")
            return;
        }
        const chatsItems: QuickPickItem[] = this.getStandardQpList(chatsList);
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
        const chatsItems: QuickPickItem[] = this.getStandardQpList(chatList);
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
    
    selectAgentFromList = async (agentsList: Agent[]) => {
        const agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList);
        let lastUsedAgent = this.app.persistence.getValue("selectedAgent")
        if (lastUsedAgent) agentsItems.push({ label: (agentsItems.length+1) + ". Last used agent", description: lastUsedAgent.name });
        const agent = await vscode.window.showQuickPick(agentsItems);
        if (agent) {
            let futureAgent: Agent;
            if (agent.label.includes("Last used agent")){
                futureAgent = lastUsedAgent;
                
            } else {
                futureAgent = agentsList[parseInt(agent.label.split(". ")[0], 10) - 1]
            }
            if(!futureAgent){
                vscode.window.showWarningMessage("No agent selected. There is no last used agent.");
                return;
            }
            this.selectedAgent = futureAgent;
            await this.selectAgent(futureAgent)
            this.app.llamaWebviewProvider.updateLlamaView();
            // TODO ? when model is added to the agent type - select it
        }
    }

    selectAgent = async (agent: Agent) => {
        this.selectedAgent = agent;
        if(!agent.tools || agent.tools.length == 0) return;

        for  (let toolFunc of this.app.tools.toolsFunc){
            let toolName = toolFunc[0];
            this.app.configuration.updateConfigValue("tool_" + toolName + "_enabled", agent.tools.includes(toolName))
        }
        await this.app.persistence.setValue(PERSISTENCE_KEYS.SELECTED_AGENT, this.selectedAgent);
        this.app.llamaWebviewProvider.updateLlamaView();
        if (agent.name) vscode.window.showInformationMessage("Agent " + agent.name + " is selected.")
    }

    selectStartModel = async (modelType: ModelTypeDetails) => {
        const modelsItems: QuickPickItem[] = this.getModels(modelType.modelsList);
        const launchToEndpoint = new Map([ ["launch_completion", "endpoint"], ["launch_chat", "endpoint_chat"],  ["launch_embeddings", "endpoint_embeddings"],  ["launch_tools", "endpoint_tools"] ]);
        modelsItems.push({ label: (modelsItems.length+1) + ". Use settings", description: "" });
        const selectedModel = await vscode.window.showQuickPick(modelsItems);
        if (selectedModel) {
            if (parseInt(selectedModel.label.split(". ")[0], 10) == modelsItems.length){
                // Last in the list => use settings
                this[modelType.selModelPropName as keyof Menu] = {
                    name: "Use settings", 
                    aiModel: this.app.configuration.ai_model,
                    isKeyRequired: false,
                    endpoint: this.app.configuration[launchToEndpoint.get(modelType.launchSettingName) as keyof Configuration],
                    localStartCommand: this.app.configuration[modelType.launchSettingName as keyof Configuration]
                } as any
            } else {
                this[modelType.selModelPropName as keyof Menu] = modelType.modelsList[parseInt(selectedModel.label.split(". ")[0], 10) - 1] as any
            }
            
            await this.activateModel(modelType.selModelPropName, modelType.killCmd, modelType.shellCmd);
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

    public async selectEnv(futureEnv: Env, askConfirm: boolean) {
        await this.app.llamaServer.killFimCmd();
        this.selectedComplModel = { name: "", localStartCommand: "" };
        await this.app.llamaServer.killChatCmd();
        this.selectedChatModel = { name: "", localStartCommand: "" };
        await this.app.llamaServer.killEmbeddingsCmd();
        this.selectedEmbeddingsModel = { name: "", localStartCommand: "" };
         await this.app.llamaServer.killToolsCmd();
        this.selectedToolsModel = { name: "", localStartCommand: "" };
        let shouldSelect = true;
        if (askConfirm){
           shouldSelect = await Utils.confirmAction("You are about to select the env below. If there are local models inside, they will be downloaded (if not yet done) and llama.cpp server(s) will be started.\n\n Do you want to continue?", 
                this.getEnvDetailsAsString(futureEnv)
            );
        }

        if (shouldSelect && futureEnv) {
            this.selectedEnv = futureEnv;
            await this.app.persistence.setValue(PERSISTENCE_KEYS.SELECTED_ENV, this.selectedEnv);

            this.selectedComplModel = this.selectedEnv.completion ?? { name: "" };
            if (this.selectedComplModel.localStartCommand) await this.app.llamaServer.shellFimCmd(this.sanitizeCommand(this.selectedComplModel.localStartCommand));
            await this.addApiKey(this.selectedComplModel);

            this.selectedChatModel = this.selectedEnv.chat ?? { name: "" };
            if (this.selectedChatModel.localStartCommand) await this.app.llamaServer.shellChatCmd(this.sanitizeCommand(this.selectedChatModel.localStartCommand));
            await this.addApiKey(this.selectedChatModel);

            this.selectedEmbeddingsModel = this.selectedEnv.embeddings ?? { name: "" };
            if (this.selectedEmbeddingsModel.localStartCommand) await this.app.llamaServer.shellEmbeddingsCmd(this.sanitizeCommand(this.selectedEmbeddingsModel.localStartCommand));
            await this.addApiKey(this.selectedEmbeddingsModel);

            this.selectedToolsModel = this.selectedEnv.tools ?? { name: "" };
            if (this.selectedToolsModel.localStartCommand) await this.app.llamaServer.shellToolsCmd(this.sanitizeCommand(this.selectedToolsModel.localStartCommand));
            await this.addApiKey(this.selectedToolsModel);

            if (this.selectedEnv.agent) this.selectAgent(this.selectedEnv.agent)
            if (this.selectedEnv.ragEnabled != undefined) this.app.configuration.updateConfigValue("rag_enabled", this.selectedEnv.ragEnabled)
            if (this.selectedEnv.envStartLastUsed != undefined) this.app.configuration.updateConfigValue("env_start_last_used", this.selectedEnv.envStartLastUsed)
            if (this.selectedEnv.complEnabled != undefined) this.app.configuration.updateConfigValue("enabled", this.selectedEnv.complEnabled)
        }
        this.app.llamaWebviewProvider.updateLlamaView();
    }

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
        this.addApiKey(selModel);
        await this.app.persistence.setValue(selModelPropName, selModel);
        await killCmd();
        if (selModel.localStartCommand) await shellCmd(this.sanitizeCommand(selModel.localStartCommand ?? ""));
        this.app.llamaWebviewProvider.updateLlamaView();
    }

    private getEnvActions(): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartEnv) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopEnv) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.addEnv) ?? "",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.addEnvDescription) ?? "",
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.viewEnvDetails) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deleteEnv) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.exportEnv) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.importEnv) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.downloadUploadEnvsOnline) ?? ""
            },
        ];
    }

    private getModelActions(modelType: ModelType): vscode.QuickPickItem[] {
        const keys = {
            [ModelType.Completion]: [
                UI_TEXT_KEYS.selectStartCompletionModel,
                UI_TEXT_KEYS.deselectStopCompletionModel,
                UI_TEXT_KEYS.addLocalCompletionModel,
                UI_TEXT_KEYS.addExternalCompletionModel,
                UI_TEXT_KEYS.addCompletionModelFromHuggingface,
                UI_TEXT_KEYS.viewCompletionModelDetails,
                UI_TEXT_KEYS.deleteCompletionModel,
                UI_TEXT_KEYS.exportCompletionModel,
                UI_TEXT_KEYS.importCompletionModel,
            ],
            [ModelType.Chat]: [
                UI_TEXT_KEYS.selectStartChatModel,
                UI_TEXT_KEYS.deselectStopChatModel,
                UI_TEXT_KEYS.addLocalChatModel,
                UI_TEXT_KEYS.addExternalChatModel,
                UI_TEXT_KEYS.addChatModelFromHuggingface,
                UI_TEXT_KEYS.viewChatModelDetails,
                UI_TEXT_KEYS.deleteChatModel,
                UI_TEXT_KEYS.exportChatModel,
                UI_TEXT_KEYS.importChatModel,
            ],
            [ModelType.Embeddings]: [
                UI_TEXT_KEYS.selectStartEmbeddingsModel,
                UI_TEXT_KEYS.deselectStopEmbeddingsModel,
                UI_TEXT_KEYS.addLocalEmbeddingsModel,
                UI_TEXT_KEYS.addExternalEmbeddingsModel,
                UI_TEXT_KEYS.addEmbeddingsModelFromHuggingface,
                UI_TEXT_KEYS.viewEmbeddingsModelDetails,
                UI_TEXT_KEYS.deleteEmbeddingsModel,
                UI_TEXT_KEYS.exportEmbeddingsModel,
                UI_TEXT_KEYS.importEmbeddingsModel,
            ],
            [ModelType.Tools]: [
                UI_TEXT_KEYS.selectStartToolsModel,
                UI_TEXT_KEYS.deselectStopToolsModel,
                UI_TEXT_KEYS.addLocalToolsModel,
                UI_TEXT_KEYS.addExternalToolsModel,
                UI_TEXT_KEYS.addToolsModelFromHuggingface,
                UI_TEXT_KEYS.viewToolsModelDetails,
                UI_TEXT_KEYS.deleteToolsModel,
                UI_TEXT_KEYS.exportToolsModel,
                UI_TEXT_KEYS.importToolsModel,
            ],
        };

        const modelKeys = keys[modelType] || [];
        return modelKeys.map(key => ({
            label: this.app.configuration.getUiText(key) ?? ""
        }));
    }

    private getAgentActions(): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartAgent) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopAgent) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.addAgent) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.viewAgentDetails) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgent) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.exportAgent) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.importAgent) ?? ""
            },
        ];
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

    private async deleteModelFromList(modelsList: LlmModel[], settingName: string) {
        const modelsItems: QuickPickItem[] = this.getModels(modelsList);
        const model = await vscode.window.showQuickPick(modelsItems);
        if (model) {
            let modelIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            const shoulDeleteModel = await Utils.confirmAction("Are you sure you want to delete the model below?", 
                this.getModelDetailsAsString(modelsList[modelIndex])
            );
            if (shoulDeleteModel) {
                modelsList.splice(modelIndex, 1);
                this.app.configuration.updateConfigValue(settingName, modelsList);
                vscode.window.showInformationMessage("The model is deleted.")
            }
        }
    }

    private async viewModelFromList(modelsList: any[]) {
        const modelsItems: QuickPickItem[] = this.getModels(modelsList);
        let model = await vscode.window.showQuickPick(modelsItems);
        if (model) {
            let modelIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            let selectedModel =  modelsList[modelIndex];
            await this.showModelDetails(selectedModel);
        }
    }

    public async showModelDetails(selectedModel: any) {
        await Utils.showOkDialog("Model details: " +
            "\nname: " + selectedModel.name +
            "\nlocal start command: " + selectedModel.localStartCommand +
            "\nendpoint: " + selectedModel.endpoint +
            "\nmodel name for provider: " + selectedModel.aiModel +
            "\napi key required: " + selectedModel.isKeyRequired);
    }

    private async viewAgentFromList(agentsList: any[]) {
        const agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList);
        let agent = await vscode.window.showQuickPick(agentsItems);
        if (agent) {
            let agentIndex = parseInt(agent.label.split(". ")[0], 10) - 1;
            let selectedAgent =  agentsList[agentIndex];
            await this.showAgentDetails(selectedAgent);
        }
    }

    public async showAgentDetails(selectedAgent: any) {
        await Utils.showOkDialog(
            this.getAgentDetailsAsString(selectedAgent)
        );
    }

    private getAgentDetailsAsString(selectedAgent: Agent): string {
        return "Agent details: " +
            "\nname: " + selectedAgent.name +
            "\ndescription: " + selectedAgent.description +
            "\nsystem prompt: \n" + selectedAgent.systemInstruction.join("\n") +
            "\n\ntools: " + (selectedAgent.tools ? selectedAgent.tools.join(", ") : "");
    }

    private async viewAgentCommandFromList(agentCommands: any[]) {
        const agentComandItems: QuickPickItem[] = this.getStandardQpList(agentCommands);
        let agentCommand = await vscode.window.showQuickPick(agentComandItems);
        if (agentCommand) {
            let agentCommandIndex = parseInt(agentCommand.label.split(". ")[0], 10) - 1;
            let selectedAgentCommand =  agentCommands[agentCommandIndex];
            await this.showAgentCommandDetails(selectedAgentCommand);
        }
    }

    private async deleteAgentCommandFromList(agentCommands: AgentCommand[], settingName: string) {
        const modelsItems: QuickPickItem[] = this.getStandardQpList(agentCommands);
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

    private async addLocalModelToList(modelTypeDetails: ModelTypeDetails) {
        const hostEndpoint = "http://" + modelTypeDetails.newModelHost
        const modelListToLocalCommand = new Map([ 
            ["completion_models_list", "llama-server -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF> -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 --port " + modelTypeDetails.newModelPort + " --host " + modelTypeDetails.newModelHost],
            ["chat_models_list", 'llama-server -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF> -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port ' + modelTypeDetails.newModelPort + " --host " + modelTypeDetails.newModelHost], 
            ["embeddings_models_list", "llama-server -hf <model name from hugging face, i.e: ggml-org/Nomic-Embed-Text-V2-GGUF> -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port " + modelTypeDetails.newModelPort + " --host " + modelTypeDetails.newModelHost],  
            ["tools_models_list", "llama-server -hf <model name from hugging face, i.e: unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF:Q8_0> --jinja  -ngl 99 -c 0 -ub 1024 -b 1024 --cache-reuse 256 --port " + modelTypeDetails.newModelPort + " --host " + modelTypeDetails.newModelHost] ]);
        let name = await Utils.getValidatedInput(
            'name for your model (required)',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'Enter a user friendly name for your model (required)',
                value: ''
            }
        );
        if (name === undefined) {
            vscode.window.showInformationMessage("Model addition cancelled.");
            return;
        }
        name = this.sanitizeInput(name);

        let localStartCommand = await Utils.getValidatedInput(
            'Enter a command to start the model locally',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'A command to start the model locally, i.e. llama-server -m model_name.gguf --port '+ modelTypeDetails.newModelPort + '. (required for local model)',
                value: modelListToLocalCommand.get(modelTypeDetails.modelsListSettingName) || ''
            }
        );
        if (localStartCommand === undefined) {
            vscode.window.showInformationMessage("Model addition cancelled.");
            return;
        }
        localStartCommand = this.sanitizeCommand(localStartCommand);
        
        let endpoint = await Utils.getValidatedInput(
            'Endpoint for accessing your model',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'Endpoint for accessing your model, i.e. ' + hostEndpoint + ':' + modelTypeDetails.newModelPort + ' (required)',
                value: hostEndpoint + ':' + modelTypeDetails.newModelPort
            }
        );
        if (endpoint === undefined) {
            vscode.window.showInformationMessage("Model addition cancelled.");
            return;
        }
        endpoint = this.sanitizeInput(endpoint);
        const isKeyRequired = await Utils.confirmAction(`Is API key required for this endpoint (${endpoint})?`, "");
        let newModel: LlmModel = {
            name: name,
            localStartCommand: localStartCommand,
            endpoint: endpoint,
            aiModel: "",
            isKeyRequired: isKeyRequired
        };

        const shouldAddModel = await Utils.confirmAction("You have entered:", 
            "\nname: " + name +
            "\nlocal start command: " + localStartCommand +
            "\nendpoint: " + endpoint +
            "\nmodel name for provider: " + 
            "\napi key required: " + isKeyRequired +
            "\nDo you want to add a model with these properties?"
        );

        if (shouldAddModel){
            let shouldOverwrite = false;
            [newModel.name, shouldOverwrite] =  await this.getUniqueModelName(modelTypeDetails.modelsList, newModel);
            if (!newModel.name){
                vscode.window.showInformationMessage("The model was not added as the name was not provided.")
                return;
            }
            if (shouldOverwrite) {
                const index = modelTypeDetails.modelsList.findIndex(model => model.name === newModel.name);
                if (index !== -1) {
                    modelTypeDetails.modelsList.splice(index, 1);
                }
            }
            modelTypeDetails.modelsList.push(newModel);
            this.app.configuration.updateConfigValue(modelTypeDetails.modelsListSettingName, modelTypeDetails.modelsList);
            vscode.window.showInformationMessage("The model is added.")
        }
    }

    private async addExternalModelToList(modelTypeDetails: ModelTypeDetails) {
        const hostEndpoint = "http://" + modelTypeDetails.newModelHost
        let name = await Utils.getValidatedInput(
            'name for your model (required)',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'Enter a user friendly name for your model (required)',
                value: ''
            }
        );
        if (name === undefined) {
            vscode.window.showInformationMessage("Model addition cancelled.");
            return;
        }
        name = this.sanitizeInput(name);
        
        let endpoint = await Utils.getValidatedInput(
            'Endpoint for your model (required)',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'Endpoint for accessing your model, i.e. ' + hostEndpoint + ':' + modelTypeDetails.newModelPort + ' or https://openrouter.ai/api (required)',
                value: ''
            }
        );
        if (endpoint === undefined) {
            vscode.window.showInformationMessage("Model addition cancelled.");
            return;
        }
        endpoint = this.sanitizeInput(endpoint);
        let aiModel = await vscode.window.showInputBox({
            placeHolder: 'Model name, exactly as expected by the provider, i.e. kimi-latest ',
            prompt: 'Enter model name as expected by the provider (leave empty if llama-server is used)',
            value: ''
        });
        aiModel = this.sanitizeInput(aiModel || '');
        const isKeyRequired = await Utils.confirmAction(`Is API key required for this endpoint (${endpoint})?`, "");
        let newModel: LlmModel = {
            name: name,
            localStartCommand: "",
            endpoint: endpoint,
            aiModel: aiModel,
            isKeyRequired: isKeyRequired
        };

        const shouldAddModel = await Utils.confirmAction("You have entered:", 
            "\nname: " + name +
            "\nlocal start command: " + 
            "\nendpoint: " + endpoint +
            "\nmodel name for provider: " + aiModel +
            "\napi key required: " + isKeyRequired +
            "\nDo you want to add a model with these properties?"
        );

        if (shouldAddModel){
            let shouldOverwrite = false;
            [newModel.name, shouldOverwrite] =  await this.getUniqueModelName(modelTypeDetails.modelsList, newModel);
            if (!newModel.name){
                vscode.window.showInformationMessage("The model was not added as the name was not provided.")
                return;
            }
            if (shouldOverwrite) {
                const index = modelTypeDetails.modelsList.findIndex(model => model.name === newModel.name);
                if (index !== -1) {
                    modelTypeDetails.modelsList.splice(index, 1);
                }
            }
            modelTypeDetails.modelsList.push(newModel);
            this.app.configuration.updateConfigValue(modelTypeDetails.modelsListSettingName, modelTypeDetails.modelsList);
            vscode.window.showInformationMessage("The model is added.")
        }
    }

    public async addHuggingfaceModelToList(typeDetails: ModelTypeDetails) {
        const modelType = SETTING_TO_MODEL_TYPE[typeDetails.modelsListSettingName];
        const template = HF_MODEL_TEMPLATES[modelType]
            .replace('MODEL_PLACEHOLDER', '<model_name>')
            .replace('PORT_PLACEHOLDER', typeDetails.newModelPort.toString())
            .replace('HOST_PLACEHOLDER', typeDetails.newModelHost);
        const hostEndpoint = "http://" + typeDetails.newModelHost;
        
        let searchWords = await vscode.window.showInputBox({
            placeHolder: 'keywords for searching a model from huggingface',
            prompt: 'Enter keywords to search for models in huggingface',
            value: ""
        });
        searchWords = this.sanitizeInput(searchWords || '');
        
        if (!searchWords){
              vscode.window.showInformationMessage("No huggingface model selected.")
              return;
        }
        let hfModelName = await this.getDownloadModelName(searchWords);
        if (hfModelName == "") return;
        let localStartCommand = template.replace('<model_name>', hfModelName);
        localStartCommand = this.sanitizeCommand(localStartCommand);
        
        let endpoint = hostEndpoint +":" + typeDetails.newModelPort;
        endpoint = this.sanitizeInput(endpoint);
        const aiModel = ""
        const isKeyRequired = false;
        let name = "hf: " + hfModelName;
        name = this.sanitizeInput(name);
        let newHfModel: LlmModel = {
            name: name,
            localStartCommand: localStartCommand,
            endpoint: endpoint,
            aiModel: aiModel,
            isKeyRequired: isKeyRequired
        };

        
        const shouldAddModel = await Utils.confirmAction("You have entered:", 
            this.getModelDetailsAsString(newHfModel) +
            "\nDo you want to add a model with these properties?"
        );

        if (shouldAddModel){
            let shouldOverwrite = false;
            [newHfModel.name, shouldOverwrite] =  await this.getUniqueModelName(typeDetails.modelsList, newHfModel);
            if (!newHfModel.name){
                vscode.window.showInformationMessage("The model was not added as the name was not provided.")
                return;
            }
            if (shouldOverwrite) {
                const index = typeDetails.modelsList.findIndex(model => model.name === newHfModel.name);
                if (index !== -1) {
                    typeDetails.modelsList.splice(index, 1);
                }
            }
            typeDetails.modelsList.push(newHfModel);
            this.app.configuration.updateConfigValue(typeDetails.modelsListSettingName, typeDetails.modelsList);
            vscode.window.showInformationMessage("The model is added: " + newHfModel.name)
            const shouldSelct = await Utils.confirmAction("Do you want to select/start the newly added model?", "");
            if (shouldSelct) {
                this[typeDetails.selModelPropName as keyof Menu] = newHfModel as any
                this.activateModel(typeDetails.selModelPropName, typeDetails.killCmd, typeDetails.shellCmd);
            }
        }
    }

    private async getUniqueModelName(modelsList: LlmModel[], newModel: LlmModel): Promise<[string, boolean]> {
        let uniqueName = newModel.name;
        let shouldOverwrite = false;
        let modelSameName = modelsList.find(model => model.name === uniqueName);
        while (uniqueName && !shouldOverwrite && modelSameName !== undefined) {
            shouldOverwrite = await Utils.confirmAction("A model with the same name already exists. Do you want to overwrite the existing model?", 
                "Existing model:\n" +
                this.getModelDetailsAsString(modelSameName) +
                "\n\nNew model:\n" +
                this.getModelDetailsAsString(newModel)
            );
            if (!shouldOverwrite) {
                uniqueName = (await vscode.window.showInputBox({
                    placeHolder: 'a unique name for your new model',
                    prompt: 'Enter a unique name for your new model. Leave empty to cancel entering.',
                    value: newModel.name
                })) ?? "";
                uniqueName = this.sanitizeInput(uniqueName);
            if (uniqueName) modelSameName = modelsList.find(model => model.name === uniqueName);
            }
        }

        return [uniqueName, shouldOverwrite]
    }

    private async getDownloadModelName(searchWords: string) {
        searchWords = this.sanitizeInput(searchWords);
        const foundModels = await this.getHfModels(searchWords ?? "");
        let hfModelName = "";
        if (foundModels && foundModels.length > 0) {
            const hfModelsQp: QuickPickItem[] = [];
            for (let hfModel of foundModels) {
                if (!hfModel.private) {
                    hfModelsQp.push({
                        label: hfModel.modelId,
                        description: "created: " + hfModel.createdAt + " | downloads: " + hfModel.downloads + " | likes: " + hfModel.likes + 
                        " | pipeline: " + hfModel.pipeline_tag + " | tags: " + hfModel.tags 
                    });
                }
            }
            const selModel = await vscode.window.showQuickPick(hfModelsQp);
            if (selModel && selModel.label) {
                let modelFiles = await this.getHfModelFiles(selModel.label);
                if (modelFiles && modelFiles.length > 0) {
                    const hfModelsFilesQp: QuickPickItem[] = await this.getFilesOfModel(selModel, modelFiles);
                    if (hfModelsFilesQp.length <= 0) {
                        vscode.window.showInformationMessage("No files found for model " + selModel.label + " or the files are with are with unexpected naming conventions.");
                        return "";
                    } else {
                        let selFile = await vscode.window.showQuickPick(hfModelsFilesQp);
                        if (!selFile) {
                            vscode.window.showInformationMessage("No files selected for model " + selModel.label + ".");
                            return "";
                        }
                        if (hfModelsFilesQp.length == 1) hfModelName = selModel.label??"";
                        else hfModelName = selFile?.label ?? "";
                    }
                } else {
                    vscode.window.showInformationMessage("No files found for model " + selModel.label);
                    return "";
                }
            }
            else {
                vscode.window.showInformationMessage("No huggingface model selected.");
                return '';
            }
        } else {
            vscode.window.showInformationMessage("No model selected.");
            return "";
        }
        hfModelName = this.sanitizeInput(hfModelName);
        return hfModelName;
    }

    private async getFilesOfModel(selModel: vscode.QuickPickItem, modelFiles: HuggingfaceFile[]) {
        const hfModelsFilesQp: QuickPickItem[] = [];
        const ggufSuffix = ".gguf";
        let cleanModelName = selModel.label.split("/")[1].replace(/-gguf/gi, "");
        let arePartsOfOneFile = true;
        let multiplePartsSize = 0;
        let multiplePartsCount = 0;
        for (let file of modelFiles) {
            if (file.type == "file"
                && file.path.toLowerCase().endsWith(ggufSuffix)
                && file.path.toLowerCase().startsWith(cleanModelName.toLowerCase())) {
                let quantization = file.path.slice(cleanModelName.length + 1, -ggufSuffix.length);
                if (arePartsOfOneFile && !this.isOneOfMany(quantization.slice(-14))) arePartsOfOneFile = false;
                if (!arePartsOfOneFile) {
                    hfModelsFilesQp.push({
                        label: selModel.label + (quantization? ":" + quantization : ""),
                        description: "size: " + (Math.round((file.size / 1000000000) * 100) / 100) + "GB"
                    });
                } else {
                    multiplePartsSize += file.size;
                    multiplePartsCount++;
                }
            }
            if (file.type == "directory") {
                let subfolderFiles = await this.getHfModelSubforlderFiles(selModel.label, file.path);
                let totalSize = 0;
                let totalFiles = 0;
                for (let file of subfolderFiles) {
                    if (file.path.toLowerCase().endsWith(ggufSuffix)) {
                        totalSize += file.size;
                        totalFiles++;
                    }
                }
                hfModelsFilesQp.push({
                    label: selModel.label + ":" + file.path,
                    description: "size: " + (Math.round((totalSize / 1000000000) * 100) / 100) + " GB | files: " + totalFiles
                });
            }
        }
        if (arePartsOfOneFile) {
            hfModelsFilesQp.push({
                label: selModel.label,
                description: "size: " + (Math.round((multiplePartsSize / 1073741824) * 100) / 100) + " GB | files: " + multiplePartsCount
            });
        }
        return hfModelsFilesQp;
    }

    private isOneOfMany(input: string): boolean {
        const regex = /^\d{5}-of-\d{5}$/;
        return regex.test(input);
    }

    private async getHfModels(searchWords: string): Promise<HuggingfaceModel[]> {
        let hfEndpoint = "https://huggingface.co/api/models?limit=1500&search="+ "GGUF+" + searchWords.replace(" ", "+");
        let result = await axios.get(
            `${Utils.trimTrailingSlash(hfEndpoint)}`
        );

        if (result && result.data) return result.data as HuggingfaceModel[]
        else return [];
    }

    private async getHfModelFiles(modelId: string): Promise<HuggingfaceFile[]> {
        let hfEndpoint = "https://huggingface.co/api/models/" + modelId + "/tree/main";
        let result = await axios.get(
            `${Utils.trimTrailingSlash(hfEndpoint)}`
        );
        if (result && result.data) return result.data as HuggingfaceFile[]
        else return [];
    }

    private async getHfModelSubforlderFiles(modelId: string, subfolder: string): Promise<HuggingfaceFile[]> {
        let hfEndpoint = "https://huggingface.co/api/models/" + modelId + "/tree/main/" + subfolder;
        let result = await axios.get(
            `${Utils.trimTrailingSlash(hfEndpoint)}`
        );
        if (result && result.data) return result.data as HuggingfaceFile[]
        else return [];
    }

    public async addEnvToList(envList: any[], settingName: string) {
        let name = await Utils.getValidatedInput(
            'name for your env (required)',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'Enter a user friendly name for your env (required)',
                value: ''
            }
        );
        if (name === undefined) {
            vscode.window.showInformationMessage("Env addition cancelled.");
            return;
        }
        name = this.sanitizeInput(name);

        let description = await vscode.window.showInputBox({
            placeHolder: 'description for the env - what is the purpose, when to select etc. ',
            prompt: 'Enter description for the env.',
            value: ''
        });
        description = this.sanitizeInput(description || '');
        
        let newEnv: Env = {
            name: name,
            description: description,
            completion: this.selectedComplModel,
            chat: this.selectedChatModel,
            embeddings: this.selectedEmbeddingsModel,
            tools: this.selectedToolsModel,
            agent: this.selectedAgent,
            ragEnabled: this.app.configuration.rag_enabled,
            envStartLastUsed: this.app.configuration.env_start_last_used,
            complEnabled: this.app.configuration.enabled
        };

        await this.persistEnvToSetting(newEnv, envList, settingName);
    }

    private async persistEnvToSetting(newEnv: Env, envList: any[], settingName: string) {
        let envDetails = this.getEnvDetailsAsString(newEnv);
        const shouldAddEnv = await Utils.confirmAction("A new env will be added. Do you want to add the env?", envDetails);

        if (shouldAddEnv) {
            envList.push(newEnv);
            this.app.configuration.updateConfigValue(settingName, envList);
            vscode.window.showInformationMessage("The env is added.");
        }
    }

    private async persistModelToSetting(newModel: LlmModel, modelList: any[], settingName: string) {
        let modelDetails = this.getModelDetailsAsString(newModel);
        const shouldAddModel = await Utils.confirmAction("A new model will be added. Do you want to add the model?", modelDetails);

        if (shouldAddModel) {
            modelList.push(newModel);
            this.app.configuration.updateConfigValue(settingName, modelList);
            vscode.window.showInformationMessage("The model is added.");
        }
    }

    private async persistAgentToSetting(newAgent: Agent, agentsList: any[], settingName: string) {
        let modelDetails = this.getAgentDetailsAsString(newAgent);
        const shouldAddModel = await Utils.confirmAction("A new agent will be added. Do you want to add the agent?", modelDetails);

        if (shouldAddModel) {
            agentsList.push(newAgent);
            this.app.configuration.updateConfigValue(settingName, agentsList);
            vscode.window.showInformationMessage("The agent is added.");
        }
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

    private async importEnvToList(envList: any[], settingName: string) {
        let name = "";
        const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Import Env',
                filters: {
                    'Env Files': ['json'],
                    'All Files': ['*']
                },
            });

            if (!uris || uris.length === 0) {
                return;
            }

            const filePath = uris[0].fsPath;
            
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const newEnv = JSON.parse(fileContent);
            // Sanitize imported data
            if (newEnv.name) newEnv.name = this.sanitizeInput(newEnv.name);
            if (newEnv.description) newEnv.description = this.sanitizeInput(newEnv.description);
            if (newEnv.completion?.name) newEnv.completion.name = this.sanitizeInput(newEnv.completion.name);
            if (newEnv.completion?.localStartCommand) newEnv.completion.localStartCommand = this.sanitizeCommand(newEnv.completion.localStartCommand);
            if (newEnv.completion?.endpoint) newEnv.completion.endpoint = this.sanitizeInput(newEnv.completion.endpoint);
            if (newEnv.completion?.aiModel) newEnv.completion.aiModel = this.sanitizeInput(newEnv.completion.aiModel);
            // Similarly for chat, embeddings, tools...
            if (newEnv.chat?.name) newEnv.chat.name = this.sanitizeInput(newEnv.chat.name);
            if (newEnv.chat?.localStartCommand) newEnv.chat.localStartCommand = this.sanitizeCommand(newEnv.chat.localStartCommand);
            if (newEnv.chat?.endpoint) newEnv.chat.endpoint = this.sanitizeInput(newEnv.chat.endpoint);
            if (newEnv.chat?.aiModel) newEnv.chat.aiModel = this.sanitizeInput(newEnv.chat.aiModel);
            if (newEnv.embeddings?.name) newEnv.embeddings.name = this.sanitizeInput(newEnv.embeddings.name);
            if (newEnv.embeddings?.localStartCommand) newEnv.embeddings.localStartCommand = this.sanitizeCommand(newEnv.embeddings.localStartCommand);
            if (newEnv.embeddings?.endpoint) newEnv.embeddings.endpoint = this.sanitizeInput(newEnv.embeddings.endpoint);
            if (newEnv.embeddings?.aiModel) newEnv.embeddings.aiModel = this.sanitizeInput(newEnv.embeddings.aiModel);
            if (newEnv.tools?.name) newEnv.tools.name = this.sanitizeInput(newEnv.tools.name);
            if (newEnv.tools?.localStartCommand) newEnv.tools.localStartCommand = this.sanitizeCommand(newEnv.tools.localStartCommand);
            if (newEnv.tools?.endpoint) newEnv.tools.endpoint = this.sanitizeInput(newEnv.tools.endpoint);
            if (newEnv.tools?.aiModel) newEnv.tools.aiModel = this.sanitizeInput(newEnv.tools.aiModel);
            if (newEnv.agent?.name) newEnv.agent.name = this.sanitizeInput(newEnv.agent.name);
            if (newEnv.agent?.description) newEnv.agent.description = this.sanitizeInput(newEnv.agent.description);
            if (newEnv.agent?.systemInstruction) newEnv.agent.systemInstruction = newEnv.agent.systemInstruction.map((s: string) => this.sanitizeInput(s));

        await this.persistEnvToSetting(newEnv, envList, settingName);
    }

    private async importModelToList(modelList: any[], settingName: string) {
        let name = "";
        const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Import Model',
                filters: {
                    'Model Files': ['json'],
                    'All Files': ['*']
                },
            });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const newModel = JSON.parse(fileContent);
        // Sanitize imported model
        if (newModel.name) newModel.name = this.sanitizeInput(newModel.name);
        if (newModel.localStartCommand) newModel.localStartCommand = this.sanitizeCommand(newModel.localStartCommand);
        if (newModel.endpoint) newModel.endpoint = this.sanitizeInput(newModel.endpoint);
        if (newModel.aiModel) newModel.aiModel = this.sanitizeInput(newModel.aiModel);

        await this.persistModelToSetting(newModel, modelList, settingName);
        vscode.window.showInformationMessage("Model imported: " + newModel.name);
    }

    private async importAgentToList(agentList: any[], settingName: string) {
        let name = "";
        const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Import Agent',
                filters: {
                    'Agent Files': ['json'],
                    'All Files': ['*']
                },
            });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const newAgent = JSON.parse(fileContent);
        // Sanitize imported agent
        if (newAgent.name) newAgent.name = this.sanitizeInput(newAgent.name);
        if (newAgent.description) newAgent.description = this.sanitizeInput(newAgent.description);
        if (newAgent.systemInstruction) newAgent.systemInstruction = newAgent.systemInstruction.map((s: string) => this.sanitizeInput(s));

        await this.persistAgentToSetting(newAgent, agentList, settingName);
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
        if (newAgent.name) newAgent.name = this.sanitizeInput(newAgent.name);
        if (newAgent.description) newAgent.description = this.sanitizeInput(newAgent.description);
        if (newAgent.prompt) newAgent.prompt = newAgent.prompt.map((s: string) => this.sanitizeInput(s));
        if (newAgent.context) newAgent.context = newAgent.context.map((s: string) => this.sanitizeInput(s));

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
        if (newChat.name) newChat.name = this.sanitizeInput(newChat.name);
        if (newChat.description) newChat.description = this.sanitizeInput(newChat.description);
        if (newChat.messages) {
            newChat.messages = newChat.messages.map((msg: any) => ({
                ...msg,
                content: this.sanitizeInput(msg.content || ''),
                role: this.sanitizeInput(msg.role || '')
            }));
        }

        await this.addChatToHistory(newChat);
    }

    private async deleteEnvFromList(envsList: any[], settingName: string) {
        const envsItems: QuickPickItem[] = this.getStandardQpList(envsList);
        const env = await vscode.window.showQuickPick(envsItems);
        if (env) {
            let envIndex = parseInt(env.label.split(". ")[0], 10) - 1;
            const shoulDeleteEnv = await Utils.confirmAction("Are you sure you want to delete the following env?", 
                this.getEnvDetailsAsString(envsList[envIndex])
            );
            if (shoulDeleteEnv) {
                envsList.splice(envIndex, 1);
                this.app.configuration.updateConfigValue(settingName, envsList);
                vscode.window.showInformationMessage("The env is deleted.")
            }
        }
    }

    private async viewEnvFromList(envsList: any[]) {
        const envsItems: QuickPickItem[] = this.getStandardQpList(envsList);
        let model = await vscode.window.showQuickPick(envsItems);
        if (model) {
            let envIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            let selectedEnv =  envsList[envIndex];
            let envDetails = this.getEnvDetailsAsString(selectedEnv);
            await Utils.showOkDialog(envDetails);
            
        }
    }

    public getEnvDetailsAsString(selectedEnv: any) {
        return "Env details: " +
            "\nname: " + selectedEnv.name +
            "\ndescription: " + selectedEnv.description +
            "\n\ncompletion model: " +
            "\nname: " + selectedEnv.completion?.name +
            "\nlocal start command: " + selectedEnv.completion?.localStartCommand +
            "\nendpoint: " + selectedEnv.completion?.endpoint +
            "\nmodel name for provider: " + selectedEnv.completion?.aiModel +
            "\napi key required: " + selectedEnv.completion?.isKeyRequired +
            "\n\nchat model: " +
            "\nname: " + selectedEnv.chat?.name +
            "\nlocal start command: " + selectedEnv.chat?.localStartCommand +
            "\nendpoint: " + selectedEnv.chat?.endpoint +
            "\nmodel name for provider: " + selectedEnv.chat?.aiModel +
            "\napi key required: " + selectedEnv.chat?.isKeyRequired +
            "\n\nembeddings model: " +
            "\nname: " + selectedEnv.embeddings?.name +
            "\nlocal start command: " + selectedEnv.embeddings?.localStartCommand +
            "\nendpoint: " + selectedEnv.embeddings?.endpoint +
            "\nmodel name for provider: " + selectedEnv.embeddings?.aiModel +
            "\napi key required: " + selectedEnv.embeddings?.isKeyRequired +
            "\n\ntools model: " +
            "\nname: " + selectedEnv.tools?.name +
            "\nlocal start command: " + selectedEnv.tools?.localStartCommand +
            "\nendpoint: " + selectedEnv.tools?.endpoint +
            "\nmodel name for provider: " + selectedEnv.tools?.aiModel +
            "\napi key required: " + selectedEnv.tools?.isKeyRequired +
            "\n\nagent: " +
            "\nname: " + selectedEnv.agent?.name +
            "\ndescription: " + selectedEnv.agent?.description +
            "\n\ncompletions enabled: " + selectedEnv.complEnabled +
            "\n\nrag enabled: " + selectedEnv.ragEnabled +
            "\n\nenv start last: " + selectedEnv.envStartLastUsed
    }

    private getModelDetailsAsString(model: LlmModel){
        return "model: " +
            "\nname: " + model.name +
            "\nlocal start command: " + model.localStartCommand +
            "\nendpoint: " + model.endpoint +
            "\nmodel name for provider: " + model.aiModel +
            "\napi key required: " + model.isKeyRequired
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
            "\nname: " + this.selectedChatModel.name +
            "\nlocal start command: " + this.selectedChatModel.localStartCommand +
            "\nendpoint: " + this.selectedChatModel.endpoint +
            "\nmodel name for provider: " + this.selectedChatModel.aiModel +
            "\napi key required: " + this.selectedChatModel.isKeyRequired +
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

    private async exportEnvFromList(envsList: any[]) {
        const envsItems: QuickPickItem[] = this.getStandardQpList(envsList);
        let model = await vscode.window.showQuickPick(envsItems);
        if (model) {
            let envIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            let selectedEnv =  envsList[envIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following env? \n\n" +
            this.getEnvDetailsAsString(selectedEnv)
            );

            if (shouldExport){
                const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedEnv.name+'.json')),
                        filters: {
                            'Env Files': ['json'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export Env'
                    });

                if (!uri) {
                    return;
                }

                const jsonContent = JSON.stringify(selectedEnv, null, 2);
                fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                vscode.window.showInformationMessage("Env is saved.")
            }
        }
    }

    private async exportModelFromList(modelsList: any[]) {
        const modelsItems: QuickPickItem[] = this.getStandardQpList(modelsList);
        let model = await vscode.window.showQuickPick(modelsItems);
        if (model) {
            let modelIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            let selectedmodel =  modelsList[modelIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following model? \n\n" +
            this.getModelDetailsAsString(selectedmodel)
            );

            if (shouldExport){
                const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedmodel.name+'.json')),
                        filters: {
                            'Model Files': ['json'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export Model'
                    });

                if (!uri) {
                    return;
                }

                const jsonContent = JSON.stringify(selectedmodel, null, 2);
                fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                vscode.window.showInformationMessage("Model is saved.")
            }
        }
    }

    private async exportAgentFromList(agentsList: any[]) {
        const agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList);
        let agent = await vscode.window.showQuickPick(agentsItems);
        if (agent) {
            let modelIndex = parseInt(agent.label.split(". ")[0], 10) - 1;
            let selectedAgent =  agentsList[modelIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following agent? \n\n" +
            this.getAgentCommandDetailsAsString(selectedAgent)
            );

            if (shouldExport){
                const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedAgent.name+'.json')),
                        filters: {
                            'Agent Files': ['json'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export Agent'
                    });

                if (!uri) {
                    return;
                }

                const jsonContent = JSON.stringify(selectedAgent, null, 2);
                fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                vscode.window.showInformationMessage("Agent is saved.")
            }
        }
    }

    private async exportAgentCommandFromList(agentCommands: any[]) {
        const agentsItems: QuickPickItem[] = this.getStandardQpList(agentCommands);
        let agent = await vscode.window.showQuickPick(agentsItems);
        if (agent) {
            let modelIndex = parseInt(agent.label.split(". ")[0], 10) - 1;
            let selectedAgentCommand =  agentCommands[modelIndex];
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
        const chatsItems: QuickPickItem[] = this.getStandardQpList(chatsList);
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
    

    private async addApiKey(model: LlmModel) {
        if (model.isKeyRequired) {
            const apiKey = this.app.persistence.getApiKey(model.endpoint ?? "");
            if (!apiKey) {
                let result = await vscode.window.showInputBox({
                    placeHolder: 'Enter your api key for ' + model.endpoint,
                    prompt: 'your api key for ' + model.endpoint,
                    value: ''
                });
                result = this.sanitizeInput(result || '');
                if (result) {
                    this.app.persistence.setApiKey(model.endpoint ?? "", result);
                    vscode.window.showInformationMessage("Your API key for "+ model.endpoint + " was saved.")
                }
            }
        }
    }

    private getModels(modelsFromProperty:any[]) {
        const complModelsItems: QuickPickItem[] = [];
        let i = 0
        for (let model of modelsFromProperty) {
            i++;
            complModelsItems.push({
                label: i + ". " +model.name,
                description: model.localStartCommand,
                detail: this.startModelDetail
            });
        }
        return complModelsItems;
    }

    private getStandardQpList(list:any[]) {
        const items: QuickPickItem[] = [];
        let i = 0
        for (let elem of list) {
            i++;
            items.push({
                label: i + ". " + elem.name,
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
        return this.selectedChatModel;
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

    getChat = (): Chat => {
        return this.selectedChat;
    }

    isComplModelSelected = (): boolean => {
        return this.selectedComplModel != undefined && this.selectedComplModel.name. trim() != "";
    }

    isChatModelSelected = (): boolean => {
        return this.selectedChatModel != undefined && this.selectedChatModel.name. trim() != "";
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

    processComplModelsActions = async (selected:vscode.QuickPickItem) => {
        let compleModelType = this.getTypeDetails(ModelType.Completion);
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartCompletionModel):  
                await this.selectStartModel(compleModelType);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addLocalCompletionModel):
                await this.addLocalModelToList(compleModelType)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addExternalCompletionModel):
                await this.addExternalModelToList(compleModelType)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addCompletionModelFromHuggingface):
                await this.addHuggingfaceModelToList(compleModelType);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteCompletionModel):
                await this.deleteModelFromList(compleModelType.modelsList, compleModelType.modelsListSettingName);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.viewCompletionModelDetails):
                await this.viewModelFromList(compleModelType.modelsList)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopCompletionModel):
                await this.deselectStopModel(compleModelType);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportCompletionModel):
                await this.exportModelFromList(compleModelType.modelsList)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importCompletionModel):
                await this.importModelToList(compleModelType.modelsList, compleModelType.modelsListSettingName)
                break;
        }
    }

    processChatModelsActions = async (selected:vscode.QuickPickItem) => {
        let chatTypeDetails = this.getTypeDetails(ModelType.Chat);
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartChatModel):
                await this.selectStartModel(chatTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addLocalChatModel) ?? "":
                await this.addLocalModelToList(chatTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addExternalChatModel) ?? "":
                await this.addExternalModelToList(chatTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addChatModelFromHuggingface) ?? "":
                await this.addHuggingfaceModelToList(chatTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteChatModel) ?? "":
                await this.deleteModelFromList(chatTypeDetails.modelsList, chatTypeDetails.modelsListSettingName);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.viewChatModelDetails) ?? "":
                await this.viewModelFromList(chatTypeDetails.modelsList)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopChatModel):
                await this.deselectStopModel(chatTypeDetails);    
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportChatModel):
                await this.exportModelFromList(chatTypeDetails.modelsList)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importChatModel):
                await this.importModelToList(chatTypeDetails.modelsList, chatTypeDetails.modelsListSettingName)
                break;
        }
    }

    processEmbsModelsActions = async (selected:vscode.QuickPickItem) => {
        let embsTypeDetails = this.getTypeDetails(ModelType.Embeddings);
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartEmbeddingsModel):
                await this.selectStartModel(embsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addLocalEmbeddingsModel):
                await this.addLocalModelToList(embsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addExternalEmbeddingsModel):
                await this.addExternalModelToList(embsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addEmbeddingsModelFromHuggingface) ?? "":
                await this.addHuggingfaceModelToList(embsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteEmbeddingsModel):
                await this.deleteModelFromList(embsTypeDetails.modelsList, embsTypeDetails.modelsListSettingName);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.viewEmbeddingsModelDetails):
                await this.viewModelFromList(embsTypeDetails.modelsList)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopEmbeddingsModel):
                await this.deselectStopModel(embsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportEmbeddingsModel):
                await this.exportModelFromList(embsTypeDetails.modelsList)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importEmbeddingsModel):
                await this.importModelToList(embsTypeDetails.modelsList, embsTypeDetails.modelsListSettingName)
                break;
        }
    }

    processToolsModelsActions = async (selected:vscode.QuickPickItem) => {
        let toolsTypeDetails = this.getTypeDetails(ModelType.Tools);
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartToolsModel):
                await this.selectStartModel(toolsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addLocalToolsModel):
                await this.addLocalModelToList(toolsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addExternalToolsModel):
                await this.addExternalModelToList(toolsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addToolsModelFromHuggingface) ?? "":
                await this.addHuggingfaceModelToList(toolsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteToolsModel):
                await this.deleteModelFromList(toolsTypeDetails.modelsList, toolsTypeDetails.modelsListSettingName);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.viewToolsModelDetails):
                await this.viewModelFromList(toolsTypeDetails.modelsList)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopToolsModel):
                await this.deselectStopModel(toolsTypeDetails);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportToolsModel):
                await this.exportModelFromList(toolsTypeDetails.modelsList)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importToolsModel):
                await this.importModelToList(toolsTypeDetails.modelsList, toolsTypeDetails.modelsListSettingName)
                break;
        }
    }

    processEnvActions = async (selected:vscode.QuickPickItem) => {
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartEnv):
                this.selectEnvFromList(this.app.configuration.envs_list);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addEnv):
                this.showEnvView();
                // await this.addEnvToList(this.app.configuration.envs_list, "envs_list");
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteEnv):
                await this.deleteEnvFromList(this.app.configuration.envs_list, "envs_list");
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.viewEnvDetails):
                await this.viewEnvFromList(this.app.configuration.envs_list)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopEnv):
                await this.stopEnv();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportEnv):
                await this.exportEnvFromList(this.app.configuration.envs_list)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importEnv):
                await this.importEnvToList(this.app.configuration.envs_list, "envs_list")
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.downloadUploadEnvsOnline):
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggml-org/llama.vscode/discussions'));
                break;
        }
    }

    processAgentsActions = async (selected:vscode.QuickPickItem) => {
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartAgent):
                await this.selectAgentFromList(this.app.configuration.agents_list);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addAgent):
                // await this.addModelToList(toolsTypeDetails);
                Utils.showOkDialog("You could add an agent in setting agents_list or use export, modify and import.")
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgent):
                // await this.deleteModelFromList(this.app.configuration.tools_models_list, "tools_models_list");
                Utils.showOkDialog("You could delete an agent in setting agents_list")
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.viewAgentDetails):
                await this.viewAgentFromList(this.app.configuration.agents_list)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopAgent):
                // await this.deselectStopModel(this.app.llamaServer.killToolsCmd, "selectedToolsModel");
                this.selectedAgent = {name: "", systemInstruction: []};
                vscode.window.showInformationMessage("The agent is deselected.")
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportAgent):
                await this.exportAgentFromList(this.app.configuration.agents_list)
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importAgent):
                await this.importAgentToList(this.app.configuration.agents_list, "agents_list")
                break;
        }
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
                    result = this.sanitizeInput(result || '');
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
                endpoint = this.sanitizeInput(endpoint || '');
                let apiKey = await vscode.window.showInputBox({
                            placeHolder: 'Enter your new api key for ' + endpoint,
                            prompt: 'your api key',
                            value: ''
                        })
                apiKey = this.sanitizeInput(apiKey || '');
                if (endpoint && apiKey) 
                    {
                        this.app.persistence.setApiKey(endpoint, apiKey);
                        vscode.window.showInformationMessage("Api key is added.")
                    }
                else vscode.window.showInformationMessage("Api key is not added! Endpoint or API Key are not entered.")
                break;
        }
    }

    public showEnvView() {
        vscode.commands.executeCommand('extension.showLlamaWebview');
        this.app.llamaWebviewProvider.setView("addenv");
    }

    public async deselectStopModel(modelTypeDetails: ModelTypeDetails) {
        await modelTypeDetails.killCmd();
        this[modelTypeDetails.selModelPropName as keyof Menu] = { name: "", localStartCommand: "" } as any;
        this.app.llamaWebviewProvider.updateLlamaView();
    }

    public async stopEnv() {
        await this.app.llamaServer.killFimCmd();
        this.selectedComplModel = { name: "", localStartCommand: "" };
        await this.app.llamaServer.killChatCmd();
        this.selectedChatModel = { name: "", localStartCommand: "" };
        await this.app.llamaServer.killEmbeddingsCmd();
        this.selectedEmbeddingsModel = { name: "", localStartCommand: "" };
        await this.app.llamaServer.killToolsCmd();
        this.selectedToolsModel = { name: "", localStartCommand: "" };
        this.deselectAgent();
        this.selectedEnv = { name: "" };
        this.app.llamaWebviewProvider.updateLlamaView();
        vscode.window.showInformationMessage("Env, models and agent are deselected.")
    }

    // Generic method using constants
    private getTypeDetails(type: ModelType): ModelTypeDetails {
        const config = MODEL_TYPE_CONFIG[type];
        return {
            modelsList: (this.app.configuration as any)[config.settingName],
            modelsListSettingName: config.settingName,
            newModelPort: (this.app.configuration as any)[config.portSetting],
            newModelHost: (this.app.configuration as any)[config.hostSetting],
            selModelPropName: config.propName,
            launchSettingName: config.launchSetting,
            killCmd: (this.app.llamaServer as any)[config.killCmdName],
            shellCmd: (this.app.llamaServer as any)[config.shellCmdName]
        };
    }

    // Legacy methods for backward compatibility (can be removed in later phases)
    getComplTypeDetails = (): ModelTypeDetails => this.getTypeDetails(ModelType.Completion);
    getChatTypeDetails = (): ModelTypeDetails => this.getTypeDetails(ModelType.Chat);
    getEmbsTypeDetails = (): ModelTypeDetails => this.getTypeDetails(ModelType.Embeddings);
    getToolsTypeDetails = (): ModelTypeDetails => this.getTypeDetails(ModelType.Tools);

    

    public deselectAgent() {
        this.selectAgent({
            name: "",
            systemInstruction: [],
            tools: [
                "run_terminal_command",
                "search_source",
                "read_file",
                "list_directory",
                "regex_search",
                "delete_file",
                "get_diff",
                "edit_file",
                "ask_user"
            ]
        });
    }

    private sanitizeCommand(command: string): string {
        if (!command) return '';
        // Escape common shell metacharacters to prevent injection
        return command.trim().replace(/[`#$&*;\<>\?\\|~!{}()[\]^"]/g, '\\$&');
    }

    private sanitizeInput(input: string): string {
        return input ? input.trim() : '';
    }
}
