import * as vscode from 'vscode';
import {Application} from "./application";
import { LlamaExtensionAPI } from './api';

let app: Application

class LlamaAPI implements LlamaExtensionAPI {
    constructor(private application: Application) {}

    async sendAgentQuery(query: string): Promise<string | undefined> {
        return this.application.llamaAgent.sendAgentQueryDirect(query);
    }

    async editCode(document: vscode.TextDocument, selection: vscode.Selection, instructions: string): Promise<void> {
        // This will trigger the existing showEditPrompt logic in TextEditor
        // We need to temporarily set the selection and editor for TextEditor to work as expected
        const originalSelection = this.application.textEditor["selection"];
        const originalEditor = this.application.textEditor["currentEditor"];

        this.application.textEditor["selection"] = selection;
        this.application.textEditor["currentEditor"] = { document, selection } as vscode.TextEditor;

        try {
            await this.application.textEditor.showEditPrompt(this.application.textEditor["currentEditor"]);
            // After showEditPrompt, the user would interact with the diff view. 
            // For programmatic control, one might want to auto-accept or wait for user action.
            // For now, we assume the user will handle the diff view manually.
            vscode.window.showInformationMessage("AI edit suggestion displayed. Please review and accept/reject.");
        } finally {
            // Restore original state
            this.application.textEditor["selection"] = originalSelection;
            this.application.textEditor["currentEditor"] = originalEditor;
        }
    }

    async getRagContext(query: string): Promise<string[]> {
        const chunks = await this.application.chatContext.getRagContextChunks(query);
        return chunks.map(chunk => chunk.content);
    }

    listAgentTools(): string[] {
        return Array.from(this.application.tools.toolsFunc.keys());
    }
}

export function activate(context: vscode.ExtensionContext) {
    app = Application.getInstance(context);
    app.architect.setStatusBar(context)
    app.architect.setOnChangeConfiguration(context);
    app.architect.setCompletionProvider(context);
    app.architect.registerCommandManualCompletion(context);
    app.architect.registerCommandCopyChunks(context);
    app.architect.registerCommandAskAi(context);
    app.architect.registerCommandAskAiWithContext(context);
    app.architect.registerCommandAskAiWithTools(context);
    app.architect.registerCommandNoCacheCompletion(context);
    app.architect.setOnSaveFile(context);
    app.architect.setPeriodicRingBufferUpdate(context);
    app.architect.setClipboardEvents(context);
    app.architect.setOnChangeActiveFile(context);
    app.architect.registerCommandAcceptFirstLine(context);
    app.architect.registerCommandAcceptFirstWord(context);
    app.architect.registerCommandShowMenu(context);
    app.architect.registerCommandEditSelectedText(context);
    app.architect.registerCommandAcceptTextEdit(context);
    app.architect.registerCommandRejectTextEdit(context);
    app.architect.registerCommandAcceptAllTextEdit(context);
    app.architect.registerCommandShowEditHistory(context);
    app.architect.setOnSaveDeleteFileForDb(context);
    app.architect.setOnChangeWorkspaceFolders(context)
    app.architect.registerGenarateCommitMsg(context)
    app.architect.registerCommandKillAgent(context)
    app.architect.registerWebviewProvider(context)
    app.architect.init()

    // Expose API
    return new LlamaAPI(app);
}

export async function deactivate() {
    // VS Code will dispose all registerd disposables
    app.llamaServer.killFimCmd();
    app.llamaServer.killChatCmd();
    app.llamaServer.killEmbeddingsCmd();
    app.llamaServer.killToolsCmd();
    app.llamaServer.killCommandCmd();
}
