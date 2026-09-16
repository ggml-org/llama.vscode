
import * as vscode from "vscode";
import { Application } from "../application";
import { IAddStrategy, LlmModel, ModelTypeDetails } from "../types";
import { Utils } from "../utils";
import { ServiceUtils } from "./service-utils";

export class LocalModelStrategy implements IAddStrategy {
    private app: Application;

    constructor(app: Application) {
        this.app = app;
    }

    async add(details: ModelTypeDetails): Promise<void> {
        const hostEndpoint = "http://" + details.newModelHost;
        const modelListToLocalCommand = new Map([
            ["completion_models_list", "llama serve -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF> -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 --port " + details.newModelPort + " --host " + details.newModelHost],
            ["chat_models_list", 'llama serve -hf <model name from hugging face, i.e: ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF> -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port ' + details.newModelPort + " --host " + details.newModelHost],
            ["embeddings_models_list", "llama serve -hf <model name from hugging face, i.e: ggml-org/Nomic-Embed-Text-V2-GGUF> -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port " + details.newModelPort + " --host " + details.newModelHost],
            ["tools_models_list", "llama serve -hf <model name from hugging face, i.e: unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF:Q8_0> -c 0 -ub 1024 -b 1024 --cache-reuse 256 --port " + details.newModelPort + " --host " + details.newModelHost]
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
        name = ServiceUtils.sanitizeInput(name);

        let localStartCommand = await Utils.getValidatedInput(
            'Enter a command to start the model locally',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'A command to start the model locally, i.e. llama serve -m model_name.gguf --port '+ details.newModelPort + '. (required for local model)',
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
        endpoint = ServiceUtils.sanitizeInput(endpoint);
        const isKeyRequired = await this.app.dialogs.confirmAction(`Is API key required for this endpoint (${endpoint})?`, "");
        let newModel: LlmModel = {
            name: name,
            localStartCommand: localStartCommand,
            endpoint: endpoint,
            aiModel: "",
            isKeyRequired: isKeyRequired
        };

        const shouldAddModel = await this.app.dialogs.confirmAction("You have entered:",
            "name: " + name +
            "\nlocal start command: " + localStartCommand +
            "\nendpoint: " + endpoint +
            "\nmodel name for provider: " +
            "\napi key required: " + isKeyRequired +
            "\nDo you want to add a model with these properties?"
        );

        if (shouldAddModel) {
            await ServiceUtils.addPersistModel(newModel, details, this.app);
        }
    }
}