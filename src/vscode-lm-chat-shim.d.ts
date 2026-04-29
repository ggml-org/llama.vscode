// Temporary shim for VS Code LM chat-provider typings.
// Some @types/vscode versions ship parts of the LM API behind proposal typings.
// This keeps `tsc` happy while still targeting the runtime VS Code API.

import type * as vscode from 'vscode';

declare module 'vscode' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	export namespace lm {
		function registerLanguageModelChatProvider(
			vendor: string,
			provider: LanguageModelChatProvider
		): vscode.Disposable;
	}

	export interface PrepareLanguageModelChatModelOptions {}

	export interface LanguageModelChatCapabilities {
		toolCalling?: boolean;
		imageInput?: boolean;
	}

	export interface LanguageModelChatInformation {
		id: string;
		name: string;
		family?: string;
		version?: string;
		maxInputTokens?: number;
		maxOutputTokens?: number;
		capabilities?: LanguageModelChatCapabilities;
	}

	export type LanguageModelChatMessagePart = unknown | LanguageModelTextPart;

	export interface LanguageModelChatRequestMessage {
		role: LanguageModelChatMessageRole;
		content: readonly LanguageModelChatMessagePart[];
	}

	export interface ProvideLanguageModelChatResponseOptions {
		tools?: readonly LanguageModelToolInformation[];
		modelOptions?: {
			temperature?: number;
			[key: string]: unknown;
		};
		[key: string]: unknown;
	}

	export type LanguageModelResponsePart =
		| LanguageModelTextPart
		| LanguageModelToolCallPart
		| unknown;

	export interface LanguageModelChatProvider {
		onDidChangeLanguageModelChatInformation?: vscode.Event<void>;

		provideLanguageModelChatInformation(
			options: PrepareLanguageModelChatModelOptions,
			token: vscode.CancellationToken
		): vscode.ProviderResult<LanguageModelChatInformation[]>;

		provideLanguageModelChatResponse(
			model: LanguageModelChatInformation,
			messages: readonly LanguageModelChatRequestMessage[],
			options: ProvideLanguageModelChatResponseOptions,
			progress: vscode.Progress<LanguageModelResponsePart>,
			token: vscode.CancellationToken
		): vscode.ProviderResult<void>;

		provideTokenCount(
			model: LanguageModelChatInformation,
			text: string | LanguageModelChatRequestMessage,
			token: vscode.CancellationToken
		): vscode.ProviderResult<number>;
	}
}

