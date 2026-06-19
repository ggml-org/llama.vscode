import { Application } from './application';
import vscode from "vscode";
import { UI_TEXT_KEYS } from './constants';

interface DialogButton{
    label: string;
    response: string;
    default?: boolean;
}

interface DialogDetails{
    message: string;
    details: string; 
    title: string; 
    buttons: DialogButton[];
}

export class Dialogs {
    private app: Application;

    constructor(application: Application) {
        this.app = application;
    }

    showYesNoDialog = async (message: string): Promise<boolean> => {
        if (message.length < this.app.configuration.popup_max_chars) {
            const choice = await vscode.window.showInformationMessage(
                "llama-vscode \n\n" + message,
                { modal: true }, // Makes the dialog modal (blocks interaction until resolved)
                'Yes',
                'No'
            );

            return choice === 'Yes';
        }

        const dialogDetails: DialogDetails = {
            message: "",
            details: message,
            title: "Confirmation",
            buttons: [
                { label: "Yes", response: "true", default: true },
                { label: "No", response: "false" },
            ]
        }
        const [result] = await this.showCustomDialog(dialogDetails); 
        return result
    }
    
    suggestModelSelection = async (choiceMsg: string, yesMsg: string, noMsg: string, app: Application) => {
        const shouldSelectModel = await this.showUserChoiceDialog(choiceMsg, "Select");
        if (shouldSelectModel) {
            app.llamaWebviewProvider.showEnvView();
            vscode.window.showInformationMessage(yesMsg);
        } else {
            vscode.window.showErrorMessage(noMsg);
        }
    }

    showUserChoiceDialog = async (message: string, acceptLabel: string): Promise<boolean> => {        
        if (message.length < this.app.configuration.popup_max_chars) {
            const choice = await vscode.window.showInformationMessage(
                UI_TEXT_KEYS.extensionName + " \n\n" + message,
                { modal: true }, // Makes the dialog modal (blocks interaction until resolved)
                acceptLabel
            );
            return choice === acceptLabel;
        }
        
        const dialogDetails: DialogDetails = {
            message: UI_TEXT_KEYS.extensionName,
            details: message,
            title: "Confirmation",
            buttons: [
                { label: "Cancel", response: "false" },
                { label: acceptLabel, response: "true", default: true },
            ]
        }
        const [result] = await this.showCustomDialog(dialogDetails)
        return result;
    }

    showYesYesdontaskNoDialog = async (message: string): Promise<[boolean, boolean]> => {
        if (message.length < this.app.configuration.popup_max_chars) {
            const choice = await vscode.window.showInformationMessage(
                "llama-vscode \n\n" + message,
                { modal: true }, // Makes the dialog modal (blocks interaction until resolved)
                'Yes',
                "Yes, don't ask again",
                'No'
            );
            return [choice === 'Yes' || choice === "Yes, don't ask again", choice === "Yes, don't ask again"];
        }

        const dialogDetails: DialogDetails = {
            message: UI_TEXT_KEYS.extensionName,
            details: message,
            title: "Confirmation",
            buttons: [
                { label: "Yes", response: "true, false", default: true },
                { label: "Yes, don't ask again", response: "true, true" },
                { label: "No", response: "false, false" },
            ]
        }
        const result = await this.showCustomDialog(dialogDetails) as [boolean, boolean];        
        return result;
    }

    showYesNoNodontAskDialog = async (message: string, acceptLabel: string): Promise<[boolean, boolean]> => {
        if (message.length < this.app.configuration.popup_max_chars) {
            const choice = await vscode.window.showInformationMessage(
                "llama-vscode \n\n" + message,
                { modal: true }, // Makes the dialog modal (blocks interaction until resolved)
                acceptLabel,
                'No',
                "No, don't ask again"            
            );

            return [choice === acceptLabel, choice === "No, don't ask again"];
        }

        const dialogDetails: DialogDetails = {
            message: UI_TEXT_KEYS.extensionName,
            details: message,
            title: "Confirmation",
            buttons: [
                { label: acceptLabel, response: "true, false", default: true },
                { label: "No", response: "false, false" },
                { label: "No, don't ask again", response: "false, true" },
            ]
        }
        const result = await this.showCustomDialog(dialogDetails) as [boolean, boolean];        
        return result;
    }

    showOkDialog = async (message: string) => {
        if (message.length < this.app.configuration.popup_max_chars) {
            const choice = await vscode.window.showInformationMessage(
                "llama-vscode \n\n" + message,
                { modal: true },
                'OK'
            );
            return;
        }
        
        const dialogDetails: DialogDetails = {
            message: "",
            details: message,
            title: "Information",
            buttons: [
                { label: "OK", response: "true", default: true },
            ]
        }
        return this.showCustomDialog(dialogDetails);
    }

    showCustomDialog = (dialogDetails: DialogDetails): Promise<[boolean] | [boolean, boolean]> => {
        return new Promise((resolve) => {
            const panel = vscode.window.createWebviewPanel(
                'customDialog',
                dialogDetails.title,
                { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
                { enableScripts: true }
            );

            // Generate buttons dynamically from dialogDetails.buttons array
            const buttonsHtml = dialogDetails.buttons.map((button, index) => {
                const buttonClass = button.default ? 'button' : 'button secondary';
                return `<button id="btn${index + 1}" class="${buttonClass}" onclick="respond([${button.response}])">${button.label}</button>`;
            }).join('');

            panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                * {
                    box-sizing: border-box;
                }
                body {
                    font-family: var(--vscode-font-family);
                    margin: 0;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .container {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    flex: 1;
                    min-height: 0;
                }
                .message {
                    flex: 0 0 auto;
                    padding: 12px;
                    border-radius: 4px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    font-size: 13px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .details {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    background: var(--vscode-editor-background);
                }
                .details-header {
                    padding: 8px 12px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    font-weight: bold;
                    font-size: 12px;
                    color: var(--vscode-editor-foreground);
                    background: var(--vscode-sideBar-background);
                    flex: 0 0 auto;
                }
                .details-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 12px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    line-height: 1.4;
                }
                .details-content::-webkit-scrollbar {
                    width: 10px;
                }
                .details-content::-webkit-scrollbar-track {
                    background: var(--vscode-scrollbarSlider-background);
                }
                .details-content::-webkit-scrollbar-thumb {
                    background: var(--vscode-scrollbarSlider-hoverBackground);
                    border-radius: 4px;
                }
                .buttons {
                    display: flex;
                    gap: 8px;
                    margin-top: 12px;
                    justify-content: flex-end;
                    flex: 0 0 auto;
                }
                .button {
                    padding: 6px 16px;
                    border: none;
                    border-radius: 2px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    cursor: pointer;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    font-weight: 500;
                }
                .button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .button.secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .button.secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="message">${dialogDetails.message.replace(/\n/g, '<br>')}</div>
                    <div class="details">
                        <div class="details-header">${dialogDetails.title}</div>
                        <div class="details-content">${dialogDetails.details.replace(/\n/g, '<br>').replace(/: /g, ': ')}</div>
                    </div>
                </div>
                <div class="buttons">
                    ${buttonsHtml}
                </div>
                <script>
                const vscode = acquireVsCodeApi();
                function respond(answer) {
                    vscode.postMessage({ command: 'answer', value: answer });
                }

                // Focus the default button when the webview loads
                window.addEventListener('load', () => {
                    const defaultButton = document.querySelector('.button:not(.secondary)') || document.getElementById('btn1');
                    if (defaultButton) {
                        // Small delay to ensure proper focus
                        setTimeout(() => {
                            defaultButton.focus();
                        }, 120);
                    }
                });
                </script>
            </body>
            </html>
            `;

            panel.webview.onDidReceiveMessage((message) => {
                if (message.command === 'answer') {
                    resolve(message.value);
                    panel.dispose();
                }
            });
            
            // Try to focus the panel after a short delay
            setTimeout(() => {
                panel.reveal(vscode.ViewColumn.One, false);
            }, 100);
        });
    }

    async confirmAction(message: string, details: string = ""): Promise<boolean> {
        if (message.length + details.length < this.app.configuration.popup_max_chars) 
        {       
            const fullMessage = message + (details ? "\n\n" + details : "");
            return this.showYesNoDialog(fullMessage);
        }
        
        const dialogDetails: DialogDetails = {
            message,
            details,
            title: "Confirmation",
            buttons: [
                { label: "Yes", response: "true", default: true },
                { label: "No", response: "false" }
            ]
        }
        const [result] = await this.showCustomDialog(dialogDetails) as [boolean];
        return result;
    }
}
