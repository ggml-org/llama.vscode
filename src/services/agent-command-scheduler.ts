import { Application } from "../application";
import { AgentCommand } from "../types";
import { PREDEFINED_LISTS_KEYS } from "../constants";
import { PREDEFINED_LISTS } from "../lists";

/**
 * Schedules periodic execution of user-defined agent commands
 * (configuration.agent_commands) with executePeriodically = true.
 *
 * Each scheduled command runs in a background agent session (askAgent with
 * background:true, memory log and in-memory todo), so it does not interfere
 * with the foreground agent UI.
 *
 * Execution counters are in-memory only and reset on extension restart.
 */
export class AgentCommandScheduler {
    private app: Application;

    // name -> pending setTimeout handle
    private timers: Map<string, NodeJS.Timeout> = new Map();
    // name -> number of executions performed in this extension session
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

        this.executionCounters.set(commandName, 0);

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
        return this.executionCounters.get(commandName) ?? 0;
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

        // Respect totalExecutionTimes (empty/0/undefined = infinite)
        const total = command.totalExecutionTimes;
        const executed = this.executionCounters.get(commandName) ?? 0;
        if (total !== undefined && total !== null && total > 0 && executed >= total) {
            this.removeCommand(commandName);
            return;
        }

        // Overlap guard: skip the execution if a previous background session
        // for this command is still running, but keep the schedule alive.
        if (!this.activeExecutions.get(commandName)) {
            this.activeExecutions.set(commandName, true);
            this.executionCounters.set(commandName, executed + 1);
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
