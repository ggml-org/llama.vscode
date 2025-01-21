import * as vscode from 'vscode';
import { Architect } from './architect';

export function activate(context: vscode.ExtensionContext) {
    let architect = new Architect();

    architect.setStatusBar(context)
    architect.setOnChangeConfiguration(context);
    architect.setCompletionProvider(context);
    architect.registerCommandManualCompletion(context);
    architect.registerCommandNoCacheCompletion(context);
    architect.registerCommandCopyChunks(context);
    architect.setOnSaveFile(context);
    architect.setPeriodicRingBufferUpdate(context);
    architect.setClipboardEvents(context);
    architect.setOnChangeActiveFile(context);
    architect.registerCommandAcceptFirstLine(context);
    architect.registerCommandAcceptFirstWord(context);
}

export function deactivate() {
    // Nothing to do. VS Code will dispose all registerd disposables
}
