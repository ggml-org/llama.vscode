import { Configuration } from './configuration';
import { LlamaServer } from './llama-server';
import * as vscode from 'vscode';

export class ExtraContext {
    private extConfig: Configuration
    private llamaServer: LlamaServer
    chunks: any[] = [];
    chunksLines: string[][] = []; //lines of each chunk are needed for measuring the distance
    queuedChunks: any[] = [];
    queuedChunksLines: string[][] = [];
    lastComplStartTime = Date.now();
    lastLinePick = -9999;
    ringNEvict = 0;

    constructor(config: Configuration, llamaServer: LlamaServer) {
        this.extConfig = config
        this.llamaServer = llamaServer
    }

    periodicRingBufferUpdate = () => {
        if (this.queuedChunks === undefined
            || this.queuedChunks === null
            || this.queuedChunks.length == 0
            || Date.now() - this.lastComplStartTime < this.extConfig.RING_UPDATE_MIN_TIME_LAST_COMPL) {
            return;
        }
        let queueChunkLns = this.queuedChunksLines.shift()
        if (queueChunkLns != undefined) {
            this.chunksLines.push(queueChunkLns);
            this.chunks.push(this.queuedChunks.shift());
            while (this.chunks.length > this.extConfig.ring_n_chunks) {
                this.chunks.shift();
                this.chunksLines.shift()
            }
        }

        this.llamaServer.prepareLlamaForNextCompletion(this.chunks)
    };

    // Class field is used instead of a function to make "this" available
    addFimContextChunks = async (position: vscode.Position, context: vscode.InlineCompletionContext, document: vscode.TextDocument) => {
        let deltaLines = Math.abs(position.line - this.lastLinePick);
        // TODO: per-file location
        // gather some extra context nearby and process it in the background
        // only gather chunks if the cursor has moved a lot
        // TODO: something more clever? reranking?
        // TODO Clarify if only on automatic trigerring the context chunks is needed
        // if (context.triggerKind == vscode.InlineCompletionTriggerKind.Automatic && deltaLines > this.extConfig.MAX_LAST_PICK_LINE_DISTANCE) {
            if (deltaLines > this.extConfig.MAX_LAST_PICK_LINE_DISTANCE) {
            // expand the prefix even further
            let prefixChunkLines = this.getDocumentLines(Math.max(0, position.line - this.extConfig.ring_scope), Math.max(0, position.line - this.extConfig.n_prefix), document);
            this.pickChunk(prefixChunkLines, false, false, document);
            // pick a suffix chunk
            let suffixChunkLines = this.getDocumentLines(Math.min(document.lineCount - 1, position.line + this.extConfig.n_suffix), Math.min(document.lineCount - 1, position.line + this.extConfig.n_suffix + this.extConfig.ring_chunk_size), document)
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

        if (this.extConfig.ring_n_chunks <= 0)
            return;

        // don't pick very small chunks
        if (lines.length < 3)
            return

        let newChunkLines: string[]
        if (lines.length + 1 < this.extConfig.ring_chunk_size)
            newChunkLines = lines
        else {
            // TODO Clarify why only half sized chunk
            let startLine = Math.floor(Math.random() * (Math.max(0, lines.length - this.extConfig.ring_chunk_size / 2 + 1)))
            let endline = Math.min(startLine + this.extConfig.ring_chunk_size / 2, lines.length)
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

        if (this.queuedChunks.length >= this.extConfig.MAX_QUEUED_CHUNKS) {
            this.queuedChunks.splice(0, 1)
        }

        let newChunk = { text: chunkString, time: Date.now(), filename: doc.fileName };
        this.queuedChunks.push(newChunk);
        this.queuedChunksLines.push(newChunkLines)
    }

    pickChunkAroundCursor = (cursorLine: number, activeDocument: vscode.TextDocument) => {
        let chunkLines = this.getDocumentLines(Math.max(0, cursorLine - this.extConfig.ring_chunk_size / 2), Math.min(cursorLine + this.extConfig.ring_chunk_size / 2, activeDocument.lineCount - 1), activeDocument)
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

}
