import * as vscode from 'vscode';
import {Application} from "./application";
import * as fs from 'fs';
import path from "path";
import { EventHook, EventResult } from './types';
import { HooksEvents } from './constants';

export class Hooks {
    private app: Application
    eventlogs: string[] = []

    constructor(application: Application) {
        this.app = application;
    }

    getHooks = (hooksFolder: string): Map<string, EventHook[]> => {
        let hooks: Map<string, any[]> = new Map();

        if (fs.existsSync(hooksFolder)) {
            const files = fs.readdirSync(hooksFolder).filter(file => file.toLowerCase().endsWith(".json"));
            for (const file of files) {
                try {
                    const filePath = path.join(hooksFolder, file);
                    const content = fs.readFileSync(filePath, "utf-8");
                    const parsed = JSON.parse(content);
                    if (parsed && parsed.hooks) {
                        for (const [event, eventHooks] of Object.entries(parsed.hooks)) {
                            if (!Array.isArray(eventHooks)) continue;
                            if (!hooks.has(event)) {
                                hooks.set(event, []);
                            }
                            hooks.get(event)!.push(...eventHooks);
                        }
                    }
                } catch (error) {
                    console.error(`Failed to load hooks file ${file}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }

        return hooks;
    }

    executeHook = async (script: string, data: any): Promise<string> => {
        let result = "Success"
        
        result = (await this.app.dslInterpreter.execute(script)).toString()

        return result
    }

    processHooks = async (hooks: EventHook[], data: any, eventName: string, toolName: string): Promise<EventResult> => {
        let eventResult: EventResult = {stopSession: false, stopTool: false, resultInfo: ""}
        const dataMap = new Map<string, any>(Object.entries(data));
        let setVarsScript = "set eventName " + eventName
        setVarsScript += "\nset toolName " + toolName
        for (const [key, value] of dataMap) {
            setVarsScript += "\nset " + key + " getEventInput " + key
        }
        setVarsScript += "\n"
        this.app.dslCommands.setEventInput(dataMap);
        for (const hook of hooks) {
            const regex = new RegExp(hook.matcher);
            if (!regex.test(toolName)) continue
            let executionScript = hook.script
            if (fs.existsSync(hook.script)) {
                executionScript = fs.readFileSync(hook.script, 'utf8')
            }
            const result = await this.executeHook(setVarsScript + executionScript, data)
            eventResult.resultInfo += '\n' + result
            if (result.toLowerCase().startsWith("stop session")) {
                eventResult.stopSession = true
                eventResult.stopTool = true
                break
            }
            if (result.toLowerCase().startsWith("stop") && eventName == HooksEvents.preToolUse) {
                eventResult.stopTool = true
                break
            }
        }

        return eventResult
    }

}
