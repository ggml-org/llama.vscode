import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Application } from './application';
import { LlmModel, Env } from './types';
import { Utils } from './utils';

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
                    case 'clearText':
                        this.app.llamaAgent.resetMessages();
                        this.app.llamaAgent.resetContextProjectFiles()
                        await this.app.menu.selectUpdateChat({name:"", id:""})
                        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
                            command: 'updateText',
                            text: ''
                        });
                        break;
                    case 'showChatsHistory':
                        this.app.menu.selectChatFromList();
                        break;
                    case 'configureTools':
                        await this.app.tools.selectTools()
                        break;
                    case 'stopSession':
                        this.app.llamaAgent.stopAgent();
                        break;
                    case 'selectModelWithTools':
                        let toolsTypeDetails = this.app.menu.getToolsTypeDetails();
                        await this.app.menu.selectStartModel(toolsTypeDetails);
                        break;
                    case 'selectModelForChat':
                        let chatTypeDetails = this.app.menu.getChatTypeDetails();
                        await this.app.menu.selectStartModel(chatTypeDetails);
                        break;
                    case 'selectModelForEmbeddings':
                        let embsTypeDetails = this.app.menu.getEmbsTypeDetails()
                        await this.app.menu.selectStartModel(embsTypeDetails);
                        break;
                    case 'selectModelForCompletion':
                        let complTypeDetails = this.app.menu.getComplTypeDetails()
                        await this.app.menu.selectStartModel(complTypeDetails);    
                        break
                    case 'chatWithAI':
                        this.app.askAi.closeChatWithAi(false);
                        this.app.askAi.showChatWithAi(false, this.context);
                        break;
                    case 'installLlamacpp':
                        this.app.menu.installLlamacpp();
                        break;
                    case 'addHuggingfaceModel':
                        let chatTypeDetailsHf = this.app.menu.getChatTypeDetails();
                        await this.app.menu.addHuggingfaceModelToList(chatTypeDetailsHf);
                        break;
                    case 'selectEnv':
                        await this.app.menu.selectEnvFromList(this.app.configuration.envs_list.filter(item => item.tools != undefined && item.tools.name));    
                        break;
                    case 'stopEnv':
                        await this.app.menu.stopEnv();    
                        break;
                    case 'showSelectedModels':
                        await this.app.menu.showCurrentEnv();    
                        break;
                    case 'getFileList':
                        const fileKeys = this.app.chatContext.getProjectFiles();
                        webviewView.webview.postMessage({
                            command: 'updateFileList',
                            files: fileKeys
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
                    case 'openContextFile':
                        const uri = vscode.Uri.file(message.fileLongName);
                        const document = await vscode.workspace.openTextDocument(uri);
                        await vscode.window.showTextDocument(document);
                        break;
                    case 'addEnv':
                        this.app.menu.addEnvToList(this.app.configuration.envs_list, "envs_list")
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

    private updateEmbsModel() {
        const currentEmbeddingsModel: LlmModel = this.app.menu.getEmbeddingsModel();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateEmbeddingsModel',
            model: currentEmbeddingsModel.name || 'No model selected'
        });
    }

    private updateChatModel() {
        const currentChatModel: LlmModel = this.app.menu.getChatModel();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateChatModel',
            model: currentChatModel.name || 'No model selected'
        });
    }

    private updateToolsModel() {
        const currentToolsModel: LlmModel = this.app.menu.getToolsModel();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateToolsModel',
            model: currentToolsModel.name || 'No model selected'
        });
    }

    private updateComplsModel() {
        const currentToolsModel: LlmModel = this.app.menu.getComplModel();
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateCompletionModel',
            model: currentToolsModel.name || 'No model selected'
        });
    }

    private updateEnv() {
        const currentEnv: Env = this.app.menu.getEnv();
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

    public updateLlamaView() {
        this.updateToolsModel();
        this.updateChatModel();
        this.updateEmbsModel();
        this.updateComplsModel();
        this.updateEnv();
        // TODO update with the selected agent
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