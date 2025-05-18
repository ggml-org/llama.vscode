import * as vscode from 'vscode';
import {Application} from "./application";

export class ExtraContext {
    private app: Application
    chunks: any[] = [];
    chunksLines: string[][] = []; //lines of each chunk are needed for measuring the distance
    chunksHash: string[] = []
    queuedChunks: any[] = [];
    queuedChunksLines: string[][] = [];
    lastComplStartTime = Date.now();
    lastLinePick = -9999;
    ringNEvict = 0;
    private fileSaveTimeout: NodeJS.Timeout | undefined;

    constructor(application: Application) {
        this.app = application
    }

    periodicRingBufferUpdate = () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document) return;
        if (!this.app.extConfig.isCompletionEnabled(editor.document)) return;
        if (this.queuedChunks === undefined
            || this.queuedChunks === null
            || this.queuedChunks.length == 0
            || Date.now() - this.lastComplStartTime < this.app.extConfig.RING_UPDATE_MIN_TIME_LAST_COMPL) {
            return;
        }
        let queueChunkLns = this.queuedChunksLines.shift()
        if (queueChunkLns != undefined) {
            this.chunksLines.push(queueChunkLns);
            let newChunk = this.queuedChunks.shift()
            this.chunksHash.push(this.app.lruResultCache.getHash(newChunk.text))
            this.chunks.push(newChunk);
            while (this.chunks.length > this.app.extConfig.ring_n_chunks) {
                this.chunks.shift();
                this.chunksLines.shift()
                this.chunksHash.shift()
            }
        }

        this.app.llamaServer.updateExtraContext(this.chunks)
    };

    // Class field is used instead of a function to make "this" available
    addFimContextChunks = async (position: vscode.Position, context: vscode.InlineCompletionContext, document: vscode.TextDocument) => {
        let deltaLines = Math.abs(position.line - this.lastLinePick);
        // TODO: per-file location
        // gather some extra context nearby and process it in the background
        // only gather chunks if the cursor has moved a lot
        // TODO: something more clever? reranking?
        if (deltaLines > this.app.extConfig.MAX_LAST_PICK_LINE_DISTANCE) {
            // expand the prefix even further
            let prefixChunkLines = this.getDocumentLines(Math.max(0, position.line - this.app.extConfig.ring_scope), Math.max(0, position.line - this.app.extConfig.n_prefix), document);
            this.pickChunk(prefixChunkLines, false, false, document);
            // pick a suffix chunk
            let suffixChunkLines = this.getDocumentLines(Math.min(document.lineCount - 1, position.line + this.app.extConfig.n_suffix), Math.min(document.lineCount - 1, position.line + this.app.extConfig.n_suffix + this.app.extConfig.ring_chunk_size), document)
            this.pickChunk(suffixChunkLines, false, false, document);

            this.lastLinePick = position.line;
        }
    }

    getDocumentLines = (startLine: number, endLine: number, document: vscode.TextDocument) => {
        return Array.from({ length: endLine - startLine + 1 }, (_, i) => document.lineAt(startLine + i).text);
    }

    pickChunk = (lines: string[], noMod: boolean, doEvict: boolean, doc: vscode.TextDocument) => {
        // do not pick chunks from buffers with pending changes
        if (noMod && doc.isDirty) {
            return
        }

        if (this.app.extConfig.ring_n_chunks <= 0)
            return;

        // don't pick very small chunks
        if (lines.length < 3)
            return

        let newChunkLines: string[]
        if (lines.length + 1 < this.app.extConfig.ring_chunk_size)
            newChunkLines = lines
        else {
            let startLine = Math.floor(Math.random() * (Math.max(0, lines.length - this.app.extConfig.ring_chunk_size / 2 + 1)))
            let endline = Math.min(startLine + this.app.extConfig.ring_chunk_size / 2, lines.length)
            newChunkLines = lines.slice(startLine, endline)
        }
        let chunkString = newChunkLines.join('\n') + '\n'

        if (doEvict
            && (this.chunks.some(ch => ch.text == chunkString)
                || this.queuedChunks.some(ch => ch.text == chunkString))) {
            return
        }

        // evict chunks that are very similar to the new one
        if (doEvict) {
            for (let i = this.chunks.length - 1; i >= 0; i--) {
                if (this.jaccardSimilarity(this.chunksLines[i], newChunkLines) > 0.9) {
                    this.chunks.splice(i, 1)
                    this.chunksLines.splice(i, 1)
                    this.chunksHash.splice(i, 1)
                    this.ringNEvict++;
                }
            }
        }

        // evict queued chunks that are very similar to the new one
        if (doEvict) {
            for (let i = this.queuedChunks.length - 1; i >= 0; i--) {
                if (this.jaccardSimilarity(this.queuedChunksLines[i], newChunkLines) > 0.9) {
                    this.queuedChunks.splice(i, 1)
                    this.queuedChunksLines.splice(i, 1)
                    this.ringNEvict++;
                }
            }
        }

        if (this.queuedChunks.length >= this.app.extConfig.MAX_QUEUED_CHUNKS) {
            this.queuedChunks.splice(0, 1)
        }

        let newChunk = { text: chunkString, time: Date.now(), filename: doc.fileName };
        this.queuedChunks.push(newChunk);
        this.queuedChunksLines.push(newChunkLines)
    }

    pickChunkAroundCursor = (cursorLine: number, activeDocument: vscode.TextDocument) => {
        let chunkLines = this.getDocumentLines(Math.max(0, cursorLine - this.app.extConfig.ring_chunk_size / 2), Math.min(cursorLine + this.app.extConfig.ring_chunk_size / 2, activeDocument.lineCount - 1), activeDocument)
        this.pickChunk(chunkLines, true, true, activeDocument);
    }

    /**
     * Computes the Jaccard similarity between two chunks of text.
     * @param lines0 - The first chunk of text as an array of strings (lines).
     * @param lines1 - The second chunk of text as an array of strings (lines).
     * @returns A number between 0 and 1 representing the Jaccard similarity.
     */
    jaccardSimilarity = (lines0: string[], lines1: string[]): number => {
        if (lines0.length === 0 && lines1.length === 0) {
            return 1;
        }

        const setA = new Set(lines0);
        const setB = new Set(lines1);

        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);

        return intersection.size / union.size;
    }

    handleDocumentSave = (document: vscode.TextDocument) => {
        if (this.fileSaveTimeout) {
            clearTimeout(this.fileSaveTimeout);
        }

        this.fileSaveTimeout = setTimeout(() => {
            if (!this.app.extConfig.isCompletionEnabled(document)) return;

            let chunkLines: string[] = []
            const editor = vscode.window.activeTextEditor;
            // If there's an active editor and it's editing the saved document
            if (editor && editor.document === document) {
                const cursorPosition = editor.selection.active;
                const line = cursorPosition.line;
                this.app.extraContext.pickChunkAroundCursor(line, document)
            } else {
                chunkLines = document.getText().split(/\r?\n/);
                this.app.extraContext.pickChunk(chunkLines, true, true, document);
            }
        }, 1000); // Adjust the delay as needed
    }

    addChunkFromSelection = (editor:  vscode.TextEditor) => {
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        let selectedLines = selectedText.split(/\r?\n/);
        // Run async to not affect copy action
        setTimeout(async () => {
            this.app.extraContext.pickChunk(selectedLines, false, true, editor.document);
        }, 1000);
        return selectedLines;
    }
}
