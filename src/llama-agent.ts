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
    private outputChannel: vscode.OutputChannel;
    private lastStopRequestTime = Date.now();
    private parser = new DOMParser();
    private messages: ChatMessage[] = []
    private logText = ""

    constructor(application: Application) {
        this.app = application;
        this.outputChannel = vscode.window.createOutputChannel('Chat With Tools');
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

    run = async (query:string) => {
        await this.askAgent(query);
    }

    askAgent = async (query:string): Promise<string> => {
            let response = ""
            let toolCallsResult: ChatMessage;
            let areFilesChanged = true;
            let finishReason:string|undefined = "tool_calls"
            let commitMessage = query;
            this.logText += query + "\n\n";

            

            let worspaceFolder = "";
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]){
                worspaceFolder = " Project root folder: " + vscode.workspace.workspaceFolders[0].uri.fsPath;
            }
            let recommendation = "Obligatory read the file before editing it with a tool."
            let projectContext = worspaceFolder + "\n" + recommendation;
            query = projectContext + "\n\n" + query;
            
            // let result = await vscode.lm.invokeTool("mcp_playwright_browser_navigate",{input: {url: "https://dir.bg"}, toolInvocationToken: undefined})

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
                
            this.outputChannel.appendLine(query + "\n")
            this.outputChannel.show(); 
            this.logInUi(this.logText);
            
            let currentCycleStartTime = Date.now();
            while (iterationsCount < this.app.extConfig.tools_max_iterations){
                if (currentCycleStartTime < this.lastStopRequestTime) {
                    this.app.statusbar.showTextInfo("agent stopped");
                    return "agent stopped"
                }
                iterationsCount++;
                let data:any = await this.app.llamaServer.getToolsCompletion(this.messages);
                if (!data) {
                    this.outputChannel.appendLine(this.app.extConfig.getUiText("No response from AI")??"")
                    this.logText += "No response from AI" + "\n"
                    this.logInUi(this.logText);
                    this.app.statusbar.showTextInfo("answer ready");
                    return "No response from AI";
                }
                finishReason = data.choices[0].finish_reason;
                response = data.choices[0].message.content;
                this.outputChannel.appendLine(response + "\n")
                this.logText += response + "\n" + "Iteration: " + iterationsCount + "\n"
                this.logInUi(this.logText);
                if (currentCycleStartTime < this.lastStopRequestTime) {
                    this.app.statusbar.showTextInfo("agent stopped");
                    return "agent stopped"
                }
                this.messages.push(data.choices[0].message);
                if (finishReason != "tool_calls") break;
                let toolCalls:any = data.choices[0].message.tool_calls;
                if (toolCalls != undefined && toolCalls.length > 0){
                    for (const oneToolCall of toolCalls){
                        if (oneToolCall && oneToolCall.function){
                            this.outputChannel.appendLine("tool: " + oneToolCall.function.name + "\narguments: " + oneToolCall.function.arguments)
                            this.logText += "\ntool: " + oneToolCall.function.name + "\n";
                            if (this.app.extConfig.tools_log_calls) this.logText += "\narguments: " + oneToolCall.function.arguments
                            this.logInUi(this.logText);
                            let commandOutput = "Tool not found";
                            if (this.app.tools.toolsFunc.has(oneToolCall.function.name)){
                                const toolFuncDesc = this.app.tools.toolsFuncDesc.get(oneToolCall.function.name);
                                if (toolFuncDesc){
                                    this.logText += await toolFuncDesc(oneToolCall.function.arguments);
                                    this.logText += "\n\n"
                                    this.logInUi(this.logText);
                                }   
                                const toolFunc = this.app.tools.toolsFunc.get(oneToolCall.function.name);
                                if (toolFunc) {
                                    commandOutput = await toolFunc(oneToolCall.function.arguments);
                                    if (oneToolCall.function.name == "edit_file" || oneToolCall.function.name == "delete_file") areFilesChanged = true;
                                }
                            }
                            if (this.app.tools.vscodeToolsSelected.has(oneToolCall.function.name)){
                                let result = await vscode.lm.invokeTool(oneToolCall.function.name,{input: JSON.parse(oneToolCall.function.arguments), toolInvocationToken: undefined})
                                commandOutput = result.content[0] ? (result.content[0] as { [key: string]: any; }).value : "";;
                            }
                            this.outputChannel.appendLine("result: " + commandOutput)
                            if (this.app.extConfig.tools_log_calls) this.logText += "result: \n" + commandOutput + "\n"
                            this.logInUi(this.logText);
                            toolCallsResult = {           
                                        "role": "tool",
                                        "tool_call_id": oneToolCall.id,
                                        "content": commandOutput
                                    }
                            this.messages.push(toolCallsResult)
                        }
                    }
                }
            }
            this.logText += "\n\n AI with tools session finished. \n\n"
            if (areFilesChanged){
                //Commiting a checkpoint in shadow git
                await this.app.shadowGit.addChanges();
                this.app.shadowGit.git?.commit((new Date).toISOString() + " " + commitMessage);
            }
            this.logInUi(this.logText);
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

    private logInUi(logText: string) {
        vscode.commands.executeCommand('llama-vscode.webview.postMessage', {
            command: 'updateText',
            text: logText
        });
    }
}