import * as crypto from 'crypto';
import { Application } from './application';
import * as vscode from "vscode"


export class Persistence {
    private uniquePrefix: string = "llama.vscode.";
    private apiKeysMapPrefix: string = "apiKeys.";
    private context: vscode.ExtensionContext;
    private app: Application

    constructor(app: Application, context: vscode.ExtensionContext) {
        this.context = context;
        this.app = app;
    }

    getApiKey = (endpoint: string): string | undefined => {
        return this.context.globalState.get(this.uniquePrefix + this.apiKeysMapPrefix + endpoint) as string
    }
    
    setApiKey = (endpoint: string, apiKey: string) => {
        this.context.globalState.update(this.uniquePrefix + this.apiKeysMapPrefix +  endpoint, apiKey);        
    }
    
    deleteApiKey = (endpoint: string) => {
        this.context.globalState.update(this.uniquePrefix + this.apiKeysMapPrefix +  endpoint, undefined);      
    }

    getAllApiKeys = (): Map<string, string> => {
        const apiKeys = this.context.globalState.keys().filter(key => key.startsWith(this.uniquePrefix + this.apiKeysMapPrefix));
        let apiKeysMap = new Map<string,string>();
        for (let key of apiKeys){
            apiKeysMap.set(key.slice((this.uniquePrefix + this.apiKeysMapPrefix).length), this.context.workspaceState.get(key)??"")
        }
        return apiKeysMap;
    }

    setValue = async (key: string, value: any) => {
        await this.context.workspaceState.update(this.uniquePrefix + key, value);
    }

    getValue = (key: string): any => {
        return this.context.workspaceState.get(this.uniquePrefix + key);
    }

    deleteValue = (key: string) => {
        this.context.workspaceState.update(this.uniquePrefix + key, undefined);
    }

    setGlobalValue = async (key: string, value: any) => {
        await this.context.globalState.update(this.uniquePrefix + key, value);
    }

    getGlobalValue = (key: string): any => {
        return this.context.globalState.get(this.uniquePrefix + key);
    }

    deleteGlobalValue = (key: string) => {
        this.context.globalState.update(this.uniquePrefix + key, undefined);
    }
}
