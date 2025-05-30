import vscode from "vscode";
import { exec } from 'child_process';
import fs from 'fs';
import { ChunkEntry } from './types'
import pm from 'picomatch'

interface BM25Stats {
    avgDocLength: number;
    docFreq: Record<string, number>;
    docLengths: number[];
    termFreq: Record<string, Record<number, number>>
    totalDocs: number;
}

export class Utils {
    static getLeadingSpaces = (input: string): string => {
        // Match the leading spaces using a regular expression
        const match = input.match(/^[ \t]*/);
        return match ? match[0] : "";
    }

    static delay = (ms: number) => {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    static getPrefixLines = (document: vscode.TextDocument, position: vscode.Position, nPrefix: number): string[] => {
        const startLine = Math.max(0, position.line - nPrefix);
        return Array.from({ length: position.line - startLine }, (_, i) => document.lineAt(startLine + i).text);
    }

    static getSuffixLines = (document: vscode.TextDocument, position: vscode.Position, nSuffix: number): string[] => {
        const endLine = Math.min(document.lineCount - 1, position.line + nSuffix);
        return Array.from({ length: endLine - position.line }, (_, i) => document.lineAt(position.line + 1 + i).text);
    }

    static removeTrailingNewLines = (suggestionLines: string[]) => {
        while (suggestionLines.length > 0 && suggestionLines.at(-1)?.trim() == "") {
            suggestionLines.pop();
        }
    }

    static getChunksInPlainText = (chunksToSend: any[]) => {
        let extraCont = "Here are pieces of code from different files of the project: \n"
        + chunksToSend.reduce((accumulator, currentValue) => accumulator + "\nFile Name: "
        + currentValue.filename + "\nText:\n" + currentValue.text + "\n\n", "");
        return extraCont;
    }

    static computeBM25Stats = (docs: string[][]): BM25Stats => {
        const docFreq: Map<string, number> = new Map();
        const termFreq: Map<string, Map<number, number>> = new Map();
        const docLengths: number[] = [];
        let totalDocs = 0;

        for (let docId = 0; docId < docs.length; docId++) {
            const doc = docs[docId];
            docLengths.push(doc.length);
            const termsInDoc = new Set<string>();

            for (const term of doc) {
                // Update term frequency (per-doc)
                if (!termFreq.has(term)) {
                    termFreq.set(term, new Map());
                }
                const termDocMap = termFreq.get(term)!;
                termDocMap.set(docId, (termDocMap.get(docId) || 0) + 1);

                termsInDoc.add(term);
            }

            // Update document frequency (global)
            for (const term of termsInDoc) {
                docFreq.set(term, (docFreq.get(term) || 0) + 1);
            }

            totalDocs++;
        }

        const avgDocLength = docLengths.reduce((a, b) => a + b, 0) / totalDocs;
        return {
            avgDocLength,
            docFreq: Object.fromEntries(docFreq),  // Convert to Record if needed
            docLengths,
            termFreq: Object.fromEntries(
                Array.from(termFreq).map(([k, v]) => [k, Object.fromEntries(v)])
            ),
            totalDocs
        };
    };

    static bm25Score = (
        queryTerms: string[],
        docIndex: number,
        stats: BM25Stats,
        k1 = 1.5,
        b = 0.75
    ): number => {
        let score = 0;

        for (const term of queryTerms) {
            if (!stats.termFreq[term]) continue;

            const tf = stats.termFreq[term][docIndex] || 0;
            const idf = Math.log(
                (stats.totalDocs - stats.docFreq[term] + 0.5) / (stats.docFreq[term] + 0.5) + 1
            );

            const numerator = tf * (k1 + 1);
            const denominator = tf + k1 * (1 - b + b * stats.docLengths[docIndex] / stats.avgDocLength);

            score += idf * numerator / denominator;
        }

        return score;
    }

    static expandSelectionToFullLines(editor: vscode.TextEditor) {
        if (!editor) {
            return;
        }

        const document = editor.document;
        const selections = editor.selections;

        const newSelections = selections.map(selection => {
            const startLine = selection.start.line;
            const endLine = selection.end.line;

            const newStart = new vscode.Position(startLine, 0);

            const endLineText = document.lineAt(endLine).text;
            const newEnd = new vscode.Position(endLine, endLineText.length);

            return new vscode.Selection(newStart, newEnd);
        });

        editor.selections = newSelections;
    }

    static  removeLeadingSpaces = (textToUpdate: string): { removedSpaces: number, updatedText: string } => {
        const lines = textToUpdate.split(/\r?\n/);
        
        // Find the length of the shortest leading space
        let nSpacesToRemove = Infinity;
        
        for (const line of lines) {
            if (line.trim().length === 0) continue;
            
            const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
            if (leadingSpaces < nSpacesToRemove) {
                nSpacesToRemove = leadingSpaces;
            }
        }
        
        if (nSpacesToRemove === Infinity || nSpacesToRemove === 0) {
            return {
                removedSpaces: 0,
                updatedText: textToUpdate
            };
        }
        
        // Remove nSpacesToRemove leading characters from each line
        const updatedLines = lines.map(line => 
            line.length >= nSpacesToRemove 
                ? line.substring(nSpacesToRemove) 
                : line
        );
        
        return {
            removedSpaces: nSpacesToRemove,
            updatedText: updatedLines.join('\n')
        };
    }

    static addLeadingSpaces = (textToUpdate: string, spacesToAdd: number): string =>{
        const spaces = ' '.repeat(spacesToAdd);
        
        return textToUpdate
            .split('\n')
            .map(line => spaces + line)
            .join('\n');
    }

    static  executeTerminalCommand = async (command: string, cwd?: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const options = cwd ? { cwd } : undefined;
            
            command = process.platform === 'win32' 
                ? `powershell -Command "${command.replace(/"/g, '\\"')}"`
                : command;
            
            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    resolve(error.message);
                    return;
                } else resolve(stdout.toString());
            });
        });
    }

    static isModifyingCommand = (command: string): boolean => {
        if (!command || typeof command !== 'string') {
            return false;
        }

        const normalizedCmd = command.trim().toLowerCase();

        // List of modifying command patterns (both Windows and Unix)
        const modifyingPatterns = [
            // File operations
            /^(rm|del|erase|remove)\b/,
            /^rd\b/,
            /^rmdir\b/,
            /^(mv|move|ren|rename)\b/,
            /^(cp|copy)\b/,
            /^mkdir\b/,
            /^ni\b/,          // New-Item (PowerShell)
            /^out\-file\b/,
            /^set\-content\b/,
            /^add\-content\b/,
            /^scp\b/,
            /^rsync\b/,
            
            // System modifications
            /^chmod\b/,
            /^chown\b/,
            /^attrib\b/,
            /^icacls\b/,
            /^cacls\b/,
            /^reg\b/,         // regedit operations
            /^netsh\b/,
            /^net\b/,
            /^diskpart\b/,
            /^format\b/,
            
            // Package management
            /^(apt|yum|dnf|pacman|brew|pip|npm|pnpm|yarn|dotnet|winget|choco)\b/,
            
            // Process management
            /^(kill|taskkill|stop\-process)\b/,
            /^start\b/,
            
            // Network operations
            /^(ssh|ftp|sftp)\b/,
            
            // Installation/execution
            /^\.\/\S+/,
            /^\.\\\S+/,
            /^\w+:\\\S+/,
            /^\.\S+\b/,
            /^install\b/,
            /^uninstall\b/,
            /^setup\b/,
            /^msiexec\b/,
            
            // Dangerous patterns
            /^>/,             // Output redirection (overwrite)
            /^>>/,            // Output redirection (append)
            /^\|/,            // Piping might modify if the receiving command does
            /^&\S*/,          // Command chaining
            /^;\S*/,          // Command sequencing
            /^\$\w+\s*=/      // Variable assignment (might lead to modifications)
        ];

        if (modifyingPatterns.some(pattern => pattern.test(normalizedCmd))) {
            return true;
        }

        const readOnlyPatterns = [
            /^echo\b/,
            /^dir\b/,
            /^ls\b/,
            /^cat\b/,
            /^type\b/,
            /^get\-content\b/,
            /^get\-childitem\b/,
            /^pwd\b/,
            /^cd\b/,
            /^chdir\b/,
            /^where\b/,
            /^which\b/,
            /^find\b/,
            /^grep\b/,
            /^select\-string\b/,
            /^help\b/,
            /^man\b/,
            /^--help\b/,
            /^-h\b/,
            /^\?/,
            /^exit\b/,
            /^clear\b/,
            /^cls\b/
        ];

        if (readOnlyPatterns.some(pattern => pattern.test(normalizedCmd))) {
            return false;
        }

        return true;
    }

    static showYesNoDialog = async (message: string): Promise<boolean> => {
        const choice = await vscode.window.showInformationMessage(
            message,
            { modal: true }, // Makes the dialog modal (blocks interaction until resolved)
            'Yes',
            'No'
        );

        return choice === 'Yes';
    }

    static getAbsolutePath = async (shortFileName: string): Promise<string | undefined> => {
        try {
            // Search for files matching the name (glob pattern requires **/)
            const files = await vscode.workspace.findFiles(`**/${shortFileName}`, null, 1);
            
            if (files.length > 0) {
                return files[0].fsPath;
            }
            
            vscode.window.showWarningMessage(`File "${shortFileName}" not found in workspace`);
            return undefined;
        } catch (error) {
            vscode.window.showErrorMessage(`Error searching for file: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }

    static listDirectoryContents = (absolutePath: string): string => {
        try {       
            if (!fs.existsSync(absolutePath)) {
                return `Error: Path does not exist - ${absolutePath}`;
            }
        
            if (!fs.statSync(absolutePath).isDirectory()) {
                return `Error: Path is not a directory - ${absolutePath}`;
            }
            
            const contents = fs.readdirSync(absolutePath, { withFileTypes: true });
            
            let output = `Contents of ${absolutePath}:\n\n`;
            
            const directories = contents.filter(dirent => dirent.isDirectory()).map(dirent => `[DIR] ${dirent.name}`);
            const files = contents.filter(dirent => dirent.isFile()).map(dirent => `[FILE] ${dirent.name}`);
            
            output += directories.join('\n');
            if (directories.length && files.length) output += '\n';
            output += files.join('\n');
            
            return output;
        } catch (error) {
            return `Error reading directory: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    static getRegexpMatches = (
        includeGlob: string,
        excludeGlobPtr: string,
        searchPattern: string,
        chunks: Map<number, ChunkEntry>
        ): string => {

        const MAX_REG_EXP_MATCHES = 50;        
        let matches:string = "";
        let totalMatches:number = 0;
        const regexSearch = new RegExp(searchPattern);
        const isMatchInclude = includeGlob.trim() == "" ? undefined : pm(includeGlob);
        const isMatchExclude = excludeGlobPtr.trim() == "" ? undefined : pm(excludeGlobPtr);
        let valuesIterator = chunks.values()
        let chunkIter = valuesIterator.next();
        while (!chunkIter.done){
            let chunk = chunkIter.value;
            if (chunk && (isMatchInclude == undefined || isMatchInclude(chunk.uri)) && (isMatchExclude == undefined || !isMatchExclude(chunk.uri))){
                const lines = chunk.content.split('\n');
                let index = 0;
                for (const line of lines){
                    if (regexSearch.test(line)) {
                        matches += "\n"+ chunk.uri + ":" + (chunk.firstLine + index) + ": " + line;
                        totalMatches++;
                        if (totalMatches > MAX_REG_EXP_MATCHES) return matches;
                    }
                    index++;
                }
            }
            chunkIter = valuesIterator.next()
        }
        if (matches.trim() == "") matches = "No matches found"
        return matches;
    } 
}
