import {Application} from "./application";
import {LlamaResponse} from "./llama-server";
import vscode from "vscode";
import {Utils} from "./utils";

interface CompletionDetails {
    completion: string;
    position: vscode.Position;
    inputPrefix: string;
    inputSuffix: string;
    prompt: string;
}

export class Completion {
    private app: Application
    private isRequestInProgress = false
    isForcedNewRequest = false
    lastCompletion: CompletionDetails = {completion: "", position: new vscode.Position(0, 0), inputPrefix: "", inputSuffix: "", prompt: ""};

    constructor(application: Application) {
        this.app = application;
    }

    // Class field is used instead of a function to make "this" available
    getCompletionItems = async (document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | null> => {
        let group = "GET_COMPLETION_" + Date.now();
        if (!this.app.extConfig.auto && context.triggerKind == vscode.InlineCompletionTriggerKind.Automatic) {
            this.app.logger.addEventLog(group, "MANUAL_MODE_AUTOMATIC_TRIGGERING_RETURN", "")
            return null;
        }

        // Start only if the previous request is finiched
        while (this.isRequestInProgress) {
            await Utils.delay(this.app.extConfig.DELAY_BEFORE_COMPL_REQUEST);
            if (token.isCancellationRequested) {
                this.app.logger.addEventLog(group, "CANCELLATION_TOKEN_RETURN", "waiting")
                return null;
            }
        }
        this.isRequestInProgress = true // Just before leaving the function should be set to false
        this.app.extraContext.lastComplStartTime = Date.now();

        // Gather local context
        const prefixLines = Utils.getPrefixLines(document, position, this.app.extConfig.n_prefix);
        const suffixLines = Utils.getSuffixLines(document, position, this.app.extConfig.n_suffix);
        const lineText = document.lineAt(position.line).text
        const cursorIndex = position.character;
        const linePrefix = lineText.slice(0, cursorIndex);
        const lineSuffix = lineText.slice(cursorIndex);
        const nindent = lineText.length - lineText.trimStart().length
        if (context.triggerKind == vscode.InlineCompletionTriggerKind.Automatic && lineSuffix.length > this.app.extConfig.max_line_suffix) {
            this.isRequestInProgress = false
            this.app.logger.addEventLog(group, "TOO_LONG_SUFFIX_RETURN", "")
            return null
        }
        const prompt = linePrefix;
        const inputPrefix = prefixLines.join('\n') + '\n';
        const inputSuffix = lineSuffix + '\n' + suffixLines.join('\n') + '\n';

        // Reuse cached completion if available.
        try {
            let data: LlamaResponse | undefined
            let hashKey = this.app.lruResultCache.getHash(inputPrefix + "|" + inputSuffix + "|" + prompt)
            let completion = this.getCachedCompletion(hashKey, inputPrefix, inputSuffix, prompt)
            let isCachedResponse = !this.isForcedNewRequest && completion != undefined
            if (!isCachedResponse) {
                this.isForcedNewRequest = false
                if (token.isCancellationRequested){
                    this.isRequestInProgress = false
                    this.app.logger.addEventLog(group, "CANCELLATION_TOKEN_RETURN", "just before server request")
                    return null;
                }
                this.app.statusbar.showThinkingInfo();

                data = await this.app.llamaServer.getFIMCompletion(inputPrefix, inputSuffix, prompt, this.app.extraContext.chunks, nindent)
                if (data != undefined) completion = data.content;
                else completion = undefined
            }
            if (completion == undefined || completion.trim() == ""){
                this.app.statusbar.showInfo(undefined);
                this.isRequestInProgress = false
                this.app.logger.addEventLog(group, "NO_SUGGESTION_RETURN", "")
                return [];
            }

            let suggestionLines = completion.split(/\r?\n/)
            Utils.removeTrailingNewLines(suggestionLines);

            if (this.shouldDiscardSuggestion(suggestionLines, document, position, linePrefix, lineSuffix)) {
                this.app.statusbar.showInfo(undefined);
                this.isRequestInProgress = false
                this.app.logger.addEventLog(group, "DISCARD_SUGGESTION_RETURN", "")
                return [];
            }

            completion = this.updateSuggestion(suggestionLines, lineSuffix);

            if (!isCachedResponse) this.app.lruResultCache.put(hashKey, completion)
            this.lastCompletion = this.getCompletionDetails(completion, position, inputPrefix, inputSuffix, prompt);

            // Run async as not needed for the suggestion
            setTimeout(async () => {
                if (isCachedResponse) this.app.statusbar.showCachedInfo()
                else this.app.statusbar.showInfo(data);
                if (!token.isCancellationRequested && lineSuffix.trim() === ""){
                    await this.cacheFutureSuggestion(inputPrefix, inputSuffix, prompt, suggestionLines);
                    await this.cacheFutureAcceptLineSuggestion(inputPrefix, inputSuffix, prompt, suggestionLines);
                }
                if (!token.isCancellationRequested){
                    this.app.extraContext.addFimContextChunks(position, context, document);
                }
            }, 0);
            this.isRequestInProgress = false
            this.app.logger.addEventLog(group, "NORMAL_RETURN", suggestionLines[0])
            return [this.getCompletion(completion, position)];
        } catch (err) {
            console.error("Error fetching llama completion:", err);
            vscode.window.showInformationMessage(this.app.extConfig.getUiText(`Error getting response. Please check if llama.cpp server is running.`)??"");
            let errorMessage = "Error fetching completion"
            if (err instanceof Error) {
                vscode.window.showInformationMessage(err.message);
                errorMessage = err.message
            }
            this.isRequestInProgress = false
            this.app.logger.addEventLog(group, "ERROR_RETURN", errorMessage)
            return [];
        }
    }

    private getCachedCompletion = (hashKey: string, inputPrefix: string, inputSuffix: string, prompt: string) => {
        let result = this.app.lruResultCache.get(hashKey);
        if (result != undefined) return result
        for (let i = prompt.length; i >= 0; i--) {
            let newPrompt = prompt.slice(0, i)
            let promptCut = prompt.slice(i)
            let hash = this.app.lruResultCache.getHash(inputPrefix + "|" + inputSuffix + "|" + newPrompt)
            let result = this.app.lruResultCache.get(hash)
            if (result != undefined && promptCut == result.slice(0,promptCut.length)) return result.slice(prompt.length - newPrompt.length)
        }

        return undefined
    }

    getCompletion = (completion: string, position: vscode.Position) => {
        return new vscode.InlineCompletionItem(
            completion,
            new vscode.Range(position, position)
        );
    }

    private getCompletionDetails = (completion: string, position: vscode.Position, inputPrefix: string, inputSuffix: string, prompt: string) => {
        return { completion: completion, position: position, inputPrefix: inputPrefix, inputSuffix: inputSuffix, prompt: prompt };
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

    // cut part of the completion in some special cases
    updateSuggestion = (suggestionLines: string[], lineSuffix: string) => {
        if (lineSuffix.trim() != "") {
            if (suggestionLines[0].endsWith(lineSuffix)) return suggestionLines[0].slice(0, -lineSuffix.length);
            if (suggestionLines.length > 1) return suggestionLines[0];
        }

        return suggestionLines.join("\n");
    }

    private  cacheFutureSuggestion = async (inputPrefix: string, inputSuffix: string, prompt: string, suggestionLines: string[]) => {
        let futureInputPrefix = inputPrefix;
        let futureInputSuffix = inputSuffix;
        let futurePrompt = prompt + suggestionLines[0];
        if (suggestionLines.length > 1) {
            futureInputPrefix = inputPrefix + prompt + suggestionLines.slice(0, -1).join('\n') + '\n';
            futurePrompt = suggestionLines[suggestionLines.length - 1];
            let futureInputPrefixLines = futureInputPrefix.slice(0,-1).split(/\r?\n/)
            if (futureInputPrefixLines.length > this.app.extConfig.n_prefix){
                futureInputPrefix = futureInputPrefixLines.slice(futureInputPrefixLines.length - this.app.extConfig.n_prefix).join('\n')+ '\n';
            }
        }
        let futureHashKey = this.app.lruResultCache.getHash(futureInputPrefix + "|" + futureInputSuffix + "|" + futurePrompt)
        let cached_completion = this.app.lruResultCache.get(futureHashKey)
        if (cached_completion != undefined) return;
        let futureData = await this.app.llamaServer.getFIMCompletion(futureInputPrefix, futureInputSuffix, futurePrompt, this.app.extraContext.chunks, prompt.length - prompt.trimStart().length);
        let futureSuggestion = "";
        if (futureData != undefined && futureData.content != undefined && futureData.content.trim() != "") {
            futureSuggestion = futureData.content;
            let suggestionLines = futureSuggestion.split(/\r?\n/)
            Utils.removeTrailingNewLines(suggestionLines);
            futureSuggestion = suggestionLines.join('\n')
            let futureHashKey = this.app.lruResultCache.getHash(futureInputPrefix + "|" + futureInputSuffix + "|" + futurePrompt);
            this.app.lruResultCache.put(futureHashKey, futureSuggestion);
        }
    }

    private  cacheFutureAcceptLineSuggestion = async (inputPrefix: string, inputSuffix: string, prompt: string, suggestionLines: string[]) => {
        // For one line suggestion there is nothing to cache
        if (suggestionLines.length > 1) {
            let futureInputSuffix = inputSuffix;
            let futureInputPrefix = inputPrefix + prompt + suggestionLines[0] + '\n';
            let futurePrompt = "";
            let futureHashKey = this.app.lruResultCache.getHash(futureInputPrefix + "|" + futureInputSuffix + "|" + futurePrompt)
            let futureSuggestion = suggestionLines.slice(1).join('\n')
            let cached_completion = this.app.lruResultCache.get(futureHashKey)
            if (cached_completion != undefined) return;
            else this.app.lruResultCache.put(futureHashKey, futureSuggestion);
        }
    }

    insertNextWord = async (editor: vscode.TextEditor) => {
        // Retrieve the last inline completion item
        const lastSuggestion = this.lastCompletion.completion;
        if (!lastSuggestion) {
            return;
        }
        let lastSuggestioLines = lastSuggestion.split(/\r?\n/)
        let firstLine = lastSuggestioLines[0];
        let prefix = Utils.getLeadingSpaces(firstLine)
        let firstWord = prefix + firstLine.trimStart().split(' ')[0] || '';
        let insertText = firstWord

        if (firstWord === "" && lastSuggestioLines.length > 1) {
            let secondLine = lastSuggestioLines[1];
            prefix = Utils.getLeadingSpaces(secondLine)
            firstWord = prefix + secondLine.trimStart().split(' ')[0] || '';
            insertText = '\n' + firstWord
        }

        // Insert the first word at the cursor
        const position = editor.selection.active;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, insertText);
        });
    }

    insertFirstLine = async (editor: vscode.TextEditor) => {
        // Retrieve the last inline completion item
        const lastItem = this.lastCompletion.completion;
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
}
