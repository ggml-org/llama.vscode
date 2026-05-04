import * as vscode from 'vscode';
import { Application } from './application';
import { Utils } from './utils';
import { LlamaChatResponse } from "./types";
import { Chat } from 'openai/resources';

export class TextEditor {
    private app: Application;
    private decorationTypes: vscode.TextEditorDecorationType[] = [];
    private inputBox: vscode.TextEditor | undefined;
    private selectedText: string = '';
    private removedSpaces: number = 0;
    private selection: vscode.Selection | undefined;
    private currentSuggestion: string | undefined;
    private currentEditor: vscode.TextEditor | undefined;
    private tempDoc: vscode.TextDocument | undefined;
    private registration: vscode.Disposable | undefined;
    private suggestionUri: vscode.Uri = vscode.Uri.parse("");
    private diffTitle = 'Text Edit Suggestion';

    constructor(application: Application) {
        this.app = application;
    }

    private setSuggestionVisible(visible: boolean) {
        vscode.commands.executeCommand('setContext', 'textEditSuggestionVisible', visible);
    }

    private escapeWebviewAttr(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;');
    }

    /**
     * Multiline instructions (webview); resolves undefined if cancelled or closed.
     */
    private showMultilineEditPrompt(): Promise<string | undefined> {
        const title =
            this.app.configuration.getUiText('How would you like to modify the selected text?') ??
            'How would you like to modify the selected text?';
        const placeholder =
            this.app.configuration.getUiText('Enter your instructions for editing the text...') ??
            'Enter your instructions for editing the text...';
        const submitLabel = this.app.configuration.getUiText('Submit') ?? 'Submit';
        const cancelLabel = this.app.configuration.getUiText('Cancel') ?? 'Cancel';
        const emptyHint =
            this.app.configuration.getUiText('Please enter editing instructions.') ??
            'Please enter editing instructions.';

        return new Promise((resolve) => {
            let settled = false;
            const panel = vscode.window.createWebviewPanel(
                'editWithAiMultilinePrompt',
                title,
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
                { enableScripts: true }
            );

            const finish = (value: string | undefined) => {
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
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        label {
            margin-bottom: 8px;
        }
        textarea {
            flex: 1;
            min-height: 120px;
            resize: vertical;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        .actions {
            margin-top: 12px;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        /* DOM order is Submit then Cancel (Tab: textarea → Submit → Cancel); flex order keeps Cancel left, Submit right. */
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
    <label for="prompt">${this.escapeWebviewAttr(title)}</label>
    <textarea id="prompt" placeholder="${this.escapeWebviewAttr(placeholder)}" autofocus></textarea>
    <div class="actions">
        <button type="button" class="primary" id="submit">${this.escapeWebviewAttr(submitLabel)}</button>
        <button type="button" class="secondary" id="cancel">${this.escapeWebviewAttr(cancelLabel)}</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const ta = document.getElementById('prompt');
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
            vscode.postMessage({ command: 'submit', text: ta.value });
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
                    if (!text.trim()) {
                        void vscode.window.showInformationMessage(emptyHint);
                        return;
                    }
                    finish(text);
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

    async showEditPrompt(editor: vscode.TextEditor) {
        let chatUrl = this.app.configuration.endpoint_chat
        if (!chatUrl) chatUrl = this.app.configuration.endpoint_tools; 
        let chatModel = this.app.getChatModel();    
        if (!this.app.isChatModelSelected()) chatModel = this.app.getToolsModel();
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint)
            chatUrl = chatEndpoint ? chatEndpoint + "/" : "";
        }
        if (!chatUrl) { 
            await Utils.suggestModelSelection(
                "Select a chat or tools model or an env with chat or tools model to edit code with AI.",
                "After the chat model is loaded, try again using Edit with AI.",
                "No endpoint for the chat model. Select an env with chat model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat.",
                this.app
            );
            return
        }

        if (editor.selection.isEmpty) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("Please select some text to edit")??"");
            return;
        }

        Utils.expandSelectionToFullLines(editor);
        const selection = editor.selection;
        let result = Utils.removeLeadingSpaces(editor.document.getText(selection));
        this.selectedText = result.updatedText;
        this.removedSpaces = result.removedSpaces
        this.selection = selection;
        this.currentEditor = editor;

        // Get context from surrounding code (10 lines before and after)
        const startLine = Math.max(0, selection.start.line - 10);
        const endLine = Math.min(editor.document.lineCount - 1, selection.end.line + 10);
        const contextRange = new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length);
        const context = editor.document.getText(contextRange);
        
        const prompt = await this.showMultilineEditPrompt();

        if (!prompt) {
            return;
        }

        this.app.statusbar.showThinkingInfo();
        let data: LlamaChatResponse | undefined
        try {
            try {
                data = await this.app.llamaServer.getChatEditCompletion(
                    prompt,
                    this.selectedText,
                    context,
                    this.app.extraContext.chunks,
                    0
                );
            } catch (error) {
                vscode.window.showErrorMessage('Error getting suggestions. Please check if the server with chat model is running.');
                return;
            }

            if (!data || !data.choices[0].message.content) {
                vscode.window.showInformationMessage('No suggestions available');
                return;
            }
            this.currentSuggestion = Utils.removeFirstAndLastLinesIfBackticks(data.choices[0].message.content.trim());
            this.currentSuggestion = Utils.addLeadingSpaces(this.currentSuggestion, this.removedSpaces)
            // Show the suggestion in a diff view
            await this.showDiffView(editor, this.currentSuggestion);
            this.setSuggestionVisible(true);

            // Wait for user to either accept (Tab) or close the diff view
            // The cleanup will be handled by the acceptSuggestion method or when the diff view is closed
        } catch (error) {
            vscode.window.showErrorMessage('Error getting suggestions. Please check if llama.cpp server is running.');
            await this.cleanup();
        } finally {
            this.app.statusbar.showInfo(undefined);
        }
    }

    

    private async showDiffView(editor: vscode.TextEditor, suggestion: string) {
        // Get context before and after the selection
        const startLine = 0; 
        const endLine = editor.document.lineCount - 1;

        // Get the text before the selection
        const beforeRange = new vscode.Range(startLine, 0, this.selection!.start.line, 0);
        const beforeText = editor.document.getText(beforeRange);

        // Get the text after the selection
        const afterRange = new vscode.Range(this.selection!.end.line, editor.document.lineAt(this.selection!.end.line).text.length, endLine, editor.document.lineAt(endLine).text.length);
        const afterText = editor.document.getText(afterRange);

        // Combine the context with the suggestion
        const fullSuggestion = beforeText + suggestion + afterText;

        // Create a temporary document for the suggestion using a custom scheme
        const extension = editor.document.uri.toString().split('.').pop();
        this.suggestionUri = vscode.Uri.parse('llama-suggestion:suggestion.' + extension);

        // Register a content provider for our custom scheme
        const provider = new class implements vscode.TextDocumentContentProvider {
            onDidChange?: vscode.Event<vscode.Uri>;
            provideTextDocumentContent(uri: vscode.Uri): string {
                return fullSuggestion;
            }
        };

        // Register the provider
        const registration = vscode.workspace.registerTextDocumentContentProvider('llama-suggestion', provider);

        await vscode.commands.executeCommand('vscode.diff', editor.document.uri, this.suggestionUri, this.diffTitle);
        setTimeout(async () => {
            try {
                // Navigate to the first difference
                await vscode.commands.executeCommand('workbench.action.compareEditor.nextChange');
            } catch (error) {
                console.error('Failed to navigate to first difference:', error);
            }
        }, 300);

        // Store the registration to dispose later
        this.registration = registration;
    }

    async acceptSuggestion() {
        // Only accept the suggestion if the diff view is currently active
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.uri.toString() !== this.suggestionUri.toString()) {
            return;
        }

        if (!this.currentSuggestion || !this.currentEditor || !this.selection) {
            return;
        }

        await this.applyChange(this.currentEditor, this.currentSuggestion);
        this.setSuggestionVisible(false);

        // Clean up after applying the change
        await this.cleanup();
    }

    async rejectSuggestion() {
        // Only reject the suggestion if the diff view is currently active
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.uri.toString() !== this.suggestionUri.toString()) {
            return;
        }
        
        if (!this.currentSuggestion || !this.currentEditor || !this.selection) {
            return;
        }

        this.setSuggestionVisible(false);

        // Clean up without applying the change
        await this.cleanup();
    }

    private async applyChange(editor: vscode.TextEditor, suggestion: string) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, this.selection!, suggestion);
        await vscode.workspace.applyEdit(edit);
    }

    private async cleanup() {
        // Close the diff editor
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        // Dispose of the content provider registration
        if (this.registration) {
            this.registration.dispose();
            this.registration = undefined;
        }

        this.currentSuggestion = undefined;
        this.currentEditor = undefined;
        this.selection = undefined;
        this.setSuggestionVisible(false);
    }
}
