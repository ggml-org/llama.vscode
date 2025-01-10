// TODO
// Reuse last completion if the typed letters are the same as the completion first letters
// Next word in case of end of line should be the first word of the next line
import * as vscode from 'vscode';
import { LRUCache } from './lru-cache';
import { ExtraContext } from './extra-context';
import { Configuration } from './configuration';
import { LlamaResponse, LlamaServer } from './llama-server';

export class Architect {
    private extConfig: Configuration;
    private extraContext: ExtraContext;
    private llamaServer: LlamaServer
    private lruResultCache: LRUCache
    private fileSaveTimeout: NodeJS.Timeout | undefined;
    private lastCompletion = ""
    private myStatusBarItem:vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    
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
                const lastItem = this.lastCompletion;
                if (!lastItem) {
                    return;
                }
                const firstLine = lastItem.split('\n')[0] || '';

                // Insert the first line at the cursor
                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, firstLine);
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
                const lastItem = this.lastCompletion;
                if (!lastItem) {
                    return;
                }
                let prefix = "";
                let firstLine = lastItem.split('\n')[0];
                if (firstLine[0] === ' ') prefix = " "
                const firstWord = prefix + firstLine.trimStart().split(' ')[0] || '';

                // Insert the first line at the cursor
                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, firstWord);
                });
            }
        );
        context.subscriptions.push(acceptFirstWordCommand);
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
        await this.delay(this.extConfig.DELAY_BEFORE_COMPL_REQUEST);
        if (token.isCancellationRequested) {
            return null;
        }
        if (!this.extConfig.auto && context.triggerKind == vscode.InlineCompletionTriggerKind.Automatic) {
            return null;
        }

        // Gather local context
        const prefixLines = this.getPrefixLines(document, position, this.extConfig.n_prefix);
        const suffixLines = this.getSuffixLines(document, position, this.extConfig.n_suffix);
        const lineText = document.lineAt(position.line).text
        const cursorIndex = position.character;
        const linePrefix = lineText.slice(0, cursorIndex);
        const lineSuffix = lineText.slice(cursorIndex);
        if (context.triggerKind == vscode.InlineCompletionTriggerKind.Automatic && lineSuffix.length > this.extConfig.max_line_suffix) {
            return null
        }
        const prompt = linePrefix;
        const inputPrefix = prefixLines.join('\n') + '\n';
        const inputSuffix = lineSuffix + '\n' + suffixLines.join('\n') + '\n';

        // Reuse cached completion if available
        let hashKey = this.lruResultCache.getHash(inputPrefix + "|" + inputSuffix + "|" + prompt)
        let cached_completion = this.lruResultCache.get(hashKey)
        if (cached_completion != undefined) {
            this.lastCompletion = cached_completion;
            setTimeout(async () => {
                await this.cacheFutureSuggestion(inputPrefix, inputSuffix, prompt, this.lastCompletion.split(/\r?\n/));
            }, 0);
            return [this.getSuggestion(cached_completion, position)];
        }

        try {
            if (token.isCancellationRequested) return null;

            const data = await this.llamaServer.getLlamaCompletion(inputPrefix, inputSuffix, prompt, this.extraContext.chunks)
            if (data == undefined || !data.content) return [];
            const suggestionText: string = data.content;

            let suggestionLines = suggestionText.split(/\r?\n/)
            // remove trailing new lines
            while (suggestionLines.length > 0 && suggestionLines.at(-1)?.trim() == "") {
                suggestionLines.pop()
            }
            if (suggestionLines.length == 0) return [];

            let discardSuggestion = this.shouldDiscardSuggestion(suggestionLines, document, position, linePrefix, lineSuffix);
            if (discardSuggestion) return [];

            this.lruResultCache.put(hashKey, suggestionText)
            this.lastCompletion = suggestionText;

            // Run async as not needed for the suggestion
            setTimeout(async () => {
                this.showInfo(data);
                await this.cacheFutureSuggestion(inputPrefix, inputSuffix, prompt, suggestionLines);
                this.extraContext.addFimContextChunks(position, context, document);
            }, 0);

            return [this.getSuggestion(suggestionLines.join('\n'), position)];
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
        if (cached_completion != undefined) return;
        let futureData = await this.llamaServer.getLlamaCompletion(futureInputPrefix, futureInputSuffix, futurePrompt, this.extraContext.chunks);
        let futureSuggestion = "";
        if (futureData != undefined && futureData.content != undefined) {
            futureSuggestion = futureData.content;
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

    showInfo = (data: LlamaResponse) => {
        if (this.extConfig.show_info) {
            if (data.truncated) this.myStatusBarItem.text = `llama-vscode | c: ${data.tokens_cached} / ${data.generation_settings.n_ctx}`;
            else this.myStatusBarItem.text = `llama-vscode | c: ${data.tokens_cached} / ${data.generation_settings.n_ctx}, r: ${this.extraContext.chunks.length} / ${this.extConfig.ring_n_chunks}, e: ${this.extraContext.ringNEvict}, q: ${this.extraContext.queuedChunks.length} / ${this.extConfig.MAX_QUEUED_CHUNKS} | p: ${data.timings?.prompt_n} (${data.timings?.prompt_ms?.toFixed(2)} ms, ${data.timings?.prompt_per_second?.toFixed(2)} t/s) | g: ${data.timings?.predicted_n} (${data.timings?.predicted_ms?.toFixed(2)} ms, ${data.timings?.predicted_per_second?.toFixed(2)} t/s) | t: ${Date.now() - this.extraContext.lastComplStartTime} ms `;
            //vscode.window.showInformationMessage(`llama-vscode | c: ${data.tokens_cached} / ${data.generation_settings.tokens_evaluated}, r: ${chunks.length} / ${llama_config.ring_n_chunks}, e: ${ringNEvict}, q: ${queuedChunks.length} / ${MAX_QUEUED_CHUNKS} | p: ${data.timings?.prompt_n} (${data.timings?.prompt_ms?.toFixed(2)} ms, ${data.timings?.prompt_per_second?.toFixed(2)} t/s) | g: ${data.timings?.predicted_n} (${data.timings?.predicted_ms?.toFixed(2)} ms, ${data.timings?.predicted_per_second?.toFixed(2)} t/s) | t: ${Date.now() - fimStartTime} ms `);
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
        
        // truncate the suggestion if the first line is empty
        if (suggestionLines.length == 1 && suggestionLines[0].trim() == "") discardSuggestion = true;

        // ... and the next lines are repeated
        if (suggestionLines.length > 1
            && suggestionLines[0].trim() == ""
            && suggestionLines.slice(1).every((value, index) => value === document.lineAt((position.line + 1) + index).text))
            discardSuggestion = true;
        
        // if last line
        

        // truncate the suggestion if it repeats the suffix
        if (suggestionLines.length == 1 && suggestionLines[0] == lineSuffix) discardSuggestion = true;

        // if cursor on the last line don't discard
        if (position.line == document.lineCount - 1) return false;

        // find the first non-empty line (strip whitespace)
        let firstNonEmptyDocLine = position.line + 1;
        while (firstNonEmptyDocLine < document.lineCount && document.lineAt(firstNonEmptyDocLine).text.trim() === "")
            firstNonEmptyDocLine++;

        if (linePrefix + suggestionLines[0] === document.lineAt(firstNonEmptyDocLine).text) {
            // truncate the suggestion if it repeats the next line
            if (suggestionLines.length == 1) discardSuggestion = true;

            // ... or if the second line of the suggestion is the prefix of line l:cmp_y + 1
            if (suggestionLines.length === 2
                && suggestionLines[1] == document.lineAt(firstNonEmptyDocLine + 1).text.slice(0, suggestionLines[1].length))
                discardSuggestion = true;

            // ... or if the middle chunk of lines of the suggestion is the same as the following non empty lines of the document
            if (suggestionLines.length > 2 && suggestionLines.slice(1).every((value, index) => value === document.lineAt((firstNonEmptyDocLine + 1) + index).text))
                discardSuggestion = true;
        }
        return discardSuggestion;
    }
}
