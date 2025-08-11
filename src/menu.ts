import {Application} from "./application";
import vscode, { QuickPickItem } from "vscode";
import { HuggingfaceFile, HuggingfaceModel, LlmModel, ModelTypeDetails, Orchestra } from "./types";
import { Utils } from "./utils";
import { Configuration } from "./configuration";
import * as fs from 'fs';
import * as path from 'path';
import axios from "axios";

export class Menu {
    private app: Application
    private selectedComplModel: LlmModel = {name: ""}
    private selectedChatModel: LlmModel = {name: ""} 
    private selectedEmbeddingsModel: LlmModel = {name: ""}
    private selectedToolsModel: LlmModel = {name: ""}
    private selectedOrchestra: Orchestra = {name: ""}
    private readonly startModelDetail = "Selects the model and if local also downloads the model (if not yet done) and starts a llama-server with it.";

    constructor(application: Application) {
        this.app = application;
    }

    createMenuItems = (currentLanguage: string | undefined, isLanguageEnabled: boolean): vscode.QuickPickItem[] => {
        let menuItems = [
            {
                label: this.app.configuration.getUiText("Actions"),
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: this.app.configuration.getUiText('Select/start orchestra...')??"",
                description: this.app.configuration.getUiText(`Stops the currently running models and starts the selected orchestra - (a predefined group of models for completion, chat, embeddings and tools).`)
            },
            {
                label: this.app.configuration.getUiText('Deselect/stop orchestra and models'),
                description: this.app.configuration.getUiText(`Unselects/stops orchestra, completion, chat, embeddings and tools models`)
            },
            {
                label: (this.app.configuration.getUiText("Show Llama Agent") ?? "") + " (Ctrl+Shif+A)",
                description: this.app.configuration.getUiText(`Shows Llama Agent panel`)
            },
            {
                label: (this.app.configuration.getUiText("Chat with AI") ?? "") + " (Ctrl+;)",
                description: this.app.configuration.getUiText(`Opens a chat with AI window inside VS Code using server from property endpoint_chat`)
            },
            {
                label: (this.app.configuration.getUiText("Chat with AI with project context") ?? "") + " (Ctrl+Shift+;)",
                description: this.app.configuration.getUiText(`Opens a chat with AI window with project context inside VS Code using server from property endpoint_chat`)
            },
            {
                label: this.app.configuration.getUiText("Show selected models"),
                description: this.app.configuration.getUiText("Displays a list of currently selected models")
            },
            
            {
                label: this.app.configuration.getUiText("Entities"),
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: this.app.configuration.getUiText('Orchestras...')??"",
            },
            
            {
                label: this.app.configuration.getUiText('Completion models...')??""
            },
            {
                label: this.app.configuration.getUiText('Chat models...')??""
            },
            {
                label: this.app.configuration.getUiText('Embeddings models...')??""
            },
            {
                label: this.app.configuration.getUiText('Tools models...')??""
            },
            {
                label: this.app.configuration.getUiText('API keys...'),
                description: this.app.configuration.getUiText(`Edit or remove API keys. New API keys are added on first use of an endpoint.`)
            },
            {
                label: this.app.configuration.getUiText("Maintenance"),
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: "Install/upgrade llama.cpp",
                description: "Installs/upgrades llama.cpp server"
            },
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
                label: this.app.configuration.getUiText("Help"),
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: this.app.configuration.getUiText("How to use llama-vscode"),
            },
            {
                label: this.app.configuration.getUiText('How to delete models'),
                description: this.app.configuration.getUiText(`Explains how to delete the downloaded models`)
            },
            {
                label: "$(book) " + this.app.configuration.getUiText("View Documentation..."),
            },
            ]                          

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
        switch (selected.label) {
            case this.app.configuration.getUiText("Select/start orchestra..."):
                this.selectOrchestra();
                break;
            case this.app.configuration.getUiText('Deselect/stop orchestra and models'):
                this.stopOrchestra()
                break;
             case this.app.configuration.getUiText("Chat with AI") + " (Ctrl+;)":
                this.app.askAi.showChatWithAi(false, context);
                break;
            case this.app.configuration.getUiText("Show Llama Agent") + " (Ctrl+Shif+A)":
                vscode.commands.executeCommand('extension.showLlamaWebview');
                break;
            case this.app.configuration.getUiText("Chat with AI with project context") + " (Ctrl+Shift+;)":
                if (this.app.configuration.rag_enabled){
                    this.app.askAi.showChatWithAi(true, context)
                } else {
                    vscode.window.showInformationMessage("RAG is not enabled. Please enable it from llama-vscode before using this feature.")
                }
                break;
            case this.app.configuration.getUiText('Show selected models'):
                this.showSelectedModels();
                break;
            case this.app.configuration.getUiText('Completion models...')??"":
                let complModelActions: vscode.QuickPickItem[] = this.getModelActions("completion");
                let complModelSelected = await vscode.window.showQuickPick(complModelActions);
                if (complModelSelected) this.processComplModelsActions(complModelSelected);
                break;
            case this.app.configuration.getUiText('Chat models...')??"":
                let chatModelActions: vscode.QuickPickItem[] = this.getModelActions("chat");
                let chatModelSelected = await vscode.window.showQuickPick(chatModelActions);
                if (chatModelSelected) this.processChatModelsActions(chatModelSelected);
                break;
            case this.app.configuration.getUiText('Embeddings models...')??"":
                let embsModelActions: vscode.QuickPickItem[] = this.getModelActions("embeddings")
                let embsModelSelected = await vscode.window.showQuickPick(embsModelActions);
                if (embsModelSelected) this.processEmbsModelsActions(embsModelSelected);
                break;
            case this.app.configuration.getUiText('Tools models...')??"":
                let toolsModelActions: vscode.QuickPickItem[] = this.getModelActions("tools");
                let toolsActionSelected = await vscode.window.showQuickPick(toolsModelActions);
                if (toolsActionSelected) this.processToolsModelsActions(toolsActionSelected);
                break;
            case this.app.configuration.getUiText('Orchestras...')??"":
                let orchestrasActions: vscode.QuickPickItem[] = this.getOrchestraActions()
                let orchestraSelected = await vscode.window.showQuickPick(orchestrasActions);
                if (orchestraSelected) this.processOrchestraActions(orchestraSelected);
                break;
            case "$(gear) " +  this.app.configuration.getUiText("Edit Settings..."):
                await vscode.commands.executeCommand('workbench.action.openSettings', 'llama-vscode');
                break;
            case this.app.configuration.getUiText('Start training completion model'):
                await this.app.llamaServer.killTrainCmd();
                await this.app.llamaServer.shellTrainCmd(this.app.configuration.launch_training_completion);
                break;
            case this.app.configuration.getUiText('Start training chat model'):
                await this.app.llamaServer.killTrainCmd();
                await this.app.llamaServer.shellTrainCmd(this.app.configuration.launch_training_chat);
                break;
            case this.app.configuration.getUiText("Stop training"):
                await this.app.llamaServer.killTrainCmd();
                break;
            case this.app.configuration.getUiText('API keys...'):
                let apiKeysActions: vscode.QuickPickItem[] = [
                    {
                        label: this.app.configuration.getUiText("Add API key...")??""
                    },
                    {
                        label: this.app.configuration.getUiText("Edit/delete API key...")??""
                    },
                ]
                let apiKeyActionSelected = await vscode.window.showQuickPick(apiKeysActions);
                if (apiKeyActionSelected) this.processApiKeyActions(apiKeyActionSelected);
                break;
            case this.app.configuration.getUiText('How to delete models'):
                Utils.showOkDialog("The automatically downloaded models (llama-server started with -hf option) are stored as follows: \nIn Windows in folder C:\\Users\\<user_name>\\AppData\\Local\\llama.cpp. \nIn Mac or Linux the folder could be /users/<user_name>/Library/Caches/llama.cpp. \nYou could delete them from the folder.")
                break;
            case this.app.configuration.getUiText("How to use llama-vscode"):
                this.showHowToUseLlamaVscode();
                break;
            case "$(book) " + this.app.configuration.getUiText("View Documentation..."):
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

    selectOrchestra = async () => {
        const orchestrasItems: QuickPickItem[] = this.getOrchestras(this.app.configuration.orchestras_list);
        orchestrasItems.push({ label: (orchestrasItems.length+1) + ". Last used models", description: "" });
        const orchestra = await vscode.window.showQuickPick(orchestrasItems);
        if (orchestra) {
            await this.app.llamaServer.killFimCmd();
            this.selectedComplModel = {name: "", localStartCommand: ""}
            await this.app.llamaServer.killChatCmd();
            this.selectedChatModel = {name: "", localStartCommand: ""}
            await this.app.llamaServer.killEmbeddingsCmd();
            this.selectedEmbeddingsModel = {name: "", localStartCommand: ""}

            if (orchestra.label.includes("Last used models")){
                this.selectedComplModel = this.app.persistence.getValue("selectedComplModel") as LlmModel
                if (this.selectedComplModel && this.selectedComplModel.localStartCommand) await this.app.llamaServer.shellFimCmd(this.selectedComplModel.localStartCommand);
                this.selectedChatModel = this.app.persistence.getValue("selectedChatModel") as LlmModel
                if (this.selectedChatModel && this.selectedChatModel.localStartCommand) await this.app.llamaServer.shellChatCmd(this.selectedChatModel.localStartCommand);
                this.selectedEmbeddingsModel = this.app.persistence.getValue("selectedEmbeddingsModel") as LlmModel
                if (this.selectedEmbeddingsModel && this.selectedEmbeddingsModel.localStartCommand) await this.app.llamaServer.shellEmbeddingsCmd(this.selectedEmbeddingsModel.localStartCommand);
                this.selectedToolsModel = this.app.persistence.getValue("selectedToolsModel") as LlmModel
                if (this.selectedToolsModel) this.addApiKey(this.selectedToolsModel)
            } else {
                this.selectedOrchestra = this.app.configuration.orchestras_list[parseInt(orchestra.label.split(". ")[0], 10) - 1]
                await this.app.persistence.setValue('selectedOrchestra', this.selectedOrchestra);
                
                if (this.selectedOrchestra){
                    this.selectedComplModel = this.selectedOrchestra.completion??{name: ""}
                    if (this.selectedComplModel.localStartCommand) await this.app.llamaServer.shellFimCmd(this.selectedComplModel.localStartCommand);
                    await this.addApiKey(this.selectedComplModel);
                    
                    this.selectedChatModel = this.selectedOrchestra.chat??{name: ""}
                    if (this.selectedChatModel.localStartCommand) await this.app.llamaServer.shellChatCmd(this.selectedChatModel.localStartCommand);
                    await this.addApiKey(this.selectedChatModel);

                    this.selectedEmbeddingsModel = this.selectedOrchestra.embeddings??{name: ""}
                    if (this.selectedEmbeddingsModel.localStartCommand) await this.app.llamaServer.shellEmbeddingsCmd(this.selectedEmbeddingsModel.localStartCommand);
                    await this.addApiKey(this.selectedEmbeddingsModel);

                    this.selectedToolsModel = this.selectedOrchestra.tools??{name: ""}
                    if (this.selectedToolsModel.localStartCommand) await this.app.llamaServer.shellToolsCmd(this.selectedToolsModel.localStartCommand);
                    await this.addApiKey(this.selectedToolsModel);
                }
            }
            this.app.llamaWebviewProvider.updateModelInfo();
        }
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

    public async installLlamacpp() {
        if (process.platform != 'darwin' && process.platform != 'win32') {
            vscode.window.showInformationMessage("Automatic install/upgrade is supported only for Mac and Windows for now. Download llama.cpp package manually and add the folder to the path. Visit github.com/ggml-org/llama.vscode/wiki for details.");
        } else {
            await this.app.llamaServer.killCommandCmd();
            let terminalCommand = process.platform === 'darwin' ? "brew install llama.cpp" : process.platform === 'win32' ? "winget install llama.cpp" : "";
            await this.app.llamaServer.shellCommandCmd(terminalCommand);
        }
    }

    private async activateModel(selModelPropName: string, killCmd: () => void, shellCmd: (message: string) => void) {
        let selModel = this[selModelPropName as keyof Menu] as LlmModel
        this.addApiKey(selModel);
        await this.app.persistence.setValue(selModelPropName, selModel);
        await killCmd();
        if (selModel.localStartCommand) await shellCmd(selModel.localStartCommand ?? "");
        this.app.llamaWebviewProvider.updateModelInfo();
    }

    private getOrchestraActions(): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText("Select/start orchestra...") ?? ""
            },
            {
                label: this.app.configuration.getUiText("Deselect/stop orchestra and models") ?? ""
            },
            {
                label: this.app.configuration.getUiText('Add orchestra...') ?? "",
                description: this.app.configuration.getUiText('Adds orchestra with the currently selected models.') ?? "",
            },
            {
                label: this.app.configuration.getUiText('View orchestra details...') ?? ""
            },
            {
                label: this.app.configuration.getUiText('Delete orchestra...') ?? ""
            },
            {
                label: this.app.configuration.getUiText('Export orchestra...') ?? ""
            },
            {
                label: this.app.configuration.getUiText('Import orchestra...') ?? ""
            },
            {
                label: this.app.configuration.getUiText('Download/upload orchestras online') ?? ""
            },
        ];
    }

    private getModelActions(modelType: string): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText("Select/start "+modelType+" model...") ?? ""
            },
            {
                label: this.app.configuration.getUiText("Deselect/stop "+modelType+" model") ?? ""
            },
            {
                label: this.app.configuration.getUiText("Add "+modelType+" model...") ?? ""
            },
            {
                label: this.app.configuration.getUiText("Add "+modelType+" model from huggingface...") ?? ""
            },
            {
                label: this.app.configuration.getUiText('View '+modelType+' model details...') ?? ""
            },
            {
                label: this.app.configuration.getUiText('Delete '+modelType+' model...') ?? ""
            },
            {
                label: this.app.configuration.getUiText('Export '+modelType+' model...') ?? ""
            },
            {
                label: this.app.configuration.getUiText('Import '+modelType+' model...') ?? ""
            },
        ];
    }

    public showSelectedModels() {
        Utils.showOkDialog(this.getSelectionsAsString());
    }

    public showHowToUseLlamaVscode() {
        Utils.showOkDialog("How to use llama-vscode" +
            "\n\nllama-vscode is an extension for code completion, chat with ai and agentic coding, focused on local model usage with llama.cpp." +
            "\n\n1. Install llama.cpp " +
            "\n  - Show the extension menu by clicking llama-vscode in the status bar or by Ctrl+Shift+M and select 'Install/upgrade llama.cpp (sometimes restart is needed to adjust the paths to llama-server)" +
            "\n\n2. Select orchestra (group of models) for your needs from llama-vscode menu." +
            "\n  - This will download (only the first time) the models and run llama.cpp servers locally (or use external servers endpoints, depends on orchestra)" +
            "\n\n3. Start using llama-vscode" +
            "\n  - For code completion - just start typing (uses completion model)" +
            "\n  - For edit code with AI - select code, right click and select 'llama-vscode Edit Selected Text with AI' (uses chat model, no tools support required)" +
            "\n  - For chat with AI (quick questions to (local) AI instead of searching with google) - select 'Chat with AI' from llama.vscode menu (uses chat model, no tools support required, llama.cpp server should run on model endpoint.)" +
            "\n  - For agentic coding - select 'Show Llama Agent' from llama.vscode menu (or Ctrl+Shift+A) and start typing your questions or requests (uses tools model and embeddings model for some tools, most intelligence needed, local usage supported, but you could also use external, paid providers for better results)" +
            "\n\n If you want to use llama-vscode only for code completion - you could disable RAG from llama-vscode menu to avoid indexing files." +
            "\n\n If you are an existing user - you could continue useing llama-vscode as before." +
            "\n\n For more details - select 'View Documentation' from llama-vscode menu" +
            "\n\n Enjoy!"
        );
    }

    private async deleteModelFromList(modelsList: LlmModel[], settingName: string) {
        const modelsItems: QuickPickItem[] = this.getModels(modelsList);
        const model = await vscode.window.showQuickPick(modelsItems);
        if (model) {
            let modelIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            const shoulDeleteModel = await Utils.showYesNoDialog("Are you sure you want to delete model below? \n\n"+
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
            Utils
            await Utils.showOkDialog("Model details: " +
            "\nname: " + selectedModel.name +
            "\nlocal start command: " + selectedModel.localStartCommand +
            "\nendpoint: " + selectedModel.endpoint +
            "\nmodel name for provider: " + selectedModel.aiModel +
            "\napi key required: " + selectedModel.isKeyRequired);
        }
    }

    private async addModelToList(modelTypeDetails: ModelTypeDetails) {
        const hostEndpoint = "http://" + modelTypeDetails.newModelHost
        const modelListToLocalCommand = new Map([ 
            ["complition_models_list", "llama-server -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF> -ngl 99 -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256 --port " + modelTypeDetails.newModelPort + " --host " + modelTypeDetails.newModelHost],
            ["chat_models_list", 'llama-server -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF> -ngl 99 -fa -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port ' + modelTypeDetails.newModelPort + " --host " + modelTypeDetails.newModelHost], 
            ["embeddings_models_list", "llama-server -hf <model name from hugging face, i.e: ggml-org/Nomic-Embed-Text-V2-GGUF> -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port " + modelTypeDetails.newModelPort + " --host " + modelTypeDetails.newModelHost],  
            ["tools_models_list", "llama-server -hf <model name from hugging face, i.e: unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF:Q8_0> --jinja  -ngl 99 -c 0 -fa -ub 1024 -b 1024 --cache-reuse 256 --port " + modelTypeDetails.newModelPort + " --host " + modelTypeDetails.newModelHost] ]);
        let name = "";
        while (name.trim() === "") {
            name = (await vscode.window.showInputBox({
                placeHolder: 'Enter a user fiendly name for your model (required)',
                prompt: 'name for your model (required)',
                value: ''
            })) ?? "";
        }
        const localStartCommand = await vscode.window.showInputBox({
            placeHolder: 'A command to start the model locally, i.e. llama-server -m model_name.gguf --port '+ modelTypeDetails.newModelPort + '. ',
            prompt: 'Enter a command to start the model locally (leave emtpy if external server is used). If not empty, the command will be run on selecting the model.',
            value: modelListToLocalCommand.get(modelTypeDetails.modelsListSettingName)
        });
        let endpoint = "";
        while (endpoint.trim() === "") {
            endpoint = await vscode.window.showInputBox({
                placeHolder: 'Endpoint for accessing your model, i.e. ' + hostEndpoint + ':' + modelTypeDetails.newModelPort + ' (required)' ,
                prompt: 'Endpoint for your model (required)',
                value: ''
            }) ?? "";
        }
        const aiModel = await vscode.window.showInputBox({
            placeHolder: 'Model name, exactly as expected by the provider, i.e. kimi-latest ',
            prompt: 'Enter model name as expected by the provider (leave empty if local llama-server is used)',
            value: ''
        });
        const isKeyRequired = await Utils.showYesNoDialog("Is API key required for this endpint (" + endpoint + ")?");
        let newModel: LlmModel = {
            name: name,
            localStartCommand: localStartCommand,
            endpoint: endpoint,
            aiModel: aiModel,
            isKeyRequired: isKeyRequired
        };

        const shouldAddModel = await Utils.showYesNoDialog("You have enterd: " +
            "\nname: " + name +
            "\nlocal start command: " + localStartCommand +
            "\nendpoint: " + endpoint +
            "\nmodel name for provider: " + aiModel +
            "\napi key required: " + isKeyRequired +
            "\nDo you want to add a model with these properties?");

        if (shouldAddModel){
            modelTypeDetails.modelsList.push(newModel);
            this.app.configuration.updateConfigValue(modelTypeDetails.modelsListSettingName, modelTypeDetails.modelsList);
            vscode.window.showInformationMessage("The model is added.")
        }
    }

    public async addHuggingfaceModelToList(typeDetails: ModelTypeDetails) {
        const hostEndpoint = "http://" + typeDetails.newModelHost
        const modelPlaceholder = "<model_name>";
        const modelListToLocalCommand = new Map([ 
            ["complition_models_list", "llama-server -hf " + modelPlaceholder + " -ngl 99 -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256 --port " + typeDetails.newModelPort + " --host " + typeDetails.newModelHost],
            ["chat_models_list", 'llama-server -hf ' + modelPlaceholder + ' -ngl 99 -fa -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port ' + typeDetails.newModelPort + " --host " + typeDetails.newModelHost], 
            ["embeddings_models_list", "llama-server -hf " + modelPlaceholder + " -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port " + typeDetails.newModelPort + " --host " + typeDetails.newModelHost],  
            ["tools_models_list", "llama-server -hf " + modelPlaceholder + " --jinja  -ngl 99 -c 0 -fa -ub 1024 -b 1024 --cache-reuse 256 --port " + typeDetails.newModelPort + " --host " + typeDetails.newModelHost] ]);
        
        const searchWords = await vscode.window.showInputBox({
            placeHolder: 'keywords for searching a model from huggingface',
            prompt: 'Enter keywords to search for models in huggingface',
            value: ""
        });
        
        if (!searchWords){
              vscode.window.showInformationMessage("No huggingface model selected.")
              return;
        }
        let hfModelName = await this.getDownloadModelName(searchWords);
        if (hfModelName == "") return;
        const localStartCommand = modelListToLocalCommand.get(typeDetails.modelsListSettingName)?.replace(modelPlaceholder, hfModelName)
        
        let endpoint = hostEndpoint +":" + typeDetails.newModelPort;
        const aiModel = ""
        const isKeyRequired = false;
        let name = "hf: " + hfModelName;
        let newHfModel: LlmModel = {
            name: name,
            localStartCommand: localStartCommand,
            endpoint: endpoint,
            aiModel: aiModel,
            isKeyRequired: isKeyRequired
        };

        
        const shouldAddModel = await Utils.showYesNoDialog("You have enterd: " +
            "\nname: " + name +
            "\nlocal start command: " + localStartCommand +
            "\nendpoint: " + endpoint +
            "\nmodel name for provider: " + aiModel +
            "\napi key required: " + isKeyRequired +
            "\nDo you want to add a model with these properties?");

        if (shouldAddModel){
            typeDetails.modelsList.push(newHfModel);
            this.app.configuration.updateConfigValue(typeDetails.modelsListSettingName, typeDetails.modelsList);
            vscode.window.showInformationMessage("The model is added.")
            const shouldSelct = await Utils.showYesNoDialog("Do you want to select/start the newly added model?")
            if (shouldSelct) {
                this[typeDetails.selModelPropName as keyof Menu] = newHfModel as any
                this.activateModel(typeDetails.selModelPropName, typeDetails.killCmd, typeDetails.shellCmd);
            }
        }
    }

    private async getDownloadModelName(searchWords: string) {
        const foundModels = await this.getHfModels(searchWords ?? "");
        let hfModelName = "";
        if (foundModels && foundModels.length > 0) {
            const hfModelsQp: QuickPickItem[] = [];
            for (let hfModel of foundModels) {
                if (!hfModel.private) {
                    hfModelsQp.push({
                        label: hfModel.modelId,
                        description: "created: " + hfModel.createdAt + " | downloads: " + hfModel.downloads + " | likes: " + hfModel.likes
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
                    }
                    let selFile = await vscode.window.showQuickPick(hfModelsFilesQp);
                    if (!selFile) {
                        vscode.window.showInformationMessage("No files selected for model " + selModel.label + ".");
                        return "";
                    }
                    hfModelName = selFile?.label ?? "";

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

    private async addOrchestraToList(orchestraList: any[], settingName: string) {
        let name = "";
        while (name.trim() === "") {
            name = (await vscode.window.showInputBox({
                placeHolder: 'Enter a user fiendly name for your orchestra (required)',
                prompt: 'name for your orchestra (required)',
                value: ''
            })) ?? "";
        }

        const description = await vscode.window.showInputBox({
            placeHolder: 'description for the orchestra - what is the purpose, when to select etc. ',
            prompt: 'Enter description for the orchestra.',
            value: ''
        });
        
        let newOrchestra: Orchestra = {
            name: name,
            description: description,
            completion: this.selectedComplModel,
            chat: this.selectedChatModel,
            embeddings: this.selectedEmbeddingsModel,
            tools: this.selectedToolsModel
        };

        await this.persistOrchestraToSetting(newOrchestra, orchestraList, settingName);
    }

    private async persistOrchestraToSetting(newOrchestra: Orchestra, orchestraList: any[], settingName: string) {
        let orchestraDetails = this.getOrchestraDetailsAsString(newOrchestra);
        const shouldAddOrchestra = await Utils.showYesNoDialog("A new orchestra will be added. \n\n" +
            orchestraDetails +
            "\n\nDo you want to add the orchestra?");

        if (shouldAddOrchestra) {
            orchestraList.push(newOrchestra);
            this.app.configuration.updateConfigValue(settingName, orchestraList);
            vscode.window.showInformationMessage("The orchestra is added.");
        }
    }

    private async persistModelToSetting(newModel: Orchestra, modelList: any[], settingName: string) {
        let orchestraDetails = this.getModelDetailsAsString(newModel);
        const shouldAddModel = await Utils.showYesNoDialog("A new model will be added. \n\n" +
            orchestraDetails +
            "\n\nDo you want to add the model?");

        if (shouldAddModel) {
            modelList.push(newModel);
            this.app.configuration.updateConfigValue(settingName, modelList);
            vscode.window.showInformationMessage("The model is added.");
        }
    }

    private async importOrchestraToList(orchestraList: any[], settingName: string) {
        let name = "";
        const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Import Orchestra',
                filters: {
                    'Orchestra Files': ['orc'],
                    'All Files': ['*']
                },
            });

            if (!uris || uris.length === 0) {
                return;
            }

            const filePath = uris[0].fsPath;
            
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const newOrchestra = JSON.parse(fileContent);

        await this.persistOrchestraToSetting(newOrchestra, orchestraList, settingName);
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

        await this.persistModelToSetting(newModel, modelList, settingName);
    }

    private async deleteOrchestraFromList(orchestrasList: any[], settingName: string) {
        const orchestrasItems: QuickPickItem[] = this.getOrchestras(orchestrasList);
        const orchestra = await vscode.window.showQuickPick(orchestrasItems);
        if (orchestra) {
            let orchestralIndex = parseInt(orchestra.label.split(". ")[0], 10) - 1;
            const shoulDeleteOrchestra = await Utils.showYesNoDialog("Are you sure you want to delete the following orchestra? \n\n" 
                + this.getOrchestraDetailsAsString(orchestrasList[orchestralIndex]));
            if (shoulDeleteOrchestra) {
                orchestrasList.splice(orchestralIndex, 1);
                this.app.configuration.updateConfigValue(settingName, orchestrasList);
                vscode.window.showInformationMessage("The orchestra is deleted.")
            }
        }
    }

    private async viewOrchestraFromList(orchestrasList: any[]) {
        const orchestrasItems: QuickPickItem[] = this.getOrchestras(orchestrasList);
        let model = await vscode.window.showQuickPick(orchestrasItems);
        if (model) {
            let orchestraIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            let selectedOrchestra =  orchestrasList[orchestraIndex];
            let orchestraDetails = this.getOrchestraDetailsAsString(selectedOrchestra);
            await Utils.showOkDialog(orchestraDetails);
            
        }
    }

    private getOrchestraDetailsAsString(selectedOrchestra: any) {
        return "Orchestra details: " +
            "\nname: " + selectedOrchestra.name +
            "\ndescription: " + selectedOrchestra.description +
            "\n\ncompletion model: " +
            "\nname: " + selectedOrchestra.completion?.name +
            "\nlocal start command: " + selectedOrchestra.completion?.localStartCommand +
            "\nendpoint: " + selectedOrchestra.completion?.endpoint +
            "\nmodel name for provider: " + selectedOrchestra.completion?.aiModel +
            "\napi key required: " + selectedOrchestra.completion?.isKeyRequired +
            "\n\nchat model: " +
            "\nname: " + selectedOrchestra.chat?.name +
            "\nlocal start command: " + selectedOrchestra.chat?.localStartCommand +
            "\nendpoint: " + selectedOrchestra.chat?.endpoint +
            "\nmodel name for provider: " + selectedOrchestra.chat?.aiModel +
            "\napi key required: " + selectedOrchestra.chat?.isKeyRequired +
            "\n\nembeddings model: " +
            "\nname: " + selectedOrchestra.embeddings?.name +
            "\nlocal start command: " + selectedOrchestra.embeddings?.localStartCommand +
            "\nendpoint: " + selectedOrchestra.embeddings?.endpoint +
            "\nmodel name for provider: " + selectedOrchestra.embeddings?.aiModel +
            "\napi key required: " + selectedOrchestra.embeddings?.isKeyRequired +
            "\n\ntools model: " +
            "\nname: " + selectedOrchestra.tools?.name +
            "\nlocal start command: " + selectedOrchestra.tools?.localStartCommand +
            "\nendpoint: " + selectedOrchestra.tools?.endpoint +
            "\nmodel name for provider: " + selectedOrchestra.tools?.aiModel +
            "\napi key required: " + selectedOrchestra.tools?.isKeyRequired;
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
        return "Selected orchestra and models: " +
            "\norchestra: " + this.selectedOrchestra.name +
            "\norchestra description: " + this.selectedOrchestra.description +
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

    private async exportOrchestraFromList(orchestrasList: any[]) {
        const orchestrasItems: QuickPickItem[] = this.getOrchestras(orchestrasList);
        let model = await vscode.window.showQuickPick(orchestrasItems);
        if (model) {
            let orchestraIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            let selectedOrchestra =  orchestrasList[orchestraIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following orchestra? \n\n" +
            this.getOrchestraDetailsAsString(selectedOrchestra)
            );

            if (shouldExport){
                const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedOrchestra.name+'.orc')),
                        filters: {
                            'Orchestra Files': ['orc'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export Orchestra'
                    });

                if (!uri) {
                    return;
                }

                const jsonContent = JSON.stringify(selectedOrchestra, null, 2);
                fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                vscode.window.showInformationMessage("Orchestra is saved.")
            }
        }
    }

    private async exportModelFromList(modelsList: any[]) {
        const modelsItems: QuickPickItem[] = this.getOrchestras(modelsList);
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
    

    private async addApiKey(model: LlmModel) {
        if (model.isKeyRequired) {
            const apiKey = this.app.persistence.getApiKey(model.endpoint ?? "");
            if (!apiKey) {
                const result = await vscode.window.showInputBox({
                    placeHolder: 'Enter your api key for ' + model.endpoint,
                    prompt: 'your api key',
                    value: ''
                });
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

    private getOrchestras(orchestrasFromProperty:any[]) {
        const complOrchestrasItems: QuickPickItem[] = [];
        let i = 0
        for (let orchestra of orchestrasFromProperty) {
            i++;
            complOrchestrasItems.push({
                label: i + ". " + orchestra.name,
                description: orchestra.description,
            });
        }
        return complOrchestrasItems;
    }    

    private async handleCompletionToggle(label: string, currentLanguage: string | undefined, languageSettings: Record<string, boolean>) {
        if (label.includes(this.app.configuration.getUiText('All Completions')??"")) {
            await this.app.configuration.updateConfigValue('enabled', !this.app.configuration.enabled);
        } else if (currentLanguage && label.includes(currentLanguage)) {
            const isLanguageEnabled = languageSettings[currentLanguage] ?? true;
            languageSettings[currentLanguage] = !isLanguageEnabled;
            await this.app.configuration.updateConfigValue('languageSettings', languageSettings);
        }
    }

    private async handleRagToggle(label: string, currentLanguage: string | undefined, languageSettings: Record<string, boolean>) {
        if (label.includes("RAG")) {
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

    getOrchestra = (): Orchestra => {
        return this.selectedOrchestra;
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

    isOrchestralected = (): boolean => {
        return this.selectedOrchestra != undefined && this.selectedOrchestra.name. trim() != "";
    }

        processComplModelsActions = async (selected:vscode.QuickPickItem) => {
        let compleModelType = this.getComplTypeDetails()
        switch (selected.label) {
            case this.app.configuration.getUiText("Select/start completion model..."):  
                await this.selectStartModel(compleModelType);
                break;
            case this.app.configuration.getUiText('Add completion model...'):
                await this.addModelToList(compleModelType)
                break;
            case this.app.configuration.getUiText('Add completion model from huggingface...'):
                await this.addHuggingfaceModelToList(compleModelType);
                break;
            case this.app.configuration.getUiText('Delete completion model...'):
                await this.deleteModelFromList(this.app.configuration.complition_models_list, "complition_models_list");
                break;
            case this.app.configuration.getUiText('View completion model details...'):
                await this.viewModelFromList(this.app.configuration.complition_models_list)
                break;
            case this.app.configuration.getUiText("Deselect/stop completion model"):
                await this.deselectStopModel(this.app.llamaServer.killFimCmd, "selectedComplModel");
                break;
            case this.app.configuration.getUiText('Export completion model...'):
                await this.exportModelFromList(this.app.configuration.complition_models_list)
                break;
            case this.app.configuration.getUiText('Import completion model...'):
                await this.importModelToList(this.app.configuration.complition_models_list, "complition_models_list")
                break;
        }
    }

    processChatModelsActions = async (selected:vscode.QuickPickItem) => {
        let chatTypeDetails = this.getChatTypeDetails()
        switch (selected.label) {
            case this.app.configuration.getUiText("Select/start chat model..."):
                await this.selectStartModel(chatTypeDetails);
                break;
            case this.app.configuration.getUiText('Add chat model...')??"":
                await this.addModelToList(chatTypeDetails);
                break;
            case this.app.configuration.getUiText('Add chat model from huggingface...')??"":
                await this.addHuggingfaceModelToList(chatTypeDetails);
                break;
            case this.app.configuration.getUiText('Delete chat model...')??"":
                await this.deleteModelFromList(this.app.configuration.chat_models_list, "chat_models_list");
                break;
            case this.app.configuration.getUiText('View chat model details...')??"":
                await this.viewModelFromList(this.app.configuration.chat_models_list)
                break;
            case this.app.configuration.getUiText("Deselect/stop chat model"):
                await this.deselectStopModel(this.app.llamaServer.killChatCmd, "selectedChatModel");    
                break;
            case this.app.configuration.getUiText('Export chat model...'):
                await this.exportModelFromList(this.app.configuration.chat_models_list)
                break;
            case this.app.configuration.getUiText('Import chat model...'):
                await this.importModelToList(this.app.configuration.chat_models_list, "chat_models_list")
                break;
        }
    }

    processEmbsModelsActions = async (selected:vscode.QuickPickItem) => {
        let embsTypeDetails = this.getEmbsTypeDetails()
        switch (selected.label) {
            case this.app.configuration.getUiText("Select/start embeddings model..."):
                await this.selectStartModel(embsTypeDetails);
                break;
            case this.app.configuration.getUiText('Add embeddings model...'):
                await this.addModelToList(embsTypeDetails);
                break;
            case this.app.configuration.getUiText('Add embeddings model from huggingface...')??"":
                await this.addHuggingfaceModelToList(embsTypeDetails);
                break;
            case this.app.configuration.getUiText('Delete embeddings model...'):
                await this.deleteModelFromList(this.app.configuration.embeddings_models_list, "embeddings_models_list");
                break;
            case this.app.configuration.getUiText('View embeddings model details...'):
                await this.viewModelFromList(this.app.configuration.embeddings_models_list)
                break;
            case this.app.configuration.getUiText("Deselect/stop embeddings model"):
                await this.deselectStopModel(this.app.llamaServer.killEmbeddingsCmd, "selectedEmbeddingsModel");
                break;
            case this.app.configuration.getUiText('Export embeddings model...'):
                await this.exportModelFromList(this.app.configuration.embeddings_models_list)
                break;
            case this.app.configuration.getUiText('Import embeddings model...'):
                await this.importModelToList(this.app.configuration.embeddings_models_list, "embeddings_models_list")
                break;
        }
    }

    processToolsModelsActions = async (selected:vscode.QuickPickItem) => {
        let toolsTypeDetails = this.getToolsTypeDetails();
        switch (selected.label) {
            case this.app.configuration.getUiText("Select/start tools model..."):
                await this.selectStartModel(toolsTypeDetails);
                break;
            case this.app.configuration.getUiText('Add tools model...'):
                await this.addModelToList(toolsTypeDetails);
                break;
            case this.app.configuration.getUiText('Add tools model from huggingface...')??"":
                await this.addHuggingfaceModelToList(toolsTypeDetails);
                break;
            case this.app.configuration.getUiText('Delete tools model...'):
                await this.deleteModelFromList(this.app.configuration.tools_models_list, "tools_models_list");
                break;
            case this.app.configuration.getUiText('View tools model details...'):
                await this.viewModelFromList(this.app.configuration.tools_models_list)
                break;
            case this.app.configuration.getUiText("Deselect/stop tools model"):
                await this.deselectStopModel(this.app.llamaServer.killToolsCmd, "selectedToolsModel");
                break;
            case this.app.configuration.getUiText('Export tools model...'):
                await this.exportModelFromList(this.app.configuration.tools_models_list)
                break;
            case this.app.configuration.getUiText('Import tools model...'):
                await this.importModelToList(this.app.configuration.tools_models_list, "tools_models_list")
                break;
        }
    }

    processOrchestraActions = async (selected:vscode.QuickPickItem) => {
        switch (selected.label) {
            case this.app.configuration.getUiText("Select/start orchestra..."):
                this.selectOrchestra();
                break;
            case this.app.configuration.getUiText('Add orchestra...'):
                await this.addOrchestraToList(this.app.configuration.orchestras_list, "orchestras_list");
                break;
            case this.app.configuration.getUiText('Delete orchestra...'):
                await this.deleteOrchestraFromList(this.app.configuration.orchestras_list, "orchestras_list");
                break;
            case this.app.configuration.getUiText('View orchestra details...'):
                await this.viewOrchestraFromList(this.app.configuration.orchestras_list)
                break;
            case this.app.configuration.getUiText("Deselect/stop orchestra and models"):
                await this.stopOrchestra();
                break;
            case this.app.configuration.getUiText('Export orchestra...'):
                await this.exportOrchestraFromList(this.app.configuration.orchestras_list)
                break;
            case this.app.configuration.getUiText('Import orchestra...'):
                await this.importOrchestraToList(this.app.configuration.orchestras_list, "orchestras_list")
                break;
            case this.app.configuration.getUiText('Download/upload orchestras online'):
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggml-org/llama.vscode/discussions'));
                break;
        }
    }

    processApiKeyActions = async (selected:vscode.QuickPickItem) => {
        switch (selected.label) {
            case this.app.configuration.getUiText("Edit/delete API key..."):
                const apiKeysMap = this.app.persistence.getAllApiKeys();
                const apiKeysQuickPick = Array.from(apiKeysMap.entries()).map(([key, value]) => ({
                                            label: key,
                                            description: "..." + value.slice(-5)
                                        }));
                const selectedItem = await vscode.window.showQuickPick(apiKeysQuickPick);
                if (selectedItem) {
                    const result = await vscode.window.showInputBox({
                            placeHolder: 'Enter your new api key for ' + selectedItem.label + ". Leave empty to remove it.",
                            prompt: 'your api key',
                            value: ''
                        })
                    if (!result || result.trim() === "") this.app.persistence.deleteApiKey(selectedItem.label);
                    else this.app.persistence.setApiKey(selectedItem.label, result);
                }
                break;
            case this.app.configuration.getUiText('Add API key...')??"":
                const endpoint = await vscode.window.showInputBox({
                            placeHolder: 'Enter the endpoint, exactly as in the model',
                            prompt: 'Endpoint (url)',
                            value: ''
                        })
                const apiKey = await vscode.window.showInputBox({
                            placeHolder: 'Enter your new api key for ' + endpoint,
                            prompt: 'your api key',
                            value: ''
                        })
                if (endpoint && apiKey) 
                    {
                        this.app.persistence.setApiKey(endpoint, apiKey);
                        vscode.window.showInformationMessage("Api key is added.")
                    }
                else vscode.window.showInformationMessage("Api key is not added! Endpoint or API Key are not entered.")
                break;
        }
    }

    private async deselectStopModel(killCmd: () => void, selModelPropName: string) {
        await killCmd();
        this[selModelPropName as keyof Menu] = { name: "", localStartCommand: "" } as any;
        this.app.llamaWebviewProvider.updateModelInfo();
    }

    public async stopOrchestra() {
        await this.app.llamaServer.killFimCmd();
        this.selectedComplModel = { name: "", localStartCommand: "" };
        await this.app.llamaServer.killChatCmd();
        this.selectedChatModel = { name: "", localStartCommand: "" };
        await this.app.llamaServer.killEmbeddingsCmd();
        this.selectedEmbeddingsModel = { name: "", localStartCommand: "" };
        await this.app.llamaServer.killToolsCmd();
        this.selectedToolsModel = { name: "", localStartCommand: "" };
        this.selectedOrchestra = { name: "" };
        this.app.llamaWebviewProvider.updateModelInfo();
        vscode.window.showInformationMessage("Orchestra and models are deselected.")
    }

    getChatTypeDetails = (): ModelTypeDetails => {
        return {
            modelsList: this.app.configuration.chat_models_list,
            modelsListSettingName: "chat_models_list",
            newModelPort: this.app.configuration.new_chat_model_port,
            newModelHost: this.app.configuration.new_chat_model_host,
            selModelPropName: "selectedChatModel",
            launchSettingName: "launch_chat",
            killCmd: this.app.llamaServer.killChatCmd,
            shellCmd: this.app.llamaServer.shellChatCmd
        };
    }

    getComplTypeDetails = (): ModelTypeDetails => {
        return {
            modelsList: this.app.configuration.complition_models_list,
            modelsListSettingName: "complition_models_list",
            newModelPort: this.app.configuration.new_completion_model_port,
            newModelHost: this.app.configuration.new_completion_model_host,
            selModelPropName: "selectedComplModel",
            launchSettingName: "launch_completion",
            killCmd: this.app.llamaServer.killFimCmd,
            shellCmd: this.app.llamaServer.shellFimCmd
        };
    }

    getEmbsTypeDetails = (): ModelTypeDetails => {
        return {
            modelsList: this.app.configuration.embeddings_models_list,
            modelsListSettingName: "embeddings_models_list",
            newModelPort: this.app.configuration.new_embeddings_model_port,
            newModelHost: this.app.configuration.new_embeddings_model_host,
            selModelPropName: "selectedEmbeddingsModel",
            launchSettingName: "launch_embeddings",
            killCmd: this.app.llamaServer.killEmbeddingsCmd,
            shellCmd: this.app.llamaServer.shellEmbeddingsCmd
        };
    }

    getToolsTypeDetails = (): ModelTypeDetails => {
        return {
            modelsList: this.app.configuration.tools_models_list,
            modelsListSettingName: "tools_models_list",
            newModelPort: this.app.configuration.new_tools_model_port,
            newModelHost: this.app.configuration.new_tools_model_host,
            selModelPropName: "selectedToolsModel",
            launchSettingName: "launch_tools",
            killCmd: this.app.llamaServer.killToolsCmd,
            shellCmd: this.app.llamaServer.shellToolsCmd
        };
    }
}
