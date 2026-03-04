import * as vscode from 'vscode';
import {Application} from "./application";
import {LlamaChatModelProvider} from "./llama-chat-model-provider";

let app: Application
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
    app.architect.setPeriodicModelsHealthUpdate(context);
    app.architect.setClipboardEvents(context);
    app.architect.setOnChangeActiveFile(context);
    app.architect.registerCommandAcceptFirstLine(context);
    app.architect.registerCommandAcceptFirstWord(context);
    app.architect.registerCommandShowMenu(context);
    app.architect.registerCommandEditSelectedText(context);
    app.architect.registerCommandEditAllSearchFiles(context);
    app.architect.registerCommandAcceptTextEdit(context);
    app.architect.registerCommandRejectTextEdit(context);
    app.architect.setOnSaveDeleteFileForDb(context);
    app.architect.setOnChangeWorkspaceFolders(context)
    app.architect.registerGenarateCommitMsg(context)
    app.architect.registerCommandKillAgent(context)
    app.architect.registerWebviewProvider(context)
    app.architect.registerCommandSelectNextSuggestion(context)
    app.architect.registerCommandSelectPreviousSuggestion(context)
    app.architect.init()

    // Register the llama.cpp language model chat provider for GitHub Copilot Chat
    const llamaChatModelProvider = new LlamaChatModelProvider(app);
    context.subscriptions.push(vscode.lm.registerLanguageModelChatProvider(
        'llama-vscode',
        llamaChatModelProvider
    ));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('llama-vscode.endpoint_chat')
            || event.affectsConfiguration('llama-vscode.endpoint_tools')
            || event.affectsConfiguration('llama-vscode.ai_api_version')) {
            llamaChatModelProvider.notifyModelsChanged();
        }
    }));
}

export async function deactivate() {
    // VS Code will dispose all registerd disposables
    app.llamaServer.killFimCmd();
    app.llamaServer.killChatCmd();
    app.llamaServer.killEmbeddingsCmd();
    app.llamaServer.killToolsCmd();
    app.llamaServer.killCommandCmd();
}
