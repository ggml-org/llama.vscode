import {Application} from "./application";
import vscode, { QuickPickItem } from "vscode";
import { LlmModel, Env, Agent, Chat } from "./types";
import { Utils } from "./utils";
import * as fs from 'fs';
import * as path from 'path';
import { ModelType, AGENT_NAME, UI_TEXT_KEYS, PERSISTENCE_KEYS } from "./constants";

export class Menu {
    private app: Application

    constructor(application: Application) {
        this.app = application;
    }

    createMenuItems = (currentLanguage: string | undefined, isLanguageEnabled: boolean): vscode.QuickPickItem[] => {
        let allMenuItems: vscode.QuickPickItem[] = [];
        allMenuItems = allMenuItems.concat(this.getActionsMenuItems());
        allMenuItems = allMenuItems.concat(this.getEntitiesMenuItems());
        allMenuItems = allMenuItems.concat(this.getMaintenanceMenuItems(currentLanguage, isLanguageEnabled));
        allMenuItems = allMenuItems.concat(this.getHelpMenuItems());
        allMenuItems = allMenuItems.concat(this.getTrainingMenuItems());
        
        return allMenuItems.filter(Boolean) as vscode.QuickPickItem[];
    }

    private getActionsMenuItems = (): QuickPickItem[] => {
        const menuItems = [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.actions)??"",
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartEnv)??"",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.envSelectDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopEnv)??"",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopEnvDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedEnv)??"",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedEnvDescription)
            },
            {
                label: (this.app.configuration.getUiText(UI_TEXT_KEYS.showLlamaAgent)??"") + " (Ctrl+Shif+A)",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.showLlamaAgentDescription)
            },
            {
                label: (this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAI)??"") + " (Ctrl+;)",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAIDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedModels)??"",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedModelsDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.useAsLocalAIRunner)??"",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.localAIRunnerDescription)
            }
        ]
        return menuItems;
    }

    private getMaintenanceMenuItems = (currentLanguage: string | undefined, isLanguageEnabled: boolean): QuickPickItem[] => {
        const menuItems = [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.maintenance)??"",
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: "Install/upgrade llama.cpp",
                description: "Installs/upgrades llama.cpp server"
            },
            {
                label: `${this.app.configuration.enabled ?  this.app.configuration.getUiText(UI_TEXT_KEYS.disable) + " " + this.app.configuration.getUiText(UI_TEXT_KEYS.allCompletions) :  this.app.configuration.getUiText(UI_TEXT_KEYS.enable)+ " " + this.app.configuration.getUiText(UI_TEXT_KEYS.allCompletions)}`,
                description: `${this.app.configuration.enabled ? this.app.configuration.getUiText(UI_TEXT_KEYS.turnOffCompletionsGlobally) : this.app.configuration.getUiText(UI_TEXT_KEYS.turnOnCompletionsGlobally)}`
            },
            currentLanguage ? {
                label: `${isLanguageEnabled ?  this.app.configuration.getUiText(UI_TEXT_KEYS.disable)??"" : this.app.configuration.getUiText(UI_TEXT_KEYS.enable)??""} ${currentLanguage}`,
                description: isLanguageEnabled ? `Disable language support for ${currentLanguage}` : `Enable language support for ${currentLanguage}`
            } : { 
                label: `${this.app.configuration.getUiText(UI_TEXT_KEYS.enable)} ${this.app.configuration.getUiText(UI_TEXT_KEYS.completionsFor)} ${currentLanguage}`,
                description: `${ this.app.configuration.getUiText(UI_TEXT_KEYS.currently)} ${isLanguageEnabled ?  this.app.configuration.getUiText(UI_TEXT_KEYS.enabled) :  this.app.configuration.getUiText(UI_TEXT_KEYS.disabled)}`
            },
            {
                label: `${this.app.configuration.rag_enabled ?  this.app.configuration.getUiText(UI_TEXT_KEYS.disable) :  this.app.configuration.getUiText(UI_TEXT_KEYS.enable)} ${this.app.configuration.getUiText(UI_TEXT_KEYS.rag)}`,
                description: `${this.app.configuration.rag_enabled ? this.app.configuration.getUiText(UI_TEXT_KEYS.turnOffRAG) : this.app.configuration.getUiText(UI_TEXT_KEYS.turnOnRAG)}`
            },
            {
                label: "$(gear) " + this.app.configuration.getUiText(UI_TEXT_KEYS.editSettings),
            }
        ]
        return menuItems;
    }

    private getEntitiesMenuItems = (): QuickPickItem[] => {
        const menuItems = [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.entities)??"",
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.envs)??"",
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
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.apiKeys)??"",
                description: this.app.configuration.getUiText(UI_TEXT_KEYS.apiKeysDescription)
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.agents)??"",
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.agentCommands)??"",
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.chats)??"",
            }
        ]
        return menuItems;
    }

    private getHelpMenuItems = (): QuickPickItem[] => {
        const menuItems = [
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
            }
        ]
        return menuItems as QuickPickItem[];
    }

    private getTrainingMenuItems = (): QuickPickItem[] => {
        let menuItems: QuickPickItem[] = []
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
        return menuItems;
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
                this.app.envService.showCurrentEnv();
                break;
             case this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAI) + " (Ctrl+;)":
                this.app.askAi.showChatWithAi(false, context);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAIAboutLlamaVscode):
                const helpAgent = this.app.configuration.agents_list.find(a => a.name === AGENT_NAME.llamaVscodeHelp);
                if (helpAgent) {
                    await this.app.agentService.selectAgent(helpAgent);
                }
                this.app.llamaWebviewProvider.showAgentView();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.showLlamaAgent) + " (Ctrl+Shif+A)":
                await this.app.llamaWebviewProvider.showAgentView();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chatWithAIWithProjectContext) + " (Ctrl+Shift+;)":
                if (this.app.configuration.rag_enabled){
                    this.app.askAi.showChatWithAi(true, context)
                } else {
                    vscode.window.showInformationMessage("RAG is not enabled. Please enable it from llama-vscode before using this feature.")
                }
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.showSelectedModels):
                this.app.envService.showCurrentEnv();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.useAsLocalAIRunner):
                vscode.commands.executeCommand('extension.showLlamaWebview');
                this.app.llamaWebviewProvider.setView("airunner")
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.completionModels) ?? "":
                await this.app.modelService.processModelActions(ModelType.Completion);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chatModels) ?? "":
                await this.app.modelService.processModelActions(ModelType.Chat);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.embeddingsModels) ?? "":
                await this.app.modelService.processModelActions(ModelType.Embeddings);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.toolsModels) ?? "":
                await this.app.modelService.processModelActions(ModelType.Tools);
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
                let agentCommandsActions: vscode.QuickPickItem[] = this.app.agentCommandService.getAgentCommandsActions();
                let agentCommandSelected = await vscode.window.showQuickPick(agentCommandsActions);
                if (agentCommandSelected) this.app.agentCommandService.processActions(agentCommandSelected);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.chats) ?? "":
                let chatsActions: vscode.QuickPickItem[] = this.app.chatService.getChatActions();
                let chatSelected = await vscode.window.showQuickPick(chatsActions);
                if (chatSelected) this.app.chatService.processChatActions(chatSelected);
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
                let apiKeysActions: vscode.QuickPickItem[] = this.app.apiKeyService.getApiKeyActions()
                let apiKeyActionSelected = await vscode.window.showQuickPick(apiKeysActions);
                if (apiKeyActionSelected) this.app.apiKeyService.processApiKeyActions(apiKeyActionSelected);
                break;            case this.app.configuration.getUiText(UI_TEXT_KEYS.howToDeleteModels):
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

    public showHowToUseLlamaVscode() {
        Utils.showOkDialog("How to use llama-vscode" +
            "\n\nTL;DR,: install llama.cpp, select env, start using" +
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
}
