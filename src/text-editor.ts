import * as vscode from 'vscode';
import { Application } from './application';

export class TextEditor {
    private app: Application;
    private decorationTypes: vscode.TextEditorDecorationType[] = [];
    private inputBox: vscode.TextEditor | undefined;
    private selectedText: string = '';
    private selection: vscode.Selection | undefined;
    private currentSuggestion: string | undefined;
    private currentEditor: vscode.TextEditor | undefined;
    private tempDoc: vscode.TextDocument | undefined;
    private registration: vscode.Disposable | undefined;

    constructor(application: Application) {
        this.app = application;
    }

    private setSuggestionVisible(visible: boolean) {
        vscode.commands.executeCommand('setContext', 'textEditSuggestionVisible', visible);
    }

    async showEditPrompt(editor: vscode.TextEditor) {
        // Get the selected text
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage('Please select some text to edit');
            return;
        }

        this.selectedText = editor.document.getText(selection);
        this.selection = selection;
        this.currentEditor = editor;

        // Get context from surrounding code (10 lines before and after)
        const startLine = Math.max(0, selection.start.line - 10);
        const endLine = Math.min(editor.document.lineCount - 1, selection.end.line + 10);
        const contextRange = new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length);
        const context = editor.document.getText(contextRange);

        // Create and show input box
        const prompt = await vscode.window.showInputBox({
            placeHolder: 'Enter your instructions for editing the text...',
            prompt: 'How would you like to modify the selected text?',
            ignoreFocusOut: true
        });

        if (!prompt) {
            return;
        }

        // Show thinking status
        this.app.statusbar.showThinkingInfo();

        try {
            // Get completion from llama server
            const data = await this.app.llamaServer.getChatEditCompletion(
                prompt,
                this.selectedText,
                context,
                this.app.extraContext.chunks,
                0
            );

            if (!data || !data.choices[0].message.content) {
                vscode.window.showInformationMessage('No suggestions available');
                return;
            }
            this.currentSuggestion = this.removeFirstAndLastLinesIfBackticks(data.choices[0].message.content.trim());

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

    private async showDiffView(editor: vscode.TextEditor, suggestion: string) {
        // Get context before and after the selection
        const contextLines = this.app.extConfig.EDIT_TEXT_DIFF_WINDOW_CONTEXT_LINEX;
        const startLine = Math.max(0, this.selection!.start.line - contextLines);
        const endLine = Math.min(editor.document.lineCount - 1, this.selection!.end.line + contextLines);

        // Get the text before the selection
        const beforeRange = new vscode.Range(startLine, 0, this.selection!.start.line, 0);
        const beforeText = editor.document.getText(beforeRange);

        // Get the text after the selection
        const afterRange = new vscode.Range(this.selection!.end.line, editor.document.lineAt(this.selection!.end.line).text.length, endLine, editor.document.lineAt(endLine).text.length);
        const afterText = editor.document.getText(afterRange);

        // Combine the context with the suggestion
        const fullSuggestion = beforeText + suggestion + afterText;

        // Create a temporary document for the suggestion using a custom scheme
        const uri = vscode.Uri.parse('llama-suggestion:suggestion.txt');

        // Register a content provider for our custom scheme
        const provider = new class implements vscode.TextDocumentContentProvider {
            onDidChange?: vscode.Event<vscode.Uri>;
            provideTextDocumentContent(uri: vscode.Uri): string {
                return fullSuggestion;
            }
        };

        // Register the provider
        const registration = vscode.workspace.registerTextDocumentContentProvider('llama-suggestion', provider);

        // Create a diff editor with read-only content
        const diffTitle = 'Text Edit Suggestion';
        await vscode.commands.executeCommand('vscode.diff', editor.document.uri, uri, diffTitle);
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
        if (!this.currentSuggestion || !this.currentEditor || !this.selection) {
            return;
        }

        await this.applyChange(this.currentEditor, this.currentSuggestion);
        this.setSuggestionVisible(false);

        // Clean up after applying the change
        await this.cleanup();
    }

    async rejectSuggestion() {
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
