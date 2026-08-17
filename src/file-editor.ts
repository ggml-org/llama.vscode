import * as vscode from 'vscode';
import { Application } from './application';
import { Utils } from './utils';
import { ModelType, PERSISTENCE_KEYS } from './constants';

export class FileEditor {
    private app: Application;
    private context = "";

    constructor(application: Application) {
        this.app = application;
    }

    private escapeWebviewAttr(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;');
    }

    /**
     * Multiline instructions + glob pattern (webview); resolves undefined if cancelled or closed.
     */
    private showMultilineEditPrompt = (): Promise<{ prompt: string; glob: string } | undefined> => {
        const title =
            this.app.configuration.getUiText('How would you like to modify the files?') ??
            'How would you like to modify the files?';
        const promptPlaceholder =
            this.app.configuration.getUiText('Enter your instructions for editing the files...') ??
            'Enter your instructions for editing the files...';
        const globLabel =
            this.app.configuration.getUiText('Glob pattern of files to edit<br>examples:<br>/* - all files,<br>src/*.ts - all files in folder src with extension .ts,<br>src//.ts - like previous one, but recursively include all subfolders') ??
            'Glob pattern of files to edit <br>examples: <br>**/* - all files, <br>src/*.ts - all files in folder src with extension .ts, <br>src/**/*.ts - like previous one, but recursively include all subfolders';
        const globPlaceholder = '**/*';
        const submitLabel = this.app.configuration.getUiText('Submit') ?? 'Submit';
        const submitContextLabel = this.app.configuration.getUiText('Submit with .md files context') ?? 'Submit with .md files context';
        const cancelLabel = this.app.configuration.getUiText('Cancel') ?? 'Cancel';
        const emptyHint =
            this.app.configuration.getUiText('Please enter editing instructions.') ??
            'Please enter editing instructions.';

        return new Promise((resolve) => {
            let settled = false;
            const panel = vscode.window.createWebviewPanel(
                'editWithAiFileMultilinePrompt',
                title,
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
                { enableScripts: true }
            );

            const finish = (value: { prompt: string; glob: string } | undefined) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(value);
                panel.dispose();
            };

            const cspSource = panel.webview.cspSource;
            panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'unsafe-inline' ${cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            box-sizing: border-box;
            margin: 0;
            padding: 12px;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: auto;
        }
        .field {
            margin-bottom: 8px;
            display: flex;
            flex-direction: column;
        }
        .field textarea {
            flex: 1;
            min-height: 200px;
            resize: vertical;
            padding: 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.5;
        }
        label {
            margin-bottom: 6px;
            font-weight: 600;
            font-size: var(--vscode-font-size);
            white-space: nowrap;
            display: block;
        }
        .glob-field {
            flex-shrink: 0;
        }
        .actions {
            flex-shrink: 0;
            margin-top: 8px;
        }
        textarea:focus {
            outline: 2px solid var(--vscode-focusBorder);
        }
        input[type="text"] {
            padding: 8px 10px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        input[type="text"]:focus {
            outline: 2px solid var(--vscode-focusBorder);
        }

        /* DOM order is Submit then Cancel (Tab: textarea -> glob -> Submit -> Cancel); flex order keeps Cancel left, Submit right. */
        .actions .secondary {
            order: 1;
        }
        .actions .primary {
            order: 2;
        }
        button {
            padding: 6px 14px;
            border: none;
            cursor: pointer;
            font-size: var(--vscode-font-size);
        }
        .primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="field">
        <label for="prompt">${this.escapeWebviewAttr(title)}</label>
        <textarea id="prompt" placeholder="${this.escapeWebviewAttr(promptPlaceholder)}" autofocus></textarea>
    </div>
    <div class="field glob-field">
        <label for="glob">${globLabel}</label>
        <input type="text" id="glob" value="${this.escapeWebviewAttr(globPlaceholder)}" />
    </div>
    <div class="actions">
        <button type="button" class="primary" id="submit">${this.escapeWebviewAttr(submitLabel)}</button>
        <button type="button" class="primary" id="submitContext" title="Adds to the context the content of the following files: \n- file from property agent_rules or if empty the file llama-vscode-rules.md (if available) from project root\n- files (if available) from prject root: AGENTS.md, USER.md, SOUL.md">${this.escapeWebviewAttr(submitContextLabel)}</button>
        <button type="button" class="secondary" id="cancel">${this.escapeWebviewAttr(cancelLabel)}</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const ta = document.getElementById('prompt');
        const globInput = document.getElementById('glob');
        function focusPrompt() {
            if (!ta) {
                return;
            }
            ta.focus();
            const len = ta.value.length;
            ta.setSelectionRange(len, len);
        }
        window.addEventListener('load', focusPrompt);
        requestAnimationFrame(focusPrompt);
        setTimeout(focusPrompt, 0);
        setTimeout(focusPrompt, 100);
        window.addEventListener('message', (event) => {
            const data = event.data;
            if (data && data.command === 'focusPrompt') {
                focusPrompt();
            }
        });
        document.getElementById('submit').addEventListener('click', () => {
            vscode.postMessage({ command: 'submit', text: ta.value, glob: globInput.value });
        });
        document.getElementById('submitContext').addEventListener('click', () => {
            vscode.postMessage({ command: 'submitContext', text: ta.value, glob: globInput.value });
        });
        document.getElementById('cancel').addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
    </script>
</body>
</html>`;

            const requestPromptFocus = () => {
                void panel.webview.postMessage({ command: 'focusPrompt' });
            };
            panel.onDidChangeViewState((e) => {
                if (e.webviewPanel.visible) {
                    requestPromptFocus();
                }
            });
            requestPromptFocus();
            setTimeout(requestPromptFocus, 50);
            setTimeout(requestPromptFocus, 200);

            panel.webview.onDidReceiveMessage((message) => {
                if (message.command === 'submit') {
                    const text = typeof message.text === 'string' ? message.text : '';
                    const glob = typeof message.glob === 'string' ? message.glob : '**/*';
                    if (!text.trim()) {
                        void vscode.window.showInformationMessage(emptyHint);
                        return;
                    }
                    finish({ prompt: text, glob });
                } else if (message.command === 'submitContext') {
                    const text = typeof message.text === 'string' ? message.text : '';
                    const glob = typeof message.glob === 'string' ? message.glob : '**/*';
                    if (!text.trim()) {
                        void vscode.window.showInformationMessage(emptyHint);
                        return;
                    }
                    this.context = this.app.llamaAgent.getMdFilesContext();
                    finish({ prompt: text, glob });
                } else if (message.command === 'cancel') {
                    finish(undefined);
                }
            });

            panel.onDidDispose(() => {
                if (!settled) {
                    settled = true;
                    resolve(undefined);
                }
            });
        });
    }

    async showEditAllSearchFilesPrompt() {
        // Resolve chat or tools model endpoint
        let chatUrl = this.app.configuration.endpoint_chat;
        if (!chatUrl) chatUrl = this.app.configuration.endpoint_tools;
        let chatModel = this.app.getChatModel();
        if (!this.app.isChatModelSelected()) chatModel = this.app.getToolsModel();
        if (!chatModel.endpoint) {
            await this.app.modelService.selectDefaultModel(ModelType.Chat, PERSISTENCE_KEYS.DEFAULT_CHAT_MODEL);
            chatModel = this.app.getChatModel();
        }
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint);
            chatUrl = chatEndpoint ? chatEndpoint + '/' : '';
        }
        if (!chatUrl) {
            await this.app.dialogs.suggestModelSelection(
                'Select a chat or tools model or an env with chat or tools model to edit files with AI.',
                'After the chat model is loaded, try again editing files with AI.',
                'No endpoint for the chat model. Select an env with chat model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat.',
                this.app
            );
            return;
        }

        this.context = "";
        const result = await this.showMultilineEditPrompt();

        if (!result) {
            return;
        }

        const prompt = result.prompt;
        const glob = result.glob;

        let shouldContinue = await this.app.dialogs.showYesNoDialog(
            "You requested an edit of multiple files with AI. " + 
            "\n\nGlob pattern (what files to edit): " + glob +
            "\nPrompt: " + prompt +
            "\n\nDo you want to continue?")
        if (!shouldContinue) return;

        const files = await vscode.workspace.findFiles(glob);
        console.log('Total files to edit:', files.length);
        this.app.statusbar.showTextInfo('Editing files...');
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
                    if (this.app.chatContext.isImageOrVideoFile(file.fsPath)) continue
                    progress.report({ message: `Editing ${processed+1} of ${total}: ${file.fsPath}`, increment: (1 / total) * 100 });

                    try {
                        const originalBuffer = await vscode.workspace.fs.readFile(file);
                        const originalText = Buffer.from(originalBuffer).toString('utf8');

                        const completion = await this.app.llamaServer.getChatEditCompletion(
                            prompt,
                            originalText,
                            this.context,
                            this.app.extraContext.chunks,
                            0
                        );

                        if (completion?.choices?.[0]?.message?.content) {
                            var edited = completion.choices[0].message.content.trim();
                            edited = Utils.removeFirstAndLastLinesIfBackticks(edited);
                            await vscode.workspace.fs.writeFile(file, Buffer.from(edited, 'utf8'));
                            if (this.app.configuration.rag_enabled) {
                                const document = await vscode.workspace.openTextDocument(file);
                                this.app.chatContext.udpateFileIndexing(document.uri.fsPath, document.getText())
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to edit ${file.fsPath}:`, err);
                    }
                    processed++;
                }
                if (!token.isCancellationRequested) {
                    vscode.window.showInformationMessage(`Edited ${processed} of ${total} files.`);
                    this.app.statusbar.showTextInfo(`Edited ${processed} of ${total}`);
                }
                this.app.statusbar.showTextInfo(``)
            }
        );
    }
}
