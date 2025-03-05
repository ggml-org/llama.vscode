import {Application} from "./application";
import * as vscode from 'vscode';

export class ChatWithAi {
    private app: Application
    private askAiPanel: vscode.WebviewPanel | undefined
    private askAiWithContextPanel: vscode.WebviewPanel | undefined
    private lastActiveEditor: vscode.TextEditor | undefined;
    private sentContextChunks: string[] = []

    constructor(application: Application) {
        this.app = application;
    }

    showChatWithAi = (withContext: boolean, context: vscode.ExtensionContext) => {
        const editor = vscode.window.activeTextEditor;
        let webviewIdentifier = 'htmlChatWithAiViewer'
        let panelTitle = this.app.extConfig.getUiText("Chat with AI")??""
        let aiPanel  = this.askAiPanel
        let extraCont = "";
        if (withContext){
             aiPanel = this.askAiWithContextPanel
             if (!aiPanel) this.sentContextChunks =  []
             webviewIdentifier = 'htmlChatWithAiWithContextViewer'
             let chunksToSend = this.app.extraContext.chunks.filter((_, index) => !this.sentContextChunks.includes(this.app.extraContext.chunksHash[index]));
             let chunksToSendHash = this.app.extraContext.chunksHash.filter((item) => !this.sentContextChunks.includes(item));
             if (chunksToSend.length > 0) extraCont = "Here are pieces of code from different files of the project: \n" + chunksToSend.reduce((accumulator, currentValue) => accumulator + "\nFile Name: " + currentValue.filename + "\nText:\n" +  currentValue.text + "\n\n" , "");
             this.sentContextChunks.push(...chunksToSendHash)
             panelTitle = this.app.extConfig.getUiText("Chat with AI with project context")??""
        }
        let selectedText = ""
        if (editor) {
            selectedText = editor.document.getText(editor.selection);
            if (selectedText.length > 0) selectedText = "Explain the following source code: " + selectedText
        }
        if (!aiPanel) {
            aiPanel = vscode.window.createWebviewPanel(
                webviewIdentifier,
                panelTitle,
                vscode.ViewColumn.Three, // Editor column to show the Webview
                {
                    enableScripts: true, // Allow JavaScript execution
                    retainContextWhenHidden: true,
                }
            );
            if (withContext) this.askAiWithContextPanel = aiPanel;
            else this.askAiPanel = aiPanel;

            if (aiPanel) context.subscriptions.push(aiPanel);
            const targetUrl = this.app.extConfig.endpoint_chat + "/";
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
            setTimeout(async () => {
                if (aiPanel) aiPanel.webview.postMessage({ command: 'setText', text: selectedText, context: extraCont });
            }, 1000);
        } else {
            aiPanel.reveal();
            this.lastActiveEditor = editor;
            // Wait for the page to load before sending message
            setTimeout(async () => {
                if (aiPanel) aiPanel.webview.postMessage({ command: 'setText', text: selectedText, context: extraCont });
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

}
