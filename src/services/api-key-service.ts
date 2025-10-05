
import * as fs from 'fs';
import * as path from 'path';
import { Application } from "../application";
import { Chat } from "../types";
import { PERSISTENCE_KEYS, UI_TEXT_KEYS } from "../constants";
import vscode, { QuickPickItem } from "vscode";
import { Utils } from '../utils';

export class ApiKeyService {
    private app: Application;

    constructor(application: Application) {
        this.app = application;
    }

    public getApiKeyActions(): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.addAPIKey) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.editDeleteAPIKey) ?? ""
            },
        ];
    }

    processApiKeyActions = async (selected:vscode.QuickPickItem) => {
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.editDeleteAPIKey):
                const apiKeysMap = this.app.persistence.getAllApiKeys();
                const apiKeysQuickPick = Array.from(apiKeysMap.entries()).map(([key, value]) => ({
                                            label: key,
                                            description: "..." + value.slice(-5)
                                        }));
                const selectedItem = await vscode.window.showQuickPick(apiKeysQuickPick);
                if (selectedItem) {
                    let result = await vscode.window.showInputBox({
                            placeHolder: 'Enter your new api key for ' + selectedItem.label + ". Leave empty to remove it.",
                            prompt: 'your api key',
                            value: ''
                        })
                    result = this.app.modelService.sanitizeInput(result || '');
                    if (!result || result === "") this.app.persistence.deleteApiKey(selectedItem.label);
                    else this.app.persistence.setApiKey(selectedItem.label, result);
                }
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addAPIKey) ?? "":
                let endpoint = await vscode.window.showInputBox({
                            placeHolder: 'Enter the endpoint, exactly as in the model',
                            prompt: 'Endpoint (url)',
                            value: ''
                        })
                endpoint = this.app.modelService.sanitizeInput(endpoint || '');
                let apiKey = await vscode.window.showInputBox({
                            placeHolder: 'Enter your new api key for ' + endpoint,
                            prompt: 'your api key',
                            value: ''
                        })
                apiKey = this.app.modelService.sanitizeInput(apiKey || '');
                if (endpoint && apiKey) 
                    {
                        this.app.persistence.setApiKey(endpoint, apiKey);
                        vscode.window.showInformationMessage("Api key is added.")
                    }
                else vscode.window.showErrorMessage("API key was not added. Please provide both endpoint and API key.")
                break;
        }
    }
}
