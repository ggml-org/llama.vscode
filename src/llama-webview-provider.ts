import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Application } from './application';
import { LlmModel, Env, Agent, ContextCustom } from './types';
import { Configuration } from './configuration';
import { Plugin } from './plugin';
import { Utils } from './utils';
import { ModelType, SETTING_NAME_FOR_LIST } from './constants';

export class LlamaWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'llama-vscode.webview';
    private _webview: vscode.WebviewView | undefined;
    private commandHandlers: Map<string, (message: any, webviewView: vscode.WebviewView) => Promise<void>>;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly app: Application,
        private readonly context: vscode.ExtensionContext
    ) { 
        this.commandHandlers = new Map([
                    ["sendText", this.sendText],
                    ["sendInSessionText", this.sendInSessionText],
                    ["sendAgentCommand", this.sendAgentCommand],
                    ["clearText", this.clearText],
                    ["showChatsHistory", this.showChatsHistory],
                    ["configureTools", this.configureTools],
                    ["configureEditTools", this.configureEditTools],
                    ["stopSession", this.stopSession],
                    ["selectModelWithTools", this.selectModelWithTools],
                    ["selectModelForChat", this.selectModelForChat],
                    ["selectModelForEmbeddings", this.selectModelForEmbeddings],
                    ["selectModelForCompletion", this.selectModelForCompletion],
                    ["deselectCompletionModel", this.deselectCompletionModel],
                    ["moreCompletionModel", this.moreCompletionModel],
                    ["checkModelHealth", this.checkModelHealth],
                    ["selectAgentModel", this.selectAgentModel],
                    ["moreChatModel", this.moreChatModel],
                    ["moreEmbeddingsModel", this.moreEmbeddingsModel],
                    ["moreToolsModel", this.moreToolsModel],
                    ["moreAgent", this.moreAgent],
                    ["deselectChatModel", this.deselectChatModel],
                    ["deselectEmbsModel", this.deselectEmbsModel],
                    ["deselectToolsModel", this.deselectToolsModel],
                    ["deselectAgentModel   ", this.deselectAgentModel   ],
                    ["deselectAgent", this.deselectAgent],
                    ["selectEditAgent", this.selectEditAgent],
                    ["showCompletionModel", this.showCompletionModel],
                    ["showChatModel", this.showChatModel],
                    ["showEmbsModel", this.showEmbsModel],
                    ["showToolsModel", this.showToolsModel],
                    ["showAgentDetails", this.showAgentDetails],
                    ["selectAgent", this.selectAgent],
                    ["chatWithAI ", this.chatWithAI ],
                    ["installLlamacpp", this.installLlamacpp],
                    ["addHuggingfaceModel", this.addHuggingfaceModel],
                    ["selectEnv", this.selectEnv],
                    ["stopEnv", this.stopEnv],
                    ["showEnvView", this.showEnvView],
                    ["showAgentView", this.showAgentView],
                    ["showAgentEditor", this.showAgentEditor],
                    ["showSelectedModels", this.showSelectedModels],
                    ["getFileList", this.getFileList],
                    ["getAgentCommands", this.getAgentCommands],
                    ["getAgentTools", this.getAgentTools],
                    ["addContextProjectFile", this.addContextProjectFile],
                    ["removeContextProjectFile", this.removeContextProjectFile],
                    ["selectImageFile", this.selectImageFile],
                    ["addContextProjectImage", this.addContextProjectImage],
                    ["removeContextProjectImage", this.removeContextProjectImage],
                    ["addEditedAgentTool", this.addEditedAgentTool],
                    ["removeEditedAgentTool", this.removeEditedAgentTool],
                    ["saveEditAgent", this.saveEditAgent],
                    ["refreshEditedAgentTool", this.refreshEditedAgentTool],
                    ["editSelectedAgent", this.editSelectedAgent],
                    ["addEditAgent", this.addEditAgent],
                    ["copyAsNewAgent", this.copyAsNewAgent],
                    ["deleteAgent", this.deleteAgent],
                    ["openContextFile", this.openContextFile          ],
                    ["addEnv", this.addEnv],
                    ["toggleCompletionsEnabled", this.toggleCompletionsEnabled],
                    ["toggleRagEnabled", this.toggleRagEnabled],
                    ["toggleAutoStartEnv", this.toggleAutoStartEnv],
                    ["getVscodeSetting ", this.getVscodeSetting ],
                    ["deleteCurrentChat", this.deleteCurrentChat]
                ]);
    }

    public get webview(): vscode.WebviewView | undefined {
        return this._webview;
    }

    configureEditTools = async (message: any, webviewView: vscode.WebviewView) => {
        const selectedTools = await this.app.agentService.selectTools(message.tools)
        this.app.agentService.resetEditedAgentTools();
        selectedTools.map(toolName => this.app.agentService.addEditedAgentTools(toolName,""))
        const selAgentTools = this.app.agentService.getEditedAgentTools();
        webviewView.webview.postMessage({
            command: 'updateAgentTools',
            files: Array.from(selAgentTools.entries())
        });
    }

    stopSession = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.llamaAgent.stopAgent()
    }

    configureTools = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.tools.selectTools()
    }

    showChatsHistory = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.chatService.selectChatFromList()
    }

    clearText = async (message: any, webviewView: vscode.WebviewView) => {
        await this.clearChatText(webviewView)
    }

    sendAgentCommand = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.llamaAgent.run(message.text, message.agentCommand)
    }

    sendInSessionText = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.llamaAgent.setInSessionText(message.text)
    }

    sendText = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.llamaAgent.run(message.text)
    }

    selectModelWithTools = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.selectAndSetModel(ModelType.Tools, this.app.configuration.tools_models_list);
    }
    
    selectModelForChat = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.selectAndSetModel(ModelType.Chat, this.app.configuration.chat_models_list);
    }
    
    selectModelForEmbeddings = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.selectAndSetModel(ModelType.Embeddings, this.app.configuration.embeddings_models_list);
    }
    
    selectModelForCompletion = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.selectAndSetModel(ModelType.Completion, this.app.configuration.completion_models_list);
    }
    
    deselectCompletionModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.deselectAndClearModel(ModelType.Completion);
    }
    
    moreCompletionModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.processModelActions(ModelType.Completion);
    }
    
    checkModelHealth = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.checkModelHealth(message.model);
    }
    
    selectAgentModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.selectAgentModel(ModelType.Tools, this.app.configuration.tools_models_list);                        
    }
    
    moreChatModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.processModelActions(ModelType.Chat);
    }
    
    moreEmbeddingsModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.processModelActions(ModelType.Embeddings);
    }
    
    moreToolsModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.processModelActions(ModelType.Tools);
    }
    
    moreAgent = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.agentService.processActions();
    }
    
    deselectChatModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.deselectAndClearModel(ModelType.Chat);
    }
    
    deselectEmbsModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.deselectAndClearModel(ModelType.Embeddings);
    }
    
    deselectToolsModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.deselectAndClearModel(ModelType.Tools);
    }
    
    deselectAgentModel = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.setAgentModel(undefined);
        this.updateLlamaView();
    }
                    
    deselectAgent = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.agentService.deselectAgent();
    }
    
    selectEditAgent = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.agentService.editAgent(this.app.configuration.agents_list)
    }
    
    showCompletionModel = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.modelService.showModelDetails(this.app.getComplModel());
    }
    
    showChatModel = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.modelService.showModelDetails(this.app.getChatModel());
    }
    
    showEmbsModel = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.modelService.showModelDetails(this.app.getEmbeddingsModel());
    }
    
    showToolsModel = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.modelService.showModelDetails(this.app.getToolsModel());
    }
    
    showAgentDetails = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.agentService.showAgentDetails(this.app.getAgent())
    }
    
    selectAgent = async (message: any, webviewView: vscode.WebviewView) => {
        let agentsList = this.app.configuration.agents_list
        let shouldContinue = await this.app.dialogs.showYesNoDialog("This will remove the current conversation. Do you want to continue?")
        if (shouldContinue) {
            await this.app.agentService.pickAndSelectAgent(agentsList)
            await this.clearChatText(webviewView);
        }
    }
         
    chatWithAI = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.askAi.closeChatWithAi(false);
        this.app.askAi.showChatWithAi(false, this.context);
    }
                    
    installLlamacpp = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.menu.installLlamacpp();
    }
    
    addHuggingfaceModel = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.modelService.addModel(ModelType.Chat, "hf");
    }
    
    selectEnv = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.envService.selectEnv(this.app.configuration.envs_list, true);    
    }

    stopEnv = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.envService.stopEnv();    
    }
    
    showEnvView = async (message: any, webviewView: vscode.WebviewView) => {
        this.showEnvViewInUi();
    }

    
    
    showAgentView = async (message: any, webviewView: vscode.WebviewView) => {
        this.showAgentViewInUi();
    }
    
    showAgentEditor = async (message: any, webviewView: vscode.WebviewView) => {
        this.showAgentEditorInUi();
    }
    
    showSelectedModels = async (message: any, webviewView: vscode.WebviewView) => {
        await this.app.envService.showCurrentEnv();    
    }
    
    getFileList = async (message: any, webviewView: vscode.WebviewView) => {
        let fileKeys: string[]
        let contextCustom = this.app.configuration.context_custom as ContextCustom
        if (contextCustom && contextCustom.get_list) {
            if (fs.existsSync(contextCustom.get_list)) {
                let toolFunction = await Utils.getFunctionFromFile(contextCustom.get_list);
                fileKeys = toolFunction()
            } else fileKeys = (await Plugin.execute(contextCustom.get_list as keyof typeof Plugin.methods)) as string[];
        } else {
            fileKeys = await this.app.chatContext.getProjectFiles();
        }
        webviewView.webview.postMessage({
            command: 'updateFileList',
            files: fileKeys
        });
    }
    
    getAgentCommands = async (message: any, webviewView: vscode.WebviewView) => {
        let agentCommands =     this.app.configuration.agent_commands.map(cmd => cmd.name +  " | " + cmd.description)
        webviewView.webview.postMessage({
            command: 'updateFileList',
            files: agentCommands
        });
    }
           
    getAgentTools = async (message: any, webviewView: vscode.WebviewView) => {
        let agentTools = this.app.tools.getTools().map(tool => tool.function.name +  " | " + tool.function.description)
        webviewView.webview.postMessage({
            command: 'updateFileList',
            files: agentTools
        });
    }
     
    addContextProjectFile = async (message: any, webviewView: vscode.WebviewView) => {
        let fileNames = message.fileLongName.split("|");
        this.app.llamaAgent.addContextProjectFile(fileNames[1].trim(),fileNames[0].trim());
        const contextFiles = this.app.llamaAgent.getContextProjectFiles();
        webviewView.webview.postMessage({
            command: 'updateContextFiles',
            files: Array.from(contextFiles.entries())
        });
    }
        
    removeContextProjectFile = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.llamaAgent.removeContextProjectFile(message.fileLongName);
        const updatedContextFiles = this.app.llamaAgent.getContextProjectFiles();
        webviewView.webview.postMessage({
            command: 'updateContextFiles',
            files: Array.from(updatedContextFiles.entries())
        });
    }
     
    selectImageFile = async (message: any, webviewView: vscode.WebviewView) => {
        var selImgPath = await this.app.llamaAgent.selectImageFile();
        this.app.llamaAgent.addContextProjectImage(selImgPath)
        webviewView.webview.postMessage({
            command: 'updateContextImage',
            image: selImgPath
        });
    }
     
    addContextProjectImage = async (message: any, webviewView: vscode.WebviewView) => {
        let imagePath = message.image;
        this.app.llamaAgent.addContextProjectImage(imagePath);
        const contextImage = this.app.llamaAgent.getContextProjecImage();
        webviewView.webview.postMessage({
            command: 'updateContextImage',
            image: contextImage
        });
    }
     
    removeContextProjectImage = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.llamaAgent.removeContextProjectImage();
        webviewView.webview.postMessage({
            command: 'updateContextImage',
            files: ""
        });
    }
     
    addEditedAgentTool = async (message: any, webviewView: vscode.WebviewView) => {
        let toolsNames = message.fileLongName.split("|");
        this.app.agentService.addEditedAgentTools(toolsNames[0].trim(),toolsNames[1].trim());
        const editedAgentTools = this.app.agentService.getEditedAgentTools();
        webviewView.webview.postMessage({
            command: 'updateAgentTools',
            files: Array.from(editedAgentTools.entries())
        });
    }
     
    removeEditedAgentTool = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.agentService.removeEditedAgentTools(message.fileLongName);
        const updatedTools = this.app.agentService.getEditedAgentTools();
        webviewView.webview.postMessage({
            command: 'updateAgentTools',
            files: Array.from(updatedTools.entries())
        });
    }
 
    saveEditAgent = async (message: any, webviewView: vscode.WebviewView) => {
        if (!message.name) {
            vscode.window.showErrorMessage("Agent should have a name!")
            return;
        }
        let agentModelToSave: LlmModel | undefined = undefined
        if (message.toolsModel) agentModelToSave = this.app.getTmpAgentModel();
        let agentToSave: Agent = {
            name: message.name, 
            description: message.description,
            subagentEnabled: message.subagentEnabled,
            systemInstruction: message.systemInstruction.split(/\r?\n/),
            toolsModel: agentModelToSave,
            tools: message.tools
        } 
        await this.app.agentService.addUpdateAgent(agentToSave)
    }
     
    refreshEditedAgentTool = async (message: any, webviewView: vscode.WebviewView) => {
        const refreshedTols = this.app.agentService.getEditedAgentTools();
        webviewView.webview.postMessage({
            command: 'updateAgentTools',
            files: Array.from(refreshedTols.entries())
        });
    }
     
    editSelectedAgent = async (message: any, webviewView: vscode.WebviewView) => {
        const selectedAgent = this.app.getAgent()
        this.addEditAgnt(selectedAgent);
    }
                    
    addEditAgent = async (message: any, webviewView: vscode.WebviewView) => {
        let toolsModel = Application.emptyModel
        if (message.toolsModel) toolsModel = this.app.getTmpAgentModel();
        const newAgent: Agent = {
            name: message.name, 
            description: message.description,
            subagentEnabled: message.subagentEnabled,
            systemInstruction: message.systemInstruction, 
            toolsModel: toolsModel,
            tools: message.tools
        }
        this.addEditAgnt(newAgent);
    }
     
    copyAsNewAgent = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.agentService.copyAgent()
    }
    
    deleteAgent = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.agentService.deleteAgent()
    }
    
    openContextFile = async (message: any, webviewView: vscode.WebviewView) => {
        const uri = vscode.Uri.file(message.fileLongName);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
    }
                    
    addEnv = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.envService.addEnv(this.app.configuration.envs_list, SETTING_NAME_FOR_LIST.ENVS)
    }
    
    toggleCompletionsEnabled = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.configuration.updateConfigValue("enabled", message.enabled)
    }
    
    toggleRagEnabled = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.configuration.updateConfigValue("rag_enabled", message.enabled)
    }
    
    toggleAutoStartEnv = async (message: any, webviewView: vscode.WebviewView) => {
        this.app.configuration.updateConfigValue("env_start_last_used", message.enabled)
    }
        
    getVscodeSetting = async (message: any, webviewView: vscode.WebviewView) => {
        const settingValue = this.app.configuration[message.key as keyof Configuration];
        this.updateSettingInEnvView(message.key, settingValue);
    }
                    
    deleteCurrentChat = async (message: any, webviewView: vscode.WebviewView) => {
        try {
            await this.app.chatService.deleteCurrentChat();
            console.log('Chat deleted successfully');
            await this.clearChatText(webviewView);
        } catch (error) {
            console.error('Error deleting chat:', error);
            vscode.window.showErrorMessage('Error deleting chat: ' + (error instanceof Error ? error.message : String(error)));
        }
    }


    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._webview = webviewView;
        
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.file(path.join(this._extensionUri.fsPath, 'ui', 'dist'))
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                

                console.log('Webview received message:', message);
                console.log('Message command:', message.command);

                const handler = this.commandHandlers.get(message.command);
                if (handler) {
                    return await handler(message, webviewView);
                } else {
                    console.log('Unknown command:', message.command);
                }
                    // case 'sendText':
                    //     this.app.llamaAgent.run(message.text);
                    //     break;
                    // case 'sendInSessionText':
                    //     this.app.llamaAgent.setInSessionText(message.text)
                    //     break;
                    // case 'sendAgentCommand':
                    //     this.app.llamaAgent.run(message.text, message.agentCommand);
                    //     break;
                    // case 'clearText':
                    //     await this.clearChatText(webviewView);
                    //     break;
                    // case 'showChatsHistory':
                    //     this.app.chatService.selectChatFromList();
                    //     break;
                    // case 'configureTools':
                    //     await this.app.tools.selectTools()
                    //     break;
                    // case 'configureEditTools':
                    //     const selectedTools = await this.app.agentService.selectTools(message.tools)
                    //     this.app.agentService.resetEditedAgentTools();
                    //     selectedTools.map(toolName => this.app.agentService.addEditedAgentTools(toolName,""))
                    //     let selAgentTools = this.app.agentService.getEditedAgentTools();
                    //     webviewView.webview.postMessage({
                    //         command: 'updateAgentTools',
                    //         files: Array.from(selAgentTools.entries())
                    //     });
                    //     break;
                    // case 'stopSession':
                    //     this.app.llamaAgent.stopAgent();
                    //     break;
                    
                //     default:
                //         console.log('Unknown command:', message.command);
                // }
            }
        );

        // Send initial welcome message when webview is ready
        setTimeout(() => {
            webviewView.webview.postMessage({
                command: 'updateText',
                text: 'Welcome to Llama Agent'
            });
            
            this.updateLlamaView();

            // Send initial context files
            const contextFiles = this.app.llamaAgent.getContextProjectFiles();
            webviewView.webview.postMessage({
                command: 'updateContextFiles',
                files: Array.from(contextFiles.entries())
            });
        }, 1000);
    }    

    private async clearChatText(webviewView: vscode.WebviewView) {
        this.app.llamaAgent.resetMessages();
        this.app.llamaAgent.resetContext();
        await this.app.chatService.selectUpdateChat({ name: "", id: "" });
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateText',
            text: ''
        });
        webviewView.webview.postMessage({
            command: 'updateContextImage',
            image: ""
        });
    }

    public addEditAgnt(agent: Agent) {
        this.app.agentService.resetEditedAgentTools();
        agent.tools?.map(tool => this.app.agentService.addEditedAgentTools(tool, ""));
        const edAgtools = this.app.agentService.getEditedAgentTools();
        this.app.setAgentModel(agent.toolsModel);
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'loadAgent',
            name: agent?.name,
            description: agent?.description,
            subagentEnabled: agent?.subagentEnabled,
            systemInstruction: agent?.systemInstruction.join("\n"),
            toolsModel: agent?.toolsModel?.name??'',
            tools: Array.from(edAgtools.entries())
        });
    }

    private updateSettingInEnvView(key: string, settingValue: any) {
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'vscodeSettingValue',
            key: key,
            value: settingValue
        });
    }

    private updateSettingsInView(){
        this.updateSettingInEnvView('enabled', this.app.configuration.enabled);
        this.updateSettingInEnvView('rag_enabled', this.app.configuration.rag_enabled);
        this.updateSettingInEnvView('env_start_last_used', this.app.configuration.env_start_last_used);
        this.updateSettingInEnvView('health_check_compl_enabled', this.app.configuration.health_check_compl_enabled);
        this.updateSettingInEnvView('health_check_chat_enabled', this.app.configuration.health_check_chat_enabled);
        this.updateSettingInEnvView('health_check_embs_enabled', this.app.configuration.health_check_embs_enabled);
        this.updateSettingInEnvView('health_check_tools_enabled', this.app.configuration.health_check_tools_enabled);
    }

    private updateEmbsModel(status: string = "") {
        const currentEmbeddingsModel: LlmModel = this.app.getEmbeddingsModel();
        let modelName = currentEmbeddingsModel.name
        if (this.app.configuration.health_check_embs_enabled  && status && status.toLowerCase() != "ok")
            modelName += ": " + status;
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateEmbeddingsModel',
            model: modelName || 'No model selected'
        });
    }

    private updateChatModel(status: string = "") {
        const currentChatModel: LlmModel = this.app.getModel(ModelType.Chat);
        let modelName = currentChatModel.name
        if (this.app.configuration.health_check_chat_enabled  && status && status.toLowerCase() != "ok")
            modelName += ": " + status;
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateChatModel',
            model: modelName || 'No model selected'
        });
    }

    private updateToolsModel(status: string = "") {
        const currentToolsModel: LlmModel = this.app.getModel(ModelType.Tools);
        let modelName = currentToolsModel.name
        if (this.app.configuration.health_check_tools_enabled  && status && status.toLowerCase() != "ok")
            modelName += ": " + status;
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateToolsModel',
            model: modelName || 'No model selected'
        });
    }

    private updateTmpAgentModel() {
        const currentTmpAgentModel: LlmModel = this.app.getTmpAgentModel();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateTmpAgentModel',
            model: currentTmpAgentModel.name || ''
        });
    }

    public updateComplsModel(status: string = "") {
        const currentComplModel: LlmModel = this.app.getModel(ModelType.Completion);
        let modelName = currentComplModel.name
        if (this.app.configuration.health_check_compl_enabled  && status && status.toLowerCase() != "ok")
            modelName += ": " + status;
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateCompletionModel',
            model: modelName || 'No model selected'
        });
    }

    private updateAgent() {
        const currentAgent: Agent = this.app.getAgent();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateAgent',
            agent: currentAgent.name || 'No agent selected'
        });
    }

    private updateEnv() {
        const currentEnv: Env = this.app.getEnv();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateEnv',
            model: currentEnv.name || 'No env selected'
        });
    }

    public logInUi(logText: string) {
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateText',
            text: logText
        });
    }

    public setState(stateText: string) {
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateCurrentState',
            text: stateText
        });
    }

    public setView(view: string) {
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateView',
            text: view
        });
    }

    public set(view: string) {
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateView',
            text: view
        });
    }

    public showEnvViewInUi() {
        vscode.commands.executeCommand('extension.showLlamaWebview');
        setTimeout(() => this.setView("addenv"), 500);
    }

    public async showAgentViewInUi() {
        let isModelAvailable = await this.app.modelService.checkForToolsModel();
        if (isModelAvailable) {
            vscode.commands.executeCommand('extension.showLlamaWebview');
            this.updateLlamaView();
            setTimeout(() => {
                if (this.webview) {
                    this.webview.webview.postMessage({
                        command: 'focusTextarea'
                    });
                }
            }, 100);
        }
    }

     

    public showAgentEditorInUi() {
        vscode.commands.executeCommand('extension.showLlamaWebview');
        setTimeout(() => this.setView("agenteditor"), 400);
    } 

    public updateLlamaView() {
        this.updateModels();
        this.updateTmpAgentModel();
        this.updateAgent();
        this.updateEnv();
        this.updateSettingsInView();
        this.logInUi(this.app.llamaAgent.getAgentLogText())
    }

    public updateModels() {
        this.updateToolsModel(this.app.getModelState(ModelType.Tools));
        this.updateChatModel(this.app.getModelState(ModelType.Chat));
        this.updateEmbsModel(this.app.getModelState(ModelType.Embeddings));
        this.updateComplsModel(this.app.getModelState(ModelType.Completion));
    }

    public updateContextFilesInfo() {
        const fileKeys = this.app.chatContext.getProjectFiles();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateContextFiles',
            files: []
        });
    }

    public _getHtmlForWebview(webview: vscode.Webview) {
        // Get the path to the built React app
        const uiPath = path.join(this._extensionUri.fsPath, 'ui', 'dist');
        const indexPath = path.join(uiPath, 'index.html');
        
        // Check if the React app is built
        if (!fs.existsSync(indexPath)) {
            return this._getErrorHtml('React app not built. Please run "npm run build" in the ui folder.');
        }

        // Read the built HTML file
        let html = fs.readFileSync(indexPath, 'utf8');
        
        // Update resource paths to use webview.asWebviewUri with proper security
        const bundleUri = webview.asWebviewUri(vscode.Uri.file(path.join(uiPath, 'bundle.js')));
        
        // Replace the bundle.js reference with the secure URI
        html = html.replace(/src="bundle\.js"/g, `src="${bundleUri}"`);
        
        return html;
    }

    private _getErrorHtml(message: string): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .error {
                    background-color: #d73a49;
                    color: white;
                    padding: 16px;
                    border-radius: 4px;
                    margin: 20px 0;
                }
                .instructions {
                    background-color: var(--vscode-input-background);
                    padding: 16px;
                    border-radius: 4px;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <h1>Llama VS Code UI</h1>
            <div class="error">
                <strong>Error:</strong> ${message}
            </div>
            <div class="instructions">
                <h3>To fix this:</h3>
                <ol>
                    <li>Open a terminal in the <code>ui</code> folder</li>
                    <li>Run <code>npm install</code></li>
                    <li>Run <code>npm run build</code></li>
                    <li>Reload the VS Code window</li>
                </ol>
            </div>
        </body>
        </html>`;
    }
} 