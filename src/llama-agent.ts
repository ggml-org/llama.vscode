import {Application} from "./application";
import { AgentCommand, Agent, ChatMessage, ContextCustom, EventHook, EventResult } from "./types";
import type { LlamaToolsResponse } from "./llama-server";
import * as vscode from 'vscode';
import { Utils } from "./utils"
import { Chat } from "./types"
import { Plugin } from './plugin';
import * as fs from 'fs';
import { AGENT_COMMAND, HooksEvents, PREDEFINED_LISTS_KEYS, SUPPORTED_IMG_FILE_EXTS, TOOLS_DESC, UI_TEXT_KEYS } from "./constants";
import path from "path";
import { DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS, resolveBoundedMaxOutputTokens } from './language-model-token-limits';
import { PREDEFINED_LISTS } from "./lists";
import { isAxiosError } from "axios";

interface Frontmatter {
  [key: string]: any;
}

interface Step {
    id: string | number;
    description: string;
    expectedResult: string;
    state: string;
    result?: string; // Optional since it might not be set initially
}

/**
 * Log destination type for session logging
 */
export type LogDestinationType = 'ui' | 'file' | 'memory';

/**
 * Interface for log destinations - allows different logging strategies per session
 */
export interface LogDestination {
    /**
     * Appends a delta to the log. `deliver: false` keeps the text in the log
     * without pushing it to the UI yet - used for status text that has to stay
     * out of the final result (e.g. the "still streaming" spinner), so the UI
     * can be updated while a request is in flight without queueing up a
     * postMessage per spinner tick.
     */
    append(delta: string, deliver?: boolean): void;
    getContents(): string;
    flushToUi?(): void;
    flushToFile?(filePath: string): Promise<void>;
}

// Characters written to UI log while the model has not started answering yet.
// The UI turns them into a "still waiting" indicator and drops them once a real
// answer starts, so they never show up in the final log or a restored chat.
export const AGENT_WAITING_MARKER = '·';
const AGENT_WAITING_MARKER_REGEX = /^[·\u00b7\u2022]+[ .]*$/;

/**
 * UI log destination - writes to instance logText and updates webview (current behavior)
 */
export class UiLogDestination implements LogDestination {
    private parent: LlamaAgent;
    private spinnerTimer: NodeJS.Timeout | null = null;
    
    constructor(parent: LlamaAgent) {
        this.parent = parent;
    }
    
    append(delta: string, deliver: boolean = true): void {
        if (this.parent.isTelegramBotRequest()) {
            this.parent.app.telegramBot.sendResponse(delta);
        }
        this.parent.logText += delta;
        // Automatically flush to UI after every append for real-time updates.
        // Non-delivered appends (the waiting spinner) are only pushed if nothing
        // else is pushing right now, which is what makes them cheap.
        if (deliver || !this.spinnerTimer) this.flushToUi();
    }
    
    getContents(): string {
        return this.parent.logText;
    }
    
    flushToUi(): void {
        this.parent.app.llamaWebviewProvider.logInUi(this.parent.logText);
    }
    
    /**
     * Starts (or keeps) a spinner in the UI while the model request is in
     * flight and no answer has been streamed yet. Without it a stop request
     * looks like nothing happened, because the answer only arrives once the
     * request finishes.
     */
    startWaitingIndicator(): void {
        if (this.spinnerTimer) return;
        this.spinnerTimer = setInterval(() => {
            this.append(AGENT_WAITING_MARKER, false);
        }, 500);
    }
    
    /** Stops the spinner and removes its markers from the log. */
    stopWaitingIndicator(): void {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = null;
        }
        this.clearWaitingIndicator();
    }
    
    /**
     * Removes the spinner markers already written to the log (no UI flush).
     * The markers are always the tail of the log, so only the trailing run is
     * dropped - this also covers the case where the log already had content
     * (e.g. the user message markers) when the spinner started.
     */
    clearWaitingIndicator(): void {
        const text = this.parent.logText;
        if (!text.includes(AGENT_WAITING_MARKER)) return;
        const stripped = text.replace(/[·\u00b7]+[ .]*$/, '');
        if (stripped !== text) this.parent.logText = stripped;
    }
}

/**
 * Memory log destination - stores logs only in memory, no UI update
 */
export class MemoryLogDestination implements LogDestination {
    private content: string = "";
    
    append(delta: string): void {
        this.content += delta;
    }
    
    getContents(): string {
        return this.content;
    }
}

/**
 * File log destination - writes logs to a file
 */
export class FileLogDestination implements LogDestination {
    private filePath: string;
    private content: string = "";
    
    constructor(filePath: string) {
        this.filePath = filePath;
    }
    
    append(delta: string): void {
        this.content += delta;
        // Also write to file immediately
        try {
            fs.appendFileSync(this.filePath, delta, 'utf8');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    
    getContents(): string {
        return this.content;
    }
}

/**
 * Options for configuring agent session behavior
 */
export interface AgentSessionOptions {
    sessionId?: string;                    // Auto-generated if not provided
    background?: boolean;                  // If true, run without UI blocking
    useInMemoryTodo?: boolean;             // Skip todo file I/O
    logDestination?: LogDestinationType;   // Where to store logs: 'ui', 'file', or 'memory'
    logFilePath?: string;                  // Optional file path for 'file' destination
    onComplete?: (result: string, sessionId: string) => void; // Callback when done
}

/**
 * Expanded AgentSession interface with per-session state fields
 */
export interface AgentSession {
    sessionId: string;                     // Unique identifier
    newMessage: ChatMessage;
    todoFile: string;                      // Per-session todo file path
    todoContent: string | null;            // In-memory todo (alternative to file)
    response: string;
    iterations: number;
    startedAt: number;
    changedFiles: Set<string>;
    deletedFiles: Set<string>;
    messages: ChatMessage[];               // Per-session message history
    logText: string;                       // Per-session log
    lastReqTokens: number;                 // Per-session token tracking
    abortController: AbortController;      // Per-session controller
    isTlgrBotRequest: boolean;             // Per-session flag
    // Texts the user queued with "Send to session" while the run was busy. They
    // are handed to the model at the next tool-call boundary (or at the end of
    // the current answer, when no tool call follows) and merged into ONE user
    // message, because the loop drains the queue in a single step.
    inSessionTexts: string[];
    // True while a "Send to session" text is waiting to be delivered.
    inSessionPending: boolean;
    // Session whose chat the instance conversation state follows. Only the
    // foreground session of the loaded chat may answer a "Send to session"
    // request; background sessions have no composer of their own.
    isForeground: boolean;
    originalQuery: string;                 // Per-session query
    contexProjectFiles: Map<string,string>; // Per-session context files
    sentContextFiles: Map<string,string>;   // Per-session sent context
    contextImage: string;                 // Per-session image
    sentContextImages: string[];          // Per-session sent images
    confirmationState: string;            // Per-session state
    logDestination: LogDestination;       // Session-specific log destination
    options: AgentSessionOptions;         // Session options
    defaultAgent?: Agent;                 // Agent used when the session started
}

export class LlamaAgent {
    public app: Application
    private lastStopRequestTime = Date.now();
    private messages: ChatMessage[] = [];
    private lastReqTokens = 0;
    private confirmationState: string = ""; // Use consts CONFIRMATION_STATE.*
    public logText = ""
    public contexProjectFiles: Map<string,string> = new Map();
    public sentContextFiles: Map<string,string> = new Map();
    public contextImage: string = "";
    public sentContextImages: string[] = [];
    private abortController: AbortController | null = null;
    private isTlgrBotRequest: boolean = false;
    private agentInProgress: boolean = false;
    private originalQuery: string = "";
    
    // Session registry for parallel/background sessions
    private activeSessions: Map<string, AgentSession> = new Map();
    // Session owning the tool call that is currently being executed.
    private currentToolSession: AgentSession | undefined = undefined;

    constructor(application: Application) {
        this.app = application;
        this.resetMessages();
    }

    getAgentLogText = () => this.logText;

    getLastReqTokens = () => this.lastReqTokens;

    setLastReqTokens = (lastReqTokens:number) => this.lastReqTokens = lastReqTokens;

    getOriginalQuery = () => this.originalQuery;

    isAgentInProgress = () => this.agentInProgress;

    getConfirmationState = () => this.confirmationState;

    setConfirmationState = (confirmationState:string) => this.confirmationState = confirmationState;

    setTelegramBotRequest = (isTlgReq: boolean) => this.isTlgrBotRequest = isTlgReq
    
    isTelegramBotRequest = (): boolean => this.isTlgrBotRequest;
    
    // Session registry methods
    registerSession(session: AgentSession): void {
        this.activeSessions.set(session.sessionId, session);
    }
    
    unregisterSession(sessionId: string): void {
        this.activeSessions.delete(sessionId);
    }
    
    getSession(sessionId: string): AgentSession | undefined {
        return this.activeSessions.get(sessionId);
    }
    
    getAllActiveSessionIds(): string[] {
        return Array.from(this.activeSessions.keys());
    }
    
    isAnySessionRunning(): boolean {
        return this.activeSessions.size > 0;
    }
    
    getActiveSessionCount(): number {
        return this.activeSessions.size;
    }

    /**
     * The session whose tool call is being executed right now. Tools that do not
     * receive the session id from the model (update_todo_list, for example) use
     * it to reach the session state, so the plan goes to the right place.
     */
    getCurrentToolSession(): AgentSession | undefined {
        return this.currentToolSession;
    }

    /**
     * Counts the live sessions that still need the given todo file. Sessions
     * that keep their todo in memory, and the excluded session, are skipped.
     * The todo file is a single scratch pad at the workspace root, so several
     * sessions can share one path and the file may only be deleted by the last
     * of them.
     */
    private countSessionsUsingTodoFile(todoFile: string, exceptSessionId?: string): number {
        if (!todoFile) return 0;
        let count = 0;
        for (const session of this.activeSessions.values()) {
            if (session.sessionId === exceptSessionId) continue;
            if (session.options.useInMemoryTodo) continue;
            if (session.todoFile === todoFile) count++;
        }
        return count;
    }

    /**
     * Deletes the temporary todo file of a finished session. The file is a
     * scratch pad for the current tool loop only ("Todo items are not reused
     * between the user requests"), so it must not survive the session and be
     * committed by mistake.
     */
    removeTodoFileForSession(session: AgentSession) {
        if (!session.todoFile || session.options.useInMemoryTodo) return;
        // Another live session still plans in the same file - keep it.
        if (this.countSessionsUsingTodoFile(session.todoFile, session.sessionId) > 0) return;
        this.removeFile(session.todoFile);
        session.todoContent = null;
    }

    /**
     * Removes a todo file left behind by an interrupted or crashed run, so a new
     * session never starts with (and reports) stale items. Skipped while any
     * live session still uses the same file.
     */
    removeStaleTodoFile(todoFile: string) {
        if (!todoFile) return;
        if (this.countSessionsUsingTodoFile(todoFile) > 0) return;
        this.removeFile(todoFile);
    }

    /**
     * Drops the temporary todo file when the extension shuts down. A run that is
     * still in progress never reaches its own cleanup, and the file must not be
     * left in the workspace where it could be committed by mistake.
     */
    cleanupTodoFileOnExit() {
        this.removeFile(Utils.getTodosFilePath());
    }

    preprocessCommandPrompt = async (prompt: string): Promise<string> => {
        const regex = /!`(.+?)`/g;
        const matches = Array.from(prompt.matchAll(regex));
        if (matches.length === 0) {
            return prompt;
        }

        const replacements = await Promise.all(
            matches.map(async (match) => {
                const command = match[1].trim();
                try {
                    const { stdout, stderr } = await this.app.llamaServer.executeCommandWithTerminalFeedback(command);
                    if (stderr) {
                        return `Error executing '${command}': ${stderr}`;
                    }
                    return stdout;
                } catch (error) {
                    return `Error executing '${command}': ${error}`;
                }
            })
        );

        let result = prompt;
        for (let i = matches.length - 1; i >= 0; i--) {
            const match = matches[i];
            if (match.index){
                result = result.substring(0, match.index) + replacements[i] + result.substring(match.index + match[0].length);
            }
        }

        return result;
    };

    resetMessages = () => {
        this.messages = [
            {
                "role": "system",
                "content": this.buildSystemPrompt()
            }
        ];
        this.logText = "";
        this.lastReqTokens = 0;
    }

    /**
     * Build the system prompt for agent sessions. It contains the agent
     * instructions, subagents description, workspace folder, md-files context
     * and the auto memory context.
     */
    public buildSystemPrompt(): string {
        let systemPromt = this.app.prompts.TOOLS_SYSTEM_PROMPT_ACTION;
        if (this.app.isAgentSelected()) systemPromt = this.app.getAgent().systemInstruction.join("\n")
        if (this.app.configuration.tool_delegate_task_enabled) {
            let agentPromtPrefix = "  \n\n " + this.app.prompts.SUBAGENTS_DESCRIPTION;
            agentPromtPrefix += "  \n\n Subagents:";
            let subagentsList = "";
            for (let agent of this.app.configuration.agents_list) {
                if (agent.subagentEnabled){
                    subagentsList += "  \n" + agent.name + ": " + agent.description;
                }
            }
            if (subagentsList.length > 0) {
                systemPromt += agentPromtPrefix + subagentsList;
            }
        }
        let worspaceFolder = "";
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]){
            worspaceFolder = " Project root folder: " + vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        let projectContext = "  \n\n" + worspaceFolder;
        projectContext += this.getMdFilesContext();

        if (this.app.configuration.auto_memory_enabled && this.app.extensionContext.storageUri?.fsPath) {
            let auto_memory = this.app.prompts.AUTO_MEMORY_PROMPT;
            let auto_memory_folder = path.join(this.app.extensionContext.storageUri?.fsPath, "auto_memory");
            if (this.app.extensionContext.storageUri?.fsPath && !fs.existsSync(auto_memory_folder)) {
                fs.mkdirSync(auto_memory_folder, { recursive: true });
            } 
            auto_memory = this.app.prompts.replacePlaceholders(auto_memory, {
                "auto_memory_folder": auto_memory_folder,
                "max_auto_memory_files": this.app.configuration.max_auto_memory_files.toString()
            });
            let auto_memory_files = fs.readdirSync(auto_memory_folder).filter(file => file.endsWith('.md'));
            if (auto_memory_files.length > 0) {
                auto_memory += "  \n\nCurent auto memory files (" + auto_memory_files.length + "):  \n";
                auto_memory += auto_memory_files.join("  \n");
            }
            projectContext += "  \n\n" + auto_memory;
        }

        return systemPromt + projectContext;
    }

    selectChat = async (chat: Chat) => {
        if (chat && chat.defaultAgent) await this.app.agentService.selectAgent(chat.defaultAgent);
        this.resetMessages();

        if (chat){
            const currentChat = this.app.getChat();
            this.messages = chat.messages??[];
            this.logText = chat.log??"";
            this.lastReqTokens = chat.tokenDetails?.lastReqTokens??0;
        }
        //  this.app.llamaWebviewProvider.logInUi(this.logText);
         this.resetContext();
    }

    resetContext = () => {
        this.contexProjectFiles.clear();
        this.app.llamaWebviewProvider.updateContextFilesInfo();
        this.sentContextFiles.clear();
        this.contextImage = "";
        this.sentContextImages = [];
        // Nothing references the imported drop files any more; remove the copies.
        void this.app.llamaWebviewProvider.cleanImportedDropFiles();
    }

    addContextProjectFile = (fileLongName: string, fileShortName: string) => {
        this.contexProjectFiles.set(fileLongName, fileShortName);
    }

    addContextProjectImage = (imagePath: string) => {
        this.contextImage = imagePath;
    }
    
    removeContextProjectImage = () => {
        this.contextImage = "";
    }

    selectImageFile = async (): Promise<string> => {
        var imgPath = "";

        var fileTypes =  Object.values(SUPPORTED_IMG_FILE_EXTS)
        fileTypes = fileTypes.map(type => type.replace("image/", ""))
        
        const uris = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel: 'Import Model',
                    filters: {
                        'Image Files': fileTypes
                    },
                });
        
                if (!uris || uris.length === 0) {
                    return "";
                }
        
        imgPath = uris[0].fsPath;

        return imgPath;
    }

    removeContextProjectFile = (fileLongName: string) => {
        this.contexProjectFiles.delete(fileLongName);
    }

    getContextProjectFiles = () => {
        return this.contexProjectFiles;
    }

    getContextProjecImage = () => {
        return this.contextImage;
    }

    /**
     * The attached context files (long name -> short name), sent to the UI so it
     * can re-attach them when a "Send to session" text is handed back because no
     * foreground session was available to receive it.
     */
    getContextProjectFilesInfo = (): [string, string][] => {
        return Array.from(this.contexProjectFiles.entries());
    }

    run = async (query:string, agentCommand?:string, isTelegramBotReq:boolean=false) => {
        
        await this.askAgent(query, agentCommand, isTelegramBotReq);
    }

    /**
     * Runs an agent command as a background agent session. Used by the agent
     * command scheduler for periodic execution. The session uses an in-memory
     * log and in-memory todo, so it does not interfere with the foreground UI.
     */
    runAgentCommandInBackground = async (commandName: string): Promise<string> => {
        return this.askAgent(commandName, commandName, false, {
            background: true,
            logDestination: 'memory',
            useInMemoryTodo: true
        });
    }

    /**
     * Returns the session a "Send to session" text belongs to: the foreground
     * session of the loaded chat. Background sessions (agent command scheduler,
     * periodic tasks) run detached from the composer, so a text typed into the
     * chat must never be injected into one of them.
     */
    private getForegroundSession = (): AgentSession | undefined => {
        for (const session of this.activeSessions.values()) {
            if (session.isForeground) return session;
        }
        return undefined;
    }

    /**
     * Queues a text typed with "Send to session" into the running session. The
     * text is handed to the model at the next tool-call boundary (or at the end
     * of the current answer, when no tool call follows), so it reaches the agent
     * as early as possible instead of starting a new prompt.
     *
     * Returns true when a session accepted the text and false when nothing could
     * take it, so the UI can hand the text back to the composer instead of
     * dropping it.
     */
    setInSessionText = (inSessionText: string): boolean => {
        const text = inSessionText.trim();
        if (!text) return false;
        const session = this.getForegroundSession();
        if (!session) return false;

        const logDestination = session.logDestination;
        // Echo the text straight into the log: the chat is where the user looked
        // for the message, and until now the text was silently buffered and never
        // confirmed. Conversations without a visible log get the echo only when
        // it reaches the model (see deliverInSessionTextsForSession).
        if (session.options.logDestination === 'ui') {
            logDestination.append(this.formatInSessionTextForUi(text));
        }
        session.inSessionTexts.push(text);
        session.inSessionPending = true;
        if (logDestination.flushToUi && session.options.logDestination === 'ui') {
            logDestination.flushToUi();
        }
        if (!session.options.background) {
            this.setAgentState(
                "Message queued - waiting for the next tool-call boundary",
                true,
                session
            );
        }
        return true;
    }

    // The chat log wraps user messages in ***...*** (see parseChatSegments.ts),
    // and the two-space hard break keeps multi-line texts from gaining blank
    // lines of their own, which the UI would render as separate paragraphs.
    private formatInSessionTextForUi = (text: string): string =>
        "\n\n***" + text.split(/\r?\n/).join("  \n") + "***\n\n"

    /**
     * Delivers every text queued with "Send to session" to the model as one user
     * message. The texts are merged because the loop drains the queue in a single
     * step; the chat log has already shown each of them separately.
     */
    private deliverInSessionTextsForSession = (session: AgentSession) => {
        if (session.inSessionTexts.length === 0) {
            session.inSessionPending = false;
            return;
        }
        const text = session.inSessionTexts.join("\n\n");
        session.inSessionTexts = [];
        session.inSessionPending = false;
        if (session.options.logDestination !== 'ui') {
            // Conversations without a visible log only learn about the text now,
            // at the moment it is really handed to the model.
            session.logDestination.append(this.formatInSessionTextForUi(text));
        }
        session.messages.push({"role": "user", "content": text});
        this.app.logger.addEventLog('AGENT', 'IN_SESSION_TEXT', `session=${session.sessionId}`);
        // The "Message queued..." state has served its purpose: the text is in
        // the conversation now, so the status line must not claim otherwise for
        // the rest of the run.
        if (!session.options.background) {
            this.setAgentState("AI is working...", true, session);
        }
    }

    getMdFilesContext = () => {
        let mdFliesContext: string = "";
        if (this.app.configuration.agent_rules && this.app.configuration.agent_rules.trim().length > 0) {
            const absolutePath = Utils.getAbsolutFilePath(this.app.configuration.agent_rules);
            if (fs.existsSync(absolutePath)) {
                mdFliesContext += "  \n\nAdditional rules from the user: \n" + fs.readFileSync(absolutePath, "utf-8");
            } else {
                vscode.window.showWarningMessage(`File with the user defined rules from setting agent_rules not found: ${this.app.configuration.agent_rules}`);
            }
        } else {
            const absolutePath = Utils.getAbsolutFilePath("llama-vscode-rules.md");
            if (fs.existsSync(absolutePath)) {
                mdFliesContext += "  \n\nAdditional rules from the user: \n" + fs.readFileSync(absolutePath, "utf-8");
            }
        }
        const agentsAbsolutePath = Utils.getAbsolutFilePath("AGENTS.md");
        if (fs.existsSync(agentsAbsolutePath)) {
            mdFliesContext += "  \n\nInstructions from " + agentsAbsolutePath + ": \n" + fs.readFileSync(agentsAbsolutePath, "utf-8");
        }
        const soulAbsolutePath = Utils.getAbsolutFilePath("SOUL.md");
        if (fs.existsSync(soulAbsolutePath)) {
            mdFliesContext += "  \n\n AI soul desription from " + soulAbsolutePath + ": \n" + fs.readFileSync(soulAbsolutePath, "utf-8");
        }
        const userInstructionsPath = Utils.getAbsolutFilePath("USER.md");
        if (fs.existsSync(userInstructionsPath)) {
            mdFliesContext += "  \n\nUser profile from " + userInstructionsPath + ": \n" + fs.readFileSync(userInstructionsPath, "utf-8");
        }
        return mdFliesContext;
    }

    summarize = async (): Promise<boolean> => {
        if (this.messages.length <= this.app.configuration.chats_msgs_keep) {
            return false; // Not enough messages to summarize
        }

        // Preserve system messages and recent messages
        const systemMessages = this.messages.filter(m => m.role === 'system');
        const recentMessages = this.messages.slice(-this.app.configuration.chats_msgs_keep);
        const oldMessages = this.messages.slice(
            systemMessages.length, 
            -this.app.configuration.chats_msgs_keep
        );

        if (oldMessages.length === 0) {
            return false; // Nothing to summarize
        }

        try {
            const summary = await this.generateSummary(oldMessages);
            
            // Replace old messages with the summary
            this.messages = [
                ...systemMessages,
                {
                role: 'assistant' as const,
                content: `Earlier conversation summary:\n <conversation_summary>\n${summary}\n</conversation_summary>`
                },
                ...recentMessages
            ];
            vscode.window.showInformationMessage(`${oldMessages.length} messages summarized. Last ${recentMessages.length} messages left.`)
            return true;

        } catch (error) {
            console.error('Failed to generate summary:', error);
            return false;
        }
    }

    public async summarizeToFitCurrentBudget(newMessage: ChatMessage = {role:"user", content:""}, imagePath = ""): Promise<boolean> {
        if (!this.app.configuration.chats_summarize_old_msgs) {
            return false;
        }
        const tokenLimits = await this.app.llamaServer.getToolsModelTokenLimits();
        const reservedOutputTokens = Math.max(1024, resolveBoundedMaxOutputTokens({
            maxInputTokens: tokenLimits.maxInputTokens,
            maxOutputTokens: tokenLimits.maxOutputTokens,
            defaultMaxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
        }));
        const maxPromptTokens = Math.max(
            1,
            tokenLimits.maxInputTokens - reservedOutputTokens - DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS
        );

        let summarizedAny = false;
        while (true) {
            let newTokens: number | undefined = undefined;
            let promptTokens: number = 0;
            if (!summarizedAny) {
                newTokens = await this.app.llamaServer.countToolsPromptTokens([newMessage], imagePath);
                if (newTokens === undefined) newTokens = this.app.llamaServer.estimateToolsRequestTokens(newMessage)
                promptTokens = this.lastReqTokens + newTokens; 
            } else {
                let tokensAfterSummarize = await this.app.llamaServer.countToolsPromptTokens(this.messages, imagePath);
                if (tokensAfterSummarize === undefined) tokensAfterSummarize = this.app.llamaServer.estimateToolsRequestTokens(this.messages);
                promptTokens = tokensAfterSummarize;
                this.lastReqTokens = tokensAfterSummarize;
            }
            
            if (promptTokens <= maxPromptTokens) {
                return summarizedAny;
            }

            const summarized = await this.summarize();
            if (!summarized) {
                return summarizedAny;
            }
            this.app.logger.addEventLog('AGENT', 'BUDGET_SUMMARIZE', `messages=${this.messages.length}`);
            summarizedAny = true;
        }
    }

    private async generateSummary(messages: ChatMessage[]): Promise<string> {
        let data = await this.app.llamaServer.getAgentCompletion(messages, true, undefined, this.abortController?.signal)
        if (!data || data.error || !data?.choices[0]?.message?.content) throw Error("Error generating summary")
        
        return data?.choices[0]?.message?.content?.trim();
    }

    /**
     * Main entry point for agent execution with support for parallel/background sessions
     */
    askAgent = async (query: string, agentCommand?: string, isTelegramBotReq: boolean = false, options?: AgentSessionOptions): Promise<string> => {
        // Generate session ID if not provided
        const sessionId = options?.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Determine log destination based on options
        let logDestination: LogDestination;
        const logDestType = options?.logDestination ?? (options?.background ? 'memory' : 'ui');
        
        switch (logDestType) {
            case 'file':
                const logFilePath = options?.logFilePath || `${Utils.getTodosFilePath().replace('.llama-vscode-todos.md', `-logs-${sessionId}.md`)}`;
                logDestination = new FileLogDestination(logFilePath);
                break;
            case 'memory':
                logDestination = new MemoryLogDestination();
                break;
            default: // 'ui'
                logDestination = new UiLogDestination(this);
        }
        
        // Ensure default options are set
        const resolvedOptions: AgentSessionOptions = {
            background: options?.background ?? false,
            useInMemoryTodo: options?.useInMemoryTodo ?? false,
            logDestination: options?.logDestination ?? 'ui',
            onComplete: options?.onComplete,
            sessionId: options?.sessionId,
            logFilePath: options?.logFilePath
        };
        
        // Foreground sessions continue the currently loaded conversation:
        // reuse its messages (history), log and token state so that a new
        // prompt sent to a loaded chat keeps the conversation context.
        // Background sessions always start fresh and stay isolated from the
        // foreground chat so they can run in parallel without side effects.
        const isBackgroundSession = resolvedOptions.background;
        let sessionMessages: ChatMessage[] = [{ role: "system", content: this.buildSystemPrompt() }];
        let sessionLogText = "";
        let sessionLastReqTokens = 0;
        if (!isBackgroundSession && this.messages.length > 0) {
            sessionMessages = [...this.messages];
            sessionLogText = this.logText;
            sessionLastReqTokens = this.lastReqTokens;
        }
        
        // Create per-session state
        const session: AgentSession = {
            sessionId,
            newMessage: { role: "user", content: "" },
            todoFile: resolvedOptions.useInMemoryTodo ? '' : Utils.getTodosFilePath(),
            todoContent: null,
            response: "",
            iterations: 0,
            startedAt: Date.now(),
            changedFiles: new Set<string>(),
            deletedFiles: new Set<string>(),
            messages: sessionMessages,
            logText: sessionLogText,
            lastReqTokens: sessionLastReqTokens,
            abortController: new AbortController(),
            isTlgrBotRequest: isTelegramBotReq,
            inSessionTexts: [],
            inSessionPending: false,
            // Only a run started from the chat view may take a "Send to session"
            // text: background sessions and Telegram requests have their own
            // conversations, even though they log to the same UI.
            isForeground: !isBackgroundSession && !isTelegramBotReq,
            originalQuery: query,
            contexProjectFiles: new Map(this.contexProjectFiles),
            sentContextFiles: new Map(),
            contextImage: this.contextImage,
            sentContextImages: [],
            confirmationState: "",
            logDestination,
            options: resolvedOptions,
            defaultAgent: this.app.isAgentSelected() ? this.app.getAgent() : undefined
        };
        
        // Remove a todo file left behind by an interrupted run before the new
        // session starts: todo items are never reused between user requests, so
        // the agent must not pick up (and repeat) stale items.
        if (!resolvedOptions.useInMemoryTodo) {
            this.removeStaleTodoFile(session.todoFile);
        }
        
        // Register session
        this.registerSession(session);
        
        try {
            return await this.executeSession(session, agentCommand, isTelegramBotReq);
        } finally {
            // Persist background sessions in the chat history on every exit path
            // (success, stopped, error) so they are always available from the
            // chat history. Non-background sessions are persisted inside
            // executeSession (updateChatForSession).
            if (session.options.background) {
                try {
                    await this.saveSessionChat(session);
                } catch (error) {
                    console.error("Failed to save background session chat:", error);
                }
            }
            
            // Cleanup. Every step is guarded: this block runs on all exit paths
            // and must always reach the todo file removal below.
            this.unregisterSession(sessionId);
            try {
                session.abortController?.abort();
            } catch (error) {
                console.error("Failed to abort the agent session:", error);
            }
            session.abortController = null as any;
            // The todo file is a scratch pad for this run only (executeSession
            // also removes it at the end of the loop); remove it here as a
            // safety net so no exit path can leave it in the workspace.
            this.removeTodoFileForSession(session);
            
            // Call completion callback if provided
            if (options?.onComplete) {
                options.onComplete(session.response, sessionId);
            }
        }
    };
    
    /**
     * Execute a single agent session with per-session state
     */
    private async executeSession(session: AgentSession, agentCommand?: string, isTelegramBotReq: boolean = false): Promise<string> {
        let hooks = this.app.hooks.getHooks(this.app.configuration.hooks_folder);
        let promptSubmitResult: EventResult = {stopLoop: false, stopTool: false, resultInfo: ""};
        
        if (hooks && hooks.has(HooksEvents.userPromptSubmit) && hooks.get(HooksEvents.userPromptSubmit)){
            promptSubmitResult = await this.app.hooks.processHooks(hooks.get(HooksEvents.userPromptSubmit)??[], {prompt: session.originalQuery}, HooksEvents.userPromptSubmit, session.sessionId);
            if (promptSubmitResult.stopLoop) {
                this.prepareSessionStopForSession(session, "Session stopped by userPromptSubmit hook.");
                return "agent stopped by userPromptSubmit hook";
            } else {
                session.originalQuery += promptSubmitResult.resultInfo;
            }                                        
        }

        let finishReason: string | undefined = "tool_calls";
        session.logDestination.append("***" + session.originalQuery.split(/\r?\n/).join("  \n") + "***" + "\n\n");
        
        const agentCommandResult = await this.resolveAgentCommand(agentCommand, session.options.background);
        if (agentCommandResult.earlyReturn) return agentCommandResult.earlyReturn;
        
        // Update UI state only for non-background sessions
        if (!session.options.background) {
            this.setAgentState("AI is working...", true, session);
        }
        
        // The agent page selects the default tools model when it is opened, but a
        // session can also be started without the page having been shown (agent
        // commands, telegram, hooks). Same guarded call, so a model that is
        // already being started is never started twice.
        const hasToolsModel = await this.app.modelService.selectDefaultToolsModelIfNone();
        if (!hasToolsModel) {
            vscode.window.showErrorMessage("Error: Tools model is not selected! Select tools model (or env with tools model) or set and endpoint in setting endpoint_tools if you want to to use Llama Agent View.");
            if (!session.options.background) {
                this.setAgentState("AI is stopped", false, session);
            }
            session.logDestination.append("Tools model is not selected");
            return "Tools model is not selected";
        }
        
        session.newMessage.content = await this.assembleQuery(session.originalQuery, agentCommandResult.prompt, session);
        session.messages.push(session.newMessage);
        
        // Flush initial log (UiLogDestination does this automatically on append)
        session.logDestination.append("");
        
        try {
            while (session.iterations < this.app.configuration.tools_max_iterations){
                if (session.startedAt < this.lastStopRequestTime) {
                    this.prepareSessionStopForSession(session, "Session stopped.");
                    return "agent stopped";
                }
                session.iterations++;                    
                try {
                    // Get reminders with session-aware todo handling
                    const remindersText = this.app.agentReminder.getRemindersWithSession(session.iterations, session);
                    if (remindersText.trim() != "") {
                        session.messages.push({"role": "user", "content": remindersText});
                    }
                    
                    await this.summarizeToFitCurrentBudgetForSession(session);
                    
                    let streamed = "";
                    let deltaBuffer = "";
                    const maxChunkSize = this.app.configuration.telegram_chunk_size;
                    
                    // Show that the agent is waiting for the model, so a stop
                    // request has visible feedback before the first token lands.
                    // Only the UI destination owns a spinner instance.
                    const waitingIndicator = session.logDestination instanceof UiLogDestination
                        ? session.logDestination
                        : undefined;
                    waitingIndicator?.startWaitingIndicator();
                    
                    let data: LlamaToolsResponse | undefined = await this.app.llamaServer.getAgentCompletion(
                        session.messages, 
                        false, 
                        (delta: string) => {
                            // First real token: stop the spinner and strip its
                            // trailing markers BEFORE the token reaches the log,
                            // otherwise the markers stay glued inside the
                            // streamed answer (the tail-strip cannot reach them
                            // once more text has been appended after them). This
                            // check must come first: `streamed` already contains
                            // the current delta after the line below, so testing
                            // it afterwards is never true.
                            if (streamed.length === 0) waitingIndicator?.stopWaitingIndicator();
                            
                            streamed += delta;
                            deltaBuffer += delta;
                            
                            // Append to session log destination (automatically flushes for UI destination)
                            session.logDestination.append(delta);
                            
                            // Telegram handling
                            if (session.isTlgrBotRequest && deltaBuffer.length > maxChunkSize) {
                                this.app.telegramBot.sendResponse(deltaBuffer); 
                                deltaBuffer = "";
                            }
                        }, 
                        session.abortController?.signal, 
                        !session.sentContextImages.includes(session.contextImage) ? session.contextImage : "",
                        session.iterations
                    );
                    
                    waitingIndicator?.stopWaitingIndicator();
                    
                    if (session.isTlgrBotRequest && deltaBuffer.length > 0) {
                        this.app.telegramBot.sendResponse(deltaBuffer); 
                    }
                    if (session.contextImage) session.sentContextImages.push(session.contextImage);
                    
                    if (!data) {
                        this.app.logger.addEventLog('AGENT', 'NO_RESPONSE', `iteration=${session.iterations}`);
                        session.logDestination.append("No response from AI" + "  \n");
                        if (!session.options.background) {
                            this.setAgentState("AI not responding", false, session);
                        }
                        return "No response from AI";
                    }
                    
                    if (data.error?.type === "exceed_context_size_error") {
                        this.app.logger.addEventLog(
                            'AGENT',
                            'CONTEXT_ERROR',
                            `iteration=${session.iterations} | prompt_tokens=${data.error.n_prompt_tokens ?? 'unknown'} | n_ctx=${data.error.n_ctx ?? 'unknown'}`
                        );
                        session.logDestination.append("Error: " + data.error.message + "  \n");
                        if (typeof data.error.n_prompt_tokens === 'number' && typeof data.error.n_ctx === 'number') {
                            session.logDestination.append(`Prompt tokens: ${data.error.n_prompt_tokens}, context window: ${data.error.n_ctx}  \n`);
                        }

                        const summarized = await this.summarizeToFitCurrentBudgetForSession(session);
                        if (summarized) {
                            this.app.logger.addEventLog('AGENT', 'CONTEXT_RETRY', `iteration=${session.iterations}`);
                            continue;
                        }

                        if (!session.options.background) {
                            this.setAgentState("Context limit exceeded", false, session);
                        }
                        return data.error.message;
                    }

                    finishReason = data.choices[0].finish_reason;
                    session.response = data.choices[0].message.content ?? "";
                    if (!streamed && session.response) {
                        session.logDestination.append(session.response + "  \n");
                    }
                    if (data.truncated) {
                        this.app.logger.addEventLog('AGENT', 'TRUNCATED_RESPONSE', `iteration=${session.iterations} | finish_reason=${finishReason ?? 'unknown'}`);
                        session.logDestination.append("  \nWarning: response was truncated by the context window.  \n");
                    }
                 
                    session.logDestination.append("  \nTotal iterations: " + session.iterations + "  \n");
                    
                    if (session.startedAt < this.lastStopRequestTime) {
                        this.prepareSessionStopForSession(session, "Session stopped.");
                        return "agent stopped";
                    }
                    
                    session.messages.push(data.choices[0].message as ChatMessage);
                    
                    // A text queued with "Send to session" must reach the agent
                    // even when this answer ends without a tool call (the model
                    // may simply have finished): only then may the loop stop.
                    if (!session.inSessionPending
                        && finishReason != "tool_calls" 
                        && !(data.choices[0].message.tool_calls && data.choices[0].message.tool_calls.length > 0)){
                        session.logDestination.append("  \n" + "Finish reason: " + finishReason);
                        if (finishReason?.toLowerCase().trim() == "error" && data.choices[0].error) {
                            session.logDestination.append("Error: " + data.choices[0].error.message + "  \n" + data?.error?.message + "  \n");
                        }
                        
                        let stopResult: EventResult = {stopLoop: false, stopTool: false, resultInfo: "", continueLoop: false};
                        if (hooks && hooks.has(HooksEvents.stop) && hooks.get(HooksEvents.stop)){
                            stopResult = await this.app.hooks.processHooks(hooks.get(HooksEvents.stop)??[], {prompt: session.originalQuery}, HooksEvents.stop, session.sessionId);                                        
                        }
                        if (stopResult.continueLoop) session.messages.push({"role": "user", "content": stopResult.resultInfo});
                        else break;
                    }
                
                    // Execute any tool calls returned by the model
                    const toolCallsOk = await this.processToolCallsForSession(data, hooks, session);
                    if (!toolCallsOk) {
                        return "agent stopped by preToolUse hook";
                    }
                
                    // Hand every queued text to the model now - "Send to session"
                    // promises delivery at the earliest possible moment, i.e. right
                    // after this answer and the tool calls it asked for.
                    this.deliverInSessionTextsForSession(session);
                } catch (error) {
                    // Handle the error
                    console.error("An error occurred:", error);
                    session.logDestination.append("An error occurred: " + error + "\n\n");
                    if (isAxiosError(error)){
                        session.logDestination.append(`Error details: ${error.response?.data?.error?.message})\n\n`);
                    }
                    if (session.logDestination.flushToUi && session.options.logDestination === 'ui') {
                        session.logDestination.flushToUi();
                    }
                    if (!session.options.background) {
                        this.setAgentState("Error", false, session);
                    }
                    return "An error occurred: " + error;
                }
            }
            
            // Session completed successfully
            if (session.changedFiles.size + session.deletedFiles.size > 0) {
                session.logDestination.append("\n\nFiles changes:  \n");
            }
            if (session.changedFiles.size > 0) {
                session.logDestination.append(Array.from(session.changedFiles).map(file => this.getFileChangeLinkForSession(session, file)).join("  \n") + "  \n");
            }
            if (session.deletedFiles.size > 0) {
                session.logDestination.append(Array.from(session.deletedFiles).join("  \n") + "  \n");
            }
            session.logDestination.append("  \nAgent session finished. \n\n");
            if (session.iterations >= this.app.configuration.tools_max_iterations) {
                session.logDestination.append(`  \nFinish reason: Max iterations reached ${this.app.configuration.tools_max_iterations}. You could change the max iterations limit in settings tools_max_iterations.  \n\n`);
            }
            if (session.logDestination.flushToUi && session.options.logDestination === 'ui') {
                session.logDestination.flushToUi();
            }
            
            if (!session.options.background) {
                this.setAgentState("AI finished", false, session);
            }
            
            // Update the selected chat for non-background sessions. Background
            // sessions are saved to the chat history in the finally block of
            // askAgent (on every exit path).
            if (!session.options.background) {
                await this.updateChatForSession(session);
            }
            
            return session.response;
        } finally {
            // A queued "Send to session" text that never made it into the model
            // messages (the run was stopped or failed first) must not disappear
            // silently: the chat keeps the text, so say why it was not used.
            if (session.inSessionPending && session.options.logDestination === 'ui') {
                session.logDestination.append(
                    `  \nThe message above was not passed to the agent - the session ended before the next tool call.  \n\n`
                );
                if (session.logDestination.flushToUi) session.logDestination.flushToUi();
            }
            session.inSessionTexts = [];
            session.inSessionPending = false;
            // Never leave the "waiting" spinner running (e.g. on stop/error).
            if (session.logDestination instanceof UiLogDestination) {
                session.logDestination.stopWaitingIndicator();
            }
            // The tool loop is over: the todo list was only a scratch pad for
            // this run, so the file must not survive it (otherwise it lingers in
            // the workspace and can be committed by mistake).
            this.removeTodoFileForSession(session);
            // Clean up AbortController
            session.abortController = null as any;
        }
    }  
        
    // Resolves an agent command (predefined, custom, or script file) and returns
    // the prompt text to append to the user query. If the command is a no-prompt
    // script that terminates immediately, earlyReturn holds the result.
    // When background is true, no-prompt script results are not pushed to the
    // foreground UI (setAgentState/logInUi) to avoid clobbering the active view.
    private async resolveAgentCommand(agentCommand?: string, background: boolean = false): Promise<{prompt: string, earlyReturn: string | undefined}> {
        let agentCommandPrompt  = ""
        if (agentCommand) {
            let commands = this.app.configuration.agent_commands as AgentCommand[];
            commands = commands.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as AgentCommand[])
            let commandDetails = commands.find( cmd => cmd.name === agentCommand)
            if (!commandDetails 
                && agentCommand.toLowerCase().endsWith(AGENT_COMMAND.scrip_file_suffix)){
                const scriptFilePath = path.join(this.app.configuration.scripts_folder, agentCommand)
                if (fs.existsSync(scriptFilePath)) {
                    const script = fs.readFileSync(scriptFilePath, 'utf-8')              
                    commandDetails = {
                        name: "script",
                        description: "Run a script file",
                        prompt: [script],
                        isScript: true,
                        noPrompt: true,
                    }
                }
            }     
            if (commandDetails) {     
                let prompt =  commandDetails.prompt.join("\n")
                if (Utils.isFilePath(prompt))
                    prompt = await fs.promises.readFile(path.join(prompt), 'utf-8')              
                if (commandDetails.isScript) {
                    const scriptResult = await this.app.dslInterpreter.execute(prompt)    
                    if (commandDetails.noPrompt) { 
                        if (!background) {
                            this.setAgentState("AI is stopped", false)
                            this.logInUi(`${scriptResult} \n\n`)
                        }
                        return { prompt: "", earlyReturn: scriptResult };
                    } else {
                        agentCommandPrompt += "\n\n " + scriptResult
                    }
                } else agentCommandPrompt += "\n\n " + await this.preprocessCommandPrompt(commandDetails.prompt.join("\n"))
            }
        }
        return { prompt: agentCommandPrompt, earlyReturn: undefined };
    }

    // Assembles the final user query by appending skills descriptions, attached
    // project-file contexts, and the todo-list reminder.
    private async assembleQuery(query: string, agentCommandPrompt: string, session?: AgentSession): Promise<string> {
        // Use session-specific context if provided, otherwise use instance context
        const contexProjectFiles = session?.contexProjectFiles ?? this.contexProjectFiles;
        const sentContextFiles = session?.sentContextFiles ?? this.sentContextFiles;
        
        // Get the skills
        const skillsFolder = this.app.configuration.skills_folder || Utils.getWorkspaceFolder() + "/" + "skills"
        let skillsDesc = this.getSkillsDesc(skillsFolder)
        if (skillsDesc) query += "\n\n" + skillsDesc           

        if (contexProjectFiles.size > 0){
            query += "\n\nBelow is a context, attached by the user.\n"
            for (const [key, value] of contexProjectFiles) {
                if (sentContextFiles.has(key)) continue // send only not sent files (parts)
                let itemContext: string;
                let contextCustom = this.app.configuration.context_custom as ContextCustom
                if (contextCustom && contextCustom.get_item_context) {
                    if (fs.existsSync(contextCustom.get_item_context)) {
                        let toolFunction = Utils.getFunctionFromFile(contextCustom.get_item_context);
                        itemContext = toolFunction(key, value)
                    } else itemContext = (await Plugin.execute(contextCustom.get_item_context as keyof typeof Plugin.methods, key, value)) as string;
                } else {
                    itemContext = await this.getItemContext(key, value);
                }
                query += itemContext
                sentContextFiles.set(key, value);
            }                  
        }
        
        if (this.app.configuration.tool_update_todo_list_enabled){
            query += "\n\n " + "If the request is complicated or involves multiple steps - use tool update_todo_list."
        }

        if (agentCommandPrompt) query += agentCommandPrompt    
        return query;
    }

    private async processToolCalls(data: LlamaToolsResponse | undefined, hooks: Map<string, EventHook[]> | undefined, changedFiles: Set<string>, deletedFiles: Set<string>): Promise<boolean> {
        let toolCalls = data?.choices[0]?.message.tool_calls;
        if (toolCalls != undefined && toolCalls.length > 0){
            for (const oneToolCall of toolCalls){
                if (oneToolCall && oneToolCall.function){
                    this.logInUi("  \ntool: " + oneToolCall.function.name + "  \n");
                    if (this.app.configuration.tools_log_calls) this.logInUi("  \narguments: " + oneToolCall.function.arguments)
                    let commandOutput = "Tool not found";
                    try {
                        if (this.app.tools.toolsFunc.has(oneToolCall.function.name)){
                            const toolFuncDesc = this.app.tools.toolsFuncDesc.get(oneToolCall.function.name);
                            let commandDescription = ""
                            if (toolFuncDesc){
                                commandDescription = await toolFuncDesc(oneToolCall.function.arguments);
                                this.logInUi(commandDescription + "\n\n")
                            }   
                            const toolFunc = this.app.tools.toolsFunc.get(oneToolCall.function.name);
                            if (toolFunc) {
                                let preToolResult: EventResult = {stopLoop: false, stopTool: false, resultInfo: ""};
                                if (hooks && hooks.has(HooksEvents.preToolUse) && hooks.get(HooksEvents.preToolUse)){
                                    preToolResult = await this.app.hooks.processHooks(hooks.get(HooksEvents.preToolUse)??[], JSON.parse(oneToolCall.function.arguments), HooksEvents.preToolUse, oneToolCall.function.name)
                                    if (preToolResult.stopLoop) {
                                        this.prepareSessionStopForSession(this.createTempSessionFromContext(), "Session stopped by preToolUse hook.");
                                        return false;
                                    }                                        
                                }
                                
                                if (!preToolResult.stopTool) commandOutput = await toolFunc(oneToolCall.function.arguments);
                                else commandOutput = preToolResult.resultInfo;
    
                                if ((oneToolCall.function.name == "edit_file" || oneToolCall.function.name == "multi_edit_file") && commandOutput != Utils.MSG_NO_USER_PERMISSION) { 
                                    let changedFile = commandDescription
                                    if (changedFile.startsWith(TOOLS_DESC.prefixMultiEditFile)) changedFile = changedFile.slice(TOOLS_DESC.prefixMultiEditFile.length)
                                    if (changedFile.startsWith(TOOLS_DESC.prefixEditFile)) changedFile = changedFile.slice(TOOLS_DESC.prefixEditFile.length)
                                    changedFiles.add(changedFile);
                                    if (commandOutput != UI_TEXT_KEYS.fileUpdated){    
                                        this.logInUi(commandOutput + "\n\n")
                                    }
                                }
                                if (oneToolCall.function.name == "delete_file" && commandOutput != Utils.MSG_NO_USER_PERMISSION) deletedFiles.add(commandDescription);
                            }
                        }
                        if (this.app.tools.vscodeToolsSelected.has(oneToolCall.function.name)){
                            let result = await vscode.lm.invokeTool(oneToolCall.function.name,{input: JSON.parse(oneToolCall.function.arguments), toolInvocationToken: undefined})
                            commandOutput = result.content[0] ? (result.content[0] as vscode.LanguageModelTextPart).value : "";
                        }
                    } catch (error) {
                        // Handle the error
                        console.error("An error occurred:", error);
                        commandOutput = "Error during the execution of tool " + oneToolCall.function.name + ": " + error
                        commandOutput = commandOutput.slice(0, 400);
                        this.logInUi("Error during the execution of tool " + oneToolCall.function.name + ": " + error + "\n\n");
                    }
    
                    if (this.app.configuration.tools_log_calls) this.logInUi("result:  \n" + commandOutput + "  \n")
                    this.messages.push({           
                                "role": "tool",
                                "tool_call_id": oneToolCall.id,
                                "content": commandOutput
                            })
                }
            }
        }
        return true;
    }

    // Requests a stop. The running loop notices `lastStopRequestTime` at every
    // iteration boundary, so aborting the in-flight request is what makes the
    // stop take effect immediately instead of after the current answer.
    stopAgent = () => {
        this.lastStopRequestTime = Date.now();
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        // Stop every live session (foreground and background). The streaming
        // request of a session is bound to session.abortController; the instance
        // level controller above is only used by the summarization helper, so
        // aborting it alone left the actual answer streaming to the end.
        for (const session of this.activeSessions.values()) {
            session.abortController?.abort();
        }
        // Give the UI instant feedback; the session will confirm with its own
        // "Session stopped." message when it unwinds.
        this.app.llamaWebviewProvider.setState("Stopping session...");
    }

    getStepContext = (plan: Step[]) => {
        let context = "";
        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];
            if (step.result && step.state.toLowerCase() == "done") {
                context = "Result from task - " + step.description + ":  \n" + step.result + "\n\n";
            }
        }
        return context;
    }

    getProgress = (plan: Step[]) => {
        let progress = "";
        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];
            progress = "Step " + step.id + " :: " + step.description + " :: " + " :: " + step.state + "  \n";
        }
        return progress;
    }

    /**
     * Stop a specific session with message
     */
    private prepareSessionStopForSession(session: AgentSession, message: string) {
        this.app.statusbar.showTextInfo(message);
        session.logDestination.append("\n\n" + message + "\n");
        if (session.logDestination.flushToUi && session.options.logDestination === 'ui') {
            session.logDestination.flushToUi();
        }
        if (!session.options.background) {
            this.setAgentState("AI is stopped", false, session);
        }
    }

    private setAgentState(uiState: string, isInProgress: boolean, session?: AgentSession) {
        // Set the flag first: setState() reads isAgentInProgress() to report the
        // authoritative "session running" state to the UI.
        this.agentInProgress = isInProgress;
        // Each session gets an increasing id, which lets the provider tell the
        // state of the current session from a stale update of a finished one.
        this.app.llamaWebviewProvider.setState(uiState, session?.startedAt);
    }

    private updateLogText(logDelta: string) {
        if (this.isTlgrBotRequest) this.app.telegramBot.sendResponse(logDelta); 
        this.logText += logDelta;
    }

    // Appends text to the agent log and flushes it to the webview UI.
    // For telegram bot requests the log text is also sent as a response chunk.
    private logInUi(logDelta: string) {
        this.updateLogText(logDelta);
        this.app.llamaWebviewProvider.logInUi(this.logText);
    }

    // Renders a changed file as a clickable markdown link in the UI.
    // Clicking it triggers the 'llama-vscode.openChangedFile' command with the
    // file path. For telegram bot requests the plain path is returned
    // (telegram renders command: links as dead links).
    private getFileChangeLink = (filePath: string): string => {
        if (this.isTlgrBotRequest) return filePath;
        const args = encodeURIComponent(JSON.stringify({ filePath: filePath }));
        return `[${filePath}](command:llama-vscode.openChangedFile?${args})`;
    };
    
    /**
     * Render file change link for a specific session
     */
    private getFileChangeLinkForSession(session: AgentSession, filePath: string): string {
        if (session.isTlgrBotRequest) return filePath;
        const args = encodeURIComponent(JSON.stringify({ filePath: filePath }));
        return `[${filePath}](command:llama-vscode.openChangedFile?${args})`;
    }

    public async updateChat() {
        let chat = this.app.getChat();
        if (!this.app.isChatSelected()) {
            chat.name = this.logText.slice(0, 25);
            chat.id = Date.now().toString(36);
            chat.description = new Date().toLocaleString() + " " + this.logText.slice(0, 150);
        }
        chat.messages = this.messages;
        chat.log = this.logText;
        await this.app.chatService.selectUpdateChat(chat);
    }
    
    /**
     * Update chat for a specific session
     */
    public async updateChatForSession(session: AgentSession) {
        let chat = this.app.getChat();
        if (!this.app.isChatSelected()) {
            chat.name = session.logDestination.getContents().slice(0, 25);
            chat.id = session.sessionId;
            chat.description = new Date().toLocaleString() + " " + session.logDestination.getContents().slice(0, 150);
        }
        chat.messages = session.messages;
        chat.log = session.logDestination.getContents();
        // Keep the instance conversation state in sync with the completed
        // session so that the next prompt sent from the UI continues the
        // conversation instead of starting from the originally loaded history.
        this.messages = session.messages;
        this.logText = session.logDestination.getContents();
        this.lastReqTokens = session.lastReqTokens;
        await this.app.chatService.selectUpdateChat(chat);
    }

    /**
     * Persist a background agent session as a standalone chat in the chat
     * history so it can be selected/loaded later from the chat history without
     * disturbing the currently selected chat.
     */
    public async saveSessionChat(session: AgentSession) {
        const contents = session.logDestination.getContents();
        // Do not persist sessions that never produced any conversation output
        // (e.g. a script command that returned early before any real work).
        if (!session.messages.some(m => m.role !== 'system')) {
            return;
        }
        const sessionChat: Chat = {
            name: contents.slice(0, 25) || "background session",
            id: session.sessionId,
            description: new Date().toLocaleString() + " " + contents.slice(0, 150),
            messages: session.messages,
            log: contents,
            defaultAgent: session.defaultAgent,
        };
        await this.app.chatService.addChatToHistory(sessionChat);
    }

    /**
     * Summarize messages for a specific session to fit current token budget
     */
    public async summarizeToFitCurrentBudgetForSession(session: AgentSession): Promise<boolean> {
        if (!this.app.configuration.chats_summarize_old_msgs) {
            return false;
        }
        const tokenLimits = await this.app.llamaServer.getToolsModelTokenLimits();
        const reservedOutputTokens = Math.max(1024, resolveBoundedMaxOutputTokens({
            maxInputTokens: tokenLimits.maxInputTokens,
            maxOutputTokens: tokenLimits.maxOutputTokens,
            defaultMaxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
        }));
        const maxPromptTokens = Math.max(
            1,
            tokenLimits.maxInputTokens - reservedOutputTokens - DEFAULT_CONTEXT_SAFETY_MARGIN_TOKENS
        );

        let summarizedAny = false;
        while (true) {
            let newTokens: number | undefined = undefined;
            let promptTokens: number = 0;
            if (!summarizedAny) {
                newTokens = await this.app.llamaServer.countToolsPromptTokens([session.newMessage], session.contextImage);
                if (newTokens === undefined) newTokens = this.app.llamaServer.estimateToolsRequestTokens(session.newMessage);
                promptTokens = session.lastReqTokens + newTokens; 
            } else {
                let tokensAfterSummarize = await this.app.llamaServer.countToolsPromptTokens(session.messages, session.contextImage);
                if (tokensAfterSummarize === undefined) tokensAfterSummarize = this.app.llamaServer.estimateToolsRequestTokens(session.messages);
                promptTokens = tokensAfterSummarize;
                session.lastReqTokens = tokensAfterSummarize;
            }
            
            if (promptTokens <= maxPromptTokens) {
                return summarizedAny;
            }

            const summarized = await this.summarizeForSession(session);
            if (!summarized) {
                return summarizedAny;
            }
            this.app.logger.addEventLog('AGENT', 'BUDGET_SUMMARIZE', `messages=${session.messages.length}`);
            summarizedAny = true;
        }
    }
    
    /**
     * Generate summary for a specific session's messages
     */
    private async summarizeForSession(session: AgentSession): Promise<boolean> {
        if (session.messages.length <= this.app.configuration.chats_msgs_keep) {
            return false;
        }

        // Preserve system messages and recent messages
        const systemMessages = session.messages.filter(m => m.role === 'system');
        const recentMessages = session.messages.slice(-this.app.configuration.chats_msgs_keep);
        const oldMessages = session.messages.slice(
            systemMessages.length, 
            -this.app.configuration.chats_msgs_keep
        );

        if (oldMessages.length === 0) {
            return false;
        }

        try {
            const summary = await this.generateSummaryForSession(session, oldMessages);
            
            // Replace old messages with the summary
            session.messages = [
                ...systemMessages,
                {
                role: 'assistant' as const,
                content: `Earlier conversation summary:\n <conversation_summary>\n${summary}\n</conversation_summary>`
                },
                ...recentMessages
            ];
            vscode.window.showInformationMessage(`${oldMessages.length} messages summarized. Last ${recentMessages.length} messages left.`);
            return true;

        } catch (error) {
            console.error('Failed to generate summary:', error);
            return false;
        }
    }
    
    /**
     * Generate summary using session-specific abort controller
     */
    private async generateSummaryForSession(session: AgentSession, messages: ChatMessage[]): Promise<string> {
        let data = await this.app.llamaServer.getAgentCompletion(messages, true, undefined, session.abortController?.signal);
        if (!data || data.error || !data?.choices[0]?.message?.content) throw Error("Error generating summary");
        
        return data?.choices[0]?.message?.content?.trim();
    }

    /**
     * Process tool calls for a specific session
     */
    private async processToolCallsForSession(data: LlamaToolsResponse | undefined, hooks: Map<string, EventHook[]> | undefined, session: AgentSession): Promise<boolean> {
        let toolCalls = data?.choices[0]?.message.tool_calls;
        if (toolCalls != undefined && toolCalls.length > 0){
            for (const oneToolCall of toolCalls){
                if (oneToolCall && oneToolCall.function){
                    session.logDestination.append("  \ntool: " + oneToolCall.function.name + "  \n");
                    if (this.app.configuration.tools_log_calls) session.logDestination.append("  \narguments: " + oneToolCall.function.arguments);
                    let commandOutput = "Tool not found";
                    try {
                        if (this.app.tools.toolsFunc.has(oneToolCall.function.name)){
                            const toolFuncDesc = this.app.tools.toolsFuncDesc.get(oneToolCall.function.name);
                            let commandDescription = "";
                            if (toolFuncDesc){
                                commandDescription = await toolFuncDesc(oneToolCall.function.arguments);
                                session.logDestination.append(commandDescription + "\n\n");
                            }   
                            const toolFunc = this.app.tools.toolsFunc.get(oneToolCall.function.name);
                            if (toolFunc) {
                                let preToolResult: EventResult = {stopLoop: false, stopTool: false, resultInfo: ""};
                                if (hooks && hooks.has(HooksEvents.preToolUse) && hooks.get(HooksEvents.preToolUse)){
                                    preToolResult = await this.app.hooks.processHooks(hooks.get(HooksEvents.preToolUse)??[], JSON.parse(oneToolCall.function.arguments), HooksEvents.preToolUse, session.sessionId);
                                    if (preToolResult.stopLoop) {
                                        this.prepareSessionStopForSession(session, "Session stopped by preToolUse hook.");
                                        return false;
                                    }                                        
                                }
                                
                                // Expose the owning session to the tool: tools that
                                // do not get the session id from the model (e.g.
                                // update_todo_list) need it to store their state in
                                // the right session. Restored afterwards because a
                                // tool may run a nested session (delegate_task).
                                const previousToolSession = this.currentToolSession;
                                this.currentToolSession = session;
                                try {
                                    if (!preToolResult.stopTool) commandOutput = await toolFunc(oneToolCall.function.arguments);
                                    else commandOutput = preToolResult.resultInfo;
                                } finally {
                                    this.currentToolSession = previousToolSession;
                                }

                                if ((oneToolCall.function.name == "edit_file" || oneToolCall.function.name == "multi_edit_file") && commandOutput != Utils.MSG_NO_USER_PERMISSION) { 
                                    let changedFile = commandDescription;
                                    if (changedFile.startsWith(TOOLS_DESC.prefixMultiEditFile)) changedFile = changedFile.slice(TOOLS_DESC.prefixMultiEditFile.length);
                                    if (changedFile.startsWith(TOOLS_DESC.prefixEditFile)) changedFile = changedFile.slice(TOOLS_DESC.prefixEditFile.length);
                                    session.changedFiles.add(changedFile);
                                    if (commandOutput != UI_TEXT_KEYS.fileUpdated){    
                                        session.logDestination.append(commandOutput + "\n\n");
                                    }
                                }
                                if (oneToolCall.function.name == "delete_file" && commandOutput != Utils.MSG_NO_USER_PERMISSION) session.deletedFiles.add(commandDescription);
                            }
                        }
                        if (this.app.tools.vscodeToolsSelected.has(oneToolCall.function.name)){
                            let result = await vscode.lm.invokeTool(oneToolCall.function.name,{input: JSON.parse(oneToolCall.function.arguments), toolInvocationToken: undefined});
                            commandOutput = result.content[0] ? (result.content[0] as vscode.LanguageModelTextPart).value : "";
                        }
                    } catch (error) {
                        // Handle the error
                        console.error("An error occurred:", error);
                        commandOutput = "Error during the execution of tool " + oneToolCall.function.name + ": " + error;
                        commandOutput = commandOutput.slice(0, 400);
                        session.logDestination.append("Error during the execution of tool " + oneToolCall.function.name + ": " + error + "\n\n");
                    }

                    if (this.app.configuration.tools_log_calls) session.logDestination.append("result:  \n" + commandOutput + "  \n");
                    session.messages.push({           
                                "role": "tool",
                                "tool_call_id": oneToolCall.id,
                                "content": commandOutput
                            });
                }
            }
        }
        return true;
    }

    /**
     * Create a temporary session from current context for backward compatibility
     */
    private createTempSessionFromContext(): AgentSession {
        const logDest = new UiLogDestination(this);
        return {
            sessionId: 'temp',
            newMessage: { role: 'user', content: '' },
            todoFile: Utils.getTodosFilePath(),
            todoContent: null,
            response: '',
            iterations: 0,
            startedAt: Date.now(),
            changedFiles: new Set<string>(),
            deletedFiles: new Set<string>(),
            messages: this.messages,
            logText: this.logText,
            lastReqTokens: this.lastReqTokens,
            abortController: new AbortController(),
            isTlgrBotRequest: this.isTelegramBotRequest(),
            inSessionTexts: [],
            inSessionPending: false,
            isForeground: false,
            originalQuery: this.originalQuery,
            contexProjectFiles: this.contexProjectFiles,
            sentContextFiles: this.sentContextFiles,
            contextImage: this.contextImage,
            sentContextImages: this.sentContextImages,
            confirmationState: this.confirmationState,
            logDestination: logDest,
            options: { background: false },
            defaultAgent: this.app.isAgentSelected() ? this.app.getAgent() : undefined
        };
    }

    /**
     * Deletes a temporary file without ever throwing: cleanup runs in `finally`
     * blocks, and a failure here (for example a file locked by an editor) must
     * not mask the session result or skip the remaining cleanup.
     */
    private removeFile(todoFile: string) {
        if (!todoFile) return;
        try {
            if (fs.existsSync(todoFile)) {
                fs.unlinkSync(todoFile);
            }
        } catch (error) {
            console.error("Failed to remove the temporary file " + todoFile + ":", error);
        }
    }

    private async getItemContext(key: string, value: string) {
        let itemContext = "";
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(key.split("|")[0]));
        let parts = value.split("|");
        if (parts.length == 1) {
            itemContext += "\n\nFile " + key + ":\n\n" + document.getText().slice(0, this.app.configuration.rag_max_context_file_chars);
        } else {
            let firstLine = parseInt(parts[1]);
            let lastLine = parseInt(parts[2]);
            let fileContent = document.getText().split(/\r?\n/).slice(firstLine - 1, lastLine).join("\n");
            itemContext += "\n\nFile " + key + " content from line " + firstLine + " to line " + lastLine + " (one based):\n\n" + fileContent.slice(0, this.app.configuration.rag_max_context_file_chars);
        }
        return itemContext;
    }

    private getSkillsDesc(skillsFolder: string): string {
        let desc = ""
        if (fs.existsSync(skillsFolder)) {
            desc += "<available_skills>"
            const items = fs.readdirSync(skillsFolder, { withFileTypes: true });
        
            const folders = items
                .filter(item => item.isDirectory())
                .map(item => item.name);

            for(let folder in folders){
                const skillsFile = path.join(skillsFolder, folders[folder], "SKILL.md");
                if (fs.existsSync(skillsFile)){
                    desc += "<skill>"
                    const frontMatter = this.parseFrontmatter(skillsFile)
                    desc += `<name>${frontMatter.name}</name>`
                    desc += `<description>${frontMatter.description}</description>`
                    desc += `<location>${skillsFile}</location>`
                    desc += "</skill>"
                }
            }
            desc += "</available_skills>"
        }
        return desc;
    }

    private parseFrontmatter(filePath: string): Frontmatter {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            
            // Match frontmatter between --- delimiters
            const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
            const match = fileContent.match(frontmatterRegex);
            
            if (!match) {
            return { frontmatter: {}, content: fileContent };
            }
            
            const frontmatterText = match[1];
            const content = fileContent.slice(match[0].length);
            
            // Parse frontmatter (assuming YAML format)
            const frontmatter: Frontmatter = {};
            const lines = frontmatterText.split('\n');
            
            for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.slice(0, colonIndex).trim();
                const value = line.slice(colonIndex + 1).trim();
                
                // Try to parse as JSON-like values
                try {
                frontmatter[key] = JSON.parse(value);
                } catch {
                // Remove quotes if present
                frontmatter[key] = value.replace(/^['"](.*)['"]$/, '$1');
                }
            }
            }
            
            return frontmatter;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read or parse file: ${error}`);
            return {}
        }
    }
}