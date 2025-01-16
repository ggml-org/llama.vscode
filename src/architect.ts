// TODO
// Dispose - провери дали всички ресурси се освобождават
//(Нисък приоритет) Прозорец на майкософт интелисенс - да не се показва или нещо друго по-красиво
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
    private lastKeyPressTime = Date.now()
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

    setKeyPressed = (context: vscode.ExtensionContext) => {
        const disposable = vscode.commands.registerCommand(
            "extension.setVariable",
            () => {
                // Set the variable when the command is triggered
                this.lastKeyPressTime = Date.now();
            }
        );
    
        context.subscriptions.push(disposable);
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
                this.extraContext.pickChunkAroundCursor(previousEditor.selection.active.line, previousEditor.document);
            }

            if (editor) {
                // Editor is now active in the UI, pick a chunk
                let activeDocument = editor.document;
                const selection = editor.selection;
                const cursorPosition = selection.active;
                this.extraContext.pickChunkAroundCursor(cursorPosition.line, activeDocument);
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
                let newCursorPosition = new vscode.Position(this.lastCompletion.position.line, this.lastCompletion.position.character + insertLine.length);

                if (insertLine === "" && lastSuggestioLines.length > 1) {
                    insertLine = '\n' + lastSuggestioLines[1];
                    newCursorPosition = new vscode.Position(this.lastCompletion.position.line + 1, insertLine.length);
                }

                this.updateCacheAndLastCompletion(this.lastCompletion.inputPrefix , this.lastCompletion.inputSuffix, this.lastCompletion.prompt + insertLine, this.lastCompletion.suggestion.slice(insertLine.length), newCursorPosition);

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
                let lastSuggestioLines = lastSuggestion.split('\n')
                let firstLine = lastSuggestioLines[0];
                let prefix = this.getLeadingSpaces(firstLine)
                let firstWord = prefix + firstLine.trimStart().split(' ')[0] || '';
                let newCursorPosition = new vscode.Position(this.lastCompletion.position.line, this.lastCompletion.position.character + firstWord.length);

                if (firstWord === "" && lastSuggestioLines.length > 1) {
                    let secondLine = lastSuggestioLines[1];
                    prefix = this.getLeadingSpaces(secondLine)
                    firstWord = '\n' + prefix + secondLine.trimStart().split(' ')[0] || '';
                    newCursorPosition = new vscode.Position(this.lastCompletion.position.line + 1, firstWord.length);
                }
                
                this.updateCacheAndLastCompletion(this.lastCompletion.inputPrefix, this.lastCompletion.inputSuffix, this.lastCompletion.prompt + firstWord, lastSuggestion.slice(firstWord.length), newCursorPosition);

                // Insert the first word at the cursor
                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, firstWord);
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
        const triggerNoCacheCompletionDisposable = vscode.commands.registerCommand('extension.copyChungs', async () => {
            // Manual triggering of the completion with a shortcut
            if (!vscode.window.activeTextEditor) {
                vscode.window.showErrorMessage('No active editor!');
                return;
            }
            if (this.extraContext.chunks.length > 0){
                let extraContext = this.extraContext.chunks.reduce((accumulator, currentValue) => accumulator + "Time: " + currentValue.time + "\nFile Name: " + currentValue.filename + "\nText:\n" +  currentValue.text + "\n\n" , "");
                vscode.env.clipboard.writeText(extraContext)
            }
            else vscode.env.clipboard.writeText("No extra context.")
        });
        context.subscriptions.push(triggerNoCacheCompletionDisposable);
    }

    setCompletionProvider = (context: vscode.ExtensionContext) => {
        let ctx = this.extraContext
        let getCompletionItems = this.getCompletionItems
        let complitionProvider = {
            async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | null> {
                ctx.lastComplStartTime = Date.now();
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
                return;
            }
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);


            let selectedLines = selectedText.split(/\r?\n/);
            this.extraContext.pickChunk(selectedLines, false, true, editor.document);

            // Delegate to the built-in command to complete the actual copy
            await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
        });

        const cutCmd = vscode.commands.registerCommand('extension.cutIntercept', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            let selectedLines = selectedText.split(/\r?\n/);
            this.extraContext.pickChunk(selectedLines, false, true, editor.document);

            // Delegate to the built-in cut
            await vscode.commands.executeCommand('editor.action.clipboardCutAction');
        });

        const pasteCmd = vscode.commands.registerCommand('extension.pasteIntercept', async () => {
            // Read the system clipboard using VS Code's API
            const clipboardText = await vscode.env.clipboard.readText();
            let selectedLines = clipboardText.split(/\r?\n/);

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            this.extraContext.pickChunk(selectedLines, false, true, editor.document);

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



        }, 500); // Adjust the delay as needed
    }

    delay = (ms: number) => {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
      }

    // Class field is used instead of a function to make "this" available
    getCompletionItems = async (document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | null> => {
        if (!this.extConfig.auto && context.triggerKind == vscode.InlineCompletionTriggerKind.Automatic) {
            return null;
        }
        this.lastKeyPressTime = Date.now();
        let cashedlastKeyPressTime = this.lastKeyPressTime
        await this.delay(this.extConfig.DELAY_BEFORE_COMPL_REQUEST);
        if (this.lastKeyPressTime > cashedlastKeyPressTime) {
            return null;
        }
        

        // Gather local context
        const prefixLines = this.getPrefixLines(document, position, this.extConfig.n_prefix);
        const suffixLines = this.getSuffixLines(document, position, this.extConfig.n_suffix);
        const lineText = document.lineAt(position.line).text
        const cursorIndex = position.character;
        const linePrefix = lineText.slice(0, cursorIndex);
        const lineSuffix = lineText.slice(cursorIndex);
        const nindent = lineText.length - lineText.trimStart().length
        if (context.triggerKind == vscode.InlineCompletionTriggerKind.Automatic && lineSuffix.length > this.extConfig.max_line_suffix) {
            return null
        }
        const prompt = linePrefix;
        const inputPrefix = prefixLines.join('\n') + '\n';
        const inputSuffix = lineSuffix + '\n' + suffixLines.join('\n') + '\n';

        // Reuse last completion if cursor moved forward possible
        if (!this.isForcedNewRequest && this.lastCompletion && this.lastCompletion.position.isBefore(position)) {
            const range = new vscode.Range(this.lastCompletion.position, position);
            let newText = document.getText(range);
            if (newText == this.lastCompletion.suggestion.slice(0, newText.length)) {
                // cache the new completion and return
                let newCompletionText = this.lastCompletion.suggestion.slice(newText.length)
                if (newCompletionText.trim().length > 0){
                    this.updateCacheAndLastCompletion(inputPrefix, inputSuffix, prompt, newCompletionText, position);
                    this.showTimeInfo(this.extraContext.lastComplStartTime)
                    return [this.getSuggestion(newCompletionText, position)];
                }
            }
        }

        // Reuse cached completion if available.
        let hashKey = this.lruResultCache.getHash(inputPrefix + "|" + inputSuffix + "|" + prompt)
        if (!this.isForcedNewRequest) {          
            let cached_completion = this.lruResultCache.get(hashKey)
            if (cached_completion != undefined) {
                this.lastCompletion = this.getCompletionDetails(cached_completion, position, inputPrefix, inputSuffix, prompt);
                let suggestionLines = cached_completion.split(/\r?\n/)
                if (this.shouldDiscardSuggestion(suggestionLines, document, position, linePrefix, lineSuffix)){
                    this.showInfo(undefined);
                    return [];
                }
                setTimeout(async () => {
                    this.showCachedInfo()
                    await this.cacheFutureSuggestion(inputPrefix, inputSuffix, prompt, this.lastCompletion.suggestion.split(/\r?\n/));
                }, 0);   
                return [this.getSuggestion(cached_completion, position)];
            }
        } else {
            this.isForcedNewRequest = false
        }

        try {
            if (token.isCancellationRequested || this.lastKeyPressTime > cashedlastKeyPressTime) return null;

            this.showThinkingInfo();
            const data = await this.llamaServer.getLlamaCompletion(inputPrefix, inputSuffix, prompt, this.extraContext.chunks, nindent)
            if (data == undefined || !data.content){
                this.showInfo(data); 
                return [];
            }
            let suggestionText: string = data.content;
            let suggestionLines = suggestionText.split(/\r?\n/)
            this.removeTrailingNewLines(suggestionLines);
            suggestionText = suggestionLines.join('\n')

            if (this.shouldDiscardSuggestion(suggestionLines, document, position, linePrefix, lineSuffix)) {
                this.showInfo(undefined);
                return [];
            }
                

            this.lruResultCache.put(hashKey, suggestionText)
            this.lastCompletion = this.getCompletionDetails(suggestionText, position, inputPrefix, inputSuffix, prompt);

            // Run async as not needed for the suggestion
            setTimeout(async () => {
                this.showInfo(data);
                await this.cacheFutureSuggestion(inputPrefix, inputSuffix, prompt, suggestionLines);
                this.extraContext.addFimContextChunks(position, context, document);
            }, 0);

            return [this.getSuggestion(suggestionText, position)];
        } catch (err) {
            console.error("Error fetching llama completion:", err);
            vscode.window.showInformationMessage(`Error getting response. Please check if llama.cpp server is running. `);
            if (err instanceof Error) vscode.window.showInformationMessage(err.message);
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
        let hashKey = this.lruResultCache.getHash(futureInputPrefix + "|" + futureInputSuffix + "|" + futurePrompt)
        let cached_completion = this.lruResultCache.get(hashKey)
        if (cached_completion == undefined) return;
        let futureData = await this.llamaServer.getLlamaCompletion(futureInputPrefix, futureInputSuffix, futurePrompt, this.extraContext.chunks, prompt.length - prompt.trimStart().length);
        let futureSuggestion = "";
        if (futureData != undefined && futureData.content != undefined && futureData.content != "") {
            futureSuggestion = futureData.content;
            let suggestionLines = futureSuggestion.split(/\r?\n/)
            this.removeTrailingNewLines(suggestionLines);
            futureSuggestion = suggestionLines.join('\n')
            let futureHashKey = this.lruResultCache.getHash(futureInputPrefix + "|" + futureInputSuffix + "|" + futurePrompt);
            this.lruResultCache.put(futureHashKey, futureSuggestion);
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
        if (this.extConfig.show_info) {
            if (data == undefined || data.content == undefined || data.content.trim() == "" )  this.myStatusBarItem.text = `llama-vscode | no suggestion | r: ${this.extraContext.chunks.length} / ${this.extConfig.ring_n_chunks}, e: ${this.extraContext.ringNEvict}, q: ${this.extraContext.queuedChunks.length} / ${this.extConfig.MAX_QUEUED_CHUNKS} | t: ${Date.now() - this.extraContext.lastComplStartTime} ms `;
            else this.myStatusBarItem.text = `llama-vscode | c: ${data.tokens_cached} / ${data.generation_settings.n_ctx ?? 0}, r: ${this.extraContext.chunks.length} / ${this.extConfig.ring_n_chunks}, e: ${this.extraContext.ringNEvict}, q: ${this.extraContext.queuedChunks.length} / ${this.extConfig.MAX_QUEUED_CHUNKS} | p: ${data.timings?.prompt_n} (${data.timings?.prompt_ms?.toFixed(2)} ms, ${data.timings?.prompt_per_second?.toFixed(2)} t/s) | g: ${data.timings?.predicted_n} (${data.timings?.predicted_ms?.toFixed(2)} ms, ${data.timings?.predicted_per_second?.toFixed(2)} t/s) | t: ${Date.now() - this.extraContext.lastComplStartTime} ms `;
            //vscode.window.showInformationMessage(`llama-vscode | c: ${data.tokens_cached} / ${data.generation_settings.tokens_evaluated}, r: ${chunks.length} / ${llama_config.ring_n_chunks}, e: ${ringNEvict}, q: ${queuedChunks.length} / ${MAX_QUEUED_CHUNKS} | p: ${data.timings?.prompt_n} (${data.timings?.prompt_ms?.toFixed(2)} ms, ${data.timings?.prompt_per_second?.toFixed(2)} t/s) | g: ${data.timings?.predicted_n} (${data.timings?.predicted_ms?.toFixed(2)} ms, ${data.timings?.predicted_per_second?.toFixed(2)} t/s) | t: ${Date.now() - fimStartTime} ms `);
            this.myStatusBarItem.show();
        }
    }

    showCachedInfo = () => {
        if (this.extConfig.show_info) {
            this.myStatusBarItem.text = `llama-vscode | C: ${this.lruResultCache.size()} / ${this.extConfig.max_cache_keys} | t: ${Date.now() - this.extraContext.lastComplStartTime} ms`;
            this.myStatusBarItem.show();
        }
    }

    showTimeInfo = (startTime: number) => {
        if (this.extConfig.show_info) {
            this.myStatusBarItem.text = `llama-vscode | t: ${Date.now() - startTime} ms`;
            this.myStatusBarItem.show();
        }
    }

    showThinkingInfo = () => {
        if (this.extConfig.show_info) {
            this.myStatusBarItem.text = `llama-vscode | thinking...`;
            this.myStatusBarItem.show();
        }
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

        // ... and the next lines are repeated
        if (suggestionLines.length > 1
            && (suggestionLines[0].trim() == "" || suggestionLines[0].trim() == lineSuffix.trim())
            && suggestionLines.slice(1).every((value, index) => value === document.lineAt((position.line + 1) + index).text))
            return true;       

        // truncate the suggestion if it repeats the suffix
        if (suggestionLines.length == 1 && suggestionLines[0] == lineSuffix) return true;

        // if cursor on the last line don't discard
        if (position.line == document.lineCount - 1) return false;

        // find the first non-empty line (strip whitespace)
        let firstNonEmptyDocLine = position.line + 1;
        while (firstNonEmptyDocLine < document.lineCount && document.lineAt(firstNonEmptyDocLine).text.trim() === "")
            firstNonEmptyDocLine++;

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

    private updateCacheAndLastCompletion = (inputPrefix: string, inputSuffix: string, prompt: string, newCompletionText: string, position: vscode.Position) => {
        if (!newCompletionText || newCompletionText.trim().length == 0) return
        let newComplHashKey = this.lruResultCache.getHash(inputPrefix + "|" + inputSuffix + "|" + prompt);
        this.lastCompletion = this.getCompletionDetails(newCompletionText, position, inputPrefix, inputSuffix, prompt);
        this.lruResultCache.put(newComplHashKey, newCompletionText);
        
    }

    private getCompletionDetails = (completion: string, position: vscode.Position, inputPrefix: string, inputSuffix: string, prompt: string) => {
        return { suggestion: completion, position: position, inputPrefix: inputPrefix, inputSuffix: inputSuffix, prompt: prompt };
    }

    private removeTrailingNewLines(suggestionLines: string[]) {
        while (suggestionLines.length > 0 && suggestionLines.at(-1)?.trim() == "") {
            suggestionLines.pop();
        }
    }
}
