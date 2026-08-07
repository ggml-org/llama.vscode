/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import { Application } from '../../application';
import { Architect } from '../../architect';
import { Configuration } from '../../configuration';
import { PERSISTENCE_KEYS } from '../../constants';
import { EnvService } from '../../services/env-service';
import { Env } from '../../types';

suite('Environment Auto-Start Test Suite', () => {
    test('changing auto-start does not reset confirmation', () => {
        const configuration = new Configuration();
        let writes = 0;
        configuration.updateConfigValue = async () => {
            writes += 1;
        };

        configuration.updateOnEvent({
            affectsConfiguration: (section: string) => section === 'llama-vscode.env_start_last_used',
        } as vscode.ConfigurationChangeEvent, vscode.workspace.getConfiguration('llama-vscode'));

        assert.strictEqual(writes, 0);
    });

    test('uses the effective User or Workspace configuration target', async () => {
        const configuration = new Configuration();
        const workspaceWrites: Array<{ setting: string; target: vscode.ConfigurationTarget | boolean | null | undefined }> = [];

        configuration.config = {
            inspect: (section: string) => section === 'env_start_last_used'
                ? { globalValue: true, workspaceValue: false }
                : { globalValue: true },
            update: async (setting: string, _value: unknown, target?: vscode.ConfigurationTarget | boolean | null) => {
                workspaceWrites.push({ setting, target });
            },
        } as unknown as vscode.WorkspaceConfiguration;

        assert.strictEqual(configuration.getEnvStartLastUsedScope(), vscode.ConfigurationTarget.Workspace);
        await configuration.updateEnvStartLastUsed(true);
        await configuration.updateEnvStartLastUsedConfirm(false);
        assert.deepStrictEqual(workspaceWrites, [
            { setting: 'env_start_last_used', target: vscode.ConfigurationTarget.Workspace },
            { setting: 'env_start_last_used_confirm', target: vscode.ConfigurationTarget.Workspace },
        ]);

        const globalWrites: Array<{ setting: string; target: vscode.ConfigurationTarget | boolean | null | undefined }> = [];
        configuration.config = {
            inspect: () => ({ globalValue: false }),
            update: async (setting: string, _value: unknown, target?: vscode.ConfigurationTarget | boolean | null) => {
                globalWrites.push({ setting, target });
            },
        } as unknown as vscode.WorkspaceConfiguration;

        assert.strictEqual(configuration.getEnvStartLastUsedScope(), vscode.ConfigurationTarget.Global);
        await configuration.updateEnvStartLastUsed(true);
        await configuration.updateEnvStartLastUsedConfirm(false);
        assert.deepStrictEqual(globalWrites, [
            { setting: 'env_start_last_used', target: vscode.ConfigurationTarget.Global },
            { setting: 'env_start_last_used_confirm', target: vscode.ConfigurationTarget.Global },
        ]);
    });

    test('fresh selection writes both histories while restoration writes neither', async () => {
        const writes: Array<{ store: string; key: string; value: unknown }> = [];
        const app = Object.create(Application.prototype) as Application;
        app.persistence = {
            setValue: async (key: string, value: unknown) => {
                writes.push({ store: 'workspace', key, value });
            },
            setGlobalValue: async (key: string, value: unknown) => {
                writes.push({ store: 'global', key, value });
            },
        } as unknown as Application['persistence'];
        app.llamaWebviewProvider = {
            updateLlamaView: () => undefined,
        } as unknown as Application['llamaWebviewProvider'];
        const fresh: Env = { name: 'fresh' };

        await app.setSelectedEnv(fresh);
        assert.deepStrictEqual(writes, [
            { store: 'workspace', key: PERSISTENCE_KEYS.SELECTED_ENV, value: fresh },
            { store: 'global', key: PERSISTENCE_KEYS.LAST_USED_ENV, value: fresh },
        ]);

        await app.setSelectedEnv({ name: 'restored' }, false);
        assert.strictEqual(writes.length, 2);
    });

    test('reads only the history selected by configuration scope', () => {
        const workspaceEnv: Env = { name: 'workspace' };
        const globalEnv: Env = { name: 'global' };

        for (const [target, expected] of [
            [vscode.ConfigurationTarget.Workspace, workspaceEnv],
            [vscode.ConfigurationTarget.Global, globalEnv],
        ] as const) {
            const app = {
                configuration: {
                    getEnvStartLastUsedScope: () => target,
                },
                persistence: {
                    getValue: () => workspaceEnv,
                    getGlobalValue: () => globalEnv,
                },
            } as unknown as Application;

            assert.strictEqual(new EnvService(app).getPersistedEnvForAutoStart(), expected);
        }

        const app = {
            configuration: {
                getEnvStartLastUsedScope: () => vscode.ConfigurationTarget.Workspace,
            },
            persistence: {
                getValue: () => ({ name: '' }),
            },
        } as unknown as Application;
        assert.strictEqual(new EnvService(app).getPersistedEnvForAutoStart(), undefined);
    });

    test('keeps restoration visible without remembering a failed fresh selection', async () => {
        const events: string[] = [];
        const restoredEnv = { name: 'remembered', completion: { name: 'completion' } } as Env;
        const app = {
            getComplModel: () => ({ name: '' }),
            getChatModel: () => ({ name: '' }),
            getEmbeddingsModel: () => ({ name: '' }),
            getToolsModel: () => ({ name: '' }),
            getAgent: () => ({ name: '', systemInstruction: [] }),
            configuration: {
                rag_enabled: false,
                env_start_last_used: true,
                enabled: true,
            },
            llamaServer: {
                killFimCmd: () => undefined,
                killChatCmd: () => undefined,
                killEmbeddingsCmd: () => undefined,
                killToolsCmd: () => undefined,
            },
            setSelectedEnv: async (env: Env, persist: boolean) => {
                events.push(`selected:${env.name}:${persist}`);
            },
            setSelectedModel: () => undefined,
            modelService: {
                addApiKey: async () => {
                    events.push('startup');
                    throw new Error('model startup failed');
                },
            },
        } as unknown as Application;

        await assert.rejects(
            new EnvService(app).selectStartEnv(restoredEnv, false, 'restoration'),
            /model startup failed/
        );
        assert.deepStrictEqual(events, ['selected:remembered:false', 'startup']);

        events.length = 0;
        await assert.rejects(
            new EnvService(app).selectStartEnv(restoredEnv, false, 'fresh'),
            /model startup failed/
        );
        assert.deepStrictEqual(events, ['startup']);
    });

    test("don't ask again is saved before startup and suppresses the next prompt", async () => {
        const events: string[] = [];
        const configuration = {
            env_start_last_used: true,
            env_start_last_used_confirm: true,
            updateEnvStartLastUsedConfirm: async (value: boolean) => {
                events.push(`confirmation:${value}`);
                configuration.env_start_last_used_confirm = value;
            },
        };
        const app = {
            configuration,
            dialogs: {
                showYesYesdontaskNoDialog: async () => {
                    events.push('dialog');
                    return [true, true] as [boolean, boolean];
                },
            },
            envService: {
                getPersistedEnvForAutoStart: () => ({ name: 'remembered' }),
                getEnvDetailsAsString: () => 'details',
                selectStartEnv: async (_env: Env, _confirm: boolean, mode: string) => {
                    events.push(`start:${mode}`);
                    return true;
                },
            },
        } as unknown as Application;
        const architect = new Architect(app) as unknown as {
            restoreLastUsedEnv: () => Promise<void>;
        };

        await architect.restoreLastUsedEnv();
        await architect.restoreLastUsedEnv();

        assert.deepStrictEqual(events, [
            'dialog',
            'confirmation:false',
            'start:restoration',
            'start:restoration',
        ]);
    });
});
