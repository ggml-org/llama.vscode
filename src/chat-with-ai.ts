import {Application} from "./application";
import * as vscode from 'vscode';
import { Utils } from "./utils";


export class ChatWithAi {
    private app: Application
    private askAiPanel: vscode.WebviewPanel | undefined
    private askAiWithContextPanel: vscode.WebviewPanel | undefined
    private lastActiveEditor: vscode.TextEditor | undefined;
    private sentContextChunks: string[] = [];   

    constructor(application: Application) {
        this.app = application;
        
    }

    showChatWithTools = async (context: vscode.ExtensionContext) => {
        let query: string|undefined = undefined
        query = await vscode.window.showInputBox({
            placeHolder: this.app.configuration.getUiText('Enter your question...'),
            prompt: this.app.configuration.getUiText('What would you like to ask an Agent (AI with tools)?'),
            ignoreFocusOut: true
        });

        if (!query) {
            return
        } else {        
            this.app.llamaAgent.run(query)
        }
    }

    closeChatWithAi = (withContext: boolean) => {
        if (withContext){
            if (this.askAiWithContextPanel ) {
                this.askAiWithContextPanel.dispose()
                this.askAiWithContextPanel = undefined;
            }
        } else {
            if (this.askAiPanel) {
                this.askAiPanel.dispose()
                this.askAiPanel = undefined;
            }
        }
    }

    showChatWithAi = async (withContext: boolean, context: vscode.ExtensionContext) => {
        const editor = vscode.window.activeTextEditor;
        let webviewIdentifier = 'htmlChatWithAiViewer'
        let panelTitle = this.app.configuration.getUiText("Chat with AI")??""
        let aiPanel  = this.askAiPanel
        let extraCont = "";
        let query: string|undefined = undefined
        if (withContext){
            if (!this.app.configuration.rag_enabled){
                vscode.window.showInformationMessage(this.app.configuration.getUiText("RAG is disabled. You could enable it from VS Code menu or setting rag_enabled.")??"")
                return;
            }
            query = await vscode.window.showInputBox({
                placeHolder: this.app.configuration.getUiText('Enter your question...'),
                prompt: this.app.configuration.getUiText('What would you like to ask AI?'),
                ignoreFocusOut: true
            });

            if (!query) {
                return
            }

            aiPanel = this.askAiWithContextPanel
            if (!aiPanel) this.sentContextChunks =  []
            webviewIdentifier = 'htmlChatWithAiWithContextViewer'
            panelTitle = this.app.configuration.getUiText("Chat with AI with project context")??""
        }
        let queryToSend = ""
        if (editor) {
            queryToSend = editor.document.getText(editor.selection);
            if (queryToSend.length > 0) queryToSend = "Explain the following source code: " + queryToSend
        }
        if (query) {
            queryToSend = query
        }
        if (!aiPanel) {
            const createWebviewTimeInMs = Date.now()
            aiPanel = vscode.window.createWebviewPanel(
                webviewIdentifier,
                panelTitle,
                vscode.ViewColumn.Three, // Editor column to show the Webview
                {
                    enableScripts: true, // Allow JavaScript execution
                    retainContextWhenHidden: true,
                }
            );
            this.lastActiveEditor = editor;
            if (withContext) this.askAiWithContextPanel = aiPanel;
            else this.askAiPanel = aiPanel;

            if (aiPanel) context.subscriptions.push(aiPanel);
            let chatModel = this.app.menu.getChatModel();
            let targetUrl = this.app.configuration.endpoint_chat + "/";
            if (chatModel.endpoint) targetUrl = Utils.trimTrailingSlash(chatModel.endpoint) + "/";
            aiPanel.webview.html = this.getWebviewContent(targetUrl);
            aiPanel.onDidDispose(() => {
                if (withContext) this.askAiWithContextPanel = undefined
                else this.askAiPanel = undefined
            });
            aiPanel.webview.onDidReceiveMessage((message) => {
                if (message.command === 'escapePressed') {
                    this.focusEditor();
                } else if (message.command === 'jsAction') {
                    // console.log("onDidReceiveMessage: " + message.text);
                }
            });
            // Wait for the page to load before sending message
            if (query) extraCont = await this.prepareRagContext(query);
            setTimeout(async () => {
                if (aiPanel) aiPanel.webview.postMessage({ command: 'setText', text: queryToSend, context: extraCont });
            }, Math.max(0, 3000 - (Date.now() - createWebviewTimeInMs)));
        } else {
            aiPanel.reveal();
            this.lastActiveEditor = editor;
            if (query) extraCont = await this.prepareRagContext(query);
            // Wait for the page to load before sending message
            setTimeout(async () => {
                if (aiPanel) aiPanel.webview.postMessage({ command: 'setText', text: queryToSend, context: extraCont });
            }, 500);
        }
    }

    focusEditor = () => {
        if (this.lastActiveEditor) {
            vscode.window.showTextDocument(this.lastActiveEditor.document, this.lastActiveEditor.viewColumn, false);
        }
    }

    getWebviewContent = (url: string): string => {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>llama.cpp server UI</title>
            <script>
                // Initialize the VS Code API
                const vscode = acquireVsCodeApi();
                vscode.postMessage({ command: 'jsAction', text: 'vscode javascript object created' });

                // Listen for messages from the extension
                window.addEventListener('message', (event) => {
                    vscode.postMessage({ command: 'jsAction', text: 'message received' });

                    const { command, text, context } = event.data; // Extract the command and text from the event
                    if (command === 'setText') {
                        vscode.postMessage({ command: 'jsAction', text: 'command setText received' });

                        const iframe = document.getElementById('askAiIframe');
                        if (iframe) {
                            vscode.postMessage({ command: 'jsAction', text: 'askAiIframe obtained' });
                            iframe.contentWindow.postMessage({ command: 'setText', text: text, context: context }, '*');
                            vscode.postMessage({ command: 'jsAction', text: text });
                        }
                    }
                    if (command === 'escapePressed') {
                        vscode.postMessage({ command: 'jsAction', text: 'command escape pressed' });
                        vscode.postMessage({ command: 'escapePressed' });
                    }
                    if (command === 'jsAction') {
                        vscode.postMessage({ command: 'jsAction', text: text });
                    }
                });

                // Listen for key events in the iframe
                window.addEventListener('keydown', (event) => {
                    vscode.postMessage({ command: 'jsAction', text: 'keydown event received' });
                    if (event.key === 'Escape') {
                        // Send a message to the extension when Escape is pressed
                        vscode.postMessage({ command: 'escapePressed', text: "" });
                        vscode.postMessage({ command: 'jsAction', text: "Escabe key pressed..." });
                    }
                });
            </script>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                }
                iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
            </style>
        </head>
        <body>
            <iframe src="${url}" id="askAiIframe"></iframe>
        </body>
        </html>
        `;
    }

    private prepareRagContext = async (query: string) => {
        let extraCont: string = ""
        const contextChunks = await this.app.chatContext.getRagContextChunks(query);
        let chunksToSend = contextChunks.filter((_, index) => !this.sentContextChunks.includes(contextChunks[index].hash));
        let chunksToSendHash = chunksToSend.map(chunk => chunk.hash);
        if (chunksToSend.length > 0) extraCont = this.app.chatContext.getContextChunksInPlainText(chunksToSend);
        this.sentContextChunks.push(...chunksToSendHash);

        const contextFiles = await this.app.chatContext.getRagFilesContext(query);
        if (contextFiles && contextFiles.length > 0) extraCont += "\n" + contextFiles;

        return extraCont
    }
}
