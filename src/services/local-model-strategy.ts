
import * as vscode from "vscode";
import { Application } from "../application";
import { IAddStrategy, LlmModel, ModelTypeDetails } from "../types";
import { Utils } from "../utils";

export class LocalModelStrategy implements IAddStrategy {
    private app: Application;

    constructor(app: Application) {
        this.app = app;
    }

    async add(details: ModelTypeDetails): Promise<void> {
        const hostEndpoint = "http://" + details.newModelHost;
        const modelListToLocalCommand = new Map([
            ["completion_models_list", "llama-server -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF> -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 --port " + details.newModelPort + " --host " + details.newModelHost],
            ["chat_models_list", 'llama-server -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF> -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port ' + details.newModelPort + " --host " + details.newModelHost],
            ["embeddings_models_list", "llama-server -hf <model name from hugging face, i.e: ggml-org/Nomic-Embed-Text-V2-GGUF> -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port " + details.newModelPort + " --host " + details.newModelHost],
            ["tools_models_list", "llama-server -hf <model name from hugging face, i.e: unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF:Q8_0> --jinja  -ngl 99 -c 0 -ub 1024 -b 1024 --cache-reuse 256 --port " + details.newModelPort + " --host " + details.newModelHost]
        ]);

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

        let localStartCommand = await Utils.getValidatedInput(
            'Enter a command to start the model locally',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'A command to start the model locally, i.e. llama-server -m model_name.gguf --port '+ details.newModelPort + '. (required for local model)',
                value: modelListToLocalCommand.get(details.modelsListSettingName) || ''
            }
        );
        if (localStartCommand === undefined) {
            vscode.window.showInformationMessage("Model addition cancelled.");
            return;
        }
        localStartCommand = this.app.modelService.sanitizeCommand(localStartCommand);

        let endpoint = await Utils.getValidatedInput(
            'Endpoint for accessing your model',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'Endpoint for accessing your model, i.e. ' + hostEndpoint + ':' + details.newModelPort + ' (required)',
                value: hostEndpoint + ':' + details.newModelPort
            }
        );
        if (endpoint === undefined) {
            vscode.window.showInformationMessage("Model addition cancelled.");
            return;
        }
        endpoint = this.sanitizeInput(endpoint);
        const isKeyRequired = await Utils.confirmAction(`Is API key required for this endpoint (${endpoint})?`, "");
        let newModel: LlmModel = {
            name: name,
            localStartCommand: localStartCommand,
            endpoint: endpoint,
            aiModel: "",
            isKeyRequired: isKeyRequired
        };

        const shouldAddModel = await Utils.confirmAction("You have entered:",
            "name: " + name +
            "\nlocal start command: " + localStartCommand +
            "\nendpoint: " + endpoint +
            "\nmodel name for provider: " +
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