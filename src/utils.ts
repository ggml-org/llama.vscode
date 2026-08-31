import vscode, { QuickPickItem, Uri } from "vscode";
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ChunkEntry, Env, LlmModel } from './types'
import pm from 'picomatch'
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { Application } from "./application";
import { UI_TEXT_KEYS } from "./constants";


interface BM25Stats {
    avgDocLength: number;
    docFreq: Record<string, number>;
    docLengths: number[];
    termFreq: Record<string, Record<number, number>>
    totalDocs: number;
}

export class Utils {
    static MSG_NO_USER_PERMISSION = "The user doesn't give a permission to execute the request!";
    static EMPTY_CHAT = {name: "", id: ""}

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
        const isMatchInclude = includeGlob == undefined || includeGlob.trim() == "" ? undefined : pm(includeGlob);
        const isMatchExclude = excludeGlobPtr == undefined || excludeGlobPtr.trim() == "" ? undefined : pm(excludeGlobPtr);
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

    static getAbsolutFilePath = (filePath:string): string => {        
        if (path.isAbsolute(filePath)) {
            return filePath;
        } else {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                return "";
            }
            
            // Resolve against first workspace folder
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const absolutePath = path.resolve(workspaceRoot, filePath);
            return absolutePath;
        }
    }

    static deleteFile = (filePath: string): string => {
        try {
            const absolutePath = Utils.getAbsolutFilePath(filePath);
            if (!fs.existsSync(absolutePath)) {
                return `File not found at ${filePath}`;
            }
            fs.unlinkSync(absolutePath);
        } catch (error) {
            if (error instanceof Error) {
                return `Failed to delete file at ${filePath}: ${error.message}`;
            }
            return `Failed to delete file at ${filePath} due to an unknown error`;
        }

        return `Successfully deleted file ${filePath}`;
    }

    static fileOrDirExists = async (path: string): Promise<boolean> => {
        try {
            await fs.promises.access(path);
            return true;
        } catch {
            return false;
        }
    }

    static escapeRegExp = (string: string): string => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    static editFile = (fileContent: string, edits: string): string => {
        const existingCodeMarker = '// ... existing code ...';
        const editParts = edits.split(existingCodeMarker).filter(part => part.trim() !== '');
        let currentContent = fileContent;
        
        for (let i = 0; i < editParts.length; i++) {
            const part = editParts[i];
            const lines = part.split(/\r?\n/);
            
            let contextBefore = '';
            let contextAfter = '';
            
            if (i === 0 && !edits.startsWith(existingCodeMarker)) {
                // First edit part: use only contextAfter if available
                if (lines.length >= 3) {
                    contextAfter = lines.slice(-3).join('\n');
                } else {
                    contextAfter = lines.join('\n');
                }
            } else if (i === editParts.length - 1 && !edits.endsWith(existingCodeMarker)) {
                // Last edit part: use only contextBefore if available
                if (lines.length >= 3) {
                    contextBefore = lines.slice(0, 3).join('\n');
                } else {
                    contextBefore = lines.join('\n');
                }
            } else {
                // Middle edit parts: use both contextBefore and contextAfter
                if (lines.length >= 6) {
                    contextBefore = lines.slice(0, 3).join('\n');
                    contextAfter = lines.slice(-3).join('\n');
                } else {
                    const half = Math.floor(lines.length / 2);
                    contextBefore = lines.slice(0, half).join('\n');
                    contextAfter = lines.slice(-half).join('\n');
                }
            }
            
            if (i === 0 && contextAfter && !edits.trim().startsWith(existingCodeMarker)) {
                // First edit part: match from start to contextAfter
                const afterPattern = Utils.escapeRegExp(contextAfter);
                const regex = new RegExp(`([\\s\\S]*?)${afterPattern}`);
                const match = currentContent.match(regex);
                if (match) {
                    const startPos = match.index! + match[1].length;
                    currentContent = part + currentContent.substring(startPos + match[0].length - match[1].length);
                }
            } else if (i === editParts.length - 1 && contextBefore && !edits.trim().endsWith(existingCodeMarker)) {
                // Last edit part: match from contextBefore to end
                const beforePattern = Utils.escapeRegExp(contextBefore);
                const regex = new RegExp(`${beforePattern}([\\s\\S]*)`);
                const match = currentContent.match(regex);
                // TODO - use the last match
                if (match) {
                    const startPos = match.index!;
                    currentContent = currentContent.substring(0, startPos) + part;
                }
            } else if (contextBefore && contextAfter) {
                // Middle edit parts: match between contextBefore and contextAfter
                const beforePattern = Utils.escapeRegExp(contextBefore);
                const afterPattern = Utils.escapeRegExp(contextAfter);
                const regex = new RegExp(`${beforePattern}([\\s\\S]*?)${afterPattern}`);
                currentContent = currentContent.replace(regex, part);
            }
        }
        
        return currentContent;
    }

    /**
     * Removes the UTF-8 / UTF-16 BE BOM from the start of a string.
     * Returns the original string if no BOM is found.
     */
    static stripBOMFromString = (content: string): string => {
    // charCodeAt(0) === 0xFEFF is the BOM marker
    if (content.charCodeAt(0) === 0xFEFF) {
        return content.slice(1);
    }
    return content;
    }

    /**
     * Checks if `substring` appears exactly once in `str`.
     * @param str - The string to search in.
     * @param sub - The substring to search for.
     * @returns 0 if not found 1 if found once 2 if found more than once.
     */
    static containsSubstringInfo = (str: string, sub: string): number => {
        // Empty substring appears at every index; treat as not exactly once.
        if (sub === "") return 0;

        const firstIndex = str.indexOf(sub);
        if (firstIndex === -1) return 0;

        const lastIndex = str.lastIndexOf(sub);
        if (firstIndex === lastIndex) return 1;
        else return 2;
    }

    static findReplaceFile = async (
        filePath: string, 
        searchText: string, 
        replaceText: string, 
        replaceAll: boolean,
        fileReadTimestamps: Map<string, number>
    ): Promise<string> => {
        try {
            // --- 1. Resolve path against workspaces ---
            let absolutePath: string = filePath;
            if (path.isAbsolute(filePath)) {
                absolutePath = path.resolve(filePath);
            } else {
                if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                    return "Error: No workspace folder found.";
                }
                let resolved = false;
                for (const folder of vscode.workspace.workspaceFolders) {
                    const potential = path.join(folder.uri.fsPath, filePath);
                    const relative = path.relative(folder.uri.fsPath, potential);
                    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
                        absolutePath = potential;
                        resolved = true;
                        break;
                    }
                }
                if (!resolved) {
                    return `Error: Cannot resolve relative path "${filePath}" against any workspace folder.`;
                }
            }

            // --- 2. Check file existence ---
            const fileExists = await fs.promises.access(absolutePath).then(() => true).catch(() => false);

            // --- 3. Read content if exists ---
            let content = "";
            if (fileExists) {
                content = (await fs.promises.readFile(absolutePath, 'utf-8')).split(/\r?\n/).join("\n");
                content = Utils.stripBOMFromString(content);
            }

            // --- 4. Normalize searchText ---
            const normalizedSearch = searchText.split(/\r?\n/).join("\n");

            // --- 5. Creation mode ---
            if (normalizedSearch.trim() === '') {
                if (fileExists) {
                    return `Error: File already exists at "${absolutePath}". Use edit mode (non-empty search) to modify it.`;
                }
                await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
                await fs.promises.writeFile(absolutePath, replaceText, 'utf-8');
                return `Success: File created at "${absolutePath}".`;
            }

            // --- 6. Edit mode ---
            if (!fileExists) {
                return `Error: Cannot edit non-existent file "${absolutePath}". To create it, set search to an empty string.`;
            }

            // --- 7. Staleness check (recommended addition) ---
            const stats = await fs.promises.stat(absolutePath);
            const lastModified = fileReadTimestamps.get(absolutePath);
            if (!lastModified)  return `Error: File "${absolutePath}" was not read. Read the file and retry.`;
            if (lastModified && stats.mtimeMs !== lastModified) {
                return `Error: File "${absolutePath}" was modified externally since last read. Re-read the file and retry.`;
            }

            // --- 8. Uniqueness check ---
            const matchCount = Utils.containsSubstringInfo(content, normalizedSearch);
            if (matchCount === 0) {
                return `Error: Search string not found in "${filePath}".`;
            }
            if (matchCount > 1 && !replaceAll) {
                return `Error: Found ${matchCount} matches in "${filePath}". Provide more context or set replace_all=true.`;
            }

            // --- 9. Perform replacement ---
            const newContent = content.split(normalizedSearch).join(replaceText);
            await fs.promises.writeFile(absolutePath, newContent, 'utf-8');

            // Update timestamp
            const newStats = await fs.promises.stat(absolutePath);
            fileReadTimestamps.set(absolutePath, newStats.mtimeMs);

            return `Success: File "${filePath}" updated.`;

        } catch (error) {
            return `Error editing file "${filePath}": ${error instanceof Error ? error.message : String(error)}`;
        }
    };

    /**
     * Performs multiple find-replace operations on a file sequentially.
     * All edits are applied in-memory first. If any edit fails, the file is NOT modified.
     * Only if ALL edits succeed, the file is written to disk.
     */
    static multiFindReplaceFile = async (
        filePath: string, 
        edits: Array<{ old_string: string; new_string: string; replace_all?: boolean }>,
        fileReadTimestamps: Map<string, number>
    ): Promise<string> => {
        try {
            // --- 1. Resolve path against workspaces ---
            let absolutePath: string = filePath;
            if (path.isAbsolute(filePath)) {
                absolutePath = path.resolve(filePath);
            } else {
                if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                    return "Error: No workspace folder found.";
                }
                let resolved = false;
                for (const folder of vscode.workspace.workspaceFolders) {
                    const potential = path.join(folder.uri.fsPath, filePath);
                    const relative = path.relative(folder.uri.fsPath, potential);
                    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
                        absolutePath = potential;
                        resolved = true;
                        break;
                    }
                }
                if (!resolved) {
                    return `Error: Cannot resolve relative path "${filePath}" against any workspace folder.`;
                }
            }

            // --- 2. Check file existence ---
            const fileExists = await fs.promises.access(absolutePath).then(() => true).catch(() => false);

            // --- 3. Read content if exists ---
            let content = "";
            if (fileExists) {
                content = (await fs.promises.readFile(absolutePath, 'utf-8')).split(/\r?\n/).join("\n");
                content = Utils.stripBOMFromString(content);
            }

            // --- 4. Staleness check ---
            const stats = await fs.promises.stat(absolutePath);
            const lastModified = fileReadTimestamps.get(absolutePath);
            if (!lastModified)  return `Error: File "${absolutePath}" was not read. Read the file and retry.`;
            if (lastModified && stats.mtimeMs !== lastModified) {
                return `Error: File "${absolutePath}" was modified externally since last read. Re-read the file and retry.`;
            }

            // --- 5. Apply each edit sequentially in-memory ---
            for (let i = 0; i < edits.length; i++) {
                const edit = edits[i];
                const normalizedSearch = edit.old_string.split(/\r?\n/).join("\n");

                // Creation mode (empty search string) - not supported in multi-edit for existing files
                if (normalizedSearch.trim() === '') {
                    if (fileExists) {
                        return `Error: Edit ${i + 1} failed - File already exists at "${absolutePath}". Use edit mode (non-empty search) to modify it.`;
                    }
                    return `Error: Edit ${i + 1} failed - Cannot create file in multi-edit mode. File must already exist.`;
                }

                // Edit mode - file must exist
                if (!fileExists) {
                    return `Error: Edit ${i + 1} failed - Cannot edit non-existent file "${absolutePath}".`;
                }

                // Uniqueness check
                const matchCount = Utils.containsSubstringInfo(content, normalizedSearch);
                if (matchCount === 0) {
                    return `Error: Edit ${i + 1} failed - Search string not found in "${filePath}".`;
                }
                if (matchCount > 1 && !edit.replace_all) {
                    return `Error: Edit ${i + 1} failed - Found more than once matches in "${filePath}". Provide more context or set replace_all=true.`;
                }

                // Perform replacement in-memory
                content = content.split(normalizedSearch).join(edit.new_string);
            }

            // --- 6. All edits succeeded, write to file ---
            await fs.promises.writeFile(absolutePath, content, 'utf-8');

            // Update timestamp
            const newStats = await fs.promises.stat(absolutePath);
            fileReadTimestamps.set(absolutePath, newStats.mtimeMs);

            return `Success: File "${filePath}" updated with ${edits.length} edit(s).`;

        } catch (error) {
            return `Error editing file "${filePath}": ${error instanceof Error ? error.message : String(error)}`;
        }
    };

    static fetchWebPage = async (url: string): Promise<string> => {
        // Validate the URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch (error) {
            throw new Error(`Invalid URL: ${url}`);
        }

        // Select the appropriate protocol module
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        return new Promise((resolve, reject) => {
            const req = protocol.get(url, (res) => {
                // Check status code
                if (res.statusCode !== 200) {
                    res.resume(); // Consume response data to free up memory
                    reject(new Error(`Request failed with status code ${res.statusCode}`));
                    return;
                }

                // Set encoding
                res.setEncoding('utf8');

                let rawData = '';
                
                // Collect chunks of data
                res.on('data', (chunk) => {
                    rawData += chunk;
                });

                // Resolve when complete
                res.on('end', () => {
                    resolve(rawData);
                });
            });

            // Handle errors
            req.on('error', (error) => {
                reject(new Error(`Request error: ${error.message}`));
            });

            // Set timeout
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timed out after 10 seconds'));
            });
        });
    }

    static extractTextFromHtml = (html: string): string => {
        // Basic HTML tag removal
        let text = html
            .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
            .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Decode HTML entities
        text = text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");

        return text;
    }

    static trimTrailingSlash = (s: string): string => {
        if (s.length > 0 && s[s.length - 1] === "/") {
            return s.slice(0, -1);
        }
        return s;
    };

    static readExtensionFile = async (relativePath: string): Promise<string> => {
        // Get the extension's context (passed in activation)
        const extension = vscode.extensions.getExtension('ggml-org.llama-vscode');
        if (!extension) {
            throw new Error('Extension not found');
        }

        const absolitePath = path.join(extension.extensionPath, relativePath);

        try {
            // Read the file content
            return await fs.promises.readFile(absolitePath, 'utf-8');
        } catch (error) {
            return `Failed to read extension file: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    static getExtensionHelp = async () => {
        return Utils.readExtensionFile("resources/help.md")
    }

    static removeFaOption = (input: string): string => {
        return input.replace(/-fa[^-]*/g, '');
    }

    static removeFaOptionFromModels = (chatModels: LlmModel[]) => {
        for (let model of chatModels) {
            if (model.localStartCommand) model.localStartCommand = Utils.removeFaOption(model.localStartCommand);
        }
    }

    static removeFaOptionFromEnvs = (envs: Env[]) => {
        for (let env of envs) {
            if (env.chat && env.chat.localStartCommand) env.chat.localStartCommand = Utils.removeFaOption(env.chat.localStartCommand);
            if (env.tools && env.tools.localStartCommand) env.tools.localStartCommand = Utils.removeFaOption(env.tools.localStartCommand);
        }
    }

    static isTimeToUpgrade = (date1: Date, date2: Date, interval: number): boolean => {
        const twentyFourHoursInMs = interval  * 60 * 60 * 1000; // 24 hours in milliseconds
        const timeDifference = date2.getTime() - date1.getTime();
        
        return timeDifference >= twentyFourHoursInMs;
    }



    static getFunctionFromFile = (filePath: string) => {
        let functionCode = fs.readFileSync(filePath, 'utf-8');
        const functionString = '(' + functionCode + ')';
        const toolFunction = eval(functionString);
        return toolFunction;
    }

    static async getValidatedInput(prompt: string, validator: (input: string) => boolean, maxAttempts: number = 3, options: vscode.InputBoxOptions = {}): Promise<string | undefined> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const fullOptions: vscode.InputBoxOptions = {
                prompt,
                ...options
            };
            const input = await vscode.window.showInputBox(fullOptions);

            if (input === undefined) {
                return undefined; // User cancelled
            }

            if (validator(input)) {
                return input;
            }

            if (attempt < maxAttempts) {
                vscode.window.showWarningMessage(`Invalid input on attempt ${attempt}. ${attempt + 1 - 1} more attempts.`);
            }
        }

        vscode.window.showErrorMessage(`Maximum attempts (${maxAttempts}) reached. Input validation failed.`);
        return undefined;
    }

    static getStandardQpList(list:any[], prefix: string, lastModelNumber: number = 0) {
        const items: QuickPickItem[] = [];
        let i = lastModelNumber;
        for (let elem of list) {
            i++;
            items.push({
                label: i + ". " + prefix + elem.name,
                description: elem.description,
            });
        }
        return items;
    } 



    static removeFirstAndLastLinesIfBackticks = (input: string): string => {
        const lines = input.split('\n'); // Split the string into lines

        // Remove the first line if it starts with ```
        if (lines[0]?.trim().startsWith('```')) {
            lines.shift(); // Remove the first line
        }

        // Remove the last line if it starts with ```
        if (lines[lines.length - 1]?.trim().startsWith('```')) {
            lines.pop(); // Remove the last line
        }

        return lines.join('\n'); // Join the remaining lines back into a string
    }

    static getTodosFilePath = () => {
        let filePath = "";
        const TODO_FILE = '.llama-vscode-todos.md';
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            filePath = TODO_FILE;
        } else {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            filePath = path.join(workspaceRoot, TODO_FILE);
        }
        return filePath;
    }

    static getWorkspaceFolder = () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return "";
        } else {
            return vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
    }

    static getErrors(uri: vscode.Uri): string {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        
        if (diagnostics.length === 0) {
            return '';
        }
        
        const lines: string[] = [];
        lines.push(`Diagnostics for ${uri.fsPath}:`);
        lines.push('='.repeat(50));
        
        diagnostics.forEach((diag, index) => {
            const severity = Utils.getSeverityString(diag.severity);
            const line = diag.range.start.line + 1;
            const col = diag.range.start.character + 1;
            const source = diag.source || 'unknown';
            
            lines.push(`[${index + 1}] ${severity} (${source}): ${diag.message}`);
            lines.push(`    at line ${line}, column ${col}`);
            if (diag.code) {
                lines.push(`    code: ${diag.code}`);
            }
            lines.push('');
        });
        
        return lines.join('\n');
    }


    static getAllErrors(): string {
        const allDiagnostics = vscode.languages.getDiagnostics();
        
        if (allDiagnostics.length === 0) {
            return '✅ No diagnostics found in the workspace.';
        }
        
        // Count total issues by severity
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalInfo = 0;
        let totalHints = 0;
        
        const sections: string[] = [];
        sections.push('📊 WORKSPACE DIAGNOSTICS SUMMARY');
        sections.push('='.repeat(50));
        
        // Process each file
        allDiagnostics.forEach(([uri, diagnostics]) => {
            if (diagnostics.length === 0) return;
            
            const filePath = uri.fsPath;
            const fileName = filePath.split('/').pop() || filePath;
            
            // Count issues in this file
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);
            const info = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Information);
            const hints = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Hint);
            
            totalErrors += errors.length;
            totalWarnings += warnings.length;
            totalInfo += info.length;
            totalHints += hints.length;
            
            sections.push('');
            sections.push(`📁 ${fileName}`);
            sections.push(`   Path: ${filePath}`);
            sections.push(`   Issues: ${diagnostics.length} total (${errors.length} errors, ${warnings.length} warnings, ${info.length} info, ${hints.length} hints)`);
            
            // Show individual diagnostics for this file
            diagnostics.forEach((diag) => {
                const severity = Utils.getSeverityString(diag.severity);
                const line = diag.range.start.line + 1;
                const col = diag.range.start.character + 1;
                const source = diag.source ? ` [${diag.source}]` : '';
                
                sections.push(`     ${severity}${source}: ${diag.message} (line ${line}, col ${col})`);
            });
        });
        
        // Add summary at the top (or bottom)
        const summary = [
            '',
            '='.repeat(50),
            '📈 TOTAL SUMMARY:',
            `   ${allDiagnostics.reduce((sum, [_, diags]) => sum + diags.length, 0)} total issues`,
            `   ${totalErrors} errors`,
            `   ${totalWarnings} warnings`,
            `   ${totalInfo} info messages`,
            `   ${totalHints} hints`,
            `   ${allDiagnostics.filter(([_, diags]) => diags.length > 0).length} files with issues`
        ];
        
        // Insert summary at the beginning
        sections.splice(1, 0, ...summary);
        
        return sections.join('\n');
    }

    static getSeverityString(severity: vscode.DiagnosticSeverity): string {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error: return 'ERROR';
            case vscode.DiagnosticSeverity.Warning: return 'WARNING';
            case vscode.DiagnosticSeverity.Information: return 'INFO';
            case vscode.DiagnosticSeverity.Hint: return 'HINT';
            default: return 'UNKNOWN';
        }
    }

    static isFilePath(filePath: string): boolean {
        try {
            // Check if the path is a real file
            fs.accessSync(filePath, fs.constants.F_OK);
            return true;
        } catch (error) {
            // If an error occurs, the path is not a real file
            return false;
        }
    }

    static async openProjectFolder(projectPath: string) {
        try {
            const folderPath = path.resolve(projectPath);
            const folderUri = vscode.Uri.file(folderPath);
            
            // Verify folder exists
            await vscode.workspace.fs.readDirectory(folderUri);
            
            // Check if it's already open
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const alreadyOpen = workspaceFolders?.some(
                workspace => workspace.uri.fsPath === folderUri.fsPath
            );
            
            if (alreadyOpen) {
                vscode.window.showInformationMessage(`Project '${projectPath}' is already open.`);
                return;
            }
            
            // Ask user if they want to open in current window or new window
            const option = await vscode.window.showInformationMessage(
                `Open project '${projectPath}'?`,
                'Open in Current Window',
                'Open in New Window'
            );
            
            if (option) {
                const forceNewWindow = option === 'Open in New Window';
                await vscode.commands.executeCommand(
                    'vscode.openFolder', 
                    folderUri, 
                    { forceNewWindow }
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open project: ${error}`);
        }
    }
}
