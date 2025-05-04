import * as vscode from 'vscode';
import { Application } from './application';
import { Utils } from './utils';
import * as fs from 'fs';
import * as path from 'path';

interface ChunkEntry {
    uri: string;
    content: string;
    firstLine: number;
    lastLine: number;
    hash: string;
}

const filename = 'ghost.dat';

export class ChatContext {
    private app: Application;
    private nextEntryId: number = 0;
    public entries: Map<number, ChunkEntry>;
    private filesHashes: Map<string, string>;
    private dimension: number = 384; // Default dimension for all-MiniLM-L6-v2 model
    private maxElements: number = 10000;

    constructor(application: Application) {
        this.app = application;
        this.entries = new Map();
        this.filesHashes = new Map();
    }
    
    public async init() {
        vscode.window.showInformationMessage('Vector index initialized!');
    }

    public getChatContext = async (prompt: string): Promise<ChunkEntry[]> => {
        let context = "";
        
        this.app.statusbar.showTextInfo(this.app.extConfig.getUiText("Extracting keywords from query..."))
        let query = this.app.prompts.replaceOnePlaceholders(this.app.prompts.CHAT_GET_KEY_WORDS, "prompt", prompt)
        let data = await this.app.llamaServer.getChatCompletion(query);
                    if (!data || !data.choices[0].message.content) {
                        vscode.window.showInformationMessage('No suggestions available');
                        return [];
                    }
        let keywords = data.choices[0].message.content.trim().split("|");

        // TODO the synonyms are not returned with good quality each time - words are repeated and sometimes are irrelevant
        //      Probably in future with better models will work better or probably with the previous prompt we could get synonyms as well
        // query = this.app.prompts.replaceOnePlaceholders(this.app.prompts.CHAT_GET_SYNONYMS, "keywords", keywords)
        // data = await this.app.llamaServer.getChatCompletion(query);
        //             if (!data || !data.choices[0].message.content) {
        //                 vscode.window.showInformationMessage('No suggestions available');
        //                 return "";
        //             }
        // keywords += "|" + data.choices[0].message.content.trim();
        

        this.app.statusbar.showTextInfo(this.app.extConfig.getUiText("Filtering chunks step 1..."))
        let topChunksBm25 = this.rankTexts(keywords, Array.from(this.entries.values()), this.app.extConfig.rag_max_bm25_filter_chunks)
        this.app.statusbar.showTextInfo(this.app.extConfig.getUiText("Filtering chunks step 2..."))
        let topChunksCosSim = await this.cosineSimilarityRank(query, topChunksBm25, this.app.extConfig.rag_max_embedding_filter_chunks);    
        this.app.statusbar.showTextInfo(this.app.extConfig.getUiText("Context chunks ready."))

        return topChunksCosSim;
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
        for (const entry of chunksWithScore) {
            entry.score = await this.cosineSimilarity(queryEmbedding, entry.entry.content);
        }
        return chunksWithScore.sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map(({ entry: chunkEntry }) => chunkEntry);
    }

    private cosineSimilarity = async (a: number[], text: string): Promise<number> => {
        let b = await this.getEmbedding(text)
        
        if (a.length !== b.length) {
          throw new Error("Vectors must have the same length");
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

    async addDocument(uri: string, content: string) {
        try {
            if (this.isImageOrVideoFile(uri)) return;
            const hash = this.app.lruResultCache.getHash(content);
            if (this.filesHashes.get(uri) === hash) {
                return;
            }
            this.filesHashes.set(uri, hash);
            
            try {
                this.removeChunkEntries(uri);
            } catch (error) {
                console.log('Failed delete element from RAG:', error);
            }
            // Split the content into chunks and add them
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i+= this.app.extConfig.rag_max_lines_per_chunk) {
                const startLine = i; // + this.app.extConfig.MAX_LINES_PER_RAG_CHUNK < lines.length ? i : Math.max(0, lines.length - this.app.extConfig.MAX_LINES_PER_RAG_CHUNK);
                let endLine = Math.min(lines.length, i + this.app.extConfig.rag_max_lines_per_chunk);
                let chunkLines = lines.slice(startLine, endLine);
                let chunk = chunkLines.join('\n');
                if (chunk.length > this.app.extConfig.rag_chunk_max_chars){
                    chunk = "";
                    let j = 0;
                    let nextLine = this.getChunkLine(chunkLines, j);
                    while (chunk.length + nextLine.length  + 1 < this.app.extConfig.rag_chunk_max_chars && j < chunkLines.length){
                        chunk += "\n" + nextLine;
                        j++;
                        nextLine = this.getChunkLine(chunkLines, j);
                    }
                    endLine = startLine + j
                    // Make sure next iteration starts after the last added line
                    i = startLine + j - this.app.extConfig.rag_max_lines_per_chunk
                }
                // const embedding = await this.getEmbedding(chunk);
                let chunkContent = "\nFile Name: "  + uri + "\nFrom line: " + (startLine + 1) + "\nTo line: " + endLine + "\nContent:\n" + chunk 
                const chunkHash = this.app.lruResultCache.getHash(chunkContent)
                this.entries.set(this.nextEntryId, { uri: uri, content: chunkContent, firstLine: startLine + 1, lastLine: endLine, hash: chunkHash});
                this.nextEntryId++;
            }
        } catch (error) {
            console.error('Failed to add document to RAG:', error);
        }
    }

    private getChunkLine(chunkLines: string[], j: number) {
        return chunkLines[j].length > this.app.extConfig.rag_max_chars_per_chunk_line ? chunkLines[j].substring(0, this.app.extConfig.rag_max_chars_per_chunk_line) : chunkLines[j];
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
        this.filesHashes.delete(uri);
    }


    async indexWorkspaceFiles() {
        try {
            // const files = await vscode.workspace.findFiles('**/*', undefined, this.app.extConfig.MAX_FILES_RAG);
            const files = await this.getFilesRespectingGitignore()
            
            // Show progress
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: this.app.extConfig.getUiText("Indexing files..."),
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

                    try {
                        const document = await vscode.workspace.openTextDocument(file);
                        await this.addDocument(file.toString(), document.getText());
                        
                        processed++;
                        progress.report({
                            message: `Indexing ${vscode.workspace.asRelativePath(file)}`,
                            increment: (1 / total) * 100
                        });
                    } catch (error) {
                        console.error(`Failed to index file ${file.toString()}:`, error);
                    }
                }
                this.app.logger.addEventLog("RAG", "END_RAG_INDEXING", "Files: " + processed + " Chunks: " + this.entries.size)
            });

            vscode.window.showInformationMessage(this.app.extConfig.getUiText("Indexed") + " " + files.length +" " 
                + this.app.extConfig.getUiText("files for RAG search"));
        } catch (error) {
            console.error('Failed to index workspace files:', error);
            vscode.window.showErrorMessage('Failed to index workspace files');
        }
    }

    private getFilesRespectingGitignore = async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }
    
        // Get all .gitignore files in the workspace
        const gitignoreUris = await vscode.workspace.findFiles('**/.gitignore', null);
    
        // Read and parse all .gitignore files
        let excludePatterns: string[] = [];
        for (const uri of gitignoreUris) {
            const gitignorePath = uri.fsPath;
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
            const folderPath = path.dirname(gitignorePath);
            
            const patterns = this.parseGitignore(gitignoreContent, folderPath);
            excludePatterns = excludePatterns.concat(patterns);
        }
    
        // Add common VSCode and Git directories to exclude
        excludePatterns.push('**/.git/**', '**/.vscode/**', '**/node_modules/**');
    
        // Find all files excluding those in .gitignore
        const files = await vscode.workspace.findFiles(
            '**/*', // include all files
            `{${excludePatterns.join(',')}}`, // exclude patterns
            this.app.extConfig.rag_max_files
        );
    
        return files;
    }
    
    parseGitignore = (content: string, gitignoreFolder: string): string[] => {
        const lines = content.split('\n');
        const patterns: string[] = [];
    
        for (let line of lines) {
            line = line.trim();
            
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) {
                continue;
            }
    
            // Handle directory patterns
            if (line.endsWith('/')) {
                line = line.slice(0, -1);
                patterns.push(`**/${line}/**`);
            } 
            // Handle specific file patterns
            else {
                patterns.push(`**/${line}`);
            }
        }
    
        return patterns;
    }
} 