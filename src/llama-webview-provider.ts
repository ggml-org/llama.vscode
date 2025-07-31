import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Application } from './application';

export class LlamaWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'llama-vscode.webview';
    private _webview: vscode.WebviewView | undefined;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly app: Application
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
                        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
                            command: 'updateText',
                            text: ''
                        });
                        break;
                    case 'configureTools':
                        await this.app.tools.selectTools()
                        break;
                    case 'stopSession':
                        this.app.llamaAgent.stopAgent();
                        break;
                    case 'selectModelWithTools':
                        await this.app.menu.selectAiWithToolsModel();
                        // Send updated tools model after selection
                        const currentToolsModel = this.app.menu.getToolsModel();
                        webviewView.webview.postMessage({
                            command: 'updateToolsModel',
                            model: currentToolsModel || 'No model selected'
                        });
                        break;                        
                }
            }
        );

        // Send initial welcome message when webview is ready
        setTimeout(() => {
            webviewView.webview.postMessage({
                command: 'updateText',
                text: 'Welcome to llama AI with tools'
            });
            
            // Send current tools model
            const currentToolsModel = this.app.menu.getToolsModel();
            webviewView.webview.postMessage({
                command: 'updateToolsModel',
                model: currentToolsModel || 'No model selected'
            });
        }, 1000);
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