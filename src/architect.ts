// TODO
// По подразбиране порта по подразбиране да е друг (сървера и екстеншъна) - примерно 8012 (за да няма конфликти)
// Да не премигва при избор само на ред или дума (върни частично проверката за съвпадение с последния рекуест?)
// Profiling - провери кое колко време отнема, за да оптимизираш (примерно пускай паралелно информацията в статус бара..., по-малко търсене в кеша...)
// - Търсенето в кеша при 250 елемента и 49 символа отнема 1/5 милисекунда => може по-голям кеш, може търсене до началото на реда
// - ShowInfo < 1/10 мс
// (Нисък приоритет) Прозорец на майкософт интелисенс - да не се показва или нещо друго по-красиво
import * as vscode from 'vscode';
import { LRUCache } from './lru-cache';
import { ExtraContext } from './extra-context';
import { Configuration } from './configuration';
import { LlamaResponse, LlamaServer } from './llama-server';

interface SuggestionDetails {
    suggestion: string;
    position: vscode.Position;
    inputPrefix: string;
    inputSuffix: string;
    prompt: string;
}

export class Architect {
    private extConfig: Configuration;
    private extraContext: ExtraContext;
    private llamaServer: LlamaServer
    private lruResultCache: LRUCache
    private fileSaveTimeout: NodeJS.Timeout | undefined;
    private lastCompletion: SuggestionDetails = {suggestion: "", position: new vscode.Position(0, 0), inputPrefix: "", inputSuffix: "", prompt: ""};
    private myStatusBarItem:vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    private isRequestInProgress = false
    private isForcedNewRequest = false

    constructor() {
        const config = vscode.workspace.getConfiguration("llama-vscode");
        this.extConfig = new Configuration(config)
        this.llamaServer = new LlamaServer(this.extConfig)
        this.extraContext = new ExtraContext(this.extConfig, this.llamaServer)
        this.lruResultCache = new LRUCache(this.extConfig.max_cache_keys);
    }

    setStatusBar = (context: vscode.ExtensionContext) => {
        this.myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        context.subscriptions.push(this.myStatusBarItem);
    }

    setOnChangeConfiguration = (context: vscode.ExtensionContext) => {
        let configurationChangeDisp = vscode.workspace.onDidChangeConfiguration((event) => {
            const config = vscode.workspace.getConfiguration("llama-vscode");
            this.extConfig.updateOnEvent(event, config);
            vscode.window.showInformationMessage(`llama-vscode extension is updated.`);
            this.lruResultCache = new LRUCache(this.extConfig.max_cache_keys);
        });
        context.subscriptions.push(configurationChangeDisp);
    }

    setOnChangeActiveFile = (context: vscode.ExtensionContext) => {
        let changeActiveTextEditorDisp = vscode.window.onDidChangeActiveTextEditor((editor) => {
            const previousEditor = vscode.window.activeTextEditor;
            if (previousEditor) {
                setTimeout(async () => {
                    this.extraContext.pickChunkAroundCursor(previousEditor.selection.active.line, previousEditor.document);
                }, 0);
            }
            // Clarify if this should be executed if the above was executed
            if (editor) {
                // Editor is now active in the UI, pick a chunk
                let activeDocument = editor.document;
                const selection = editor.selection;
                const cursorPosition = selection.active;
                setTimeout(async () => {
                    this.extraContext.pickChunkAroundCursor(cursorPosition.line, activeDocument);
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

                // Retrieve the last inline completion item
                const lastItem = this.lastCompletion.suggestion;
                if (!lastItem) {
                    return;
                }
                let lastSuggestioLines = lastItem.split('\n')
                let insertLine = lastSuggestioLines[0] || '';

                if (insertLine.trim() == "" && lastSuggestioLines.length > 1) {
                    insertLine = '\n' + lastSuggestioLines[1];
                }



                // Insert the first line at the cursor
                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, insertLine);
                });
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

                // Retrieve the last inline completion item
                const lastSuggestion = this.lastCompletion.suggestion;
                if (!lastSuggestion) {
                    return;
                }
                let lastSuggestioLines = lastSuggestion.split(/\r?\n/)
                let firstLine = lastSuggestioLines[0];
                let prefix = this.getLeadingSpaces(firstLine)
                let firstWord = prefix + firstLine.trimStart().split(' ')[0] || '';
                let insertText = firstWord

                if (firstWord === "" && lastSuggestioLines.length > 1) {
                    let secondLine = lastSuggestioLines[1];
                    prefix = this.getLeadingSpaces(secondLine)
                    firstWord = prefix + secondLine.trimStart().split(' ')[0] || '';
                    insertText = '\n' + firstWord
                }

                // Insert the first word at the cursor
                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, insertText);
                });
            }
        );
        context.subscriptions.push(acceptFirstWordCommand);
    }

    getLeadingSpaces = (input: string): string => {
        // Match the leading spaces using a regular expression
        const match = input.match(/^[ \t]*/);
        return match ? match[0] : "";
      }

    setPeriodicRingBufferUpdate = (context: vscode.ExtensionContext) => {
        const ringBufferIntervalId = setInterval(this.extraContext.periodicRingBufferUpdate, this.extConfig.ring_update_ms);
        const rungBufferUpdateDisposable = {
            dispose: () => {
                clearInterval(ringBufferIntervalId);
                console.log('Periodic Task Extension has been deactivated. Interval cleared.');
            }
        };
        context.subscriptions.push(rungBufferUpdateDisposable);
    }

    setOnSaveFile = (context: vscode.ExtensionContext) => {
        const onSaveDocDisposable = vscode.workspace.onDidSaveTextDocument(this.handleDocumentSave);
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
            this.isForcedNewRequest = true;
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
            let extraContext = ""
            if (this.extraContext.chunks.length > 0){
                extraContext = this.extraContext.chunks.reduce((accumulator, currentValue) => accumulator + "Time: " + currentValue.time + "\nFile Name: " + currentValue.filename + "\nText:\n" +  currentValue.text + "\n\n" , "");
            }
            let completionCache = ""
            if (this.lruResultCache.size() > 0){
                completionCache = Array.from(this.lruResultCache.getMap().entries()).reduce((accumulator, [key, value]) => accumulator + "Key: " + key + "\nCompletion:\n" +  value + "\n\n" , "");
            }
            vscode.env.clipboard.writeText("Extra context: \n" + extraContext + "\n\n------------------------------\nCompletion cache: \n" + completionCache)
        });
        context.subscriptions.push(triggerCopyChunksDisposable);
    }

    setCompletionProvider = (context: vscode.ExtensionContext) => {
        let getCompletionItems = this.getCompletionItems
        let complitionProvider = {
            async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | null> {
                // ctx.lastComplStartTime = Date.now();
                return await getCompletionItems(document, position, context, token);
            }
        };
        const providerDisposable = vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**' },
            complitionProvider
        );
        context.subscriptions.push(providerDisposable);
    }

    setClipboardEvents = (context: vscode.ExtensionContext) => {
        const copyCmd = vscode.commands.registerCommand('extension.copyIntercept', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // Delegate to the built-in paste action
                await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                return;
            }
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);


            let selectedLines = selectedText.split(/\r?\n/);
             // Run async to not affect copy action
            setTimeout(async () => {
                this.extraContext.pickChunk(selectedLines, false, true, editor.document);
            }, 0);

            // Delegate to the built-in command to complete the actual copy
            await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
        });

        const cutCmd = vscode.commands.registerCommand('extension.cutIntercept', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // Delegate to the built-in paste action
                await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                return;
            }
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            let selectedLines = selectedText.split(/\r?\n/);
            // Run async to not affect cut action
            setTimeout(async () => {
                this.extraContext.pickChunk(selectedLines, false, true, editor.document);
            }, 0);

            // Delegate to the built-in cut
            await vscode.commands.executeCommand('editor.action.clipboardCutAction');
        });

        const pasteCmd = vscode.commands.registerCommand('extension.pasteIntercept', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // Delegate to the built-in paste action
                await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                return;
            }

            // Read the system clipboard using VS Code's API
            const clipboardText = await vscode.env.clipboard.readText();
            let selectedLines = clipboardText.split(/\r?\n/);
            // Run async to not affect paste action
            setTimeout(async () => {
                this.extraContext.pickChunk(selectedLines, false, true, editor.document);
            }, 0);

            // Delegate to the built-in paste action
            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
        });
        context.subscriptions.push(copyCmd, cutCmd, pasteCmd);
    }

    handleDocumentSave = (document: vscode.TextDocument) => {
        if (this.fileSaveTimeout) {
            clearTimeout(this.fileSaveTimeout);
        }

        this.fileSaveTimeout = setTimeout(() => {
            let chunkLines: string[] = []
            const editor = vscode.window.activeTextEditor;
            // If there's an active editor and it's editing the saved document
            if (editor && editor.document === document) {
                const cursorPosition = editor.selection.active;
                const line = cursorPosition.line;
                this.extraContext.pickChunkAroundCursor(line, document)
            } else {
                chunkLines = document.getText().split(/\r?\n/);
                this.extraContext.pickChunk(chunkLines, true, true, document);
            }
        }, 1000); // Adjust the delay as needed
    }

    delay = (ms: number) => {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
      }

    // Class field is used instead of a function to make "this" available
    getCompletionItems = async (document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | null> => {
        if (!this.extConfig.auto && context.triggerKind == vscode.InlineCompletionTriggerKind.Automatic) {
            return null;
        }

        // Start only if the previous request is finiched
        while (this.isRequestInProgress) {
            await this.delay(this.extConfig.DELAY_BEFORE_COMPL_REQUEST);
            if (token.isCancellationRequested) {
                return null;
            }
        }
        this.isRequestInProgress = true // Just before leaving the function should be set to false
        this.extraContext.lastComplStartTime = Date.now();

        // Gather local context
        const prefixLines = this.getPrefixLines(document, position, this.extConfig.n_prefix);
        const suffixLines = this.getSuffixLines(document, position, this.extConfig.n_suffix);
        const lineText = document.lineAt(position.line).text
        const cursorIndex = position.character;
        const linePrefix = lineText.slice(0, cursorIndex);
        const lineSuffix = lineText.slice(cursorIndex);
        const nindent = lineText.length - lineText.trimStart().length
        if (context.triggerKind == vscode.InlineCompletionTriggerKind.Automatic && lineSuffix.length > this.extConfig.max_line_suffix) {
            this.isRequestInProgress = false
            return null
        }
        const prompt = linePrefix;
        const inputPrefix = prefixLines.join('\n') + '\n';
        const inputSuffix = lineSuffix + '\n' + suffixLines.join('\n') + '\n';

        // Reuse cached completion if available.
        try {
            let data: LlamaResponse | undefined
            let hashKey = this.lruResultCache.getHash(inputPrefix + "|" + inputSuffix + "|" + prompt)
            let completion = this.getCachedCompletion(hashKey, inputPrefix, inputSuffix, prompt)
            let isCachedResponse = !this.isForcedNewRequest && completion != undefined
            if (!isCachedResponse) {
                this.isForcedNewRequest = false
                if (token.isCancellationRequested){
                    this.isRequestInProgress = false
                    return null;
                }
                this.showThinkingInfo();

                data = await this.llamaServer.getLlamaCompletion(inputPrefix, inputSuffix, prompt, this.extraContext.chunks, nindent)
                if (data != undefined) completion = data.content;
                else completion = undefined
            }
            if (completion == undefined || completion.trim() == ""){
                this.showInfo(undefined);
                this.isRequestInProgress = false
                return [];
            }

            let suggestionLines = completion.split(/\r?\n/)
            this.removeTrailingNewLines(suggestionLines);
            completion = suggestionLines.join('\n')

            if (this.shouldDiscardSuggestion(suggestionLines, document, position, linePrefix, lineSuffix)) {
                this.showInfo(undefined);
                this.isRequestInProgress = false
                return [];
            }
            if (!isCachedResponse) this.lruResultCache.put(hashKey, completion)
            this.lastCompletion = this.getCompletionDetails(completion, position, inputPrefix, inputSuffix, prompt);

            // Run async as not needed for the suggestion
            setTimeout(async () => {
                if (isCachedResponse) this.showCachedInfo()
                else this.showInfo(data);
                if (!(token.isCancellationRequested)){
                    await this.cacheFutureSuggestion(inputPrefix, inputSuffix, prompt, suggestionLines);
                    await this.cacheFutureAcceptLineSuggestion(inputPrefix, inputSuffix, prompt, suggestionLines);
                    this.extraContext.addFimContextChunks(position, context, document);
                }
            }, 0);
            this.isRequestInProgress = false
            return [this.getSuggestion(completion, position)];
        } catch (err) {
            console.error("Error fetching llama completion:", err);
            vscode.window.showInformationMessage(`Error getting response. Please check if llama.cpp server is running. `);
            if (err instanceof Error) vscode.window.showInformationMessage(err.message);
            this.isRequestInProgress = false
            return [];
        }
    }

    private  cacheFutureSuggestion = async (inputPrefix: string, inputSuffix: string, prompt: string, suggestionLines: string[]) => {
        let futureInputPrefix = inputPrefix;
        let futureInputSuffix = inputSuffix;
        let futurePrompt = prompt + suggestionLines[0];
        if (suggestionLines.length > 1) {
            futureInputPrefix = inputPrefix + prompt + suggestionLines.slice(0, -1).join('\n') + '\n';
            futurePrompt = suggestionLines[suggestionLines.length - 1];
        }
        let futureHashKey = this.lruResultCache.getHash(futureInputPrefix + "|" + futureInputSuffix + "|" + futurePrompt)
        let cached_completion = this.lruResultCache.get(futureHashKey)
        if (cached_completion != undefined) return;
        let futureData = await this.llamaServer.getLlamaCompletion(futureInputPrefix, futureInputSuffix, futurePrompt, this.extraContext.chunks, prompt.length - prompt.trimStart().length);
        let futureSuggestion = "";
        if (futureData != undefined && futureData.content != undefined && futureData.content.trim() != "") {
            futureSuggestion = futureData.content;
            let suggestionLines = futureSuggestion.split(/\r?\n/)
            this.removeTrailingNewLines(suggestionLines);
            futureSuggestion = suggestionLines.join('\n')
            let futureHashKey = this.lruResultCache.getHash(futureInputPrefix + "|" + futureInputSuffix + "|" + futurePrompt);
            this.lruResultCache.put(futureHashKey, futureSuggestion);
        }
    }

    private  cacheFutureAcceptLineSuggestion = async (inputPrefix: string, inputSuffix: string, prompt: string, suggestionLines: string[]) => {
        // For one line suggestion there is nothing to cache
        if (suggestionLines.length > 1) {
            // let futureInputPrefix = inputPrefix;
            let futureInputSuffix = inputSuffix;
            // let futurePrompt = prompt + suggestionLines[0];
            let futureInputPrefix = inputPrefix + prompt + suggestionLines[0] + '\n';
            let futurePrompt = "";
            let futureHashKey = this.lruResultCache.getHash(futureInputPrefix + "|" + futureInputSuffix + "|" + futurePrompt)
            let futureSuggestion = suggestionLines.slice(1).join('\n')
            let cached_completion = this.lruResultCache.get(futureHashKey)
            if (cached_completion != undefined) return;
            else this.lruResultCache.put(futureHashKey, futureSuggestion);
        }
    }

    getPrefixLines = (document: vscode.TextDocument, position: vscode.Position, nPrefix: number): string[] => {
        const startLine = Math.max(0, position.line - nPrefix);
        return Array.from({ length: position.line - startLine }, (_, i) => document.lineAt(startLine + i).text);
    }

    getSuffixLines = (document: vscode.TextDocument, position: vscode.Position, nSuffix: number): string[] => {
        const endLine = Math.min(document.lineCount - 1, position.line + nSuffix);
        return Array.from({ length: endLine - position.line }, (_, i) => document.lineAt(position.line + 1 + i).text);
    }

    showInfo = (data: LlamaResponse | undefined) => {
        if (data == undefined || data.content == undefined || data.content.trim() == "" ) {
            if (this.extConfig.show_info) {
                this.myStatusBarItem.text = `llama-vscode | ${this.extConfig.getUiText("no suggestion")} | r: ${this.extraContext.chunks.length} / ${this.extConfig.ring_n_chunks}, e: ${this.extraContext.ringNEvict}, q: ${this.extraContext.queuedChunks.length} / ${this.extConfig.MAX_QUEUED_CHUNKS} | t: ${Date.now() - this.extraContext.lastComplStartTime} ms `;
            } else {
                this.myStatusBarItem.text = `llama-vscode | ${this.extConfig.getUiText("no suggestion")} | t: ${Date.now() - this.extraContext.lastComplStartTime} ms `;
            }
        } else {
            if (this.extConfig.show_info) {
                this.myStatusBarItem.text = `llama-vscode | c: ${data.tokens_cached} / ${data.generation_settings.n_ctx ?? 0}, r: ${this.extraContext.chunks.length} / ${this.extConfig.ring_n_chunks}, e: ${this.extraContext.ringNEvict}, q: ${this.extraContext.queuedChunks.length} / ${this.extConfig.MAX_QUEUED_CHUNKS} | p: ${data.timings?.prompt_n} (${data.timings?.prompt_ms?.toFixed(2)} ms, ${data.timings?.prompt_per_second?.toFixed(2)} t/s) | g: ${data.timings?.predicted_n} (${data.timings?.predicted_ms?.toFixed(2)} ms, ${data.timings?.predicted_per_second?.toFixed(2)} t/s) | t: ${Date.now() - this.extraContext.lastComplStartTime} ms `;
            } else {
                this.myStatusBarItem.text = `llama-vscode | t: ${Date.now() - this.extraContext.lastComplStartTime} ms `;
            }
        }
        this.myStatusBarItem.show();
    }

    showCachedInfo = () => {
        if (this.extConfig.show_info) {
            this.myStatusBarItem.text = `llama-vscode | C: ${this.lruResultCache.size()} / ${this.extConfig.max_cache_keys} | t: ${Date.now() - this.extraContext.lastComplStartTime} ms`;
        }else {
            this.myStatusBarItem.text = `llama-vscode | t: ${Date.now() - this.extraContext.lastComplStartTime} ms`;
        }
        this.myStatusBarItem.show();
    }

    showTimeInfo = (startTime: number) => {
        this.myStatusBarItem.text = `llama-vscode | t: ${Date.now() - startTime} ms`;
        this.myStatusBarItem.show();
    }

    showThinkingInfo = () => {
        this.myStatusBarItem.text = `llama-vscode | ${this.extConfig.getUiText("thinking...")}`;
        this.myStatusBarItem.show();
    }

    getSuggestion = (completion: string, position: vscode.Position) => {
        return new vscode.InlineCompletionItem(
            completion,
            new vscode.Range(position, position)
        );
    }

    // logic for discarding predictions that repeat existing text
    shouldDiscardSuggestion = (suggestionLines: string[], document: vscode.TextDocument, position: vscode.Position, linePrefix: string, lineSuffix: string) => {
        let discardSuggestion = false;
        if (suggestionLines.length == 0) return true;
        // truncate the suggestion if the first line is empty
        if (suggestionLines.length == 1 && suggestionLines[0].trim() == "") return true;

        // if cursor on the last line don't discard
        if (position.line == document.lineCount - 1) return false;

        // ... and the next lines are repeated
        if (suggestionLines.length > 1
            && (suggestionLines[0].trim() == "" || suggestionLines[0].trim() == lineSuffix.trim())
            && suggestionLines.slice(1).every((value, index) => value === document.lineAt((position.line + 1) + index).text))
            return true;

        // truncate the suggestion if it repeats the suffix
        if (suggestionLines.length == 1 && suggestionLines[0] == lineSuffix) return true;

        // find the first non-empty line (strip whitespace)
        let firstNonEmptyDocLine = position.line + 1;
        while (firstNonEmptyDocLine < document.lineCount && document.lineAt(firstNonEmptyDocLine).text.trim() === "")
            firstNonEmptyDocLine++;

        // if all lines to the end of file are empty don't discard
        if (firstNonEmptyDocLine >= document.lineCount) return false;

        if (linePrefix + suggestionLines[0] === document.lineAt(firstNonEmptyDocLine).text) {
            // truncate the suggestion if it repeats the next line
            if (suggestionLines.length == 1) return true;

            // ... or if the second line of the suggestion is the prefix of line l:cmp_y + 1
            if (suggestionLines.length === 2
                && suggestionLines[1] == document.lineAt(firstNonEmptyDocLine + 1).text.slice(0, suggestionLines[1].length))
                return true;

            // ... or if the middle chunk of lines of the suggestion is the same as the following non empty lines of the document
            if (suggestionLines.length > 2 && suggestionLines.slice(1).every((value, index) => value === document.lineAt((firstNonEmptyDocLine + 1) + index).text))
                return true;
        }
        return discardSuggestion;
    }

    private getCompletionDetails = (completion: string, position: vscode.Position, inputPrefix: string, inputSuffix: string, prompt: string) => {
        return { suggestion: completion, position: position, inputPrefix: inputPrefix, inputSuffix: inputSuffix, prompt: prompt };
    }

    private getCachedCompletion = (hashKey: string, inputPrefix: string, inputSuffix: string, prompt: string) => {
        let result = this.lruResultCache.get(hashKey);
        if (result != undefined) return result
        for (let i = prompt.length; i >= 0; i--) {
            let newPrompt = prompt.slice(0, i)
            let promptCut = prompt.slice(i)
            let hash = this.lruResultCache.getHash(inputPrefix + "|" + inputSuffix + "|" + newPrompt)
            let result = this.lruResultCache.get(hash)
            if (result != undefined && promptCut == result.slice(0,promptCut.length)) return result.slice(prompt.length - newPrompt.length)
        }

        return undefined
    }

    private removeTrailingNewLines = (suggestionLines: string[]) => {
        while (suggestionLines.length > 0 && suggestionLines.at(-1)?.trim() == "") {
            suggestionLines.pop();
        }
    }
}
