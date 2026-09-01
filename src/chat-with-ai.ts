import {Application} from "./application";
import * as vscode from 'vscode';
import { Utils } from "./utils";
import { ModelType, PERSISTENCE_KEYS } from "./constants";


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

    showChatWithAi = async (withContext: boolean, context: vscode.ExtensionContext, aiInitialExtraContext: string="") => {
        const editor = vscode.window.activeTextEditor;
        let webviewIdentifier = 'htmlChatWithAiViewer'
        let panelTitle = this.app.configuration.getUiText("Chat with AI")??""
        let aiPanel  = this.askAiPanel
        let extraCont = aiInitialExtraContext ? aiInitialExtraContext + "\n\n" : "";
        let query: string|undefined = undefined
        let targetUrl = this.app.configuration.endpoint_chat 
                        ? this.app.configuration.endpoint_chat + "/" 
                        : this.app.configuration.endpoint_tools ? this.app.configuration.endpoint_tools + "/" : "";

        let chatModel = this.app.getChatModel();
        if (!this.app.isChatModelSelected() && !this.app.configuration.endpoint_chat) chatModel = this.app.getToolsModel();    
        if (!chatModel.endpoint) {
            await this.app.modelService.selectDefaultModel(ModelType.Chat, PERSISTENCE_KEYS.DEFAULT_CHAT_MODEL);
            chatModel = this.app.getChatModel();
        }
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint)
            targetUrl = chatEndpoint ? chatEndpoint + "/" : "";
        }
        
        if (!targetUrl) {
            await this.app.dialogs.suggestModelSelection(
                "Select a chat or tools model run by llama serve or an env with chat or tools model run on llama serve to chat with AI.",
                "After the chat/tools model is loaded, try again opening Chat with AI.",
                "No endpoint for the chat or tools model. Select a chat or tools model run on llama serve or an env with chat or tools model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat. ",
                this.app
            );
            return
        }

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
            
            aiPanel.webview.html = this.getWebviewContent(targetUrl);
            aiPanel.onDidDispose(() => {
                if (withContext) this.askAiWithContextPanel = undefined
                else this.askAiPanel = undefined
            });
            aiPanel.webview.onDidReceiveMessage((message) => {
                if (message.command === 'escapePressed') {
                    this.focusEditor();
                } else if (message.command === 'openInBrowser') {
                    vscode.env.openExternal(vscode.Uri.parse(targetUrl));
                } else if (message.command === 'jsAction') {
                    // console.log("onDidReceiveMessage: " + message.text);
                }
            });
        } else {
            aiPanel.reveal();
            this.lastActiveEditor = editor;
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
            <meta 
                http-equiv="Content-Security-Policy" 
                content="default-src 'self' https: http: data: blob: 'unsafe-inline' 'unsafe-eval';
                        connect-src 'self' https: http: ws: wss:;
                        frame-src 'self' https: http:;">
            <title>llama.cpp server UI</title>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                }
                #openInBrowserLink {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-editor-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                #openInBrowserLink:hover {
                    background-color: var(--vscode-panel-border);
                    transform: translateY(-1px);
                }
                iframe {
                    width: 100%;
                    height: calc(100% - 40px);
                    border: none;
                }
            </style>
        </head>
        <body>
            <button id="openInBrowserLink" title="Shows the AI chat in browser (where the copy buttons work)">Show in Browser</button>
            
            <iframe src="${url}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" id="askAiIframe"></iframe>
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    console.log('[chat-with-ai] Script loaded, vscode acquired:', typeof vscode);
                    
                    window.addEventListener('DOMContentLoaded', function() {
                        var button = document.getElementById('openInBrowserLink');
                        
                        if (button) {
                            button.addEventListener('click', function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                    vscode.postMessage({command: 'openInBrowser'});
                                } catch (err) {
                                    console.error('[chat-with-ai] Exception sending message:', err);
                                }
                            });
                        }
                    });
                })();
            </script>
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
