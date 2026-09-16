import * as vscode from "vscode";
import { QuickPickItem } from "vscode";
import { Application } from "../application";
import { IAddStrategy, LlmModel, ModelTypeDetails } from "../types";
import { Utils } from "../utils";
import * as axios from "axios";
import { OPENAI_COMP_PROVIDERS, OpenAiProvidersKeys, SETTING_TO_MODEL_TYPE } from "../constants";
import { ServiceUtils } from "./service-utils";

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
                    prompt: 'example: http://localhost:8080 or https://openrouter.ai/api'
                })??""
                isKeyRequired = await this.app.dialogs.confirmAction(`Is API key required for this endpoint (${endpoint})?`, "");
            }
            if (!endpoint){
                vscode.window.showWarningMessage("Endpoint is not provided!")
                return;
            }
            const providerModels: QuickPickItem[] = [];
            const models = await this.getModels(endpoint, isKeyRequired);
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

            const shouldAddModel = await this.app.dialogs.confirmAction("You have entered:",
                ServiceUtils.getModelDetailsAsString(newModel) +
                "\n\nDo you want to add a model with these properties?"
            );

            if (shouldAddModel) {
                await ServiceUtils.addPersistModel(newModel, details, this.app);
            }
        }
    }

    private async getModels(endpoint: string, isKeyRequired: boolean): Promise<OpenAiCompModel[]> {
        const hfEndpoint = Utils.trimTrailingSlash(endpoint) + "/v1/models";

        // Create a request configuration
        let requestConfig: any = {};

        if (isKeyRequired) {
            // We get the saved key for this specific endpoint
            const apiKey = this.app.persistence.getApiKey(endpoint);
            if (apiKey) {
                requestConfig = {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                };
            }
        }

        try {
            const result = await axios.default.get(
                `${Utils.trimTrailingSlash(hfEndpoint)}`,
                requestConfig
            );

            let models: OpenAiCompModel[] = [];
            let modelsList: OpenAiCompModel[] = [];

            if (result && result.data && result.data.models) modelsList = result.data.models;
            else if (result && result.data && result.data.data) modelsList = result.data.data;

            if (modelsList.length > 0) {
                for (let mdl of modelsList) {
                    models.push(mdl);
                }
            }

            return models;
        } catch (error) {
            vscode.window.showErrorMessage("Error getting provider models: " + error);
            return [];
        }
    }
}