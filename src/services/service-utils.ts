import { Application } from "../application";
import { LlmModel, ModelTypeDetails } from "../types";
import * as vscode from "vscode";

export class ServiceUtils {


    static addPersistModel = async (newModel: LlmModel, details: ModelTypeDetails, app: Application) => {
        let shouldOverwrite = false;
        [newModel.name, shouldOverwrite] = await ServiceUtils.getUniqueModelName(details.modelsList, newModel, app);
        if (!newModel.name) {
            vscode.window.showInformationMessage("The model was not added as the name was not provided.");
        } else {
            if (shouldOverwrite) {
                const index = details.modelsList.findIndex(model => model.name === newModel.name);
                if (index !== -1) {
                    details.modelsList.splice(index, 1);
                }
            }
            details.modelsList.push(newModel);
            app.configuration.updateConfigValue(details.modelsListSettingName, details.modelsList);
            vscode.window.showInformationMessage("The model is added: " + newModel.name);
            const shouldSelect = await app.dialogs.confirmAction("Do you want to select/start the newly added model?", "");
            if (shouldSelect && details.modelType) {
                await app.modelService.selectStartModel(newModel, details.modelType, details);
            }
        }
    }

    static getUniqueModelName =  async (modelsList: LlmModel[], newModel: LlmModel, app: Application): Promise<[string, boolean]> => {
        let uniqueName = newModel.name;
        let shouldOverwrite = false;
        let modelSameName = modelsList.find(model => model.name === uniqueName);
        while (uniqueName && !shouldOverwrite && modelSameName !== undefined) {
            shouldOverwrite = await app.dialogs.confirmAction("A model with the same name already exists. Do you want to overwrite the existing model?",
                "Existing model:\n" +
                ServiceUtils.getModelDetailsAsString(modelSameName) +
                "\n\nNew model:\n" +
                ServiceUtils.getModelDetailsAsString(newModel)
            );
            if (!shouldOverwrite) {
                uniqueName = (await vscode.window.showInputBox({
                    placeHolder: 'a unique name for your new model',
                    prompt: 'Enter a unique name for your new model. Leave empty to cancel entering.',
                    value: newModel.name
                })) ?? "";
                uniqueName = ServiceUtils.sanitizeInput(uniqueName);
                if (uniqueName) modelSameName = modelsList.find(model => model.name === uniqueName);
            }
        }

        return [uniqueName, shouldOverwrite]
    }

    static getModelDetailsAsString = (model: LlmModel): string => {
        return "model: " +
            "\nname: " + model.name +
            "\nlocal start command: " + model.localStartCommand +
            "\nendpoint: " + model.endpoint +
            "\nmodel name for provider: " + model.aiModel +
            "\napi key required: " + model.isKeyRequired
    }

    static sanitizeInput = (input: string): string => {
        return input ? input.trim() : '';
    }
}