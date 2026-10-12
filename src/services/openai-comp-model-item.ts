import type { QuickPickItem } from "vscode";

export interface OpenAiCompModel {
    id: string;
    name?: string | null;
    description?: string | null;
    context_length?: number | string | null;
    pricing?: {
        prompt?: number | string | null;
        completion?: number | string | null;
    } | null;
}

function pricePerMillion(value: number | string | null | undefined): string | undefined {
    if (value == null || (typeof value === "string" && !value.trim())) return undefined;
    const price = Number(value);
    return Number.isFinite(price) && price >= 0 ? (price * 1000000).toFixed(2) : undefined;
}

export function formatOpenAiCompModelItem(model: OpenAiCompModel): QuickPickItem {
    const metadata: string[] = [];
    const context = Number(model.context_length);
    if (Number.isFinite(context) && context > 0) metadata.push(`${model.context_length} context`);
    const inputPrice = pricePerMillion(model.pricing?.prompt);
    const outputPrice = pricePerMillion(model.pricing?.completion);
    if (inputPrice !== undefined) metadata.push(`$${inputPrice}/M input tokens`);
    if (outputPrice !== undefined) metadata.push(`$${outputPrice}/M output tokens`);
    return {
        label: model.name || model.id,
        description: metadata.join(" | ") || "Context and pricing not provided",
        detail: model.description ? `${model.description} | ${model.id}` : model.id,
    };
}
