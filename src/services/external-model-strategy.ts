import * as vscode from "vscode";
import { Application } from "../application";
import { IAddStrategy, LlmModel, ModelTypeDetails } from "../types";
import { Utils } from "../utils";
import { ServiceUtils } from "./service-utils";

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
        name = ServiceUtils.sanitizeInput(name);

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
        endpoint = ServiceUtils.sanitizeInput(endpoint);
        let aiModel = await vscode.window.showInputBox({
            placeHolder: 'Model name, exactly as expected by the provider, i.e. kimi-k3 ',
            prompt: 'Enter model name as expected by the provider (leave empty if llama serve is used)',
            value: ''
        });
        aiModel = ServiceUtils.sanitizeInput(aiModel || '');
        const isKeyRequired = await this.app.dialogs.confirmAction(`Is API key required for this endpoint (${endpoint})?`, "");
        let newModel: LlmModel = {
            name: name,
            localStartCommand: "",
            endpoint: endpoint,
            aiModel: aiModel,
            isKeyRequired: isKeyRequired
        };

        const shouldAddModel = await this.app.dialogs.confirmAction("You have entered:",
            "\nname: " + name +
            "\nlocal start command: " +
            "\nendpoint: " + endpoint +
            "\nmodel name for provider: " + aiModel +
            "\napi key required: " + isKeyRequired +
            "\nDo you want to add a model with these properties?"
        );

        if (shouldAddModel) {
            await ServiceUtils.addPersistModel(newModel, details, this.app);
        }
    }

    

    

    
}