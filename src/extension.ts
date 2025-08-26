import * as vscode from 'vscode';
import {Application} from "./application";

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
    app.architect.setClipboardEvents(context);
    app.architect.setOnChangeActiveFile(context);
    app.architect.registerCommandAcceptFirstLine(context);
    app.architect.registerCommandAcceptFirstWord(context);
    app.architect.registerCommandShowMenu(context);
    app.architect.registerCommandEditSelectedText(context);
    app.architect.registerCommandAcceptTextEdit(context);
    app.architect.registerCommandRejectTextEdit(context);
    app.architect.setOnSaveDeleteFileForDb(context);
    app.architect.setOnChangeWorkspaceFolders(context)
    app.architect.registerGenarateCommitMsg(context)
    app.architect.registerCommandKillAgent(context)
    app.architect.registerWebviewProvider(context)
    app.architect.init()
}

export async function deactivate() {
    // VS Code will dispose all registerd disposables
    app.llamaServer.killFimCmd();
    app.llamaServer.killChatCmd();
    app.llamaServer.killEmbeddingsCmd();
    app.llamaServer.killToolsCmd();
    app.llamaServer.killCommandCmd();
}
