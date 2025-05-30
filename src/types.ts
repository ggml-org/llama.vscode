export interface ChunkEntry {
    uri: string;
    content: string;
    firstLine: number;
    lastLine: number;
    hash: string;
    embedding: number[]
}