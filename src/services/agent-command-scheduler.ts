import { Application } from "../application";
import { AgentCommand } from "../types";
import { PREDEFINED_LISTS_KEYS } from "../constants";
import { PREDEFINED_LISTS } from "../lists";
import { Utils } from "../utils";

/**
 * Schedules periodic execution of user-defined agent commands
 * (configuration.agent_commands) with executePeriodically = true.
 *
 * Each scheduled command runs in a background agent session (askAgent with
 * background:true, memory log and in-memory todo), so it does not interfere
 * with the foreground agent UI.
 *
 * Execution counters are seeded from the persisted `executedTimes` field of the
 * command, written back to the `agent_commands` setting after every execution,
 * and therefore survive an extension restart. The in-memory map stays as a fast
 * path that avoids re-reading the setting on every tick.
 */
export class AgentCommandScheduler {
    private app: Application;

    // name -> pending setTimeout handle
    private timers: Map<string, NodeJS.Timeout> = new Map();
    // name -> number of executions performed for this command (seeded from the
    // persisted executedTimes, kept in sync with it on every execution)
    private executionCounters: Map<string, number> = new Map();
    // name -> true while a background session for this command is running (overlap guard)
    private activeExecutions: Map<string, boolean> = new Map();

    constructor(app: Application) {
        this.app = app;
    }

    /**
     * Schedules all user commands with executePeriodically = true.
     * Predefined commands (lists.ts) are never scheduled.
     */
    public start(): void {
        const userCommands = this.getUserCommands();
        for (const command of userCommands) {
            if (this.isSchedulable(command)) {
                this.scheduleCommand(command.name);
            }
        }
    }

    /**
     * Cancels all pending timers and clears in-memory state.
     */
    public stop(): void {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.executionCounters.clear();
        this.activeExecutions.clear();
    }

    /**
     * Re-reads the user commands from configuration and reconciles the
     * scheduled set. Called when the agent_commands setting changes.
     */
    public reschedule(): void {
        const userCommands = this.getUserCommands();

        // Unschedule commands that no longer exist or are no longer periodic
        for (const scheduledName of Array.from(this.timers.keys())) {
            const command = userCommands.find(cmd => cmd.name === scheduledName);
            if (!command || !this.isSchedulable(command)) {
                this.unscheduleCommand(scheduledName);
            }
        }

        // (Re)schedule commands that should run periodically
        for (const command of userCommands) {
            if (this.isSchedulable(command)) {
                if (this.isScheduled(command.name)) {
                    // Re-apply settings changes (period/startTime/totalExecutionTimes)
                    this.rescheduleCommand(command.name);
                } else {
                    this.scheduleCommand(command.name);
                }
            }
        }
    }

    /**
     * Schedules a single command by name. The command is looked up among the
     * user commands only. If the startTime is missing or in the past, the
     * command runs immediately and then every period seconds.
     */
    public scheduleCommand(commandName: string): void {
        const command = this.getUserCommands().find(cmd => cmd.name === commandName);
        if (!command || !this.isSchedulable(command)) return;
        if (this.isScheduled(commandName)) return;

        const periodSeconds = command.period && command.period > 0 ? command.period : 3600;
        const periodMs = periodSeconds * 1000;

        let initialDelayMs: number;
        if (command.startTime) {
            const start = new Date(command.startTime).getTime();
            if (!isNaN(start)) {
                initialDelayMs = Math.max(0, start - Date.now());
            } else {
                initialDelayMs = 0;
            }
        } else {
            initialDelayMs = 0;
        }

        // Seed the in-memory counter from the persisted one so the budget spent in
        // previous windows is respected (0 when the command has never run).
        this.executionCounters.set(commandName, Utils.normalizeExecutedTimes(command.executedTimes));

        if (initialDelayMs === 0) {
            // Run immediately, then schedule the next execution.
            this.executeAndScheduleNext(commandName, periodMs);
        } else {
            const timer = setTimeout(() => {
                this.timers.delete(commandName);
                this.executeAndScheduleNext(commandName, periodMs);
            }, initialDelayMs);
            this.timers.set(commandName, timer);
        }
    }

    /**
     * Unschedules a command (cancels the pending timer) without resetting the
     * execution counter. Used when a command is removed or stops being periodic.
     */
    public unscheduleCommand(commandName: string): void {
        const timer = this.timers.get(commandName);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(commandName);
        }
    }

    /**
     * Fully removes a command from the scheduler state (timer + counters).
     */
    public removeCommand(commandName: string): void {
        this.unscheduleCommand(commandName);
        this.executionCounters.delete(commandName);
        this.activeExecutions.delete(commandName);
    }

    /**
     * Re-applies scheduling settings for an already scheduled command
     * (period/startTime/totalExecutionTimes changes). The execution counter is
     * preserved so totalExecutionTimes is not reset by settings edits, and the
     * next execution is scheduled one period from now (or at the future
     * startTime) - the command is NOT run immediately again on every edit.
     */
    public rescheduleCommand(commandName: string): void {
        const command = this.getUserCommands().find(cmd => cmd.name === commandName);
        if (!command || !this.isSchedulable(command)) return;

        // Cancel the existing timer but keep the execution counter.
        this.unscheduleCommand(commandName);

        // Adopt a LOWER persisted value: that can only be an external reset (the
        // editor's Reset button or a hand-edited setting). A higher value is our
        // own write (already in memory) - memory is the fresher truth then.
        const persisted = Utils.normalizeExecutedTimes(command.executedTimes);
        const inMemory = this.executionCounters.get(commandName);
        if (inMemory === undefined || persisted < inMemory) {
            this.executionCounters.set(commandName, persisted);
        }

        const periodSeconds = command.period && command.period > 0 ? command.period : 3600;
        const periodMs = periodSeconds * 1000;

        let delayMs = periodMs;
        if (command.startTime) {
            const start = new Date(command.startTime).getTime();
            if (!isNaN(start) && start > Date.now()) {
                delayMs = start - Date.now();
            }
        }

        const timer = setTimeout(() => {
            this.timers.delete(commandName);
            this.executeAndScheduleNext(commandName, periodMs);
        }, delayMs);
        this.timers.set(commandName, timer);
    }

    public isScheduled(commandName: string): boolean {
        return this.timers.has(commandName);
    }

    public getScheduledCommands(): string[] {
        return Array.from(this.timers.keys());
    }

    public getExecutionCount(commandName: string): number {
        const command = this.getUserCommands().find(cmd => cmd.name === commandName);
        return this.executionCounters.get(commandName) ?? Utils.normalizeExecutedTimes(command?.executedTimes);
    }

    /**
     * True if the command is a user command (not predefined) with
     * executePeriodically = true.
     */
    private isSchedulable(command: AgentCommand): boolean {
        if (!command.executePeriodically) return false;
        // Skip predefined commands - only user commands from
        // configuration.agent_commands are scheduled.
        const predefined = PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as AgentCommand[] | undefined;
        if (predefined && predefined.some(cmd => cmd.name === command.name)) return false;
        return true;
    }

    private getUserCommands(): AgentCommand[] {
        return this.app.configuration.agent_commands as AgentCommand[];
    }

    private executeAndScheduleNext(commandName: string, periodMs: number): void {
        const command = this.getUserCommands().find(cmd => cmd.name === commandName);
        if (!command) {
            this.removeCommand(commandName);
            return;
        }

        // Respect totalExecutionTimes (empty/0/undefined = infinite). The persisted
        // value is the source of truth; the in-memory counter is the fast path.
        const total = Utils.normalizeExecutedTimes(command.totalExecutionTimes);
        const executed = this.executionCounters.get(commandName) ?? Utils.normalizeExecutedTimes(command.executedTimes);
        const isInfinite = total === 0;
        if (!isInfinite && executed >= total) {
            // Timer + memory only: the persisted executedTimes is the record of the
            // consumed budget and may only be lowered by an explicit reset.
            this.removeCommand(commandName);
            return;
        }

        // Overlap guard: skip the execution if a previous background session
        // for this command is still running, but keep the schedule alive.
        if (!this.activeExecutions.get(commandName)) {
            this.activeExecutions.set(commandName, true);
            const nextExecuted = executed + 1;
            // Memory FIRST, then persist: the settings change event fires after the
            // write and re-enters reschedule(), which must see the updated memory.
            this.executionCounters.set(commandName, nextExecuted);
            // Fire-and-forget: a failed settings write must not break the schedule.
            this.app.agentCommandService.setExecutedTimes(commandName, nextExecuted)
                .catch((error) => console.error(`Agent command scheduler: could not persist executedTimes for "${commandName}":`, error));
            this.app.llamaAgent.runAgentCommandInBackground(commandName)
                .catch((error) => {
                    console.error(`Agent command scheduler: error executing "${commandName}":`, error);
                })
                .finally(() => {
                    this.activeExecutions.delete(commandName);
                });
        }

        // Always schedule the next execution.
        const timer = setTimeout(() => {
            this.timers.delete(commandName);
            this.executeAndScheduleNext(commandName, periodMs);
        }, periodMs);
        this.timers.set(commandName, timer);
    }
}
