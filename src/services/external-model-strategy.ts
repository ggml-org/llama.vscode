import * as vscode from "vscode";
import { QuickPickItem } from "vscode";
import { Application } from "../application";
import { IAddStrategy, LlmModel, ModelTypeDetails } from "../types";
import { Utils } from "../utils";
import * as axios from "axios";
import { ModelType, UI_TEXT_KEYS, HF_MODEL_TEMPLATES, SETTING_TO_MODEL_TYPE, MODEL_TYPE_CONFIG } from "../constants";
import * as path from "path";
import * as fs from "fs";
import { Configuration } from "../configuration";


export class ExternalModelStrategy implements IAddStrategy {
    private app: Application;

    constructor(app: Application) {
        this.app = app;
    }

    async add(details: ModelTypeDetails): Promise<void> {
        const hostEndpoint = "http://" + details.newModelHost;
        let name = await Utils.getValidatedInput(
            'name for your model (required)',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'Enter a user friendly name for your model (required)',
                value: ''
            }
        );
        if (name === undefined) {
            vscode.window.showInformationMessage("Model addition cancelled.");
            return;
        }
        name = this.sanitizeInput(name);

        let endpoint = await Utils.getValidatedInput(
            'Endpoint for your model (required)',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'Endpoint for accessing your model, i.e. ' + hostEndpoint + ':' + details.newModelPort + ' or https://openrouter.ai/api (required)',
                value: ''
            }
        );
        if (endpoint === undefined) {
            vscode.window.showInformationMessage("Model addition cancelled.");
            return;
        }
        endpoint = this.sanitizeInput(endpoint);
        let aiModel = await vscode.window.showInputBox({
            placeHolder: 'Model name, exactly as expected by the provider, i.e. kimi-latest ',
            prompt: 'Enter model name as expected by the provider (leave empty if llama-server is used)',
            value: ''
        });
        aiModel = this.sanitizeInput(aiModel || '');
        const isKeyRequired = await Utils.confirmAction(`Is API key required for this endpoint (${endpoint})?`, "");
        let newModel: LlmModel = {
            name: name,
            localStartCommand: "",
            endpoint: endpoint,
            aiModel: aiModel,
            isKeyRequired: isKeyRequired
        };

        const shouldAddModel = await Utils.confirmAction("You have entered:",
            "\nname: " + name +
            "\nlocal start command: " +
            "\nendpoint: " + endpoint +
            "\nmodel name for provider: " + aiModel +
            "\napi key required: " + isKeyRequired +
            "\nDo you want to add a model with these properties?"
        );

        if (shouldAddModel) {
            let shouldOverwrite = false;
            [newModel.name, shouldOverwrite] = await this.getUniqueModelName(details.modelsList, newModel);
            if (!newModel.name) {
                vscode.window.showInformationMessage("The model was not added as the name was not provided.")
                return;
            }
            if (shouldOverwrite) {
                const index = details.modelsList.findIndex(model => model.name === newModel.name);
                if (index !== -1) {
                    details.modelsList.splice(index, 1);
                }
            }
            details.modelsList.push(newModel);
            this.app.configuration.updateConfigValue(details.modelsListSettingName, details.modelsList);
            vscode.window.showInformationMessage("The model is added.")
        }
    }

    private sanitizeInput(input: string): string {
        return input ? input.trim() : '';
    }

    private async getUniqueModelName(modelsList: LlmModel[], newModel: LlmModel): Promise<[string, boolean]> {
        let uniqueName = newModel.name;
        let shouldOverwrite = false;
        let modelSameName = modelsList.find(model => model.name === uniqueName);
        while (uniqueName && !shouldOverwrite && modelSameName !== undefined) {
            shouldOverwrite = await Utils.confirmAction("A model with the same name already exists. Do you want to overwrite the existing model?",
                "Existing model:\n" +
                this.getModelDetailsAsString(modelSameName) +
                "\n\nNew model:\n" +
                this.getModelDetailsAsString(newModel)
            );
            if (!shouldOverwrite) {
                uniqueName = (await vscode.window.showInputBox({
                    placeHolder: 'a unique name for your new model',
                    prompt: 'Enter a unique name for your new model. Leave empty to cancel entering.',
                    value: newModel.name
                })) ?? "";
                uniqueName = this.sanitizeInput(uniqueName);
                if (uniqueName) modelSameName = modelsList.find(model => model.name === uniqueName);
            }
        }

        return [uniqueName, shouldOverwrite]
    }

    private getModelDetailsAsString(model: LlmModel): string {
        return "model: " +
            "\nname: " + model.name +
            "\nlocal start command: " + model.localStartCommand +
            "\nendpoint: " + model.endpoint +
            "\nmodel name for provider: " + model.aiModel +
            "\napi key required: " + model.isKeyRequired
    }
}