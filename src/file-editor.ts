import * as vscode from 'vscode';
import { Application } from './application';
import { Utils } from './utils';
import { LlamaChatResponse } from './types';

export class FileEditor {
    private app: Application;

    constructor(application: Application) {
        this.app = application;
    }

    async showEditAllSearchFilesPrompt(editor: vscode.TextEditor) {
        // Resolve chat or tools model endpoint
        let chatUrl = this.app.configuration.endpoint_chat;
        if (!chatUrl) chatUrl = this.app.configuration.endpoint_tools;
        let chatModel = this.app.getChatModel();
        if (!this.app.isChatModelSelected()) chatModel = this.app.getToolsModel();
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint);
            chatUrl = chatEndpoint ? chatEndpoint + '/' : '';
        }
        if (!chatUrl) {
            await Utils.suggestModelSelection(
                'Select a chat or tools model or an env with chat or tools model to edit files with AI.',
                'After the chat model is loaded, try again editing files with AI.',
                'No endpoint for the chat model. Select an env with chat model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat.',
                this.app
            );
            return;
        }

        const prompt = await vscode.window.showInputBox({
            placeHolder: 'Enter instructions for editing files...',
            prompt: 'How would you like to modify the files?',
            ignoreFocusOut: true
        });
        if (!prompt) return;

        const glob = await vscode.window.showInputBox({
            placeHolder: '**/*',
            prompt: 'Enter glob pattern of files to edit (e.g., src/**/*.ts)',
            ignoreFocusOut: true
        });
        if (!glob) return;

        const files = await vscode.workspace.findFiles(glob);
        if (!files || files.length === 0) {
            vscode.window.showInformationMessage('No files matched the glob pattern.');
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'llama.vscode is editing files with AI',
                cancellable: true
            },
            async (progress, token) => {
                const total = files.length;
                let processed = 0;
                for (const file of files) {
                    if (token.isCancellationRequested) {
                        vscode.window.showInformationMessage(`File editing cancelled after ${processed} of ${total} files.`);
                        break;
                    }
                    progress.report({ message: `Editing ${file.fsPath}`, increment: (1 / total) * 100 });

                    try {
                        const originalBuffer = await vscode.workspace.fs.readFile(file);
                        const originalText = Buffer.from(originalBuffer).toString('utf8');

                        const completion = await this.app.llamaServer.getChatEditCompletion(
                            prompt,
                            originalText,
                            '',
                            this.app.extraContext.chunks,
                            0
                        );

                        if (completion?.choices?.[0]?.message?.content) {
                            var edited = completion.choices[0].message.content.trim();
                            edited = this.removeFirstAndLastLinesIfBackticks(edited);
                            await vscode.workspace.fs.writeFile(file, Buffer.from(edited, 'utf8'));
                        }
                    } catch (err) {
                        console.error(`Failed to edit ${file.fsPath}:`, err);
                    }
                    processed++;
                }
                if (!token.isCancellationRequested) {
                    vscode.window.showInformationMessage(`Edited ${processed} of ${total} files.`);
                }
            }
        );
    }

    private removeFirstAndLastLinesIfBackticks(input: string): string {
        const lines = input.split('\n'); // Split the string into lines

        // Remove the first line if it starts with ```
        if (lines[0]?.trim().startsWith('```')) {
            lines.shift(); // Remove the first line
        }

        // Remove the last line if it starts with ```
        if (lines[lines.length - 1]?.trim().startsWith('```')) {
            lines.pop(); // Remove the last line
        }

        return lines.join('\n'); // Join the remaining lines back into a string
    }
}
