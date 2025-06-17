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

    constructor(application: Application) {
        this.app = application;
        this.outputChannel = vscode.window.createOutputChannel('Chat With Tools');
    }

    run = async (query:string) => {
        let aiAnswer = "";
        let goal = ""
        const plan: Step[] = [];
        // TODO
        // Accept query as a goal and clarify it (new tool for asking the user is needed)
        aiAnswer = await this.askAgent(this.app.prompts.replaceOnePlaceholders(this.app.prompts.TOOLS_ANALYSE_GOAL, "goal", query));
        let xmlDoc:Document = this.parser.parseFromString(aiAnswer, "text/xml");
        const goalElement = xmlDoc.getElementsByTagName('goal')[0];
        if (goalElement) {
            const goalText = goalElement.textContent?.trim();
            goal = goalText??"";
        } else {
            goal = 'No <goal> element found in the XML';
        }
        // Create a plan 
        aiAnswer = await this.askAgent(this.app.prompts.replaceOnePlaceholders(this.app.prompts.TOOLS_CREATE_PLAN, "goal", goal));
        xmlDoc = this.parser.parseFromString(aiAnswer, "text/xml");
        const stepElements = xmlDoc.getElementsByTagName('step');
        if (stepElements) {
            for (let i = 0; i < stepElements.length; i++) {
                const stepText = stepElements[i].textContent?.trim();
                if (stepText) {
                    let stepParts = stepText.split("::");
                    plan.push({id: stepParts[0], description: stepParts[1], expectedResult: stepParts[2], state: ""});
                }
            }
        }

        let context = "";
        for (let i = 0; i < plan.length; i++){
            const step = plan[i];
            if (step.result && step.state.toLowerCase() == "done"){
                context = "Result from task - " + step.description + ":\n" + step.result + "\n\n"
            }
        }

        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];
            aiAnswer = await this.askAgent(this.app.prompts.replacePlaceholders(this.app.prompts.TOOLS_EXECUTE_STEP, {"context": context, "task": step.description, "expected_result": step.expectedResult}));
            let xmlDoc:Document = this.parser.parseFromString(aiAnswer, "text/xml");
            const taskState = xmlDoc.getElementsByTagName('state')[0];
            if (taskState) {
                const stateText = taskState.textContent?.trim();
                step.state = stateText??"";
            } else {
                step.state = '';
            }
            const taskResult = xmlDoc.getElementsByTagName('result')[0];
            if (taskResult) {
                const resultText = taskResult.textContent?.trim();
                step.result = resultText??"";
            } else {
                step.result = '';
            }
        }
        // Save the plan in a structure
        // Execute the plan step by step
        // For each step:
        //  Execute the step, save the result of the step in a structure
        //  make it possible to get the results of the actions, which are done with a new tool
        this.app.statusbar.showTextInfo("answer ready");
    }

    askAgent = async (query:string): Promise<string> => {
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
                                "content": this.app.prompts.TOOLS_SYSTEM_PROMPT_ACTION
                            },
                            {
                                "role": "user",
                                "content": query
                            }
                        ]

            let iterationsCount = 0;        
            this.outputChannel.appendLine(query + "\n")
            this.outputChannel.show(); 
            
            let currentCycleStartTime = Date.now();
            while (iterationsCount < this.app.extConfig.MAX_TOOLS_ITERATIONS){
                if (currentCycleStartTime < this.lastStopRequestTime) {
                    this.app.statusbar.showTextInfo("agent stopped");
                    return "agent stopped"
                }
                iterationsCount++;
                let data:any = await this.app.llamaServer.getToolsCompletion(messages);
                if (!data) {
                    this.outputChannel.appendLine(this.app.extConfig.getUiText("No response from AI")??"")
                    this.app.statusbar.showTextInfo("answer ready");
                    return "No response from AI";
                }
                finishReason = data.choices[0].finish_reason;
                response = data.choices[0].message.content;
                this.outputChannel.appendLine(response + "\n")
                if (currentCycleStartTime < this.lastStopRequestTime) {
                    this.app.statusbar.showTextInfo("agent stopped");
                    return "agent stopped"
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
            return response;
        }  
        
        stopAgent = () => {
            this.lastStopRequestTime = Date.now();
        }
}