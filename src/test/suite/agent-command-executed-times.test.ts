/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import { Application } from '../../application';
import { Configuration } from '../../configuration';
import { AgentCommandScheduler } from '../../services/agent-command-scheduler';
import { AgentCommandService } from '../../services/agent-command-service';
import { AgentCommand } from '../../types';
import { Utils } from '../../utils';

// Agent commands with executePeriodically persist how many times they already ran
// (executedTimes). The counter must survive a restart (it lives in the
// agent_commands setting), gate the execution against totalExecutionTimes, be
// writable by the editor's Reset button only through setExecutedTimes(), and never
// be clobbered by a normal Save. These tests drive the real AgentCommandService
// and the real AgentCommandScheduler against a fake Application - that is why the
// suite runs inside the extension host (utils.ts imports vscode).

interface Harness {
    // The live configuration array the extension would expose.
    commands: AgentCommand[];
    // Number of settings writes (Configuration.updateAgentCommands calls).
    writes: number;
    // Scope of every write, in order.
    writeTargets: any[];
    // Snapshot of the last value written to the setting.
    lastWritten: AgentCommand[] | undefined;
    // Names passed to runAgentCommandInBackground (i.e. actual executions).
    runs: string[];
    service: AgentCommandService;
    scheduler: AgentCommandScheduler;
}

// `workspaceValue` mirrors where the user keeps llama-vscode.agent_commands.
const createHarness = (commands: AgentCommand[], workspaceValue?: AgentCommand[]): Harness => {
    const harness = {
        commands,
        writes: 0,
        writeTargets: [],
        lastWritten: undefined,
        runs: [],
    } as unknown as Harness;

    // The real Configuration helper is used so the write goes through the same
    // scope resolution the extension uses (window-scoped setting - GOTCHA #8).
    // A real instance is created (not Object.create): updateAgentCommands is an
    // instance arrow property, so it only exists on a constructed object.
    const configuration = new Configuration();
    (configuration as unknown as { agent_commands: AgentCommand[] }).agent_commands = harness.commands;
    // Used by getAgentCommandsList() when the picker label is built.
    (configuration as unknown as { enabled: boolean }).enabled = false;
    (configuration as unknown as { rag_enabled: boolean }).rag_enabled = false;
    (configuration as unknown as { scripts_folder: string }).scripts_folder = '/nonexistent-scripts-folder';
    configuration.config = {
        inspect: (section: string) => section === 'agent_commands' ? { workspaceValue } : undefined,
        update: async (_setting: string, value: any[], target?: any) => {
            harness.writes += 1;
            harness.writeTargets.push(target);
            harness.lastWritten = JSON.parse(JSON.stringify(value));
        },
    } as unknown as vscode.WorkspaceConfiguration;

    const app = {
        configuration,
        llamaAgent: {
            runAgentCommandInBackground: async (commandName: string) => {
                harness.runs.push(commandName);
            },
        },
        dialogs: {
            confirmAction: async () => true,
            showOkDialog: async () => undefined,
            showYesNoDialog: async () => false,
        },
    } as unknown as Application;

    harness.service = new AgentCommandService(app);
    // The scheduler persists through app.agentCommandService.
    (app as unknown as { agentCommandService: AgentCommandService }).agentCommandService = harness.service;
    harness.scheduler = new AgentCommandScheduler(app);
    return harness;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Polls until the predicate holds (the scheduler works with real timers).
const waitFor = async (predicate: () => boolean, timeoutMs: number = 4000): Promise<boolean> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (predicate()) return true;
        await delay(10);
    }
    return predicate();
};

// A periodic command with a 10 ms period, so the scheduler can exhaust a small
// budget within a test.
const periodicCommand = (overrides: Partial<AgentCommand> = {}): AgentCommand => ({
    name: 'c',
    prompt: ['p'],
    executePeriodically: true,
    period: 0.01,
    ...overrides,
});

suite('Agent command executedTimes Test Suite', () => {
    test('T1: Utils.normalizeExecutedTimes coerces bad input to a non-negative integer', () => {
        assert.strictEqual(Utils.normalizeExecutedTimes(undefined), 0);
        assert.strictEqual(Utils.normalizeExecutedTimes(null), 0);
        assert.strictEqual(Utils.normalizeExecutedTimes(''), 0);
        assert.strictEqual(Utils.normalizeExecutedTimes('abc'), 0);
        assert.strictEqual(Utils.normalizeExecutedTimes(NaN), 0);
        assert.strictEqual(Utils.normalizeExecutedTimes(Infinity), 0);
        assert.strictEqual(Utils.normalizeExecutedTimes(-5), 0);
        assert.strictEqual(Utils.normalizeExecutedTimes('3'), 3);
        assert.strictEqual(Utils.normalizeExecutedTimes(3.9), 3);
        assert.strictEqual(Utils.normalizeExecutedTimes(0), 0);
    });

    test('T2: the scheduler persists the counter, stops at the total and a reset re-arms it', async function () {
        this.timeout(10000);
        const harness = createHarness([periodicCommand({ totalExecutionTimes: 2 })]);

        harness.scheduler.scheduleCommand('c');
        const exhausted = await waitFor(() => !harness.scheduler.isScheduled('c'));
        harness.scheduler.stop();

        assert.ok(exhausted, 'an exhausted command must be removed from the schedule');
        assert.strictEqual(harness.runs.length, 2, 'exactly totalExecutionTimes executions');
        assert.strictEqual(harness.commands[0].executedTimes, 2, 'the counter is persisted on the command');
        assert.strictEqual(harness.writes, 2, 'one settings write per execution (no write loop)');
        assert.deepStrictEqual(harness.lastWritten?.[0]?.executedTimes, 2);
        assert.deepStrictEqual(harness.writeTargets, [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Global],
            'the commands live in the user settings, so the counter is written there');

        // Reset (what the editor's Reset button does): persist 0 ...
        const changed = await harness.service.setExecutedTimes('c', 0);
        assert.strictEqual(changed, true);
        assert.strictEqual(harness.commands[0].executedTimes, 0);

        // ... and the settings change re-schedules the command (reschedule()).
        harness.scheduler.reschedule();
        assert.ok(harness.scheduler.isScheduled('c'), 'the reset command is scheduled again');
        const ranAgain = await waitFor(() => harness.runs.length === 3);
        harness.scheduler.stop();
        assert.ok(ranAgain, 'the reset command runs again');
        assert.strictEqual(harness.commands[0].executedTimes, 1, 'the counter restarts from 0');
    });

    test('T2b: totalExecutionTimes 0/undefined means infinite', async function () {
        this.timeout(10000);
        const harness = createHarness([periodicCommand({ totalExecutionTimes: 0 })]);

        harness.scheduler.scheduleCommand('c');
        await waitFor(() => harness.runs.length >= 3);
        const stillScheduled = harness.scheduler.isScheduled('c');
        harness.scheduler.stop();

        assert.ok(harness.runs.length >= 3, 'an infinite command keeps running');
        assert.ok(stillScheduled, 'an infinite command is never unscheduled');
        assert.ok((harness.commands[0].executedTimes ?? 0) >= 3, 'the counter keeps growing');
    });

    test('T3: a command without executedTimes starts at 0 and gains the key on the first execution', async function () {
        this.timeout(10000);
        const command = periodicCommand();
        delete command.executedTimes;
        const harness = createHarness([command]);

        assert.strictEqual(Utils.normalizeExecutedTimes(command.executedTimes), 0);
        assert.ok(!Object.keys(command).includes('executedTimes'), 'an old command has no such key');

        harness.scheduler.scheduleCommand('c');
        await waitFor(() => harness.commands[0].executedTimes !== undefined);
        harness.scheduler.stop();

        assert.ok(Object.keys(harness.commands[0]).includes('executedTimes'), 'the key is added');
        assert.strictEqual(harness.commands[0].executedTimes, 1, 'the first increment produces exactly 1');
        assert.strictEqual(harness.commands[0].name, 'c');
        assert.deepStrictEqual(harness.commands[0].prompt, ['p']);
    });

    test('T4: addUpdateAgentCommand() preserves the stored counter', async () => {
        const harness = createHarness([{ name: 'c', prompt: ['old'], executedTimes: 5 }]);

        await harness.service.addUpdateAgentCommand({ name: 'c', prompt: ['new'], executedTimes: 0 });

        assert.strictEqual(harness.commands[0].executedTimes, 5, 'a stale form value must not reset the counter');
        assert.deepStrictEqual(harness.commands[0].prompt, ['new'], 'the edited fields are applied');
        assert.strictEqual(harness.writes, 1);
    });

    test('T4b: setExecutedTimes() ignores unknown and predefined commands and unchanged values', async () => {
        const harness = createHarness([{ name: 'c', prompt: ['p'], executedTimes: 0 }]);

        assert.strictEqual(await harness.service.setExecutedTimes('does-not-exist', 3), false);
        assert.strictEqual(harness.writes, 0, 'nothing is written for an unknown command');

        assert.strictEqual(await harness.service.setExecutedTimes('c', 0), false);
        assert.strictEqual(harness.writes, 0, 'an unchanged counter is not written');

        assert.strictEqual(await harness.service.setExecutedTimes('c', -2), false);
        assert.strictEqual(harness.writes, 0, 'an invalid value normalizes to the stored 0');

        assert.strictEqual(await harness.service.setExecutedTimes('c', 3), true);
        assert.strictEqual(harness.writes, 1);
        assert.strictEqual(harness.commands[0].executedTimes, 3);
    });

    test('T4c: rescheduleCommand() adopts a lower persisted counter and ignores a higher one', async function () {
        this.timeout(10000);
        const harness = createHarness([periodicCommand({ period: 3600, totalExecutionTimes: 10, executedTimes: 3 })]);

        // Seeded from the setting (3) and executed once -> 4 in memory and persisted.
        harness.scheduler.scheduleCommand('c');
        await waitFor(() => harness.commands[0].executedTimes === 4);
        assert.strictEqual(harness.scheduler.getExecutionCount('c'), 4);

        // A hand-edited INCREASE is ignored: memory is the fresher truth during a run.
        harness.commands[0].executedTimes = 9;
        harness.scheduler.rescheduleCommand('c');
        assert.strictEqual(harness.scheduler.getExecutionCount('c'), 4);

        // A DECREASE can only be an external reset -> adopted.
        harness.commands[0].executedTimes = 1;
        harness.scheduler.rescheduleCommand('c');
        assert.strictEqual(harness.scheduler.getExecutionCount('c'), 1);

        harness.scheduler.stop();
    });

    test('T11: commands stored in workspace settings keep counting (write scope)', async () => {
        // The user keeps llama-vscode.agent_commands in .vscode/settings.json: the
        // workspace value wins on read, so a Global write would be shadowed and the
        // counter would look like it never persisted.
        const commands: AgentCommand[] = [{ name: 'c', prompt: ['p'], executedTimes: 0 }];
        const harness = createHarness(commands, commands);

        assert.strictEqual(await harness.service.setExecutedTimes('c', 1), true);

        assert.strictEqual(harness.writes, 1);
        assert.deepStrictEqual(harness.writeTargets, [vscode.ConfigurationTarget.Workspace],
            'the counter is written into the workspace file, not the global one');
        assert.deepStrictEqual(harness.lastWritten?.[0]?.executedTimes, 1);
    });

    test('T12: the details dialog and the picker report the executed count', () => {
        const harness = createHarness([{ name: 'c', prompt: ['p'], description: 'd', executePeriodically: true, period: 60, totalExecutionTimes: 10, executedTimes: 3 }]);

        const details = (harness.service as unknown as { getAgentCommandDetailsAsString: (cmd: AgentCommand) => string })
            .getAgentCommandDetailsAsString(harness.commands[0]);
        assert.ok(details.includes('\nexecuted times: 3\n'), `details must report the counter, got: ${details}`);
        assert.ok(details.includes('\ntotal execution times: 10\n'), 'the total line is preserved');

        const list = harness.service.getAgentCommandsList();
        const item = list.find(entry => entry.includes('c | d'));
        assert.ok(item, `the command is listed, got: ${list.join(' ; ')}`);
        assert.ok(item!.includes('(executed: 3/10)'), `progress is appended after the description, got: ${item}`);

        // A command without a total reports the infinite marker.
        harness.commands[0].totalExecutionTimes = undefined;
        const infiniteItem = harness.service.getAgentCommandsList().find(entry => entry.includes('c | d'));
        assert.ok(infiniteItem!.includes('(executed: 3/∞)'), `infinite progress marker, got: ${infiniteItem}`);
    });
});
