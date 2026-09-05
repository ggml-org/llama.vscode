import {Application} from "./application";
import { AgentCommand, ChatMessage, ContextCustom } from "./types";
import * as vscode from 'vscode';
import { Utils } from "./utils"
import { Chat } from "./types"
import { Plugin } from './plugin';
import * as fs from 'fs';
import { AGENT_COMMAND, ModelType, PERSISTENCE_KEYS, PREDEFINED_LISTS_KEYS, SUPPORTED_IMG_FILE_EXTS, UI_TEXT_KEYS } from "./constants";
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

export class LlamaAgent {
    private app: Application
    private lastStopRequestTime = Date.now();
    private messages: ChatMessage[] = [];
    private lastReqTokens = 0;
    private confirmationState: string = ""; // Use consts CONFIRMATION_STATE.*
    private logText = ""
    public contexProjectFiles: Map<string,string> = new Map();
    public sentContextFiles: Map<string,string> = new Map();
    public contextImage: string = "";
    public sentContextImages: string[] = [];
    private abortController: AbortController | null = null;
    private inSessionText: string = ""
    private isTlgrBotRequest: boolean = false;
    private agentInProgress: boolean = false;
    private originalQuery: string = "";

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

        this.messages = [
            {
                "role": "system",
                "content": systemPromt + projectContext
            }
        ];
        this.logText = "";
        this.lastReqTokens = 0;
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

    run = async (query:string, agentCommand?:string, isTelegramBotReq:boolean=false) => {
        
        await this.askAgent(query, agentCommand, isTelegramBotReq);
    }

    setInSessionText = async (inSessionText:string) => {
        
        this.inSessionText += inSessionText.trim();
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

    askAgent = async (query:string, agentCommand?:string, isTelegramBotReq: boolean = false): Promise<string> => {
            let response = ""
            
            this.originalQuery = query;
            let toolCallsResult: ChatMessage;
            let finishReason:string|undefined = "tool_calls"
            this.updateLogText("***" + query.split(/\r?\n/).join("  \n") + "***" + "\n\n");
            this.isTlgrBotRequest = isTelegramBotReq
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
                            this.setAgentState("AI is stopped", false)
                            this.updateLogText(`${scriptResult} \n\n`)
                            this.app.llamaWebviewProvider.logInUi(this.logText);
                            return scriptResult;
                        } else {
                            agentCommandPrompt += "\n\n " + scriptResult
                        }
                    } else agentCommandPrompt += "\n\n " + await this.preprocessCommandPrompt(commandDetails.prompt.join("\n"))
                }
            }
            
            this.setAgentState("AI is working...", true)
            if (!this.app.isToolsModelSelected() && !this.app.configuration.endpoint_tools){
                await this.app.modelService.selectDefaultModel(ModelType.Tools, PERSISTENCE_KEYS.DEFAULT_TOOLS_MODEL);
            }
            if (!this.app.isToolsModelSelected() && !this.app.configuration.endpoint_tools) {
                vscode.window.showErrorMessage("Error: Tools model is not selected! Select tools model (or env with tools model) or set and endpoint in setting endpoint_tools if you want to to use Llama Agent View.")
                this.setAgentState("AI is stopped", false)
                this.updateLogText("Tools model is not selected")
                this.app.llamaWebviewProvider.logInUi(this.logText);
                return "Tools model is not selected"
            }
            // Get the skills
            const skillsFolder = this.app.configuration.skills_folder || Utils.getWorkspaceFolder() + "/" + "skills"
            let skillsDesc = this.getSkillsDesc(skillsFolder)
            if (skillsDesc) query += "\n\n" + skillsDesc

            if (this.contexProjectFiles.size > 0){
                query += "\n\nBelow is a context, attached by the user.\n"
                for (const [key, value] of this.contexProjectFiles) {
                    if (this.sentContextFiles.has(key)) continue // send only not sent files (parts)
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
                    this.sentContextFiles.set(key, value);
                }                  
            }
            
            const todoFile = Utils.getTodosFilePath()
            this.removeFile(todoFile);

            if (this.app.configuration.tool_update_todo_list_enabled){
                query += "\n\n " + "If the request is complicated or involves multiple steps - use tool update_todo_list."
            }

            if (agentCommandPrompt) query += agentCommandPrompt    
            let newMessage: ChatMessage = {
                                "role": "user",
                                "content": query
                            }         
            this.messages.push(newMessage)

            let iterationsCount = 0;    
            this.app.llamaWebviewProvider.logInUi(this.logText);
            
            let currentCycleStartTime = Date.now();
            const changedFiles = new Set<string>
            const deletedFiles = new Set<string>
            
            // Create new AbortController for this session
            this.abortController = new AbortController();
            
            while (iterationsCount < this.app.configuration.tools_max_iterations){
                if (currentCycleStartTime < this.lastStopRequestTime) {
                    this.app.statusbar.showTextInfo("agent stopped");
                    this.updateLogText("\n\n" + "Session stopped." + "  \n")
                    this.app.llamaWebviewProvider.logInUi(this.logText);
                    this.setAgentState("AI is stopped", false)
                    this.resetMessages();
                    return "agent stopped"
                }
                iterationsCount++;                    
                try {
                    const remindersText = this.app.agentReminder.getReminders(iterationsCount)
                    if (remindersText.trim() != "") this.messages.push({"role": "user", "content": remindersText})                   
                        
                    await this.summarizeToFitCurrentBudget(newMessage, this.contextImage);
                    let streamed = "";
                    let deltaBuffer = ""
                    const maxChunkSize = this.app.configuration.telegram_chunk_size
                    let data:any = await this.app.llamaServer.getAgentCompletion(
                                                                this.messages, 
                                                                false, 
                                                                (delta: string) => {
                                                                    streamed += delta;
                                                                    deltaBuffer += delta;
                                                                    if (this.isTlgrBotRequest && deltaBuffer.length > maxChunkSize) {
                                                                        this.app.telegramBot.sendResponse(deltaBuffer); 
                                                                        deltaBuffer = ""
                                                                    }
                                                                    this.logText += delta;
                                                                    this.app.llamaWebviewProvider.logInUi(this.logText);
                                                                }, 
                                                                this.abortController?.signal, 
                                                                !this.sentContextImages.includes(this.contextImage)? this.contextImage : "",
                                                                iterationsCount
                                                            );
                    if (this.isTlgrBotRequest && deltaBuffer.length > 0) {
                        this.app.telegramBot.sendResponse(deltaBuffer); 
                    }
                    if (this.contextImage) this.sentContextImages.push(this.contextImage)
                    if (!data) {
                        this.app.logger.addEventLog('AGENT', 'NO_RESPONSE', `iteration=${iterationsCount}`);
                        this.updateLogText("No response from AI" + "  \n")
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                        this.setAgentState("AI not responding", false)
                        return "No response from AI";
                    }
                    if (data.error?.type === "exceed_context_size_error") {
                        this.app.logger.addEventLog(
                            'AGENT',
                            'CONTEXT_ERROR',
                            `iteration=${iterationsCount} | prompt_tokens=${data.error.n_prompt_tokens ?? 'unknown'} | n_ctx=${data.error.n_ctx ?? 'unknown'}`
                        );
                        this.updateLogText("Error: " + data.error.message + "  \n");
                        if (typeof data.error.n_prompt_tokens === 'number' && typeof data.error.n_ctx === 'number') {
                            this.updateLogText(`Prompt tokens: ${data.error.n_prompt_tokens}, context window: ${data.error.n_ctx}  \n`);
                        }
                        this.app.llamaWebviewProvider.logInUi(this.logText);

                        const summarized = await this.summarizeToFitCurrentBudget(newMessage, this.contextImage);
                        if (summarized) {
                            this.app.logger.addEventLog('AGENT', 'CONTEXT_RETRY', `iteration=${iterationsCount}`);
                            continue;
                        }

                        this.setAgentState("Context limit exceeded", false)
                        return data.error.message;
                    }

                    finishReason = data.choices[0].finish_reason;
                    response = data.choices[0].message.content;
                    if (!streamed && response) {
                        this.updateLogText(response + "  \n");
                    }
                    if (data.truncated) {
                        this.app.logger.addEventLog('AGENT', 'TRUNCATED_RESPONSE', `iteration=${iterationsCount} | finish_reason=${finishReason ?? 'unknown'}`);
                        this.updateLogText("  \nWarning: response was truncated by the context window.  \n");
                    }
                     
                    this.updateLogText("  \nTotal iterations: " + iterationsCount + "  \n")
                    this.app.llamaWebviewProvider.logInUi(this.logText);
                    if (currentCycleStartTime < this.lastStopRequestTime) {
                        this.app.statusbar.showTextInfo("agent stopped");
                        this.updateLogText("\n\n" + "Session stopped." + "\n")
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                        this.setAgentState("AI is stopped", false);
                        this.resetMessages();
                        return "agent stopped"
                    }
                    this.messages.push(data.choices[0].message);
                    if (!this.inSessionText 
                        && finishReason != "tool_calls" 
                        && !(data.choices[0].message.tool_calls && data.choices[0].message.tool_calls.length > 0)){
                        this.updateLogText("  \n" + "Finish reason: " + finishReason)
                        if (finishReason?.toLowerCase().trim() == "error" && data.choices[0].error) this.updateLogText("Error: " + data.choices[0].error.message + "  \n" + data?.error?.message + "  \n")
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                        break;
                    }
                    
                    let toolCalls:any = data.choices[0].message.tool_calls;
                    if (toolCalls != undefined && toolCalls.length > 0){
                        for (const oneToolCall of toolCalls){
                            if (oneToolCall && oneToolCall.function){
                                this.updateLogText("  \ntool: " + oneToolCall.function.name + "  \n");
                                if (this.app.configuration.tools_log_calls) this.updateLogText("  \narguments: " + oneToolCall.function.arguments)
                                this.app.llamaWebviewProvider.logInUi(this.logText);
                                let commandOutput = "Tool not found";
                                try {
                                    if (this.app.tools.toolsFunc.has(oneToolCall.function.name)){
                                        const toolFuncDesc = this.app.tools.toolsFuncDesc.get(oneToolCall.function.name);
                                        let commandDescription = ""
                                        if (toolFuncDesc){
                                            commandDescription = await toolFuncDesc(oneToolCall.function.arguments);
                                            this.updateLogText(commandDescription + "\n\n")
                                            this.app.llamaWebviewProvider.logInUi(this.logText);
                                        }   
                                        const toolFunc = this.app.tools.toolsFunc.get(oneToolCall.function.name);
                                        if (toolFunc) {
                                            commandOutput = await toolFunc(oneToolCall.function.arguments);
                                            if ((oneToolCall.function.name == "edit_file" || oneToolCall.function.name == "multi_edit_file") && commandOutput != Utils.MSG_NO_USER_PERMISSION) { 
                                                changedFiles.add(commandDescription);
                                                if (commandOutput != UI_TEXT_KEYS.fileUpdated){    
                                                    this.updateLogText(commandOutput + "\n\n")
                                                    this.app.llamaWebviewProvider.logInUi(this.logText);
                                                }
                                            }
                                            if (oneToolCall.function.name == "delete_file" && commandOutput != Utils.MSG_NO_USER_PERMISSION) deletedFiles.add(commandDescription);
                                        }
                                    }
                                    if (this.app.tools.vscodeToolsSelected.has(oneToolCall.function.name)){
                                        let result = await vscode.lm.invokeTool(oneToolCall.function.name,{input: JSON.parse(oneToolCall.function.arguments), toolInvocationToken: undefined})
                                        commandOutput = result.content[0] ? (result.content[0] as { [key: string]: any; }).value : "";;
                                    }
                                } catch (error) {
                                    // Handle the error
                                    console.error("An error occurred:", error);
                                    commandOutput = "Error during the execution of tool " + oneToolCall.function.name + ": " + error
                                    commandOutput = commandOutput.slice(0, 400);
                                    this.updateLogText("Error during the execution of tool " + oneToolCall.function.name + ": " + error + "\n\n");
                                    this.app.llamaWebviewProvider.logInUi(this.logText);
                                }

                                if (this.app.configuration.tools_log_calls) this.updateLogText("result:  \n" + commandOutput + "  \n")
                                this.app.llamaWebviewProvider.logInUi(this.logText);
                                toolCallsResult = {           
                                            "role": "tool",
                                            "tool_call_id": oneToolCall.id,
                                            "content": commandOutput
                                        }
                                this.messages.push(toolCallsResult)
                            }
                        }
                    }
                    
                    if (this.inSessionText){
                        this.updateLogText("\n\n***" + this.inSessionText.split(/\r?\n/).join("  \n") + "***\n\n")
                        this.messages.push({"role": "user", "content": this.inSessionText})
                        this.inSessionText = ""
                    }
                } catch (error) {
                    // Handle the error
                    console.error("An error occurred:", error);
                    this.updateLogText("An error occurred: " + error + "\n\n");
                    if (isAxiosError(error)){
                        this.updateLogText(`Error details: ${error.response?.data?.error?.message})\n\n`);
                    }
                    this.app.llamaWebviewProvider.logInUi(this.logText);
                    this.setAgentState("Error", false)
                    return "An error occurred: " + error;
                }
            }
            if (changedFiles.size + deletedFiles.size > 0) this.updateLogText("\n\nFiles changes:  \n")
            if (changedFiles.size > 0) this.updateLogText(Array.from(changedFiles).join("  \n") + "  \n")
            if (deletedFiles.size > 0) this.updateLogText(Array.from(deletedFiles).join("  \n") + "  \n")
            this.updateLogText("  \nAgent session finished. \n\n")
            if (iterationsCount >= this.app.configuration.tools_max_iterations) {
                this.updateLogText(`  \nFinish reason: Max iterations reached ${this.app.configuration.tools_max_iterations}. You could change the max iterations limit in settings tools_max_iterations.  \n\n`)
            }
            this.app.llamaWebviewProvider.logInUi(this.logText);
            this.setAgentState("AI finished", false)
            await this.updateChat();
            
            // Clean up AbortController
            this.abortController = null;

            this.removeFile(todoFile);
            
            return response;
        }  
        
    stopAgent = () => {
        this.lastStopRequestTime = Date.now();
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
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

    private setAgentState(uiState: string, isInProgress: boolean) {
        this.app.llamaWebviewProvider.setState(uiState);
        this.agentInProgress = isInProgress;
    }

    private updateLogText(logDelta: string) {
        if (this.isTlgrBotRequest) this.app.telegramBot.sendResponse(logDelta); 
        this.logText += logDelta;
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

    private removeFile(todoFile: string) {
        if (fs.existsSync(todoFile)) {
            fs.unlinkSync(todoFile);
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