import * as vscode from "vscode";
import { QuickPickItem } from "vscode";
import { Application } from "../application";
import { IAddStrategy, LlmModel, ModelTypeDetails } from "../types";
import { Utils } from "../utils";
import * as axios from "axios";
import { OPENAI_COMP_PROVIDERS, OpenAiProvidersKeys, SETTING_TO_MODEL_TYPE } from "../constants";

interface OpenAiCompModel {
    name: string;
    id: string;
    description: string;
    context_length: string;
    pricing: {
        completion: number;
        prompt: number;
    }
}

export class OpenAiCompModelStrategy implements IAddStrategy {
    private app: Application;

    constructor(app: Application) {
        this.app = app;
    }

    add = async (details: ModelTypeDetails): Promise<void> => {
        const modelType = SETTING_TO_MODEL_TYPE[details.modelsListSettingName];
        const openAiCompProviders: QuickPickItem[] = [];
        for (const [key, value] of Object.entries(OPENAI_COMP_PROVIDERS)) {
                openAiCompProviders.push({
                    label: key,
                    description: value
                });
        }
        const selProvider = await vscode.window.showQuickPick(openAiCompProviders);
        if (selProvider && selProvider.label) {
            //if custom - ask for endpoint
            let endpoint = selProvider.description??""
            let isKeyRequired = true;
            if (selProvider.label == OpenAiProvidersKeys.Custom){
                endpoint = await vscode.window.showInputBox({
                    placeHolder: 'endpoint (URL to the API) of an OpenAI compatible provider',
                    prompt: 'example: http://localhost:8080 or https://openrauter.ai/api'
                })??""
                isKeyRequired = await Utils.confirmAction(`Is API key required for this endpoint (${endpoint})?`, "");
            } 
            if (!endpoint){
                vscode.window.showWarningMessage("Endpoint is not provided!")
                return;
            }
            const providerModels: QuickPickItem[] = [];
            const models = await this.getModels(endpoint);
            if (models.length == 0) {
                vscode.window.showInformationMessage("No models are found.")
                return
            }
            for (let mdl of models) {
                providerModels.push({
                    label: mdl.name,
                    description: mdl.context_length + " context | $" + (mdl.pricing?.prompt*1000000).toFixed(2) + "/M input tokens | $" + (mdl.pricing?.completion*1000000).toFixed(2) + "/M output tokens",
                    detail: mdl.description + " | "+ mdl.id,
                });
            }
            const selModel = await vscode.window.showQuickPick(providerModels);
            if (!selModel){
                vscode.window.showWarningMessage("No model is selected!")
                return;
            }
            let aiModel = selModel.detail
            if(aiModel) aiModel = aiModel.split("|").slice(-1)[0]?.trim()
            let provider = selProvider.label
            if (provider.endsWith("...")) provider = provider.slice(0,-3)
            let newModel: LlmModel = {
                name: provider + ": " + selModel.label,
                localStartCommand: "",
                endpoint: endpoint,
                aiModel: aiModel == "undefined" ? "" : aiModel??"",
                isKeyRequired: isKeyRequired
            };

            const shouldAddModel = await Utils.confirmAction("You have entered:",
                this.getModelDetailsAsString(newModel) +
                "\n\nDo you want to add a model with these properties?"
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
                vscode.window.showInformationMessage("The model is added: " + newModel.name)
                const shouldSelect = await Utils.confirmAction("Do you want to select/start the newly added model?", "");
                if (shouldSelect) {
                    await this.app.modelService.selectStartModel(newModel, modelType, details);
                }
            }
        }
    }

    private async getModels(endpoint: string): Promise<OpenAiCompModel[]> {
        let hfEndpoint = Utils.trimTrailingSlash(endpoint) +"/v1/models";
        try {
            let result = await axios.default.get(
                `${Utils.trimTrailingSlash(hfEndpoint)}`
            );
            let models: OpenAiCompModel[] = [];
        
            let modelsList: OpenAiCompModel[] = []
            if (result && result.data && result.data.models) modelsList = result.data.models
            else if (result && result.data && result.data.data) modelsList = result.data.data
            if (modelsList.length > 0){
                for(let mdl of modelsList){
                    models.push(mdl)
                }
            }
            
            return models;
        } catch (error){
            vscode.window.showErrorMessage("Error getting provider models): " + error)
            return [];
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
        return "name: " + model.name +
            "\nlocal start command: " + model.localStartCommand +
            "\nendpoint: " + model.endpoint +
            "\nmodel name for provider: " + model.aiModel +
            "\napi key required: " + model.isKeyRequired
    }
}