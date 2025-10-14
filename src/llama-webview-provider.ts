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

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly app: Application,
        private readonly context: vscode.ExtensionContext
    ) { }

    public get webview(): vscode.WebviewView | undefined {
        return this._webview;
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
                switch (message.command) {
                    case 'sendText':
                        this.app.llamaAgent.run(message.text);
                        break;
                    case 'sendAgentCommand':
                        this.app.llamaAgent.run(message.text, message.agentCommand);
                        break;
                    case 'clearText':
                        this.app.llamaAgent.resetMessages();
                        this.app.llamaAgent.resetContextProjectFiles()
                        await this.app.chatService.selectUpdateChat({name:"", id:""})
                        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
                            command: 'updateText',
                            text: ''
                        });
                        break;
                    case 'showChatsHistory':
                        this.app.chatService.selectChatFromList();
                        break;
                    case 'configureTools':
                        await this.app.tools.selectTools()
                        break;
                    case 'configureEditTools':
                        const selectedTools = await this.app.agentService.selectTools(message.tools)
                        this.app.agentService.resetEditedAgentTools();
                        selectedTools.map(toolName => this.app.agentService.addEditedAgentTools(toolName,""))
                        let selAgentTools = this.app.agentService.getEditedAgentTools();
                        webviewView.webview.postMessage({
                            command: 'updateAgentTools',
                            files: Array.from(selAgentTools.entries())
                        });
                        break;
                    case 'stopSession':
                        this.app.llamaAgent.stopAgent();
                        break;
                    case 'selectModelWithTools':
                        await this.app.modelService.selectAndSetModel(ModelType.Tools, this.app.configuration.tools_models_list);
                        break;
                    case 'selectModelForChat':
                        await this.app.modelService.selectAndSetModel(ModelType.Chat, this.app.configuration.chat_models_list);
                        break;
                    case 'selectModelForEmbeddings':
                        await this.app.modelService.selectAndSetModel(ModelType.Embeddings, this.app.configuration.embeddings_models_list);
                        break;
                    case 'selectModelForCompletion':
                        await this.app.modelService.selectAndSetModel(ModelType.Completion, this.app.configuration.completion_models_list);
                        break;
                    case 'deselectCompletionModel':
                        await this.app.modelService.deselectAndClearModel(ModelType.Completion);
                        break;
                    case 'moreCompletionModel':
                        await this.app.modelService.processModelActions(ModelType.Completion);
                        break;
                    case 'moreChatModel':
                        await this.app.modelService.processModelActions(ModelType.Chat);
                        break;
                    case 'moreEmbeddingsModel':
                        await this.app.modelService.processModelActions(ModelType.Embeddings);
                        break;
                    case 'moreToolsModel':
                        await this.app.modelService.processModelActions(ModelType.Tools);
                        break;
                    case 'moreAgent':
                        await this.app.agentService.processActions();
                        break;
                    case 'deselectChatModel':
                        await this.app.modelService.deselectAndClearModel(ModelType.Chat);
                        break;
                    case 'deselectEmbsModel':
                        await this.app.modelService.deselectAndClearModel(ModelType.Embeddings);
                        break;
                    case 'deselectToolsModel':
                        await this.app.modelService.deselectAndClearModel(ModelType.Tools);
                        break;
                    case 'deselectAgent':
                        await this.app.agentService.deselectAgent();
                        break;
                    case 'selectEditAgent':
                        await this.app.agentService.editAgent(this.app.configuration.agents_list)
                        break;
                    case 'showCompletionModel':
                        this.app.modelService.showModelDetails(this.app.getComplModel());
                        break;
                    case 'showChatModel':
                       this.app.modelService.showModelDetails(this.app.getChatModel());
                        break;
                    case 'showEmbsModel':
                        this.app.modelService.showModelDetails(this.app.getEmbeddingsModel());
                        break;
                    case 'showToolsModel':
                        this.app.modelService.showModelDetails(this.app.getToolsModel());
                        break;
                    case 'showAgentDetails':
                        this.app.agentService.showAgentDetails(this.app.getAgent())
                        break;
                    case 'selectAgent':
                        let agentsList = this.app.configuration.agents_list
                        await this.app.agentService.pickAndSelectAgent(agentsList)
                        break;
                    case 'chatWithAI':
                        this.app.askAi.closeChatWithAi(false);
                        this.app.askAi.showChatWithAi(false, this.context);
                        break;
                    case 'installLlamacpp':
                        this.app.menu.installLlamacpp();
                        break;
                    case 'addHuggingfaceModel':
                        await this.app.modelService.addModel(ModelType.Chat, "hf");
                        break;
                    case 'selectEnv':
                        await this.app.envService.selectEnv(this.app.configuration.envs_list, true);    
                        break;
                    case 'stopEnv':
                        await this.app.envService.stopEnv();    
                        break;
                    case 'showEnvView':
                        this.showEnvView();
                        break;
                    case 'showAgentView':
                        this.showAgentView();
                        break;
                    case 'showAgentEditor':
                        this.showAgentEditor();
                        break;
                    case 'showSelectedModels':
                        await this.app.envService.showCurrentEnv();    
                        break;
                    case 'getFileList':
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
                        break;
                    case 'getAgentCommands':
                        let agentCommands =     this.app.configuration.agent_commands.map(cmd => cmd.name +  " | " + cmd.description)
                        webviewView.webview.postMessage({
                            command: 'updateFileList',
                            files: agentCommands
                        });
                        break;
                    case 'getAgentTools':
                        let agentTools = this.app.tools.getTools().map(tool => tool.function.name +  " | " + tool.function.description)
                        webviewView.webview.postMessage({
                            command: 'updateFileList',
                            files: agentTools
                        });
                        break;
                    case 'addContextProjectFile':
                        let fileNames = message.fileLongName.split("|");
                        this.app.llamaAgent.addContextProjectFile(fileNames[1].trim(),fileNames[0].trim());
                        const contextFiles = this.app.llamaAgent.getContextProjectFiles();
                        webviewView.webview.postMessage({
                            command: 'updateContextFiles',
                            files: Array.from(contextFiles.entries())
                        });
                        break;
                    case 'removeContextProjectFile':
                        this.app.llamaAgent.removeContextProjectFile(message.fileLongName);
                        const updatedContextFiles = this.app.llamaAgent.getContextProjectFiles();
                        webviewView.webview.postMessage({
                            command: 'updateContextFiles',
                            files: Array.from(updatedContextFiles.entries())
                        });
                        break;
                    case 'addEditedAgentTool':
                        let toolsNames = message.fileLongName.split("|");
                        this.app.agentService.addEditedAgentTools(toolsNames[0].trim(),toolsNames[1].trim());
                        const editedAgentTools = this.app.agentService.getEditedAgentTools();
                        webviewView.webview.postMessage({
                            command: 'updateAgentTools',
                            files: Array.from(editedAgentTools.entries())
                        });
                        break;
                    case 'removeEditedAgentTool':
                        this.app.agentService.removeEditedAgentTools(message.fileLongName);
                        const updatedTools = this.app.agentService.getEditedAgentTools();
                        webviewView.webview.postMessage({
                            command: 'updateAgentTools',
                            files: Array.from(updatedTools.entries())
                        });
                        break;
                    case 'saveEditAgent':
                        if (!message.name) {
                            vscode.window.showErrorMessage("Agent should have a name!")
                            return;
                        }
                        let agentToSave: Agent = {
                            name: message.name, 
                            description: message.description,
                            systemInstruction: message.systemInstruction.split(/\r?\n/),
                            tools: message.tools
                        } 
                        await this.app.agentService.addUpdateAgent(agentToSave)
                        break;
                    case 'refreshEditedAgentTool':
                        const refreshedTols = this.app.agentService.getEditedAgentTools();
                        webviewView.webview.postMessage({
                            command: 'updateAgentTools',
                            files: Array.from(refreshedTols.entries())
                        });
                        break;
                    case 'editSelectedAgent':
                        const selectedAgent = this.app.getAgent()
                        this.addEditAgent(selectedAgent);
                        break
                    case 'addEditAgent':
                        const newAgent: Agent = {
                            name: message.name, 
                            description: message.description,
                            systemInstruction: message.systemInstruction, 
                            tools: message.tools
                        }
                        this.addEditAgent(newAgent);
                        break
                    case 'copyAsNewAgent':
                        this.app.agentService.copyAgent()
                        break;
                    case 'deleteAgent':
                        this.app.agentService.deleteAgent()
                        break;
                    case 'openContextFile':
                        const uri = vscode.Uri.file(message.fileLongName);
                        const document = await vscode.workspace.openTextDocument(uri);
                        await vscode.window.showTextDocument(document);
                        break;
                    case 'addEnv':
                        this.app.envService.addEnv(this.app.configuration.envs_list, SETTING_NAME_FOR_LIST.ENVS)
                        break;
                    case 'toggleCompletionsEnabled':
                        this.app.configuration.updateConfigValue("enabled", message.enabled)
                        break;
                    case 'toggleRagEnabled':
                        this.app.configuration.updateConfigValue("rag_enabled", message.enabled)
                        break;
                    case 'toggleAutoStartEnv':
                        this.app.configuration.updateConfigValue("env_start_last_used", message.enabled)
                        break;
                    case 'getVscodeSetting':
                        const settingValue = this.app.configuration[message.key as keyof Configuration];
                        this.updateSettingInEnvView(message.key, settingValue);
                        break;
                }
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

    public addEditAgent(agent: Agent) {
        this.app.agentService.resetEditedAgentTools();
        agent.tools?.map(tool => this.app.agentService.addEditedAgentTools(tool, ""));
        const edAgtools = this.app.agentService.getEditedAgentTools();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'loadAgent',
            name: agent?.name,
            description: agent?.description,
            systemInstruction: agent?.systemInstruction.join("\n"),
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
    }

    private updateEmbsModel() {
        const currentEmbeddingsModel: LlmModel = this.app.getEmbeddingsModel();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateEmbeddingsModel',
            model: currentEmbeddingsModel.name || 'No model selected'
        });
    }

    private updateChatModel() {
        const currentChatModel: LlmModel = this.app.getChatModel();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateChatModel',
            model: currentChatModel.name || 'No model selected'
        });
    }

    private updateToolsModel() {
        const currentToolsModel: LlmModel = this.app.getToolsModel();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateToolsModel',
            model: currentToolsModel.name || 'No model selected'
        });
    }

    private updateComplsModel() {
        const currentToolsModel: LlmModel = this.app.getComplModel();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateCompletionModel',
            model: currentToolsModel.name || 'No model selected'
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

    public async showAgentView() {
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

    public showEnvView() {
        vscode.commands.executeCommand('extension.showLlamaWebview');
        setTimeout(() => this.setView("addenv"), 500);
    } 

    public showAgentEditor() {
        vscode.commands.executeCommand('extension.showLlamaWebview');
        setTimeout(() => this.setView("agenteditor"), 400);
    } 

    public updateLlamaView() {
        this.updateToolsModel();
        this.updateChatModel();
        this.updateEmbsModel();
        this.updateComplsModel();
        this.updateAgent();
        this.updateEnv();
        this.updateSettingsInView();
        this.logInUi(this.app.llamaAgent.getAgentLogText())
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