import {Application} from "./application";
import { ChatMessage, ContextCustom } from "./types";
import * as vscode from 'vscode';
import { Utils } from "./utils"
import { Chat } from "./types"
import { Plugin } from './plugin';
import * as fs from 'fs';


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
    private messages: ChatMessage[] = []
    private logText = ""
    public contexProjectFiles: Map<string,string> = new Map();
    public sentContextFiles: Map<string,string> = new Map();
    private abortController: AbortController | null = null;

    constructor(application: Application) {
        this.app = application;
        this.resetMessages();
    }

    resetMessages = () => {
        let systemPromt = this.app.prompts.TOOLS_SYSTEM_PROMPT_ACTION;
        if (this.app.menu.isAgentSelected()) systemPromt = this.app.menu.getAgent().systemInstruction.join("\n")
        let worspaceFolder = "";
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]){
            worspaceFolder = " Project root folder: " + vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        let projectContext = "  \n\n" + worspaceFolder;
        this.messages = [
                            {
                                "role": "system",
                                "content": systemPromt + projectContext
                            }
                        ];
        this.logText = "";
    }

    selectChat = (chat: Chat) => {
        if (chat && chat.defaultAgent) this.app.menu.selectAgent(chat.defaultAgent);
        this.resetMessages();

        if (chat){
            const currentChat = this.app.menu.getChat();
            this.messages = chat.messages??[];
            this.logText = chat.log??"";
         }
         this.app.llamaWebviewProvider.logInUi(this.logText);
         this.resetContextProjectFiles();
    }

    resetContextProjectFiles = () => {
        this.contexProjectFiles.clear();
        this.app.llamaWebviewProvider.updateContextFilesInfo();
        this.sentContextFiles.clear();
    }

    addContextProjectFile = (fileLongName: string, fileShortName: string) => {
        this.contexProjectFiles.set(fileLongName, fileShortName);
    }

    removeContextProjectFile = (fileLongName: string) => {
        this.contexProjectFiles.delete(fileLongName);
    }

    getContextProjectFiles = () => {
        return this.contexProjectFiles;
    }

    run = async (query:string) => {
        await this.askAgent(query);
    }

    private async summarize(): Promise<void> {
        if (this.messages.length <= this.app.configuration.chats_msgs_keep) {
            return; // Not enough messages to summarize
        }

        // Preserve system messages and recent messages
        const systemMessages = this.messages.filter(m => m.role === 'system');
        const recentMessages = this.messages.slice(-this.app.configuration.chats_msgs_keep);
        const oldMessages = this.messages.slice(
            systemMessages.length, 
            -this.app.configuration.chats_msgs_keep
        );

        if (oldMessages.length === 0) {
            return; // Nothing to summarize
        }

        try {
            const summary = await this.generateSummary(oldMessages);
            
            // Replace old messages with the summary
            this.messages = [
                ...systemMessages,
                {
                role: 'system' as const,
                content: `Earlier conversation summary: ${summary}`
                },
                ...recentMessages
            ];

        } catch (error) {
            console.error('Failed to generate summary:', error);
            // Fallback: just keep recent messages and remove older ones
            this.messages = [...systemMessages, ...recentMessages];
        }
    }

    private async generateSummary(messages: ChatMessage[]): Promise<string> {
        let data = await this.app.llamaServer.getAgentCompletion(messages, true, undefined, this.abortController?.signal)

        return data?.choices[0]?.message?.content?.trim() || 'No summary generated';
    }

    askAgent = async (query:string): Promise<string> => {
            let response = ""
            let toolCallsResult: ChatMessage;
            let finishReason:string|undefined = "tool_calls"
            this.logText += "***" + query + "***" + "\n\n";
            
            if (!this.app.menu.isToolsModelSelected()) {
                vscode.window.showErrorMessage("Error: Tools model is not selected! Select tools model (or orchestra with tools model) if you want to to use Llama Agent.")
                this.app.llamaWebviewProvider.setState("AI is stopped")
                return "Tools model is not selected"
            }
            
            if (this.app.configuration.chats_summarize_old_msgs 
                && JSON.stringify(this.messages).length > this.app.configuration.chats_max_tokens*4) {
                this.summarize();
            }
            
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

            let filesFromQuery = this.app.chatContext.getFilesFromQuery(query)
            for (const fileName of filesFromQuery){
                let absPath = await Utils.getAbsolutePath(fileName);
                if (absPath != undefined) query = query.replace("@" + fileName, absPath)
            }

            this.messages.push(
                            {
                                "role": "user",
                                "content": query
                            }
            )

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
                    this.logText += "\n\n" + "Session stopped." + "  \n"
                    this.app.llamaWebviewProvider.logInUi(this.logText);
                    this.app.llamaWebviewProvider.setState("AI is stopped")
                    this.resetMessages();
                    return "agent stopped"
                }
                iterationsCount++;
                try {
                    let streamed = "";
                    let data:any = await this.app.llamaServer.getAgentCompletion(this.messages, false, (delta: string) => {
                        streamed += delta;
                        this.logText += delta;
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                    }, this.abortController?.signal);
                    if (!data) {
                        this.logText += "No response from AI" + "  \n"
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                        this.app.llamaWebviewProvider.setState("AI not responding")
                        return "No response from AI";
                    }
                    finishReason = data.choices[0].finish_reason;
                    response = data.choices[0].message.content;
                    if (!streamed && response) {
                        this.logText += response + "  \n";
                    }
                    this.logText += "  \nTotal iterations: " + iterationsCount + "  \n"
                    this.app.llamaWebviewProvider.logInUi(this.logText);
                    if (currentCycleStartTime < this.lastStopRequestTime) {
                        this.app.statusbar.showTextInfo("agent stopped");
                        this.logText += "\n\n" + "Session stopped." + "\n"
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                        this.app.llamaWebviewProvider.setState("AI is stopped")
                        this.resetMessages();
                        return "agent stopped"
                    }
                    this.messages.push(data.choices[0].message);
                    if (finishReason != "tool_calls" && !(data.choices[0].message.tool_calls && data.choices[0].message.tool_calls.length > 0)){
                        this.logText += "  \n" + "Finish reason: " + finishReason
                        if (finishReason?.toLowerCase().trim() == "error" && data.choices[0].error) this.logText += "Error: " + data.choices[0].error.message + "  \n"
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                        break;
                    }
                    let toolCalls:any = data.choices[0].message.tool_calls;
                    if (toolCalls != undefined && toolCalls.length > 0){
                        for (const oneToolCall of toolCalls){
                            if (oneToolCall && oneToolCall.function){
                                this.logText += "  \ntool: " + oneToolCall.function.name + "  \n";
                                if (this.app.configuration.tools_log_calls) this.logText += "  \narguments: " + oneToolCall.function.arguments
                                this.app.llamaWebviewProvider.logInUi(this.logText);
                                let commandOutput = "Tool not found";
                                try {
                                    if (this.app.tools.toolsFunc.has(oneToolCall.function.name)){
                                        const toolFuncDesc = this.app.tools.toolsFuncDesc.get(oneToolCall.function.name);
                                        let commandDescription = ""
                                        if (toolFuncDesc){
                                            commandDescription = await toolFuncDesc(oneToolCall.function.arguments);
                                            this.logText += commandDescription + "\n\n"
                                            this.app.llamaWebviewProvider.logInUi(this.logText);
                                        }   
                                        const toolFunc = this.app.tools.toolsFunc.get(oneToolCall.function.name);
                                        if (toolFunc) {
                                            commandOutput = await toolFunc(oneToolCall.function.arguments);
                                            if (oneToolCall.function.name == "edit_file" && commandOutput != Utils.MSG_NO_UESR_PERMISSION) changedFiles.add(commandDescription);
                                            if (oneToolCall.function.name == "delete_file" && commandOutput != Utils.MSG_NO_UESR_PERMISSION) deletedFiles.add(commandDescription);
                                        }
                                    }
                                    if (this.app.tools.vscodeToolsSelected.has(oneToolCall.function.name)){
                                        let result = await vscode.lm.invokeTool(oneToolCall.function.name,{input: JSON.parse(oneToolCall.function.arguments), toolInvocationToken: undefined})
                                        commandOutput = result.content[0] ? (result.content[0] as { [key: string]: any; }).value : "";;
                                    }
                                } catch (error) {
                                    // Handle the error
                                    console.error("An error occurred:", error);
                                    commandOutput = "Error during the execution of tool: " + oneToolCall.function.name
                                    this.logText += "Error during the execution of tool " + oneToolCall.function.name + ": " + error + "\n\n";
                                    this.app.llamaWebviewProvider.logInUi(this.logText);
                                }

                                if (this.app.configuration.tools_log_calls) this.logText += "result:  \n" + commandOutput + "  \n"
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
                } catch (error) {
                    // Handle the error
                    console.error("An error occurred:", error);
                    this.logText += "An error occurred: " + error + "\n\n";
                    this.app.llamaWebviewProvider.logInUi(this.logText);
                    this.app.llamaWebviewProvider.setState("Error")
                    return "An error occurred: " + error;
                }
            }
            if (changedFiles.size + deletedFiles.size > 0) this.logText += "\n\nFiles changes:  \n"
            if (changedFiles.size > 0) this.logText += Array.from(changedFiles).join("  \n") + "  \n"
            if (deletedFiles.size > 0) this.logText += Array.from(deletedFiles).join("  \n") + "  \n"
            this.logText += "  \nAgent session finished. \n\n"
            this.app.llamaWebviewProvider.logInUi(this.logText);
            this.app.llamaWebviewProvider.setState("AI finished")
            let chat = this.app.menu.getChat()
            if (!this.app.menu.isChatSelected()){
                chat.name = this.logText.slice(0, 25);
                chat.id = Date.now().toString(36);
                chat.description = new Date().toLocaleString() + " " + this.logText.slice(0,150)
            }
            chat.messages = this.messages;
            chat.log = this.logText;
            await this.app.menu.selectUpdateChat(chat)
            
            // Clean up AbortController
            this.abortController = null;
            
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

    private async getItemContext(key: string, value: string) {
        let itemContext = "";
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(key));
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
}