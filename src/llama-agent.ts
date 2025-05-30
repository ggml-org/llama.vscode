import {Application} from "./application";
import { ChatMessage } from "./llama-server";
import * as vscode from 'vscode';
import { Utils } from "./utils"

export class LlamaAgent {
    private app: Application
    private outputChannel: vscode.OutputChannel;
    private lastStopRequestTime = Date.now();

    constructor(application: Application) {
        this.app = application;
        this.outputChannel = vscode.window.createOutputChannel('Chat With Tools');
    }

    run = async (query:string) => {
            let response = ""
            let toolCallsResult: ChatMessage;
            let finishReason:string|undefined = "tool_calls"
            let filesFromQuery = this.app.chatContext.getFilesFromQuery(query)
            for (const fileName of filesFromQuery){
                let absPath = await Utils.getAbsolutePath(fileName);
                if (absPath != undefined) query = query.replace("@" + fileName, absPath)
            }

            let messages: ChatMessage[] = [
                            {
                                "role": "system",
                                "content": this.app.prompts.TOOLS_SYSTEM_PROMPT
                            },
                            {
                                "role": "user",
                                "content": query
                            }
                        ]

            let iterationsCount = 0;        
            this.outputChannel.appendLine(query + "\n")
            this.outputChannel.show();
            // this.app.statusbar.showThinkingInfo();
            // this.app.statusbar.showTextInfo("thinking with tools...");
            let currentCycleStartTime = Date.now();
            while (iterationsCount < this.app.extConfig.MAX_TOOLS_ITERATIONS){
                if (currentCycleStartTime < this.lastStopRequestTime) {
                    this.app.statusbar.showTextInfo("agent stopped");
                    return
                }
                iterationsCount++;
                let data:any = await this.app.llamaServer.getToolsCompletion(messages);
                if (!data) {
                    this.outputChannel.appendLine("No response from AI")
                    vscode.window.showInformationMessage('No response from AI');
                    this.app.statusbar.showTextInfo("answer ready");
                    return [];
                }
                finishReason = data.choices[0].finish_reason;
                response = data.choices[0].message.content;
                this.outputChannel.appendLine(response + "\n")
                if (currentCycleStartTime < this.lastStopRequestTime) {
                    this.app.statusbar.showTextInfo("agent stopped");
                    return
                }
                if (finishReason != "tool_calls") break;
                messages.push(data.choices[0].message);
                let toolCalls:any = data.choices[0].message.tool_calls;
                if (toolCalls != undefined && toolCalls.length > 0){
                    for (const oneToolCall of toolCalls){
                        if (oneToolCall && oneToolCall.function){
                            this.outputChannel.appendLine("tool: " + oneToolCall.function.name + "\narguments: " + oneToolCall.function.arguments)
                            let commandOutput = "Tool not found";
                            if (this.app.tools.toolsFunc.has(oneToolCall.function.name)){
                                const toolFunc = this.app.tools.toolsFunc.get(oneToolCall.function.name);
                                if (toolFunc) commandOutput = await toolFunc(oneToolCall.function.arguments);
                            }
                            this.outputChannel.appendLine("result: " + commandOutput)
                            toolCallsResult = {           
                                        "role": "tool",
                                        "tool_call_id": oneToolCall.id,
                                        "content": commandOutput
                                    }
                            messages.push(toolCallsResult)
                        }
                    }
                }
            }
            this.app.statusbar.showTextInfo("answer ready");
        }  
        
        stopAgent = () => {
            this.lastStopRequestTime = Date.now();
        }
}