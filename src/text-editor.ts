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
            const data = await this.app.llamaServer.getChatCompletion(
                prompt, 
                this.selectedText,
                "",
                this.app.extraContext.chunks,
                0
            );

            if (!data || !data.choices[0].message.content) {
                vscode.window.showInformationMessage('No suggestions available');
                return;
            }

            // Show the suggestion in a diff view
            this.currentSuggestion = data.choices[0].message.content.trim();

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
        // Create a temporary document for the suggestion using a custom scheme
        const uri = vscode.Uri.parse('llama-suggestion:suggestion.txt');
        
        // Register a content provider for our custom scheme
        const provider = new class implements vscode.TextDocumentContentProvider {
            onDidChange?: vscode.Event<vscode.Uri>;
            provideTextDocumentContent(uri: vscode.Uri): string {
                return suggestion;
            }
        };
        
        // Register the provider
        const registration = vscode.workspace.registerTextDocumentContentProvider('llama-suggestion', provider);
        
        // Create a diff editor with read-only content
        const diffTitle = 'Text Edit Suggestion';
        await vscode.commands.executeCommand('vscode.diff', editor.document.uri, uri, diffTitle);
        
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