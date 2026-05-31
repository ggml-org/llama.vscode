export const DEFAULT_MAX_INPUT_TOKENS = 8192;
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS = 256;

// Fallback-only heuristic for degraded mode.
//
// The preferred counting path in llama-vscode is to ask llama.cpp to apply the
// active chat template and tokenize the exact prompt via the server. This
// helper exists only for cases where that authoritative path is unavailable,
// fails transiently, or is too early in startup to rely on. It should not be
// treated as the normal or authoritative way to count tokens.
export function estimateTokenCount(value: unknown): number {
    const serializedValue =
        typeof value === 'string'
            ? value
            : JSON.stringify(value ?? '');

    if (!serializedValue) {
        return 0;
    }

    return Math.ceil(serializedValue.length / 4);
}

const INPUT_TOKEN_FIELDS = [
    'max_input_tokens',
    'input_token_limit',
    'prompt_token_limit',
    'max_prompt_tokens',
    'context_length',
    'context_window',
    'max_context_length',
    'max_sequence_length',
    'max_position_embeddings',
    'n_ctx',
    'n_ctx_train',
] as const;

const OUTPUT_TOKEN_FIELDS = [
    'max_output_tokens',
    'output_token_limit',
    'completion_token_limit',
    'max_completion_tokens',
    'max_generated_tokens',
] as const;

const NESTED_METADATA_FIELDS = ['meta', 'metadata', 'limits', 'top_provider'] as const;

type UnknownRecord = Record<string, unknown>;

export interface OpenAICompatibleModel extends UnknownRecord {
    id: string;
    object?: string;
}

export function isLikelyLlamaCppProvider(models: OpenAICompatibleModel[]): boolean {
    return models.some((model) => {
        const ownedBy = typeof model.owned_by === 'string' ? model.owned_by.toLowerCase() : '';
        return ownedBy === 'llamacpp' || asRecord(model.meta) !== undefined;
    });
}

export function buildRuntimePropsUrl(endpoint: string, modelId?: string): string {
    const normalizedEndpoint = endpoint.replace(/\/+$/, '');
    if (!modelId) {
        return `${normalizedEndpoint}/props`;
    }

    const params = new URLSearchParams({
        model: modelId,
        autoload: 'false',
    });
    return `${normalizedEndpoint}/props?${params.toString()}`;
}

export interface ResolvedModelTokenLimits {
    maxInputTokens: number;
    maxOutputTokens: number;
}

interface ResolveRequestMaxOutputTokensOptions {
    maxInputTokens?: number;
    maxOutputTokens?: number;
    promptTokenEstimate?: number;
    defaultMaxOutputTokens?: number;
    contextSafetyMarginTokens?: number;
}

interface ResolveModelTokenLimitsOptions {
    configuredMaxInputTokens?: number;
    configuredMaxOutputTokens?: number;
    runtimeContextSize?: number;
    defaultMaxInputTokens?: number;
    defaultMaxOutputTokens?: number;
}

export function resolveModelTokenLimits(
    model: OpenAICompatibleModel,
    options: ResolveModelTokenLimitsOptions = {}
): ResolvedModelTokenLimits {
    const configuredMaxInputTokens = getPositiveInteger(options.configuredMaxInputTokens);
    const configuredMaxOutputTokens = getPositiveInteger(options.configuredMaxOutputTokens);
    const detectedMaxInputTokens =
        getPositiveInteger(options.runtimeContextSize) ?? extractModelTokenLimit(model, INPUT_TOKEN_FIELDS);
    const detectedMaxOutputTokens = extractModelTokenLimit(model, OUTPUT_TOKEN_FIELDS);
    const llamaCppOutputFallback = usesInputLimitAsOutputFallback(model) ? detectedMaxInputTokens : undefined;

    return {
        maxInputTokens:
            configuredMaxInputTokens
            ?? detectedMaxInputTokens
            ?? options.defaultMaxInputTokens
            ?? DEFAULT_MAX_INPUT_TOKENS,
        maxOutputTokens:
            configuredMaxOutputTokens
            ?? detectedMaxOutputTokens
            ?? llamaCppOutputFallback
            ?? options.defaultMaxOutputTokens
            ?? DEFAULT_MAX_OUTPUT_TOKENS,
    };
}

export function extractRuntimeContextSize(propsResponse: unknown): number | undefined {
    const props = asRecord(propsResponse);
    const defaultGenerationSettings = asRecord(props?.default_generation_settings);
    return getPositiveInteger(defaultGenerationSettings?.n_ctx);
}

export function resolveRequestMaxOutputTokens(
    options: ResolveRequestMaxOutputTokensOptions = {}
): number {
    const requestedMaxOutputTokens =
        getPositiveInteger(options.maxOutputTokens)
        ?? options.defaultMaxOutputTokens
        ?? DEFAULT_MAX_OUTPUT_TOKENS;
    const maxInputTokens = getPositiveInteger(options.maxInputTokens);
    const promptTokenEstimate = getPositiveInteger(options.promptTokenEstimate) ?? 0;
    const contextSafetyMarginTokens =
        getPositiveInteger(options.contextSafetyMarginTokens) ?? DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS;

    if (maxInputTokens === undefined) {
        return requestedMaxOutputTokens;
    }

    const remainingContextTokens = maxInputTokens - promptTokenEstimate - contextSafetyMarginTokens;
    if (remainingContextTokens <= 0) {
        return 1;
    }

    return Math.max(1, Math.min(requestedMaxOutputTokens, remainingContextTokens));
}

function extractModelTokenLimit(
    model: OpenAICompatibleModel,
    fieldNames: readonly string[]
): number | undefined {
    for (const candidate of getCandidateRecords(model)) {
        const tokenLimit = getFirstPositiveInteger(candidate, fieldNames);
        if (tokenLimit !== undefined) {
            return tokenLimit;
        }
    }

    return undefined;
}

function getCandidateRecords(model: OpenAICompatibleModel): UnknownRecord[] {
    const candidates: UnknownRecord[] = [model];

    for (const fieldName of NESTED_METADATA_FIELDS) {
        const nestedRecord = asRecord(model[fieldName]);
        if (nestedRecord) {
            candidates.push(nestedRecord);
        }
    }

    return candidates;
}

function getFirstPositiveInteger(
    source: UnknownRecord,
    fieldNames: readonly string[]
): number | undefined {
    for (const fieldName of fieldNames) {
        const value = getPositiveInteger(source[fieldName]);
        if (value !== undefined) {
            return value;
        }
    }

    return undefined;
}

function asRecord(value: unknown): UnknownRecord | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    return value as UnknownRecord;
}

function usesInputLimitAsOutputFallback(model: OpenAICompatibleModel): boolean {
    const ownedBy = typeof model.owned_by === 'string' ? model.owned_by.toLowerCase() : '';
    return ownedBy === 'llamacpp' || asRecord(model.meta) !== undefined;
}

function getPositiveInteger(value: unknown): number | undefined {
    const numberValue =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim() !== ''
                ? Number(value)
                : undefined;

    if (numberValue === undefined || !Number.isFinite(numberValue) || numberValue <= 0) {
        return undefined;
    }

    return Math.floor(numberValue);
}