/// <reference types="mocha" />
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import { Application } from '../../application';
import { ToolsPermissionsMode } from '../../constants';
import {
    TOOLS_PERMISSIONS_MODES,
    getToolsPermissionsModeInfo,
    isToolsPermissionsMode,
    normalizeToolsPermissionsMode
} from '../../services/permissions-mode';
import { LlamaWebviewProvider } from '../../llama-webview-provider';

// The composer footer button shows the tools permissions mode and lets the user
// switch it. Two copies of the mode metadata exist - package.json (the settings
// UI) and src/services/permissions-mode.ts (what the webview renders) - so the
// first thing this suite does is prove they cannot drift apart. A silent drift
// would show the user a different explanation than the one VS Code shows.

const REPO_ROOT = path.resolve(__dirname, '../../..');

interface PackageSetting {
    enum?: string[];
    enumItemLabels?: string[];
    enumDescriptions?: string[];
    default?: unknown;
}

const readPackageSetting = (): PackageSetting => {
    const raw = fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
    const json = JSON.parse(raw);
    const properties =
        json?.contributes?.configuration?.properties ??
        // The setting may live in the first entry of an array of configurations.
        (Array.isArray(json?.contributes?.configuration)
            ? json.contributes.configuration[0]?.properties
            : undefined);
    const setting = properties?.['llama-vscode.tools_permissions_mode'];
    assert.ok(setting, 'llama-vscode.tools_permissions_mode must be declared in package.json');
    return setting as PackageSetting;
};

suite('Tools permissions mode metadata Test Suite', () => {
    test('the modes and their order match the package.json enum', () => {
        const setting = readPackageSetting();
        assert.deepStrictEqual(
            TOOLS_PERMISSIONS_MODES.map(mode => mode.value),
            setting.enum
        );
    });

    test('the labels match enumItemLabels', () => {
        const setting = readPackageSetting();
        assert.deepStrictEqual(
            TOOLS_PERMISSIONS_MODES.map(mode => mode.label),
            setting.enumItemLabels
        );
    });

    test('the details match enumDescriptions', () => {
        const setting = readPackageSetting();
        assert.deepStrictEqual(
            TOOLS_PERMISSIONS_MODES.map(mode => mode.details),
            setting.enumDescriptions
        );
    });

    test('the setting default is the fallback of normalizeToolsPermissionsMode', () => {
        const setting = readPackageSetting();
        // Safety property: an unreadable setting must fall back to the mode
        // package.json declares as the default (Ask), never to a permissive one.
        assert.strictEqual(normalizeToolsPermissionsMode(undefined), setting.default);
        assert.strictEqual(normalizeToolsPermissionsMode('garbage'), setting.default);
        assert.strictEqual(normalizeToolsPermissionsMode(42), setting.default);
    });

    test('every mode has a short label for the compact footer button', () => {
        TOOLS_PERMISSIONS_MODES.forEach(mode => {
            assert.ok(mode.shortLabel.length > 0, mode.value + ' needs a shortLabel');
            // The footer is 10px inside a narrow sidebar: keep it terse.
            assert.ok(mode.shortLabel.length <= 10, mode.value + ' shortLabel is too long: ' + mode.shortLabel);
        });
    });

    test('every mode has a one-sentence description for the menu', () => {
        TOOLS_PERMISSIONS_MODES.forEach(mode => {
            assert.ok(mode.description.length > 0, mode.value + ' needs a description');
            assert.notStrictEqual(mode.description, mode.details, mode.value + ' must not reuse the long text');
        });
    });

    test('isToolsPermissionsMode accepts exactly the enum values', () => {
        assert.strictEqual(isToolsPermissionsMode(ToolsPermissionsMode.AllowAll), true);
        assert.strictEqual(isToolsPermissionsMode(ToolsPermissionsMode.AutoAskIfUnsure), true);
        assert.strictEqual(isToolsPermissionsMode(ToolsPermissionsMode.AutoDenyIfUnsure), true);
        assert.strictEqual(isToolsPermissionsMode(ToolsPermissionsMode.Ask), true);
        assert.strictEqual(isToolsPermissionsMode('allowall'), false);
        assert.strictEqual(isToolsPermissionsMode(''), false);
        assert.strictEqual(isToolsPermissionsMode(null), false);
        assert.strictEqual(isToolsPermissionsMode({}), false);
    });

    test('getToolsPermissionsModeInfo resolves every mode and falls back to Ask', () => {
        TOOLS_PERMISSIONS_MODES.forEach(mode => {
            assert.strictEqual(getToolsPermissionsModeInfo(mode.value).value, mode.value);
        });
        assert.strictEqual(getToolsPermissionsModeInfo('nonsense').value, ToolsPermissionsMode.Ask);
    });
});

// --- The provider side: posting the mode and writing the setting -------------

interface ProviderHarness {
    provider: LlamaWebviewProvider;
    messages: any[];
    written: any[];
    configuration: { tools_permissions_mode: string };
    modeMessages: () => any[];
    lastModeMessage: () => any;
}

const createProviderHarness = (initialMode: string): ProviderHarness => {
    const messages: any[] = [];
    const written: any[] = [];
    const configuration = { tools_permissions_mode: initialMode };

    const app = {
        configuration: {
            get tools_permissions_mode() {
                return configuration.tools_permissions_mode;
            },
            updateConfigValue: async (key: string, value: any) => {
                written.push({ key, value });
                if (key === 'tools_permissions_mode') configuration.tools_permissions_mode = value;
            }
        }
    };

    // A REAL instance is needed: `setPermissionsMode` and
    // `updatePermissionsModeInView` are arrow-function class properties, so they
    // only exist on a constructed object (an Object.create(prototype) harness -
    // the recipe that works for prototype methods - does not have them). The
    // constructor only reads `app` and fills the command map, which is exactly
    // what is wanted here, so a throw-away instance is built and its internals are
    // then pointed at the harness.
    const provider = new LlamaWebviewProvider(
        undefined as any,
        app as unknown as Application,
        { subscriptions: [] } as unknown as vscode.ExtensionContext
    );
    (provider as any).app = app;
    (provider as any)._webview = {
        webview: { postMessage: (message: any) => { messages.push(message); } }
    };

    const modeMessages = () => messages.filter(m => m.command === 'updatePermissionsMode');
    return {
        provider,
        messages,
        written,
        configuration,
        modeMessages,
        lastModeMessage: () => modeMessages()[modeMessages().length - 1]
    };
};

suite('Tools permissions mode - webview wiring Test Suite', () => {
    test('the current mode and the mode list are posted to the UI', () => {
        const harness = createProviderHarness(ToolsPermissionsMode.AutoAskIfUnsure);
        harness.provider.updatePermissionsModeInView();

        const message = harness.lastModeMessage();
        assert.ok(message, 'the UI must be told about the permissions mode');
        assert.strictEqual(message.mode, ToolsPermissionsMode.AutoAskIfUnsure);
        assert.strictEqual(message.shortLabel, 'auto ask');
        // The list carries the explanations, so the webview copy cannot drift.
        assert.deepStrictEqual(
            message.modes.map((mode: any) => mode.value),
            [ToolsPermissionsMode.AllowAll, ToolsPermissionsMode.AutoAskIfUnsure, ToolsPermissionsMode.AutoDenyIfUnsure, ToolsPermissionsMode.Ask]
        );
    });

    test('an unknown setting value is reported as Ask instead of being rendered', () => {
        const harness = createProviderHarness('yolo');
        harness.provider.updatePermissionsModeInView();

        assert.strictEqual(harness.lastModeMessage()?.mode, ToolsPermissionsMode.Ask);
    });

    test('selecting a mode writes the setting and echoes the new value', async () => {
        const harness = createProviderHarness(ToolsPermissionsMode.Ask);

        await harness.provider.setPermissionsMode({ mode: ToolsPermissionsMode.AutoDenyIfUnsure }, {} as any);

        assert.deepStrictEqual(harness.written, [
            { key: 'tools_permissions_mode', value: ToolsPermissionsMode.AutoDenyIfUnsure }
        ]);
        assert.strictEqual(harness.lastModeMessage()?.mode, ToolsPermissionsMode.AutoDenyIfUnsure);
    });

    test('an unknown mode from the webview is not written to the setting', async () => {
        const harness = createProviderHarness(ToolsPermissionsMode.Ask);

        await harness.provider.setPermissionsMode({ mode: 'RunEverything' }, {} as any);

        assert.deepStrictEqual(harness.written, [], 'a stale bundle must not be able to set an arbitrary value');
        // The UI is still corrected, so it does not keep showing the bad value.
        assert.strictEqual(harness.lastModeMessage()?.mode, ToolsPermissionsMode.Ask);
    });

    test('a message without a mode is ignored', async () => {
        const harness = createProviderHarness(ToolsPermissionsMode.Ask);

        await harness.provider.setPermissionsMode({}, {} as any);

        assert.deepStrictEqual(harness.written, []);
    });

    test('updateLlamaView also posts the permissions mode (full refresh)', () => {
        const harness = createProviderHarness(ToolsPermissionsMode.AllowAll);
        const app = (harness.provider as any).app;
        // Everything updateLlamaView() touches, stubbed to no-ops. Listed
        // explicitly so a new call added to updateLlamaView() shows up here.
        app.configuration.enabled = true;
        app.configuration.rag_enabled = true;
        app.modelService = { hasToolsEndpoint: () => false, getDefaultToolsModel: () => undefined };
        app.persistence = { getGlobalValue: () => undefined };
        app.getModelState = () => '';
        app.getToolsModel = () => ({ name: '' });
        app.getModel = () => ({ name: '' });
        app.getEmbeddingsModel = () => ({ name: '' });
        app.getTmpAgentModel = () => ({ name: '' });
        app.getAgent = () => ({ name: '', systemInstruction: [] });
        app.getEnv = () => ({ name: '' });
        app.getChat = () => ({});
        app.llamaAgent = { getAgentLogText: () => '' };
        (harness.provider as any).startingDefaultToolsModel = false;

        harness.provider.updateLlamaView();

        assert.ok(
            harness.modeMessages().length > 0,
            'updateLlamaView() must refresh the permissions mode button'
        );
        assert.strictEqual(harness.lastModeMessage()?.mode, ToolsPermissionsMode.AllowAll);
    });
});
