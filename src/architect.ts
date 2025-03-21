// TODO
// Ако се използва лора за чат сървера - да се подава в заявката от webui
// Идеи
// - Използване на агенти (?)
// - използване lSP
// - използване на MCP
import * as vscode from 'vscode';
import {Application} from "./application";

export class Architect {
    private app: Application

    constructor(application: Application) {
        this.app = application;
    }

    setOnChangeConfiguration = (context: vscode.ExtensionContext) => {
        let configurationChangeDisp = vscode.workspace.onDidChangeConfiguration((event) => {
            const config = vscode.workspace.getConfiguration("llama-vscode");
            this.app.extConfig.updateOnEvent(event, config);
            vscode.window.showInformationMessage(this.app.extConfig.getUiText(`llama-vscode extension is updated.`)??"");
        });
        context.subscriptions.push(configurationChangeDisp);
    }

    setOnChangeActiveFile = (context: vscode.ExtensionContext) => {
        let changeActiveTextEditorDisp = vscode.window.onDidChangeActiveTextEditor((editor) => {
            const previousEditor = vscode.window.activeTextEditor;
            if (previousEditor) {
                setTimeout(async () => {
                    this.app.extraContext.pickChunkAroundCursor(previousEditor.selection.active.line, previousEditor.document);
                }, 0);
            }
            
            if (editor) {
                // Editor is now active in the UI, pick a chunk
                let activeDocument = editor.document;
                const selection = editor.selection;
                const cursorPosition = selection.active;
                setTimeout(async () => {
                    this.app.extraContext.pickChunkAroundCursor(cursorPosition.line, activeDocument);
                }, 0);

            }
        });
        context.subscriptions.push(changeActiveTextEditorDisp)
    }

    registerCommandAcceptFirstLine = (context: vscode.ExtensionContext) => {
        const acceptFirstLineCommand = vscode.commands.registerCommand(
            'extension.acceptFirstLine',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return;
                }
                await this.app.completion.insertFirstLine(editor);
            }
        );
        context.subscriptions.push(acceptFirstLineCommand);
    }

    registerCommandAcceptFirstWord = (context: vscode.ExtensionContext) => {
        const acceptFirstWordCommand = vscode.commands.registerCommand(
            'extension.acceptFirstWord',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return;
                }

                await this.app.completion.insertNextWord(editor);
            }
        );
        context.subscriptions.push(acceptFirstWordCommand);
    }

    registerCommandShowMenu = (context: vscode.ExtensionContext) => {
        const showMenuCommand = vscode.commands.registerCommand(
            'extension.showMenu',
            async () => {
                await this.app.menu.showMenu(context);
            }
        );
        context.subscriptions.push(showMenuCommand);
    }

    setPeriodicRingBufferUpdate = (context: vscode.ExtensionContext) => {
        const ringBufferIntervalId = setInterval(this.app.extraContext.periodicRingBufferUpdate, this.app.extConfig.ring_update_ms);
        const rungBufferUpdateDisposable = {
            dispose: () => {
                clearInterval(ringBufferIntervalId);
            }
        };
        context.subscriptions.push(rungBufferUpdateDisposable);
    }

    setOnSaveFile = (context: vscode.ExtensionContext) => {
        const onSaveDocDisposable = vscode.workspace.onDidSaveTextDocument(this.app.extraContext.handleDocumentSave);
        context.subscriptions.push(onSaveDocDisposable);
    }

    registerCommandManualCompletion = (context: vscode.ExtensionContext) => {
        const triggerManualCompletionDisposable = vscode.commands.registerCommand('extension.triggerInlineCompletion', async () => {
            // Manual triggering of the completion with a shortcut
            if (!vscode.window.activeTextEditor) {
                vscode.window.showErrorMessage('No active editor!');
                return;
            }
            vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
        });
        context.subscriptions.push(triggerManualCompletionDisposable);
    }

    registerCommandNoCacheCompletion = (context: vscode.ExtensionContext) => {
        const triggerNoCacheCompletionDisposable = vscode.commands.registerCommand('extension.triggerNoCacheCompletion', async () => {
            // Manual triggering of the completion with a shortcut
            if (!vscode.window.activeTextEditor) {
                vscode.window.showErrorMessage('No active editor!');
                return;
            }
            // Hide the current suggestion to force VS Code to call the completion provider instead of using cache
            await vscode.commands.executeCommand('editor.action.inlineSuggest.hide');
            // Wait a tiny bit to ensure VS Code processes the command
            await new Promise(resolve => setTimeout(resolve, 50));
            this.app.completion.isForcedNewRequest = true;
            vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
        });
        context.subscriptions.push(triggerNoCacheCompletionDisposable);
    }

    registerCommandCopyChunks = (context: vscode.ExtensionContext) => {
        const triggerCopyChunksDisposable = vscode.commands.registerCommand('extension.copyChunks', async () => {
            if (!vscode.window.activeTextEditor) {
                vscode.window.showErrorMessage('No active editor!');
                return;
            }
            let eventLogsCombined = ""
            if (this.app.logger.eventlogs.length > 0){
                eventLogsCombined = this.app.logger.eventlogs.reverse().reduce((accumulator, currentValue) => accumulator + currentValue + "\n" , "");
            }
            let extraContext = ""
            if (this.app.extraContext.chunks.length > 0){
                extraContext = this.app.extraContext.chunks.reduce((accumulator, currentValue) => accumulator + "Time: " + currentValue.time + "\nFile Name: " + currentValue.filename + "\nText:\n" +  currentValue.text + "\n\n" , "");
            }
            let completionCache = ""
            if (this.app.lruResultCache.size() > 0){
                completionCache = Array.from(this.app.lruResultCache.getMap().entries()).reduce((accumulator, [key, value]) => accumulator + "Key: " + key + "\nCompletion:\n" +  value + "\n\n" , "");
            }
            vscode.env.clipboard.writeText("Events:\n" + eventLogsCombined + "\n\n------------------------------\n" + "Extra context: \n" + extraContext + "\n\n------------------------------\nCompletion cache: \n" + completionCache)
        });
        context.subscriptions.push(triggerCopyChunksDisposable);
    }

    setCompletionProvider = (context: vscode.ExtensionContext) => {
        const providerDisposable = vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**' },
            {
                provideInlineCompletionItems: async (document, position, context, token) => {
                    if (!this.app.extConfig.isCompletionEnabled(document)) {
                        return undefined;
                    }
                    return await this.app.completion.getCompletionItems(document, position, context, token);
                }
            }
        );
        context.subscriptions.push(providerDisposable);
    }

    setClipboardEvents = (context: vscode.ExtensionContext) => {
        const copyCmd = vscode.commands.registerCommand('extension.copyIntercept', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // Delegate to the built-in paste action
                await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
                return;
            }
            let selectedLines = this.app.extraContext.addChunkFromSelection(editor);

            // Delegate to the built-in command to complete the actual copy
            await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
            this.app.logger.addEventLog("", "COPY_INTERCEPT", selectedLines[0])
        });
        context.subscriptions.push(copyCmd);

        const cutCmd = vscode.commands.registerCommand('extension.cutIntercept', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // Delegate to the built-in paste action
                await vscode.commands.executeCommand('editor.action.clipboardCutAction');
                return;
            }
            let selectedLines = this.app.extraContext.addChunkFromSelection(editor);

            // Delegate to the built-in cut
            await vscode.commands.executeCommand('editor.action.clipboardCutAction');
            this.app.logger.addEventLog("", "CUT_INTERCEPT", selectedLines[0])
        });
        context.subscriptions.push(cutCmd);
    }

    setStatusBar = (context: vscode.ExtensionContext) => {
        this.app.statusbar.initializeStatusBar();
        this.app.statusbar.registerEventListeners(context);

        context.subscriptions.push(vscode.commands.registerCommand('llama-vscode.showMenu', async () => {
                await this.app.menu.showMenu(context);
            })
        );
    }

    registerCommandAskAi = (context: vscode.ExtensionContext) => {
        const triggerAskAiDisposable = vscode.commands.registerCommand('extension.askAi', async () => {
            if (!vscode.window.activeTextEditor) {
                vscode.window.showErrorMessage('No active editor!');
                return;
            }

            if (!this.app.extConfig.endpoint_chat) return;

            this.app.askAi.showChatWithAi(false, context);
        });
        context.subscriptions.push(triggerAskAiDisposable);
    }

    registerCommandAskAiWithContext = (context: vscode.ExtensionContext) => {
        const triggerAskAiDisposable = vscode.commands.registerCommand('extension.askAiWithContext', async () => {
            if (!vscode.window.activeTextEditor) {
                vscode.window.showErrorMessage('No active editor!');
                return;
            }

            if (!this.app.extConfig.endpoint_chat) return;

            const editor = vscode.window.activeTextEditor;
            if (editor) {
                // if editor is active in the UI, pick a chunk before sending extra context to the ai
                let activeDocument = editor.document;
                const selection = editor.selection;
                const cursorPosition = selection.active;
                this.app.extraContext.pickChunkAroundCursor(cursorPosition.line, activeDocument);
                // Ensure ring chunks buffer will be updated
                this.app.extraContext.lastComplStartTime = Date.now() - this.app.extConfig.RING_UPDATE_MIN_TIME_LAST_COMPL - 1
                this.app.extraContext.periodicRingBufferUpdate()
            }
            this.app.askAi.showChatWithAi(true, context);
        });
        context.subscriptions.push(triggerAskAiDisposable);
    }

    registerCommandEditSelectedText = (context: vscode.ExtensionContext) => {
        const editSelectedTextDisposable = vscode.commands.registerCommand('extension.editSelectedText', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor!');
                return;
            }
            await this.app.textEditor.showEditPrompt(editor);
        });
        context.subscriptions.push(editSelectedTextDisposable);
    }

    registerCommandAcceptTextEdit = (context: vscode.ExtensionContext) => {
        const acceptTextEditDisposable = vscode.commands.registerCommand('extension.acceptTextEdit', async () => {
            await this.app.textEditor.acceptSuggestion();
        });
        context.subscriptions.push(acceptTextEditDisposable);
    }

    registerCommandRejectTextEdit = (context: vscode.ExtensionContext) => {
        context.subscriptions.push(
            vscode.commands.registerCommand('extension.rejectTextEdit', () => {
                this.app.textEditor.rejectSuggestion();
            })
        );
    }
}
