import * as vscode from 'vscode';
import { Application } from './application';
import { Utils } from './utils';

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
    private currentEditGoal: string | undefined; // New property for the overall edit goal
    private editHistory: { instruction: string, suggestedChange: string, applied: boolean }[] = []; // New property for edit history

    constructor(application: Application) {
        this.app = application;
    }

    private setSuggestionVisible(visible: boolean) {
        vscode.commands.executeCommand('setContext', 'textEditSuggestionVisible', visible);
    }

    async showEditPrompt(editor: vscode.TextEditor) {
        let chatUrl = this.app.configuration.endpoint_chat
        let chatModel = this.app.menu.getChatModel();    
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint)
            chatUrl = chatEndpoint ? chatEndpoint + "/" : "";
        }
        if (!chatUrl) { 
            const shouldSelectModel = await Utils.showUserChoiceDialog("Select a chat model or an env with chat model to edit code with AI.","Select Env")
            if (shouldSelectModel){
                this.app.menu.showEnvView();
                vscode.window.showInformationMessage("After the chat model is loaded, try again using Edit with AI.")
                return;
            } else {
                vscode.window.showErrorMessage("No endpoint for the chat model. Select an env with chat model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat. ")
                return
            }
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

        // Prompt for the overall goal of the edit
        const initialPrompt = await vscode.window.showInputBox({
            placeHolder: 'Enter your overall goal for editing the text...',
            prompt: 'What is the main goal for this edit session?',
            ignoreFocusOut: true
        });

        if (!initialPrompt) {
            return;
        }
        this.currentEditGoal = initialPrompt; // Set the overall goal
        this.editHistory = []; // Reset edit history for a new session

        // Get context from surrounding code (10 lines before and after)
        const startLine = Math.max(0, selection.start.line - 10);
        const endLine = Math.min(editor.document.lineCount - 1, selection.end.line + 10);
        const contextRange = new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length);
        const context = editor.document.getText(contextRange);
        
        const instruction = await vscode.window.showInputBox({
            placeHolder: 'Enter your instructions for editing the text...',
            prompt: 'How would you like to modify the selected text (specific instruction)?',
            ignoreFocusOut: true
        });

        if (!instruction) {
            return;
        }

        this.app.statusbar.showThinkingInfo();

        try {
            const data = await this.app.llamaServer.getChatEditCompletion(
                instruction,
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
            this.currentSuggestion = Utils.addLeadingSpaces(this.currentSuggestion, this.removedSpaces)
            // Store the initial instruction and suggestion
            this.editHistory.push({ instruction: instruction, suggestedChange: this.currentSuggestion, applied: false });

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
        const uri = vscode.Uri.parse('llama-suggestion:suggestion.' + extension);

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

        // Mark the last suggestion as applied
        if (this.editHistory.length > 0) {
            this.editHistory[this.editHistory.length - 1].applied = true;
        }

        // Clean up after applying the change
        await this.cleanup();
    }

    async acceptAllSuggestion() {
        // Applies the full current suggestion (if present) regardless of edit steps
        if (!this.currentSuggestion || !this.currentEditor || !this.selection) return;

        await this.applyChange(this.currentEditor, this.currentSuggestion);
        this.setSuggestionVisible(false);

        // Mark all pending history entries as applied
        if (this.editHistory.length > 0) {
            for (let i = 0; i < this.editHistory.length; i++) this.editHistory[i].applied = true;
        }

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

    async showEditHistory() {
        if (!this.editHistory || this.editHistory.length === 0) {
            vscode.window.showInformationMessage('No edit history for the current session.');
            return;
        }

        const items = this.editHistory.map((entry, idx) => ({
            label: `#${idx + 1} ${entry.applied ? '[applied]' : '[pending]'}`,
            description: entry.instruction,
            detail: entry.suggestedChange
        }));

        const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select edit to view details' });
        if (selected) {
            vscode.window.showInformationMessage(selected.detail || 'No details');
        }
    }

    async nextEdit(editor: vscode.TextEditor) {
        if (!this.currentEditGoal || !this.currentEditor || !this.selection) {
            vscode.window.showInformationMessage("No active edit session. Please start an edit session first.");
            return;
        }

        this.app.statusbar.showThinkingInfo();

        try {
            // Construct the prompt for the next edit
            let editPrompt = `Overall goal: ${this.currentEditGoal}\n\n`;
            editPrompt += `Previous instructions and applied changes:\n`;
            this.editHistory.forEach((entry, index) => {
                editPrompt += `  ${index + 1}. Instruction: ${entry.instruction}\n`;
                editPrompt += `     Applied: ${entry.applied ? 'Yes' : 'No'}\n`;
                if (entry.applied) {
                    editPrompt += `     Change: \n\`\`\`\n${entry.suggestedChange}\n\`\`\`\n`;
                }
            });
            editPrompt += `\nWhat is the next logical step to achieve the overall goal?`;

            // Get context from surrounding code
            const startLine = Math.max(0, editor.selection.start.line - 10);
            const endLine = Math.min(editor.document.lineCount - 1, editor.selection.end.line + 10);
            const contextRange = new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length);
            const context = editor.document.getText(contextRange);

            const data = await this.app.llamaServer.getChatEditCompletion(
                editPrompt, // Use the constructed prompt as the instruction
                editor.document.getText(editor.selection), // Current selected text
                context,
                this.app.extraContext.chunks,
                0
            );

            if (!data || !data.choices[0].message.content) {
                vscode.window.showInformationMessage('No further suggestions available for the next edit.');
                await this.cleanup();
                return;
            }
            this.currentSuggestion = this.removeFirstAndLastLinesIfBackticks(data.choices[0].message.content.trim());
            this.currentSuggestion = Utils.addLeadingSpaces(this.currentSuggestion, this.removedSpaces);

            // Store the new suggestion (instruction will be the generated prompt)
            this.editHistory.push({ instruction: editPrompt, suggestedChange: this.currentSuggestion, applied: false });

            await this.showDiffView(editor, this.currentSuggestion);
            this.setSuggestionVisible(true);

        } catch (error) {
            console.error('Error getting next edit suggestion:', error);
            vscode.window.showErrorMessage('Error getting next edit suggestion. Please check if llama.cpp server is running.');
            await this.cleanup();
        } finally {
            this.app.statusbar.showInfo(undefined);
        }
    }

    private applyChange(editor: vscode.TextEditor, suggestion: string) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, this.selection!, suggestion);
        return vscode.workspace.applyEdit(edit);
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
        this.currentEditGoal = undefined; // Clear the overall goal
        this.editHistory = []; // Clear edit history
        this.setSuggestionVisible(false);
    }

    async explainSelectedCode(editor: vscode.TextEditor) {
        let chatUrl = this.app.configuration.endpoint_chat
        let chatModel = this.app.menu.getChatModel();    
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint)
            chatUrl = chatEndpoint ? chatEndpoint + "/" : "";
        }
        if (!chatUrl) { 
            const shouldSelectModel = await Utils.showUserChoiceDialog("Select a chat model or an env with chat model to explain code with AI.","Select Env")
            if (shouldSelectModel){
                this.app.menu.showEnvView();
                vscode.window.showInformationMessage("After the chat model is loaded, try again to explain code.")
                return;
            } else {
                vscode.window.showErrorMessage("No endpoint for the chat model. Select an env with chat model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat. ")
                return
            }
        }

        if (editor.selection.isEmpty) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("Please select some code to explain")??"");
            return;
        }

        const selectedCode = editor.document.getText(editor.selection);

        this.app.statusbar.showThinkingInfo();

        try {
            const prompt = this.app.prompts.replaceOnePlaceholders(this.app.prompts.EXPLAIN_CODE_PROMPT, "code", selectedCode);
            const data = await this.app.llamaServer.getChatCompletion(prompt);

            if (data && data.choices[0].message.content) {
                vscode.window.showInformationMessage(data.choices[0].message.content);
            } else {
                vscode.window.showInformationMessage('No explanation available.');
            }
        } catch (error) {
            vscode.window.showErrorMessage('Error getting explanation. Please check if llama.cpp server is running.');
        } finally {
            this.app.statusbar.showInfo(undefined);
        }
    }

    async refactorSelectedCode(editor: vscode.TextEditor) {
        let chatUrl = this.app.configuration.endpoint_chat;
        let chatModel = this.app.menu.getChatModel();    
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint)
            chatUrl = chatEndpoint ? chatEndpoint + "/" : "";
        }
        if (!chatUrl) { 
            const shouldSelectModel = await Utils.showUserChoiceDialog("Select a chat model or an env with chat model to refactor code with AI.","Select Env")
            if (shouldSelectModel){
                this.app.menu.showEnvView();
                vscode.window.showInformationMessage("After the chat model is loaded, try again to refactor code.")
                return;
            } else {
                vscode.window.showErrorMessage("No endpoint for the chat model. Select an env with chat model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat. ")
                return
            }
        }

        if (editor.selection.isEmpty) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("Please select some code to refactor")??"");
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
        
        const prompt = await vscode.window.showInputBox({
            placeHolder: 'Enter your refactoring instructions...',
            prompt: 'How would you like to refactor the selected code?',
            ignoreFocusOut: true
        });

        if (!prompt) {
            return;
        }

        this.app.statusbar.showThinkingInfo();

        try {
            const data = await this.app.llamaServer.getChatEditCompletion(
                prompt,
                this.selectedText,
                context,
                this.app.extraContext.chunks,
                0
            );

            if (!data || !data.choices[0].message.content) {
                vscode.window.showInformationMessage('No refactoring suggestion available.');
                return;
            }
            this.currentSuggestion = this.removeFirstAndLastLinesIfBackticks(data.choices[0].message.content.trim());
            this.currentSuggestion = Utils.addLeadingSpaces(this.currentSuggestion, this.removedSpaces)
            // Show the suggestion in a diff view
            await this.showDiffView(editor, this.currentSuggestion);
            this.setSuggestionVisible(true);

        } catch (error) {
            vscode.window.showErrorMessage('Error getting refactoring suggestion. Please check if llama.cpp server is running.');
            await this.cleanup();
        } finally {
            this.app.statusbar.showInfo(undefined);
        }
    }

    async generateCodeBlock(editor: vscode.TextEditor) {
        let chatUrl = this.app.configuration.endpoint_chat;
        let chatModel = this.app.menu.getChatModel();    
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint)
            chatUrl = chatEndpoint ? chatEndpoint + "/" : "";
        }
        if (!chatUrl) { 
            const shouldSelectModel = await Utils.showUserChoiceDialog("Select a chat model or an env with chat model to generate code with AI.","Select Env")
            if (shouldSelectModel){
                this.app.menu.showEnvView();
                vscode.window.showInformationMessage("After the chat model is loaded, try again to generate code.")
                return;
            } else {
                vscode.window.showErrorMessage("No endpoint for the chat model. Select an env with chat model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat. ")
                return
            }
        }

        const description = await vscode.window.showInputBox({
            placeHolder: 'Enter a description for the code you want to generate...',
            prompt: 'What code would you like to generate?',
            ignoreFocusOut: true
        });

        if (!description) {
            return;
        }

        this.app.statusbar.showThinkingInfo();

        try {
            // Get RAG context from the current document or workspace
            const currentFileContent = editor.document.getText();
            const ragContextChunks = await this.app.chatContext.getRagContextChunks(currentFileContent + "\n" + description);
            const ragContext = ragContextChunks.map(chunk => chunk.content).join('\n\n');

            const promptContent = this.app.prompts.replacePlaceholders(this.app.prompts.GENERATE_CODE_PROMPT, {
                description: description,
                rag_context: ragContext
            });
            
            const data = await this.app.llamaServer.getChatCompletion(promptContent);

            if (data && data.choices[0].message.content) {
                const generatedCode = this.removeFirstAndLastLinesIfBackticks(data.choices[0].message.content.trim());
                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, generatedCode);
                });
                vscode.window.showInformationMessage('Code generated and inserted.');
            } else {
                vscode.window.showInformationMessage('No code generated.');
            }
        } catch (error) {
            console.error('Error generating code:', error);
            vscode.window.showErrorMessage('Error generating code. Please check if llama.cpp server is running.');
        } finally {
            this.app.statusbar.showInfo(undefined);
        }
    }

    async generateUnitTests(editor: vscode.TextEditor) {
        let chatUrl = this.app.configuration.endpoint_chat;
        let chatModel = this.app.menu.getChatModel();    
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint)
            chatUrl = chatEndpoint ? chatEndpoint + "/" : "";
        }
        if (!chatUrl) { 
            const shouldSelectModel = await Utils.showUserChoiceDialog("Select a chat model or an env with chat model to generate unit tests with AI.","Select Env")
            if (shouldSelectModel){
                this.app.menu.showEnvView();
                vscode.window.showInformationMessage("After the chat model is loaded, try again to generate unit tests.")
                return;
            } else {
                vscode.window.showErrorMessage("No endpoint for the chat model. Select an env with chat model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat. ")
                return
            }
        }
 
        if (editor.selection.isEmpty) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("Please select some code to generate tests for")??"");
            return;
        }
 
        const codeToTest = editor.document.getText(editor.selection);
 
        const additionalInstructions = await vscode.window.showInputBox({
            placeHolder: 'Enter additional instructions for test generation (e.g., specific scenarios, mocking strategies)...',
            prompt: 'Additional instructions for unit tests (optional):',
            ignoreFocusOut: true
        });
 
        this.app.statusbar.showThinkingInfo();
 
        try {
            const promptContent = this.app.prompts.replacePlaceholders(this.app.prompts.GENERATE_UNIT_TEST_PROMPT, {
                code_to_test: codeToTest,
                instructions: additionalInstructions || ""
            });
            
            const data = await this.app.llamaServer.getChatCompletion(promptContent);
 
            if (data && data.choices[0].message.content) {
                const generatedTests = this.removeFirstAndLastLinesIfBackticks(data.choices[0].message.content.trim());
                
                // Create a new untitled document and insert the generated tests
                const newDocument = await vscode.workspace.openTextDocument({ content: generatedTests, language: editor.document.languageId });
                await vscode.window.showTextDocument(newDocument, vscode.ViewColumn.Beside);
                vscode.window.showInformationMessage('Unit tests generated in a new file.');
            } else {
                vscode.window.showInformationMessage('No unit tests generated.');
            }
        } catch (error) {
            console.error('Error generating unit tests:', error);
            vscode.window.showErrorMessage('Error generating unit tests. Please check if llama.cpp server is running.');
        } finally {
            this.app.statusbar.showInfo(undefined);
        }
    }

    async analyzeError(editor: vscode.TextEditor) {
        let chatUrl = this.app.configuration.endpoint_chat;
        let chatModel = this.app.menu.getChatModel();    
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint)
            chatUrl = chatEndpoint ? chatEndpoint + "/" : "";
        }
        if (!chatUrl) { 
            const shouldSelectModel = await Utils.showUserChoiceDialog("Select a chat model or an env with chat model to analyze errors with AI.","Select Env")
            if (shouldSelectModel){
                this.app.menu.showEnvView();
                vscode.window.showInformationMessage("After the chat model is loaded, try again to analyze errors.")
                return;
            } else {
                vscode.window.showErrorMessage("No endpoint for the chat model. Select an env with chat model or enter the endpoint of a running llama.cpp server with chat model in setting endpoint_chat. ")
                return
            }
        }

        if (editor.selection.isEmpty) {
            vscode.window.showInformationMessage(this.app.configuration.getUiText("Please select an error message or stack trace to analyze")??"");
            return;
        }

        const errorText = editor.document.getText(editor.selection);

        this.app.statusbar.showThinkingInfo();

        try {
            const promptContent = this.app.prompts.replaceOnePlaceholders(this.app.prompts.ANALYZE_ERROR_PROMPT, "error_text", errorText);
            
            const data = await this.app.llamaServer.getChatCompletion(promptContent);

            if (data && data.choices[0].message.content) {
                const analysis = data.choices[0].message.content.trim();
                vscode.window.showInformationMessage(analysis, { modal: true });
            } else {
                vscode.window.showInformationMessage('No analysis available.');
            }
        } catch (error) {
            console.error('Error analyzing error:', error);
            vscode.window.showErrorMessage('Error analyzing error. Please check if llama.cpp server is running.');
        } finally {
            this.app.statusbar.showInfo(undefined);
        }
    }
}
