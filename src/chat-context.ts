import * as vscode from 'vscode';
import { Application } from './application';
import { Utils } from './utils';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
import { ChunkEntry } from './types'

interface FileProperties {
    hash: string;
    updated: number;
}

const filename = 'ghost.dat';

export class ChatContext {
    private app: Application;
    private nextEntryId: number = 0;
    public entries: Map<number, ChunkEntry>;
    private filesProperties: Map<string, FileProperties>;

    constructor(application: Application) {
        this.app = application;
        this.entries = new Map();
        this.filesProperties = new Map();
    }

    public async init() {
        vscode.window.showInformationMessage('Vector index initialized!');
    }

    getProjectFiles = (): string[] => {
        return Array.from(this.filesProperties.keys()).map(fullPath => {
            // Handle both forward and backward slashes
            const parts = fullPath.split(/[\\/]/);
            return parts[parts.length - 1] + " | " + fullPath;
        });
    }

    public getRagContextChunks = async (prompt: string): Promise<ChunkEntry[]> => {
        this.app.statusbar.showTextInfo(this.app.configuration.getUiText("Extracting keywords from query..."))
        let query = this.app.prompts.replaceOnePlaceholder(this.app.prompts.CHAT_GET_KEY_WORDS, "prompt", prompt)
        let data = await this.app.llamaServer.getChatCompletion(query);
        if (!data || !data.choices[0].message.content) {
            vscode.window.showInformationMessage('No suggestions available');
            return [];
        }
        let keywords = data.choices[0].message.content.trim().split("|");

        // TODO the synonyms are not returned with good quality each time - words are repeated and sometimes are irrelevant
        // Probably in future with better models will work better or probably with the previous prompt we could get synonyms as well

        this.app.statusbar.showTextInfo(this.app.configuration.getUiText("Filtering chunks with BM25..."))
        let topChunksBm25 = this.rankTexts(keywords, Array.from(this.entries.values()), this.app.configuration.rag_max_bm25_filter_chunks)
        let topContextChunks: ChunkEntry[];
        if ((this.app.menu.getEmbeddingsModel().endpoint && this.app.menu.getEmbeddingsModel().endpoint?.trim() != "") 
            || this.app.configuration.endpoint_embeddings.trim() != ""){
            this.app.statusbar.showTextInfo(this.app.configuration.getUiText("Filtering chunks with embeddings..."))
            topContextChunks = await this.cosineSimilarityRank(query, topChunksBm25, this.app.configuration.rag_max_embedding_filter_chunks);
        } else {
            vscode.window.showInformationMessage('No embeddings server. Filtering chunks with embeddings will be skipped.');
            topContextChunks = topChunksBm25.slice(0, 5);
        }

        this.app.statusbar.showTextInfo(this.app.configuration.getUiText("Context chunks ready."))

        return topContextChunks;
    }

    public getRagFilesContext = async (prompt: string): Promise<string> => {
        let contextFiles = this.getFilesFromQuery(prompt)
        let filesContext = ""
        for (const fileName of contextFiles.slice(0, this.app.configuration.rag_max_context_files)) {
             let contextFile = Array.from(this.filesProperties).find(([key]) => key.toLocaleLowerCase().endsWith(fileName.toLocaleLowerCase()))
             if (contextFile){
                const [fileUrl, fileProperties] = contextFile;
                const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fileUrl));
                filesContext += "\n\n" + fileUrl + ":\n" + document.getText().slice(0, this.app.configuration.rag_max_context_file_chars)
             }
        };
        return filesContext;
    }

    public getContextChunksInPlainText = (chunksToSend: ChunkEntry[]) => {
        let extraCont = "Here are pieces of code from different files of the project: \n" +
        chunksToSend.reduce((accumulator, currentValue) => accumulator + currentValue.content + "\n\n", "");
        return extraCont;
    }

    private cosineSimilarityRank = async (query: string, chunkEntries: ChunkEntry[], topN: number):Promise<ChunkEntry[]>  => {
        const queryEmbedding = await this.getEmbedding(query);
        let chunksWithScore = Array.from(chunkEntries)
        .map((chunkEntry, index) => ({
            entry: chunkEntry,
            score: 0,
        }));
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: this.app.configuration.getUiText("Filtering chunks with embeddings..."),
            cancellable: true
        };
        await vscode.window.withProgress(progressOptions, async (progress, token) => {
            let processed = 0;
            const total = chunksWithScore.length;
            for (const entry of chunksWithScore) {
                if (token.isCancellationRequested) {
                    break;
                }
                processed++;
                progress.report({
                    // message: `Indexing ${vscode.workspace.asRelativePath(file)}`,
                    increment: (1 / total) * 100
                });
                entry.score = await this.cosineSimilarity(queryEmbedding, entry.entry);
            }
        });

        return chunksWithScore.sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map(({ entry: chunkEntry }) => chunkEntry);
    }

    private cosineSimilarity = async (a: number[], chunk: ChunkEntry): Promise<number> => {
        let b = chunk.embedding;
        if (b.length == 0){
            b = await this.getEmbedding(chunk.content)
            chunk.embedding = b;
        }
        if (!b || b.length == 0 || !a || a.length == 0) {
            throw new Error("Error getting embeddings.");
          }
        if (!b || b.length == 0 || a.length !== b.length) {
          throw new Error("Error - vectors must have the same length.");
        }

        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
        }

        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

        if (magnitudeA === 0 || magnitudeB === 0) {
          return 0;
        }

        // Calculate cosine similarity
        return dotProduct / (magnitudeA * magnitudeB);
      }

    private rankTexts = (keywords: string[], chunkEntries: ChunkEntry[], topN: number): ChunkEntry[] => {
        if (!keywords.length || !chunkEntries.length) return [];

        const tokenizedDocs = chunkEntries.map(this.tokenizeChunkEntry);
        const stats = Utils.computeBM25Stats(tokenizedDocs);
        const queryTerms = Array.from(new Set(keywords.flatMap(this.tokenize)));

        const sortedChunks = Array.from(chunkEntries)
            .map((chunkEntry, index) => ({
                entry: chunkEntry,
                score: Utils.bm25Score(queryTerms, index, stats),
            }))
            .sort((a, b) => b.score - a.score)

        const topChunks = sortedChunks.slice(0, topN)
        return topChunks.map(({ entry: chunkEntry }) => chunkEntry);
    }

    private tokenizeChunkEntry = (chunkEntry: ChunkEntry): string[] => {
        return chunkEntry.content.split(/([A-Z]?[a-z]+)|[_\-\.\s]+/)
        .filter(Boolean) // Remove empty strings from the result
        .map(word => word.toLowerCase());
    }

    private tokenize = (text: string): string[] => {
        return text.split(/([A-Z]?[a-z]+)|[_\-\.\s]+/)
        .filter(Boolean) // Remove empty strings from the result
        .map(word => word.toLowerCase());
    }

    private async getEmbedding(text: string): Promise<number[]> {
        try {
            const output = await this.app.llamaServer.getEmbeddings(text);
            if (output && output.data && output.data.length > 0) {
                return Array.from(output.data[0].embedding);
            } else {
                console.error('Failed to generate embedding:');
                return [];
            }
        } catch (error) {
            console.error('Failed to generate embedding:', error);
            return [];
        }
    }

    isImageOrVideoFile = (filename: string): boolean => {
        const imageExtensions = [
            // image extensions
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff',
            // Standard video formats
            '.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv',
            // High-quality formats
            '.mpg', '.mpeg', '.m4v', '.vob', '.m2ts', '.prores', '.dnxhd',
            // Specialized formats
            '.mxf', '.ogv', '.3gp', '.3g2',
            // Others
            '.rm', '.swf', '.asf', '.divx',
            // VR formats
            '.360', '.vr'
        ];
        const lowerCaseFilename = filename.toLowerCase();
        return imageExtensions.some(ext => lowerCaseFilename.endsWith(ext));
    }

    getFileProperties = (uri: string): FileProperties | undefined => {
        return this.filesProperties.get(uri);
    }

    addDocument = async (uri: string, content: string) => {
        try {
            const hash = this.app.lruResultCache.getHash(content);
            if (this.filesProperties.get(uri)?.hash === hash) {
                return;
            }
            this.filesProperties.set(uri, {hash: hash, updated: Date.now()});

            try {
                this.removeChunkEntries(uri);
            } catch (error) {
                console.log('Failed delete element from RAG:', error);
            }
            // Split the content into chunks and add them
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i+= this.app.configuration.rag_max_lines_per_chunk) {
                const startLine = i; // + this.app.extConfig.MAX_LINES_PER_RAG_CHUNK < lines.length ? i : Math.max(0, lines.length - this.app.extConfig.MAX_LINES_PER_RAG_CHUNK);
                let endLine = Math.min(lines.length, i + this.app.configuration.rag_max_lines_per_chunk);
                let chunkLines = lines.slice(startLine, endLine);
                let chunk = chunkLines.join('\n');
                if (chunk.length > this.app.configuration.rag_chunk_max_chars){
                    chunk = "";
                    let j = 0;
                    let nextLine = this.getChunkLine(chunkLines, j);
                    while (chunk.length + nextLine.length  + 1 < this.app.configuration.rag_chunk_max_chars && j < chunkLines.length){
                        chunk += "\n" + nextLine;
                        j++;
                        nextLine = this.getChunkLine(chunkLines, j);
                    }
                    endLine = startLine + j
                    // Make sure next iteration starts after the last added line
                    i = startLine + j - this.app.configuration.rag_max_lines_per_chunk
                }
                // const embedding = await this.getEmbedding(chunk);
                let chunkContent = "\nFile Name: "  + uri + "\nFrom line: " + (startLine + 1) + "\nTo line: " + endLine + "\nContent:\n" + chunk
                const chunkHash = this.app.lruResultCache.getHash(chunkContent)
                this.entries.set(this.nextEntryId, { uri: uri, content: chunkContent, firstLine: startLine + 1, lastLine: endLine, hash: chunkHash, embedding: []});
                if (this.entries.size >= this.app.configuration.rag_max_chunks) break;
                this.nextEntryId++;
            }
        } catch (error) {
            console.error('Failed to add document to RAG:', error);
        }
    }

    private getChunkLine(chunkLines: string[], j: number) {
        return chunkLines[j].length > this.app.configuration.rag_max_chars_per_chunk_line ? chunkLines[j].substring(0, this.app.configuration.rag_max_chars_per_chunk_line) : chunkLines[j];
    }

    private removeChunkEntries(uri: string) {
        const filteredIds = Array.from(this.entries)
            .filter(([_, value]) => value.uri === uri)
            .map(([key, _]) => key);
        for (let id of filteredIds) {
            this.entries.delete(id);
        }
    }

    async removeDocument(uri: string) {
        this.removeChunkEntries(uri);
        this.filesProperties.delete(uri);
    }

    async indexWorkspaceFiles() {
        try {
            this.entries.clear();
            this.filesProperties.clear()
            if (this.app.configuration.rag_max_files <= 0) return;
            const files = (await this.getFilesRespectingGitignore()).slice(0,this.app.configuration.rag_max_files)

            // Show progress
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: this.app.configuration.getUiText("Indexing files..."),
                cancellable: true
            };
            await vscode.window.withProgress(progressOptions, async (progress, token) => {
                const total = files.length;
                let processed = 0;

                this.app.logger.addEventLog("RAG", "START_RAG_INDEXING", "")
                for (const file of files) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    if (this.isImageOrVideoFile(file.toString())) continue;

                    try {
                        const document = await vscode.workspace.openTextDocument(file);
                        await this.addDocument(file.fsPath, document.getText());

                        processed++;
                        progress.report({
                            message: `Indexing ${vscode.workspace.asRelativePath(file)}`,
                            increment: (1 / total) * 100
                        });
                    } catch (error) {
                        console.error(`Failed to index file ${file.toString()}:`, error);
                    }
                    if (this.entries.size >= this.app.configuration.rag_max_chunks) break;
                }
                this.app.logger.addEventLog("RAG", "END_RAG_INDEXING", "Files: " + processed + " Chunks: " + this.entries.size)
                vscode.window.showInformationMessage(this.app.configuration.getUiText("Indexed") + " " + processed +"/" + files.length +" "
                + this.app.configuration.getUiText("files for RAG search"));
            });

        } catch (error) {
            console.error('Failed to index workspace files:', error);
            vscode.window.showErrorMessage('Failed to index workspace files');
        }
    }

    getFilesRespectingGitignore = async (): Promise<vscode.Uri[]> => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const rootUri = workspaceFolders[0].uri;
        const result: vscode.Uri[] = [];
        const igMap = new Map<string, ignore.Ignore>();

        // First pass: Collect all .gitignore files and their rules
        const gitignoreUris = await vscode.workspace.findFiles('**/.gitignore', '');
        await Promise.all(gitignoreUris.map(async uri => {
            try {
                const content = await vscode.workspace.fs.readFile(uri);
                const dir = path.dirname(uri.fsPath);
                igMap.set(dir, ignore().add(content.toString()));
            } catch (error) {
                console.error(`Error reading .gitignore at ${uri.fsPath}:`, error);
            }
        }));

        // Second pass: Traverse directory tree while respecting ignore rules
        async function traverse(dirUri: vscode.Uri) {
            const dirPath = dirUri.fsPath;

            if (isIgnored(dirPath)) {
                return;
            }

            let entries: [string, vscode.FileType][];
            try {
                entries = await vscode.workspace.fs.readDirectory(dirUri);
            } catch {
                return; // Skip directories we can't read
            }

            for (const [name, type] of entries) {
                const entryUri = vscode.Uri.file(path.join(dirPath, name));

                if (type === vscode.FileType.Directory) {
                    if (entryUri.toString().toLowerCase().endsWith(".git")) continue
                    await traverse(entryUri);
                } else if (!isIgnored(entryUri.fsPath)) {
                    result.push(entryUri);
                }
            }
        }

        function isIgnored(fsPath: string): boolean {
            let currentDir = path.dirname(fsPath);
            const target = path.basename(fsPath);

            // Check ignore rules from closest to farthest
            while (true) {
                if (igMap.has(currentDir)) {
                    const relative = path.relative(currentDir, fsPath);
                    if (igMap.get(currentDir)!.ignores(relative)) {
                        return true;
                    }
                }

                const parentDir = path.dirname(currentDir);
                if (parentDir === currentDir) break; // Reached root
                currentDir = parentDir;
            }

            return false;
        }

        await traverse(rootUri);
        return result;
    }

    public getFilesFromQuery = (text: string): string[] => {
        // Only allows letters, numbers, underscores, dots, and hyphens in filenames
        const regex = /@([a-zA-Z0-9_.-]+)(?=[,.?!\s]|$)/g;
        return [...text.matchAll(regex)].map(match => match[1]);
    }    
}
