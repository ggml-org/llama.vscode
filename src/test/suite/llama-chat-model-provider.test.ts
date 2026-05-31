/// <reference types="mocha" />
import * as assert from 'assert';
import { Readable } from 'stream';
import * as vscode from 'vscode';
import axios from 'axios';
import { suite, test, teardown } from 'mocha';
import { LlamaChatModelProvider } from '../../llama-chat-model-provider';
import { Application } from '../../application';

class MockApplication {
	eventLogs: string[] = [];

	configuration = {
		ai_api_version: 'v1',
		lm_max_input_tokens: 0,
		lm_max_output_tokens: 0,
		endpoint_chat: 'http://127.0.0.1:8080',
		endpoint_tools: '',
		axiosRequestConfigChat: {},
		axiosRequestConfigTools: {},
	};

	persistence = {
		getApiKey: () => undefined,
	};

	logger = {
		addEventLog: (group: string, event: string, details: string) => {
			this.eventLogs.push([group, event, details].join(' | '));
		},
	};

	llamaServer = {
		createRequestTrace: (caller: string) => ({
			requestId: 'test-request-id',
			caller,
		}),
		countToolsPromptTokens: async () => 33135,
		logBudgetDecision: () => undefined,
		logBudgetFallback: () => undefined,
	};

	getToolsModel() {
		return undefined;
	}
}

suite('LlamaChatModelProvider Test Suite', () => {
	const originalGet = axios.get;
	const originalPost = axios.post;

	teardown(() => {
		(axios as typeof axios & { get: typeof axios.get }).get = originalGet;
		(axios as typeof axios & { post: typeof axios.post }).post = originalPost;
	});

	test('rejects exact prompt overflow before sending chat completions', async () => {
		let postCalled = false;

		(axios as typeof axios & { get: typeof axios.get }).get = (async (url: string) => {
			if (url.endsWith('/v1/models')) {
				return {
					data: {
						data: [
							{
								id: 'mock-model',
								owned_by: 'llamacpp',
							},
						],
					},
				};
			}

			if (url.includes('/props')) {
				return {
					data: {
						default_generation_settings: {
							n_ctx: 32768,
						},
					},
				};
			}

			throw new Error(`Unexpected GET ${url}`);
		}) as typeof axios.get;

		(axios as typeof axios & { post: typeof axios.post }).post = (async () => {
			postCalled = true;
			throw new Error('chat completions should not be called when the prompt already exceeds context');
		}) as typeof axios.post;

		const provider = new LlamaChatModelProvider(new MockApplication() as unknown as Application);
		const model: vscode.LanguageModelChatInformation = {
			id: 'mock-model',
			name: 'mock-model',
			family: 'llama-vscode',
			version: '1',
			maxInputTokens: 32768,
			maxOutputTokens: 4096,
			capabilities: {
				toolCalling: true,
				imageInput: false,
			},
		};
		const messages = [
			{
				role: vscode.LanguageModelChatMessageRole.User,
				content: [new vscode.LanguageModelTextPart('is it faster than ansible?')],
			},
		] as unknown as readonly vscode.LanguageModelChatRequestMessage[];

		await assert.rejects(
			() => provider.provideLanguageModelChatResponse(
				model,
				messages,
				{} as vscode.ProvideLanguageModelChatResponseOptions,
				{ report: () => undefined },
				new vscode.CancellationTokenSource().token,
			),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				assert.strictEqual(error.name, 'LanguageModelProviderError');
				assert.match(error.message, /exceeds the model context window/i);
				assert.match(error.message, /33135/);
				assert.match(error.message, /32768/);
				assert.strictEqual(error.stack, undefined);
				return true;
			}
		);

		assert.strictEqual(postCalled, false);
	});

	test('flushes the final SSE chunk when the stream ends without a trailing newline', async () => {
		(axios as typeof axios & { get: typeof axios.get }).get = (async (url: string) => {
			if (url.endsWith('/v1/models')) {
				return {
					data: {
						data: [
							{
								id: 'mock-model',
								owned_by: 'llamacpp',
							},
						],
					},
				};
			}

			if (url.includes('/props')) {
				return {
					data: {
						default_generation_settings: {
							n_ctx: 65536,
						},
					},
				};
			}

			throw new Error(`Unexpected GET ${url}`);
		}) as typeof axios.get;

		(axios as typeof axios & { post: typeof axios.post }).post = (async () => ({
			data: Readable.from([
				'data: {"choices":[{"delta":{"content":"final answer"}}]}'
			]),
		})) as typeof axios.post;

		const provider = new LlamaChatModelProvider(new MockApplication() as unknown as Application);
		const reportedParts: vscode.LanguageModelResponsePart[] = [];

		await provider.provideLanguageModelChatResponse(
			{
				id: 'mock-model',
				name: 'mock-model',
				family: 'llama-vscode',
				version: '1',
				maxInputTokens: 65536,
				maxOutputTokens: 4096,
				capabilities: {
					toolCalling: true,
					imageInput: false,
				},
			},
			[
				{
					role: vscode.LanguageModelChatMessageRole.User,
					content: [new vscode.LanguageModelTextPart('say hello')],
				},
			] as unknown as readonly vscode.LanguageModelChatRequestMessage[],
			{} as vscode.ProvideLanguageModelChatResponseOptions,
			{ report: part => reportedParts.push(part) },
			new vscode.CancellationTokenSource().token,
		);

		assert.deepStrictEqual(
			reportedParts.map(part => part instanceof vscode.LanguageModelTextPart ? part.value : part.constructor.name),
			['final answer']
		);
	});

	test('logs per-turn usage from a usage-only final SSE chunk', async () => {
		(axios as typeof axios & { get: typeof axios.get }).get = (async (url: string) => {
			if (url.endsWith('/v1/models')) {
				return {
					data: {
						data: [
							{
								id: 'mock-model',
								owned_by: 'llamacpp',
							},
						],
					},
				};
			}

			if (url.includes('/props')) {
				return {
					data: {
						default_generation_settings: {
							n_ctx: 65536,
						},
					},
				};
			}

			throw new Error(`Unexpected GET ${url}`);
		}) as typeof axios.get;

		(axios as typeof axios & { post: typeof axios.post }).post = (async () => ({
			data: Readable.from([
				'data: {"choices":[{"delta":{"content":"final answer"}}]}\n',
				'data: {"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150,"completion_tokens_details":{"reasoning_tokens":20},"prompt_tokens_details":{"cached_tokens":7}}}\n',
				'data: [DONE]\n'
			]),
		})) as typeof axios.post;

		const app = new MockApplication();
		const provider = new LlamaChatModelProvider(app as unknown as Application);

		await provider.provideLanguageModelChatResponse(
			{
				id: 'mock-model',
				name: 'mock-model',
				family: 'llama-vscode',
				version: '1',
				maxInputTokens: 65536,
				maxOutputTokens: 4096,
				capabilities: {
					toolCalling: true,
					imageInput: false,
				},
			},
			[
				{
					role: vscode.LanguageModelChatMessageRole.User,
					content: [new vscode.LanguageModelTextPart('say hello')],
				},
			] as unknown as readonly vscode.LanguageModelChatRequestMessage[],
			{} as vscode.ProvideLanguageModelChatResponseOptions,
			{ report: () => undefined },
			new vscode.CancellationTokenSource().token,
		);

		const usageLog = app.eventLogs.find(entry => entry.includes('CHAT_COMPLETIONS_POST_RESPONSE'));
		assert.ok(usageLog);
		assert.match(usageLog!, /prompt_tokens=100/);
		assert.match(usageLog!, /completion_tokens=50/);
		assert.match(usageLog!, /total_tokens=150/);
		assert.match(usageLog!, /reasoning_tokens=20/);
		assert.match(usageLog!, /cached_prompt_tokens=7/);
	});

	test('rejects an empty streamed response explicitly', async () => {
		(axios as typeof axios & { get: typeof axios.get }).get = (async (url: string) => {
			if (url.endsWith('/v1/models')) {
				return {
					data: {
						data: [
							{
								id: 'mock-model',
								owned_by: 'llamacpp',
							},
						],
					},
				};
			}

			if (url.includes('/props')) {
				return {
					data: {
						default_generation_settings: {
							n_ctx: 65536,
						},
					},
				};
			}

			throw new Error(`Unexpected GET ${url}`);
		}) as typeof axios.get;

		(axios as typeof axios & { post: typeof axios.post }).post = (async () => ({
			data: Readable.from([
				'data: {"choices":[{"delta":{}}]}\n'
			]),
		})) as typeof axios.post;

		const provider = new LlamaChatModelProvider(new MockApplication() as unknown as Application);

		await assert.rejects(
			() => provider.provideLanguageModelChatResponse(
				{
					id: 'mock-model',
					name: 'mock-model',
					family: 'llama-vscode',
					version: '1',
					maxInputTokens: 65536,
					maxOutputTokens: 4096,
					capabilities: {
						toolCalling: true,
						imageInput: false,
					},
				},
				[
					{
						role: vscode.LanguageModelChatMessageRole.User,
						content: [new vscode.LanguageModelTextPart('say hello')],
					},
				] as unknown as readonly vscode.LanguageModelChatRequestMessage[],
				{} as vscode.ProvideLanguageModelChatResponseOptions,
				{ report: () => undefined },
				new vscode.CancellationTokenSource().token,
			),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				assert.strictEqual(error.name, 'LanguageModelProviderError');
				assert.match(error.message, /empty response/i);
				assert.strictEqual(error.stack, undefined);
				return true;
			}
		);
	});

	test('rejects reasoning-only streamed responses that exhaust the output budget', async () => {
		(axios as typeof axios & { get: typeof axios.get }).get = (async (url: string) => {
			if (url.endsWith('/v1/models')) {
				return {
					data: {
						data: [
							{
								id: 'mock-model',
								owned_by: 'llamacpp',
							},
						],
					},
				};
			}

			if (url.includes('/props')) {
				return {
					data: {
						default_generation_settings: {
							n_ctx: 65536,
						},
					},
				};
			}

			throw new Error(`Unexpected GET ${url}`);
		}) as typeof axios.get;

		(axios as typeof axios & { post: typeof axios.post }).post = (async () => ({
			data: Readable.from([
				'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n',
				'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n',
				'data: [DONE]\n'
			]),
		})) as typeof axios.post;

		const provider = new LlamaChatModelProvider(new MockApplication() as unknown as Application);

		await assert.rejects(
			() => provider.provideLanguageModelChatResponse(
				{
					id: 'mock-model',
					name: 'mock-model',
					family: 'llama-vscode',
					version: '1',
					maxInputTokens: 65536,
					maxOutputTokens: 4096,
					capabilities: {
						toolCalling: true,
						imageInput: false,
					},
				},
				[
					{
						role: vscode.LanguageModelChatMessageRole.User,
						content: [new vscode.LanguageModelTextPart('say hello')],
					},
				] as unknown as readonly vscode.LanguageModelChatRequestMessage[],
				{} as vscode.ProvideLanguageModelChatResponseOptions,
				{ report: () => undefined },
				new vscode.CancellationTokenSource().token,
			),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				assert.strictEqual(error.name, 'LanguageModelProviderError');
				assert.match(error.message, /entire output budget on internal reasoning/i);
				assert.strictEqual(error.stack, undefined);
				return true;
			}
		);
	});
});