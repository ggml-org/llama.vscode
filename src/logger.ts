import * as vscode from 'vscode';
import {Application} from "./application";

export class Logger {
    private app: Application
    private readonly outputChannel: vscode.OutputChannel
    eventlogs: string[] = []

    constructor(application: Application) {
        this.app = application;
        this.outputChannel = vscode.window.createOutputChannel('llama-vscode');
    }

    addEventLog = (group: string, event: string, details: string) => {
        const logEntry = Date.now() + ", " + group + ", " + event + ", " + details.replace(",", " ");
        this.eventlogs.push(logEntry);
        this.outputChannel.appendLine(logEntry);
        if (this.eventlogs.length > this.app.configuration.MAX_EVENTS_IN_LOG) {
            this.eventlogs.shift();
        }
    }

    show = () => {
        this.outputChannel.show(true);
    }
}
