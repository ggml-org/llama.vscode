import * as vscode from 'vscode';
import {Application} from "./application";
import {Utils} from "./utils";

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
    app.architect.registerCommandSendPromptToAgent(context);
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
    app.architect.registerCommandOpenChangedFile(context)
    app.architect.registerWebviewProvider(context)
    app.architect.registerUriHandler(context)
    app.architect.registerCommandSelectNextSuggestion(context)
    app.architect.registerCommandSelectPreviousSuggestion(context)
    app.architect.registerLlavaVscodeModelProvider(context)
    // The agent keeps a temporary todo file in the workspace root: make sure git
    // never sees it, even if a run is interrupted before it removes the file.
    Utils.excludeAgentTempFilesFromGit()
    app.architect.init()

    
}

export async function deactivate() {
    // VS Code will dispose all registerd disposables
    app.agentCommandScheduler.stop();
    // A run interrupted by the shutdown never cleans up after itself - the
    // temporary todo file must not stay in the workspace.
    app.llamaAgent.cleanupTodoFileOnExit();
    app.llamaServer.killFimCmd();
    app.llamaServer.killChatCmd();
    app.llamaServer.killEmbeddingsCmd();
    app.llamaServer.killToolsCmd();
    app.llamaServer.killCommandCmd();
}
