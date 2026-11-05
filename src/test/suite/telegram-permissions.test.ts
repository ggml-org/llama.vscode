/// <reference types="mocha" />
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { suite, test } from 'mocha';
import { TELEGRAM_BOT_COMMANDS, ToolsPermissionsMode, UI_TEXT_KEYS } from '../../constants';
import { translations } from '../../translations';
import {
    TOOLS_PERMISSIONS_MODES,
    buildPermissionsModesMessage,
    isToolsPermissionsMode,
    resolveToolsPermissionsModeArgument
} from '../../services/permissions-mode';

// The Telegram bot lets the user (i.e. from a phone) read and change the tools
// permissions mode with /permissions and /setpermission - the same setting the
// composer footer button writes. The whole suite runs without a VS Code host:
// services/permissions-mode.ts imports only ../constants.

const REPO_ROOT = path.resolve(__dirname, '../../..');

// Names (not the English strings) of the UI_TEXT_KEYS the two commands print.
const uiTextKeyNames = [
    'telegramCmdPermissionsDesc',
    'telegramCmdSetPermissionDesc',
    'telegramAvailablePermissions',
    'telegramPermissionSetTo',
    'telegramEnterCorrectPermission'
] as const;

const uiTextKeys = uiTextKeyNames.map(name => UI_TEXT_KEYS[name]);

suite('Telegram bot /permissions and /setpermission commands', () => {
    test('are registered as bot commands', () => {
        assert.strictEqual(TELEGRAM_BOT_COMMANDS.SHOW_PERMISSIONS, '/permissions');
        assert.strictEqual(TELEGRAM_BOT_COMMANDS.SET_PERMISSION, '/setpermission');
        // /setpermission must not be a prefix of /permissions or vice versa: the
        // bot dispatch is `startsWith` for the argument commands and an exact
        // match in the switch, so an overlap would shadow a command.
        assert.ok(!TELEGRAM_BOT_COMMANDS.SET_PERMISSION.startsWith(TELEGRAM_BOT_COMMANDS.SHOW_PERMISSIONS));
        assert.ok(!TELEGRAM_BOT_COMMANDS.SHOW_PERMISSIONS.startsWith(TELEGRAM_BOT_COMMANDS.SET_PERMISSION));
    });

    test('every printed string is translated (7-column rows, English = key)', () => {
        const malformed = translations.filter(row => row.length !== 7).map(row => row[0]);
        assert.deepStrictEqual(malformed, [], 'each translation row must have 7 columns');
        uiTextKeys.forEach(key => {
            assert.ok(typeof key === 'string' && key.length > 0, 'empty UI text key');
            assert.ok(
                translations.some(row => row[0] === key),
                'missing translation row for: ' + key
            );
        });
    });

    test('lists the available modes and marks the current one', () => {
        const msg = buildPermissionsModesMessage(ToolsPermissionsMode.AutoDenyIfUnsure, { title: 'Title' });
        const lines = msg.split('\n');
        assert.strictEqual(lines[0], 'Title');
        // One line per mode, numbered for /setpermission, the current one with ✓.
        assert.strictEqual(lines.length, TOOLS_PERMISSIONS_MODES.length + 1);
        assert.ok(lines[1].startsWith('1. allow all commands'), lines[1]);
        assert.ok(!lines[1].includes('✓'), lines[1]);
        assert.ok(lines[3].includes('✓'), lines[3]);
        assert.ok(lines[3].includes(ToolsPermissionsMode.AutoDenyIfUnsure), lines[3]);
        assert.ok(!lines[4].includes('✓'), lines[4]);
    });

    test('falls back to the most restrictive mode for an unknown setting value', () => {
        // Ask is the setting default; a corrupted value must not show a mode that
        // allows everything.
        const msg = buildPermissionsModesMessage('RunEverything', { title: 'T' });
        const current = msg.split('\n').filter(line => line.includes('✓'));
        assert.deepStrictEqual(current.length, 1);
        assert.ok(current[0].includes(ToolsPermissionsMode.Ask), current[0]);
    });

    test('resolves the /setpermission argument by number, value or label', () => {
        // Numbers printed by /permissions (1-based).
        TOOLS_PERMISSIONS_MODES.forEach((info, index) => {
            assert.strictEqual(resolveToolsPermissionsModeArgument(String(index + 1)), info.value);
        });
        // The setting value, case-insensitive.
        assert.strictEqual(resolveToolsPermissionsModeArgument('AllowAll'), ToolsPermissionsMode.AllowAll);
        assert.strictEqual(resolveToolsPermissionsModeArgument('autodenyifunsure'), ToolsPermissionsMode.AutoDenyIfUnsure);
        // The labels from package.json, typed as a sentence or squeezed.
        assert.strictEqual(resolveToolsPermissionsModeArgument('auto - ask if unsure'), ToolsPermissionsMode.AutoAskIfUnsure);
        assert.strictEqual(resolveToolsPermissionsModeArgument('auto-ask'), ToolsPermissionsMode.AutoAskIfUnsure);
        assert.strictEqual(resolveToolsPermissionsModeArgument('ask for permission'), ToolsPermissionsMode.Ask);
        assert.strictEqual(resolveToolsPermissionsModeArgument('  ask  '), ToolsPermissionsMode.Ask);
    });

    test('rejects a missing, out of range or unknown argument', () => {
        // Rejecting (instead of assuming a mode) keeps a typo from changing the
        // permissions of the agent: the user gets the help text instead.
        ['', '   ', undefined, null, '0', '5', '-1', '1.5', 'run everything', 'a'].forEach(argument => {
            assert.strictEqual(
                resolveToolsPermissionsModeArgument(argument as any),
                undefined,
                'must reject: ' + String(argument)
            );
        });
    });

    test('only ever resolves to a valid setting value', () => {
        // Whatever the user types, what the bot writes into tools_permissions_mode
        // must be an enum member (the webview and tools.ts depend on it).
        const inputs = ['1', '2', '3', '4', 'AllowAll', 'ask', 'auto deny', 'nonsense'];
        inputs.forEach(input => {
            const mode = resolveToolsPermissionsModeArgument(input);
            if (mode !== undefined) assert.ok(isToolsPermissionsMode(mode), 'invalid mode: ' + mode);
        });
    });

    test('the bot help (and resources/help.md) mention both commands', () => {
        // getCommandsHelp() is a plain method over UI_TEXT_KEYS; the same list
        // exists as prose in resources/help.md, so both are checked here without
        // constructing the bot (which would need a VS Code host).
        const help = fs.readFileSync(path.join(REPO_ROOT, 'resources', 'help.md'), 'utf8');
        [TELEGRAM_BOT_COMMANDS.SHOW_PERMISSIONS, TELEGRAM_BOT_COMMANDS.SET_PERMISSION].forEach(command => {
            assert.ok(help.includes('- ' + command), 'resources/help.md must list ' + command);
        });
        const telegramBotSource = fs.readFileSync(path.join(REPO_ROOT, 'src', 'telegram-bot.ts'), 'utf8');
        uiTextKeyNames.forEach(name => {
            assert.ok(telegramBotSource.includes('UI_TEXT_KEYS.' + name), 'telegram-bot.ts must use ' + name);
        });
        assert.ok(telegramBotSource.includes('case TELEGRAM_BOT_COMMANDS.SHOW_PERMISSIONS'), 'switch case missing');
        assert.ok(
            telegramBotSource.includes('startsWith(TELEGRAM_BOT_COMMANDS.SET_PERMISSION)'),
            'the /setpermission argument block is missing'
        );
    });
});
