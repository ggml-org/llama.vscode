/// <reference types="mocha" />
import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
    DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS,
    buildRuntimePropsUrl,
    DEFAULT_MAX_INPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
    estimateTokenCount,
    extractRuntimeContextSize,
    isLikelyLlamaCppProvider,
    resolveBoundedMaxOutputTokens,
    resolveRequestMaxOutputTokens,
    resolveModelTokenLimits,
} from '../../language-model-token-limits';

suite('Language Model Token Limits Test Suite', () => {
    test('uses llama.cpp metadata context length for both input and output defaults', () => {
        const limits = resolveModelTokenLimits({
            id: 'gemma-3',
            meta: {
                n_ctx_train: 131072,
            },
        });

        assert.strictEqual(limits.maxInputTokens, 131072);
        assert.strictEqual(limits.maxOutputTokens, 131072);
    });

    test('prefers runtime llama.cpp context for both input and output defaults', () => {
        const runtimeContextSize = extractRuntimeContextSize({
            default_generation_settings: {
                n_ctx: 262144,
            },
        });

        const limits = resolveModelTokenLimits(
            {
                id: 'gemma-3',
                meta: {
                    n_ctx_train: 131072,
                },
            },
            {
                configuredMaxInputTokens: 0,
                runtimeContextSize,
            }
        );

        assert.strictEqual(runtimeContextSize, 262144);
        assert.strictEqual(limits.maxInputTokens, 262144);
        assert.strictEqual(limits.maxOutputTokens, 262144);
    });

    test('honors explicit overrides and detects model output limits', () => {
        const limits = resolveModelTokenLimits(
            {
                id: 'provider-model',
                context_length: '64000',
                top_provider: {
                    max_completion_tokens: '12000',
                },
            },
            {
                configuredMaxInputTokens: 128000,
                configuredMaxOutputTokens: 0,
            }
        );

        assert.strictEqual(limits.maxInputTokens, 128000);
        assert.strictEqual(limits.maxOutputTokens, 12000);
    });

    test('falls back to defaults when nothing is reported', () => {
        const limits = resolveModelTokenLimits(
            {
                id: 'unknown-model',
            },
            {
                configuredMaxInputTokens: 0,
                configuredMaxOutputTokens: 0,
            }
        );

        assert.strictEqual(limits.maxInputTokens, DEFAULT_MAX_INPUT_TOKENS);
        assert.strictEqual(limits.maxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS);
    });

    test('detects llama.cpp provider model metadata', () => {
        assert.strictEqual(
            isLikelyLlamaCppProvider([
                {
                    id: 'gemma-router-model',
                    owned_by: 'llamacpp',
                },
            ]),
            true
        );
    });

    test('builds router props url with autoload disabled', () => {
        const url = buildRuntimePropsUrl('http://127.0.0.1:8080/v1/', 'ggml-org/gemma-3-4b-it-GGUF:Q4_K_M');

        assert.strictEqual(
            url,
            'http://127.0.0.1:8080/v1/props?model=ggml-org%2Fgemma-3-4b-it-GGUF%3AQ4_K_M&autoload=false'
        );
    });

    test('clamps output tokens to remaining context budget', () => {
        const maxTokens = resolveRequestMaxOutputTokens({
            maxInputTokens: 65536,
            maxOutputTokens: 65536,
            promptTokenEstimate: 58000,
        });

        assert.strictEqual(
            maxTokens,
            65536 - 58000 - DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS
        );
    });

    test('falls back to one token when prompt already fills the context window', () => {
        const maxTokens = resolveRequestMaxOutputTokens({
            maxInputTokens: 8192,
            maxOutputTokens: 4096,
            promptTokenEstimate: 8192,
        });

        assert.strictEqual(maxTokens, 1);
    });

    test('caps requested output tokens to one quarter of the context window', () => {
        const maxTokens = resolveBoundedMaxOutputTokens({
            maxInputTokens: 65536,
            maxOutputTokens: 65536,
        });

        assert.strictEqual(maxTokens, 16384);
    });

    test('applies the quarter-window cap before remaining-context clamping', () => {
        const maxTokens = resolveRequestMaxOutputTokens({
            maxInputTokens: 65536,
            maxOutputTokens: 65536,
            promptTokenEstimate: 23000,
        });

        assert.strictEqual(maxTokens, 16384);
    });

    test('estimates token counts for structured payloads', () => {
        const estimatedTokens = estimateTokenCount({
            messages: [
                { role: 'assistant', content: 'hello world' },
                { role: 'tool', content: 'tool output' },
            ],
            tools: [{ type: 'function', function: { name: 'read_file' } }],
        });

        assert.ok(estimatedTokens > 0);
    });
});