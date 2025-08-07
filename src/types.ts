export interface ChunkEntry {
    uri: string;
    content: string;
    firstLine: number;
    lastLine: number;
    hash: string;
    embedding: number[]
}

export interface LlmModel {
    name: string;
    aiModel?: string;
    isKeyRequired?: boolean;
    endpoint?: string;
    localStartCommand?: string
}

export interface Orchestra {
    name: string,
    description?: string,
    completion?: LlmModel,
    chat?: LlmModel,
    embeddings?: LlmModel,
    tools?: LlmModel
}