/// <reference types="mocha" />
import * as assert from 'assert';
import { suite, test } from 'mocha';
import { Application } from '../../application';
import { LlamaWebviewProvider } from '../../llama-webview-provider';
import { ModelService } from '../../services/model-service';
import { PERSISTENCE_KEYS } from '../../constants';
import { LlmModel } from '../../types';

interface Harness {
    service: ModelService;
    starts: LlmModel[];
    selected: LlmModel | undefined;
    // Notifications posted by updateModels(), used to verify the UI is refreshed.
    updates: number;
}

/**
 * Builds a ModelService whose default selection is observable. `selected` is the
 * model the app reports as the current tools model: it starts out empty and is
 * filled in by selectStartModel, exactly like the real Application does through
 * app.setSelectedModel().
 */
const createHarness = (options: {
    defaultModel?: LlmModel;
    endpointTools?: string;
    concurrentStarts?: number;
} = {}): Harness => {
    const starts: LlmModel[] = [];
    const harness = {
        starts,
        selected: undefined as LlmModel | undefined,
        updates: 0,
    } as Harness;

    const app = {
        getToolsModel: () => harness.selected ?? { name: '' },
        isToolsModelSelected: () => Boolean(harness.selected?.name?.trim()),
        configuration: {
            endpoint_tools: options.endpointTools ?? '',
            // getTypeDetails() reads the per-type settings and launch commands.
            tools_models_list: [],
            launch_tools: '',
        },
        persistence: {
            getGlobalValue: (key: string) =>
                key === PERSISTENCE_KEYS.DEFAULT_TOOLS_MODEL ? options.defaultModel : undefined,
        },
        llamaServer: {
            killToolsCmd: () => undefined,
            shellToolsCmd: () => undefined,
        },
        llamaWebviewProvider: {
            updateLlamaView: () => { harness.updates += 1; },
        },
        llamaChatModelProvider: {
            notifyModelsChanged: () => undefined,
        },
        setSelectedModel: (_type: unknown, model: LlmModel) => { harness.selected = model; },
    } as unknown as Application;

    const service = new ModelService(app);
    // selectStartModel launches a real terminal/command in the extension; the
    // test only needs to know that it was called with the default model.
    service.selectStartModel = async (model: LlmModel) => {
        starts.push(model);
        if (options.concurrentStarts) {
            // Give a concurrent caller a chance to enter the guard.
            await new Promise(resolve => setTimeout(resolve, options.concurrentStarts));
        }
        harness.selected = model;
    };
    harness.service = service;
    return harness;
};

suite('Default tools model Test Suite', () => {
    test('selects the configured default tools model when none is selected', async () => {
        const defaultModel: LlmModel = { name: 'default-tools', endpoint: 'http://127.0.0.1:8011' };
        const harness = createHarness({ defaultModel });

        const usable = await harness.service.selectDefaultToolsModelIfNone();

        assert.strictEqual(usable, true);
        assert.deepStrictEqual(harness.starts, [defaultModel]);
        assert.strictEqual(harness.service.getDefaultToolsModel(), defaultModel);
    });

    test('does not start the default model when one is already selected', async () => {
        const harness = createHarness({ defaultModel: { name: 'default-tools' } });
        harness.selected = { name: 'already-selected' };

        const usable = await harness.service.selectDefaultToolsModelIfNone();

        assert.strictEqual(usable, true);
        assert.deepStrictEqual(harness.starts, []);
    });

    test('does nothing when no default model is configured', async () => {
        const harness = createHarness();

        // Nothing selected, no default, no endpoint: the agent cannot run.
        assert.strictEqual(await harness.service.selectDefaultToolsModelIfNone(), false);
        assert.deepStrictEqual(harness.starts, []);
        assert.strictEqual(harness.service.shouldStartDefaultToolsModel(), false);
    });

    test('a configured endpoint_tools makes the agent usable without a model', async () => {
        const harness = createHarness({ endpointTools: 'http://127.0.0.1:8011' });

        assert.strictEqual(await harness.service.selectDefaultToolsModelIfNone(), true);
        // No local model may be started on top of an explicitly configured endpoint.
        assert.deepStrictEqual(harness.starts, []);
        assert.strictEqual(harness.service.hasToolsEndpoint(), true);
        assert.strictEqual(harness.service.shouldStartDefaultToolsModel(), false);
    });

    test('a stale default entry with an empty name is ignored', async () => {
        // `removeDefaultModel` writes null, but an imported/edited setting can
        // leave a nameless object behind; starting it would be a broken launch.
        const harness = createHarness({ defaultModel: { name: '   ' } });

        assert.strictEqual(harness.service.getDefaultToolsModel(), undefined);
        assert.strictEqual(harness.service.shouldStartDefaultToolsModel(), false);
        assert.strictEqual(await harness.service.selectDefaultToolsModelIfNone(), false);
        assert.deepStrictEqual(harness.starts, []);
    });

    test('shouldStartDefaultToolsModel reports the pending start for the UI', async () => {
        const harness = createHarness({ defaultModel: { name: 'default-tools' } });

        // This is what makes the agent page show "starting the default tools
        // model" instead of the "no tools model" empty state.
        assert.strictEqual(harness.service.shouldStartDefaultToolsModel(), true);

        await harness.service.selectDefaultToolsModelIfNone();
        assert.strictEqual(harness.service.shouldStartDefaultToolsModel(), false);
    });

    test('concurrent calls start the default model only once', async () => {
        const harness = createHarness({ defaultModel: { name: 'default-tools' }, concurrentStarts: 20 });

        // The agent page opening and a session starting can race. Starting a
        // local model twice would kill the terminal the first start created.
        const results = await Promise.all([
            harness.service.selectDefaultToolsModelIfNone(),
            harness.service.selectDefaultToolsModelIfNone(),
            harness.service.selectDefaultToolsModelIfNone(),
        ]);

        assert.deepStrictEqual(results, [true, true, true]);
        assert.strictEqual(harness.starts.length, 1);
    });

    test('a failing default start is not retried by a concurrent caller', async () => {
        const harness = createHarness({ defaultModel: { name: 'default-tools' }, concurrentStarts: 10 });
        let attempts = 0;
        harness.service.selectStartModel = async () => {
            attempts += 1;
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new Error('model startup failed');
        };

        const results = await Promise.allSettled([
            harness.service.selectDefaultToolsModelIfNone(),
            harness.service.selectDefaultToolsModelIfNone(),
        ]);

        // Both callers see the failure (the promise is shared) and the failed
        // attempt does not leave the guard set forever.
        assert.deepStrictEqual(results.map(r => r.status), ['rejected', 'rejected']);
        assert.strictEqual(attempts, 1);
        assert.strictEqual(await harness.service.selectDefaultToolsModelIfNone().catch(() => 'threw'), 'threw');
    });

    test('the guard is released so a later attempt can still succeed', async () => {
        const harness = createHarness({ defaultModel: { name: 'default-tools' } });
        let attempts = 0;
        harness.service.selectStartModel = async (model: LlmModel) => {
            attempts += 1;
            if (attempts === 1) throw new Error('transient failure');
            harness.selected = model;
        };

        await assert.rejects(harness.service.selectDefaultToolsModelIfNone(), /transient failure/);
        // Retrying (e.g. the panel becoming visible again) must work.
        assert.strictEqual(await harness.service.selectDefaultToolsModelIfNone(), true);
        assert.strictEqual(attempts, 2);
    });
});

/**
 * The wiring is what was actually broken: `ModelService` could already select a
 * default, but nothing called it when the agent chat was opened. These tests pin
 * the provider side down - including the message fields the UI relies on.
 */
const createProvider = (options: { defaultModel?: LlmModel; endpointTools?: string } = {}) => {
    const messages: any[] = [];
    const starts: LlmModel[] = [];
    let selected: LlmModel | undefined;

    const app = {
        getToolsModel: () => selected ?? { name: '' },
        isToolsModelSelected: () => Boolean(selected?.name?.trim()),
        configuration: {
            endpoint_tools: options.endpointTools ?? '',
            tools_models_list: [],
            launch_tools: '',
            health_check_tools_enabled: false,
        },
        persistence: {
            getGlobalValue: (key: string) =>
                key === PERSISTENCE_KEYS.DEFAULT_TOOLS_MODEL ? options.defaultModel : undefined,
        },
        llamaServer: {
            killToolsCmd: () => undefined,
            shellToolsCmd: () => undefined,
        },
        llamaChatModelProvider: {
            notifyModelsChanged: () => undefined,
        },
        setSelectedModel: (_type: unknown, model: LlmModel) => { selected = model; },
        getModel: () => ({ name: '' }),
        getEmbeddingsModel: () => ({ name: '' }),
        getComplModel: () => ({ name: '' }),
        getTmpAgentModel: () => ({ name: '' }),
        getAgent: () => ({ name: '', systemInstruction: [] }),
        getEnv: () => ({ name: '' }),
        getChat: () => ({}),
        getModelState: () => '',
        llamaAgent: { getAgentLogText: () => '' },
    } as unknown as Application;

    app.modelService = new ModelService(app);
    app.modelService.selectStartModel = async (model: LlmModel) => {
        starts.push(model);
        selected = model;
    };

    const provider = Object.create(LlamaWebviewProvider.prototype) as LlamaWebviewProvider;
    (provider as any).app = app;
    // The provider talks to the webview through `_webview`; record instead.
    (provider as any)._webview = {
        webview: { postMessage: (message: any) => { messages.push(message); } }
    };

    const toolsModelMessages = () => messages.filter(m => m.command === 'updateToolsModel');
    const lastToolsModelMessage = () => toolsModelMessages()[toolsModelMessages().length - 1];

    return { provider, app, starts, messages, toolsModelMessages, lastToolsModelMessage };
};

suite('Default tools model - agent view wiring Test Suite', () => {
    test('opening the agent view selects the default tools model', async () => {
        const defaultModel: LlmModel = { name: 'default-tools', endpoint: 'http://127.0.0.1:8011' };
        const harness = createProvider({ defaultModel });

        await harness.provider.selectDefaultToolsModelForAgentView();

        assert.deepStrictEqual(harness.starts, [defaultModel]);
        // The UI is told about the new model, so the empty state disappears.
        assert.strictEqual(harness.lastToolsModelMessage()?.model, 'default-tools');
    });

    test('the UI is told the model is starting before the (slow) start begins', async () => {
        const defaultModel: LlmModel = { name: 'default-tools' };
        const harness = createProvider({ defaultModel });

        let startingSeenWhileStarting = false;
        harness.app.modelService.selectStartModel = async (model: LlmModel) => {
            // Capture what the UI has been told at the moment the start runs.
            startingSeenWhileStarting = Boolean(harness.lastToolsModelMessage()?.startingDefault);
            harness.starts.push(model);
        };

        await harness.provider.selectDefaultToolsModelForAgentView();

        assert.strictEqual(startingSeenWhileStarting, true, 'the "starting" state must be posted before the model start');
        // And it is cleared afterwards, otherwise the page would spin forever.
        assert.strictEqual(Boolean(harness.lastToolsModelMessage()?.startingDefault), false);
    });

    test('the starting state is cleared even when the model start fails', async () => {
        const harness = createProvider({ defaultModel: { name: 'default-tools' } });
        harness.app.modelService.selectStartModel = async () => {
            throw new Error('model startup failed');
        };

        // Must not throw: a failed default selection may not break the page.
        await harness.provider.selectDefaultToolsModelForAgentView();

        assert.strictEqual(Boolean(harness.lastToolsModelMessage()?.startingDefault), false);
    });

    test('nothing is started when a tools model is already selected', async () => {
        const harness = createProvider({ defaultModel: { name: 'default-tools' } });
        harness.app.setSelectedModel('tools' as never, { name: 'already-selected' });

        await harness.provider.selectDefaultToolsModelForAgentView();

        assert.deepStrictEqual(harness.starts, []);
    });

    test('endpoint_tools alone is enough: no default model is started', async () => {
        const harness = createProvider({
            defaultModel: { name: 'default-tools' },
            endpointTools: 'http://127.0.0.1:8011'
        });

        await harness.provider.selectDefaultToolsModelForAgentView();

        // An explicitly configured endpoint wins; starting a local model on top
        // of it would be surprising and slow.
        assert.deepStrictEqual(harness.starts, []);
        assert.strictEqual(harness.lastToolsModelMessage()?.toolsEndpoint, true);
    });

    test('the UI is told which default model is being started', async () => {
        const harness = createProvider({ defaultModel: { name: 'default-tools' } });

        await harness.provider.selectDefaultToolsModelForAgentView();

        // Used by the empty state to say "<name> is being started".
        assert.strictEqual(harness.lastToolsModelMessage()?.defaultModel, 'default-tools');
    });

    test('a configured endpoint_tools is reported so the empty state is not shown', async () => {
        const harness = createProvider({ endpointTools: 'http://127.0.0.1:8011' });

        await harness.provider.selectDefaultToolsModelForAgentView();

        // llama-agent.ts accepts this combination, so the view must not claim
        // there is no tools model.
        assert.strictEqual(harness.lastToolsModelMessage()?.toolsEndpoint, true);
    });

    test('no default and no endpoint leaves the empty state in place', async () => {
        const harness = createProvider();

        await harness.provider.selectDefaultToolsModelForAgentView();

        assert.deepStrictEqual(harness.starts, []);
        const message = harness.lastToolsModelMessage();
        assert.strictEqual(message?.model, 'No model selected');
        assert.strictEqual(message?.toolsEndpoint, false);
        assert.strictEqual(message?.defaultModel, '');
    });

    test('switching to the agent view selects the default tools model', async () => {
        const defaultModel: LlmModel = { name: 'default-tools' };
        const harness = createProvider({ defaultModel });

        // This is the funnel every "open the agent chat" entry point goes
        // through (sidebar icon, Ctrl+Shift+A, URI handler, moving the view).
        harness.provider.setView('agent');
        // The selection is fire-and-forget; let it run.
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.deepStrictEqual(harness.starts, [defaultModel]);
    });

    test('switching to another view does not start the default tools model', async () => {
        const defaultModel: LlmModel = { name: 'default-tools' };
        const harness = createProvider({ defaultModel });

        harness.provider.setView('addenv');
        await new Promise(resolve => setTimeout(resolve, 0));

        // Opening the env view must not silently launch a tools model.
        assert.deepStrictEqual(harness.starts, []);
    });
});
