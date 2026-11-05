import type { TokenDetails } from "../types";

// Token/price report, shared by the Telegram bot (/tokens) and available to any
// other text-only surface. The webview shows the same numbers in the agent
// status line (ui/src/components/agent/StatusLine.tsx - tooltipForRequest /
// tooltipForChat); both read `chat.tokenDetails` which is maintained by
// ChatService.updateChatTokens.
//
// This module is intentionally free of `vscode` imports so it can be unit tested
// without the extension host: the labels are injected by the caller, which reads
// them with Configuration.getUiText().

export interface TokenStatsLabels {
    title: string;
    lastRequest: string;
    chatTotal: string;
    input: string;
    cached: string;
    output: string;
    unit: string;
    priceNotAvailable: string;
    none: string;
    note: string;
}

// 1234 -> "1,234". Uses a manual grouping instead of toLocaleString() so the
// output does not depend on the machine locale (the tests assert exact text).
export const formatTokenCount = (value: number | undefined): string => {
    const rounded = Math.round(Number.isFinite(value ?? NaN) ? (value as number) : 0);
    const digits = String(Math.abs(rounded));
    let grouped = "";
    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && (digits.length - i) % 3 === 0) grouped += ",";
        grouped += digits[i];
    }
    return (rounded < 0 ? "-" : "") + grouped;
};

// Same shape as ui/src/utils/formatNumber.ts:formatPrice() - '' means "no price
// information" (most local models are free and the providers do not report it).
export const formatTokenPrice = (price: number | undefined): string => {
    if (!price || !Number.isFinite(price) || price <= 0) return "";
    if (price < 0.0001) return "<$0.0001";
    if (price < 1) return "$" + price.toFixed(4);
    return "$" + price.toFixed(2);
};

interface TokenStatsLine {
    label: string;
    total: number;
    input: number;
    cached: number;
    output: number;
    price: number;
}

const buildLine = (line: TokenStatsLine, labels: TokenStatsLabels): string => {
    const details = `${labels.input} ${formatTokenCount(line.input)}, ` +
        `${labels.cached} ${formatTokenCount(line.cached)}, ` +
        `${labels.output} ${formatTokenCount(line.output)}`;
    const price = formatTokenPrice(line.price);
    return `${line.label}: ${formatTokenCount(line.total)} ${labels.unit} (${details}) · ` +
        (price || labels.priceNotAvailable);
};

// One message, plain text (Telegram sends it as-is): last request, chat total
// and a note that the price is only reported by some providers.
export const buildTokenStatsMessage = (tokenDetails: TokenDetails | undefined, labels: TokenStatsLabels): string => {
    const lastRequestTokens = tokenDetails?.lastReqTokens ?? 0;
    const chatTotalTokens = tokenDetails?.chatTokens ?? 0;
    const lines: string[] = [labels.title];
    if (lastRequestTokens > 0) {
        lines.push(buildLine({
            label: labels.lastRequest,
            total: lastRequestTokens,
            input: tokenDetails?.inputTokens ?? 0,
            cached: tokenDetails?.cachedTokens ?? 0,
            output: tokenDetails?.outputTokens ?? 0,
            price: tokenDetails?.price ?? 0
        }, labels));
    }
    if (chatTotalTokens > 0) {
        lines.push(buildLine({
            label: labels.chatTotal,
            total: chatTotalTokens,
            input: tokenDetails?.chatInputTokens ?? 0,
            cached: tokenDetails?.chatCachedTokens ?? 0,
            output: tokenDetails?.chatOutputTokens ?? 0,
            price: tokenDetails?.chatPrice ?? 0
        }, labels));
    }
    if (lines.length === 1) {
        // Nothing used yet (fresh chat): one short line instead of a header only.
        return labels.none;
    }
    lines.push("");
    lines.push(labels.note);
    return lines.join("\n");
};

// English defaults for every label, used when a translation row is missing.
export const DEFAULT_TOKEN_STATS_LABELS: TokenStatsLabels = {
    title: "Tokens:",
    lastRequest: "Last request",
    chatTotal: "Chat total",
    input: "input",
    cached: "cached",
    output: "output",
    unit: "tokens",
    priceNotAvailable: "price not available",
    none: "No tokens have been used yet in this chat.",
    note: "Price works only for OpenRouter and OrcaRouter; not finished/stopped requests are not included but are taxed."
};
