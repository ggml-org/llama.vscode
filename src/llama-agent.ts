import {Application} from "./application";
import { ChatMessage } from "./llama-server";
import * as vscode from 'vscode';
import { Utils } from "./utils"
import { DOMParser } from 'xmldom';

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

    constructor(application: Application) {
        this.app = application;
        this.resetMessages();
    }

    resetMessages = () => {
        this.messages = [
                            {
                                "role": "system",
                                "content": this.app.prompts.TOOLS_SYSTEM_PROMPT_ACTION
                            }
                        ];
        this.logText = "";
    }

    addContextProjectFile = (fileLongName: string, fileShortName: string) => {
        this.contexProjectFiles.set(fileLongName, fileShortName);
    }

    removeContextProjectFile = (fileLongName: string) => {
        this.contexProjectFiles.delete(fileLongName);
    }

    getContextProjectFile = () => {
        return this.contexProjectFiles;
    }

    run = async (query:string) => {
        await this.askAgent(query);
    }

    askAgent = async (query:string): Promise<string> => {
            let response = ""
            let toolCallsResult: ChatMessage;
            let finishReason:string|undefined = "tool_calls"
            this.logText += query + "\n\n";
            
            if (!this.app.menu.isToolsModelSelected()) {
                vscode.window.showErrorMessage("Error: Tools model is not selected! Select tools model (or orchestra with tools model) if you want to to use Llama Agent.")
                this.app.llamaWebviewProvider.setState("AI is stopped")
                return "Tools model is not selected"
            }

            let worspaceFolder = "";
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]){
                worspaceFolder = " Project root folder: " + vscode.workspace.workspaceFolders[0].uri.fsPath;
            }
            let recommendation = "Obligatory read the file before editing it with a tool."
            let projectContext = worspaceFolder + "\n" + recommendation;
            query = projectContext + "\n\n" + query;
            
            if (this.contexProjectFiles.size > 0){
                query += "\n\nBelow is the content of some files, which the user has attached as a context."
                for (const [key, value] of this.contexProjectFiles) {
                    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(key));
                    let parts = value.split("|")
                    if (parts.length == 1) {
                        query += "\n\nFile " + key + ":\n\n" + document.getText().slice(0, this.app.configuration.rag_max_context_file_chars) 
                    } else {
                        let firstLine = parseInt(parts[1]);
                        let lastLine = parseInt(parts[2]);
                        let fileContent = document.getText().split(/\r?\n/).slice(firstLine - 1, lastLine).join("\n");
                        query += "\n\nFile " + key + " content from line " + firstLine + " to line " + lastLine + " (one based):\n\n" + fileContent.slice(0, this.app.configuration.rag_max_context_file_chars)
                    }
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
            while (iterationsCount < this.app.configuration.tools_max_iterations){
                if (currentCycleStartTime < this.lastStopRequestTime) {
                    this.app.statusbar.showTextInfo("agent stopped");
                    this.logText += "\n\n" + "Session stopped." + "\n"
                    this.app.llamaWebviewProvider.logInUi(this.logText);
                    this.app.llamaWebviewProvider.setState("AI is stopped")
                    return "agent stopped"
                }
                iterationsCount++;
                try {
                    let data:any = await this.app.llamaServer.getToolsCompletion(this.messages);
                    if (!data) {
                        this.logText += "No response from AI" + "\n"
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                        this.app.llamaWebviewProvider.setState("AI not responding")
                        return "No response from AI";
                    }
                    finishReason = data.choices[0].finish_reason;
                    response = data.choices[0].message.content;
                    this.logText += response + "\n" + "Total iterations: " + iterationsCount + "\n"
                    this.app.llamaWebviewProvider.logInUi(this.logText);
                    if (currentCycleStartTime < this.lastStopRequestTime) {
                        this.app.statusbar.showTextInfo("agent stopped");
                        this.logText += "\n\n" + "Session stopped." + "\n"
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                        this.app.llamaWebviewProvider.setState("AI is stopped")
                        return "agent stopped"
                    }
                    this.messages.push(data.choices[0].message);
                    if (finishReason != "tool_calls" && !(data.choices[0].message.tool_calls && data.choices[0].message.tool_calls.length > 0)){
                        this.logText += "\n\n" + "Finish reason: " + finishReason + "\n"
                        if (finishReason?.toLowerCase().trim() == "error" && data.choices[0].error) this.logText += "Error: " + data.choices[0].error.message + "\n"
                        this.app.llamaWebviewProvider.logInUi(this.logText);
                        break;
                    }
                    let toolCalls:any = data.choices[0].message.tool_calls;
                    if (toolCalls != undefined && toolCalls.length > 0){
                        for (const oneToolCall of toolCalls){
                            if (oneToolCall && oneToolCall.function){
                                this.logText += "\ntool: " + oneToolCall.function.name + "\n";
                                if (this.app.configuration.tools_log_calls) this.logText += "\narguments: " + oneToolCall.function.arguments
                                this.app.llamaWebviewProvider.logInUi(this.logText);
                                let commandOutput = "Tool not found";
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
                                if (this.app.configuration.tools_log_calls) this.logText += "result: \n" + commandOutput + "\n"
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
            if (changedFiles.size + deletedFiles.size > 0) this.logText += "\n\nFiles changes:\n"
            if (changedFiles.size > 0) this.logText += Array.from(changedFiles).join("\n") + "\n"
            if (deletedFiles.size > 0) this.logText += Array.from(deletedFiles).join("\n") + "\n"
            this.logText += "\n\nAgent session finished. \n\n"
            this.app.llamaWebviewProvider.logInUi(this.logText);
            this.app.llamaWebviewProvider.setState("AI finished")
            return response;
        }  
        
    stopAgent = () => {
        this.lastStopRequestTime = Date.now();
    }

    getStepContext = (plan: Step[]) => {
        let context = "";
        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];
            if (step.result && step.state.toLowerCase() == "done") {
                context = "Result from task - " + step.description + ":\n" + step.result + "\n\n";
            }
        }
        return context;
    }

    getProgress = (plan: Step[]) => {
        let progress = "";
        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];
            progress = "Step " + step.id + " :: " + step.description + " :: " + " :: " + step.state + "\n";
        }
        return progress;
    }
}