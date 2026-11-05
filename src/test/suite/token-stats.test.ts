/// <reference types="mocha" />
import * as assert from 'assert';
import { suite, test } from 'mocha';
import { TELEGRAM_BOT_COMMANDS, UI_TEXT_KEYS } from '../../constants';
import { translations } from '../../translations';
import {
    buildTokenStatsMessage,
    DEFAULT_TOKEN_STATS_LABELS,
    formatTokenCount,
    formatTokenPrice,
    TokenStatsLabels
} from '../../services/token-stats';

// The Telegram bot command /tokens prints the same numbers the agent view shows
// in its status line (ui/src/components/agent/StatusLine.tsx). The whole suite
// runs without a VS Code host: services/token-stats.ts imports only types.

const labels = (overrides: Partial<TokenStatsLabels> = {}): TokenStatsLabels => ({
    ...DEFAULT_TOKEN_STATS_LABELS,
    ...overrides
});

suite('Telegram bot /tokens command', () => {
    test('is registered as a bot command and described in the help', () => {
        assert.strictEqual(TELEGRAM_BOT_COMMANDS.SHOW_TOKENS, '/tokens');
        // Every label the bot prints must have a UI_TEXT_KEYS entry, otherwise
        // getUiText() returns undefined and the command would print an English
        // fallback in a translated chat.
        const keys = [
            UI_TEXT_KEYS.telegramCmdTokensDesc,
            UI_TEXT_KEYS.telegramTokensTitle,
            UI_TEXT_KEYS.telegramTokensLastRequest,
            UI_TEXT_KEYS.telegramTokensChatTotal,
            UI_TEXT_KEYS.telegramTokensInput,
            UI_TEXT_KEYS.telegramTokensCached,
            UI_TEXT_KEYS.telegramTokensOutput,
            UI_TEXT_KEYS.telegramTokensUnit,
            UI_TEXT_KEYS.telegramTokensPriceNotAvailable,
            UI_TEXT_KEYS.telegramTokensNone,
            UI_TEXT_KEYS.telegramTokensPriceNote
        ];
        keys.forEach(key => assert.ok(typeof key === 'string' && key.length > 0, 'empty UI text key'));
        // Each of the above keys must resolve through translations.ts (English
        // column) - the same lookup the Configuration does at runtime.
        keys.forEach(key => assert.ok(
            translations.some(row => row[0] === key),
            'missing translation row for: ' + key
        ));
        // The English defaults must be the exact strings from translations.ts so
        // a missing row cannot silently change the wording.
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.title, UI_TEXT_KEYS.telegramTokensTitle);
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.lastRequest, UI_TEXT_KEYS.telegramTokensLastRequest);
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.chatTotal, UI_TEXT_KEYS.telegramTokensChatTotal);
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.input, UI_TEXT_KEYS.telegramTokensInput);
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.cached, UI_TEXT_KEYS.telegramTokensCached);
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.output, UI_TEXT_KEYS.telegramTokensOutput);
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.unit, UI_TEXT_KEYS.telegramTokensUnit);
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.priceNotAvailable, UI_TEXT_KEYS.telegramTokensPriceNotAvailable);
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.none, UI_TEXT_KEYS.telegramTokensNone);
        assert.strictEqual(DEFAULT_TOKEN_STATS_LABELS.note, UI_TEXT_KEYS.telegramTokensPriceNote);
    });

    test('formats token counts with thousands separators', () => {
        assert.strictEqual(formatTokenCount(0), '0');
        assert.strictEqual(formatTokenCount(999), '999');
        assert.strictEqual(formatTokenCount(1000), '1,000');
        assert.strictEqual(formatTokenCount(1234), '1,234');
        assert.strictEqual(formatTokenCount(1234567), '1,234,567');
        assert.strictEqual(formatTokenCount(undefined), '0');
        assert.strictEqual(formatTokenCount(NaN), '0');
    });

    test('formats prices like the agent status line and hides missing prices', () => {
        assert.strictEqual(formatTokenPrice(0), '');
        assert.strictEqual(formatTokenPrice(undefined), '');
        assert.strictEqual(formatTokenPrice(NaN), '');
        assert.strictEqual(formatTokenPrice(-1), '');
        assert.strictEqual(formatTokenPrice(0.00001), '<$0.0001');
        assert.strictEqual(formatTokenPrice(0.0021), '$0.0021');
        assert.strictEqual(formatTokenPrice(1.5), '$1.50');
    });

    test('reports last request and chat total with prices', () => {
        const msg = buildTokenStatsMessage({
            lastReqTokens: 1234,
            inputTokens: 1000,
            cachedTokens: 200,
            outputTokens: 34,
            price: 0.0021,
            chatTokens: 5000,
            chatInputTokens: 4200,
            chatCachedTokens: 500,
            chatOutputTokens: 300,
            chatPrice: 0.5
        }, labels());
        const lines = msg.split('\n');
        assert.strictEqual(lines[0], 'Tokens:');
        assert.strictEqual(lines[1], 'Last request: 1,234 tokens (input 1,000, cached 200, output 34) · $0.0021');
        assert.strictEqual(lines[2], 'Chat total: 5,000 tokens (input 4,200, cached 500, output 300) · $0.5000');
        assert.strictEqual(lines[3], '');
        assert.strictEqual(lines[4], DEFAULT_TOKEN_STATS_LABELS.note);
    });

    test('says the price is not available when the provider does not report it', () => {
        const msg = buildTokenStatsMessage({ lastReqTokens: 10, chatTokens: 10 }, labels());
        assert.ok(msg.includes('(input 0, cached 0, output 0) · price not available'), msg);
    });

    test('reports only the last request when no chat total is stored yet', () => {
        const msg = buildTokenStatsMessage({ lastReqTokens: 42, inputTokens: 40, outputTokens: 2 }, labels());
        assert.ok(msg.includes('Last request: 42 tokens'), msg);
        assert.ok(!msg.includes('Chat total'), msg);
    });

    test('reports only the chat total for a chat restored from history', () => {
        // A chat loaded from history keeps chatTokens but has no last request of
        // its own until the first request of this session finishes.
        const msg = buildTokenStatsMessage({ chatTokens: 777, chatInputTokens: 700, chatOutputTokens: 77 }, labels());
        assert.ok(!msg.includes('Last request'), msg);
        assert.ok(msg.includes('Chat total: 777 tokens'), msg);
    });

    test('handles a chat with no token details at all', () => {
        assert.strictEqual(buildTokenStatsMessage(undefined, labels()), DEFAULT_TOKEN_STATS_LABELS.none);
        assert.strictEqual(buildTokenStatsMessage({}, labels()), DEFAULT_TOKEN_STATS_LABELS.none);
        assert.strictEqual(buildTokenStatsMessage({ lastReqTokens: 0, chatTokens: 0 }, labels()), DEFAULT_TOKEN_STATS_LABELS.none);
    });

    test('uses the supplied (translated) labels', () => {
        const msg = buildTokenStatsMessage({ lastReqTokens: 5, chatTokens: 5 }, labels({
            title: 'T',
            lastRequest: 'L',
            chatTotal: 'C',
            input: 'i',
            cached: 'c',
            output: 'o',
            unit: 'u',
            priceNotAvailable: 'p',
            none: 'n',
            note: 'x'
        }));
        assert.strictEqual(msg.split('\n')[1], 'L: 5 u (i 0, c 0, o 0) · p');
        assert.strictEqual(msg.split('\n')[2], 'C: 5 u (i 0, c 0, o 0) · p');
        assert.strictEqual(msg.split('\n')[4], 'x');
    });
});
