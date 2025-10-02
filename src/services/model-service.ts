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
import { PREDEFINED_LISTS } from "../lists";

export class ModelService {
    private app: Application;
    private strategies: Record<string, IAddStrategy>;

    constructor(app: Application) {
        this.app = app;
        this.strategies = {
            local: this.app.localModelStrategy,
            external: this.app.externalModelStrategy,
            hf: this.app.hfModelStrategy
        };
    }

    getActions(type: ModelType): vscode.QuickPickItem[] {
        const keys = {
            [ModelType.Completion]: [
                UI_TEXT_KEYS.selectStartCompletionModel,
                UI_TEXT_KEYS.deselectStopCompletionModel,
                UI_TEXT_KEYS.addLocalCompletionModel,
                UI_TEXT_KEYS.addExternalCompletionModel,
                UI_TEXT_KEYS.addCompletionModelFromHuggingface,
                UI_TEXT_KEYS.viewCompletionModelDetails,
                UI_TEXT_KEYS.deleteCompletionModel,
                UI_TEXT_KEYS.exportCompletionModel,
                UI_TEXT_KEYS.importCompletionModel,
            ],
            [ModelType.Chat]: [
                UI_TEXT_KEYS.selectStartChatModel,
                UI_TEXT_KEYS.deselectStopChatModel,
                UI_TEXT_KEYS.addLocalChatModel,
                UI_TEXT_KEYS.addExternalChatModel,
                UI_TEXT_KEYS.addChatModelFromHuggingface,
                UI_TEXT_KEYS.viewChatModelDetails,
                UI_TEXT_KEYS.deleteChatModel,
                UI_TEXT_KEYS.exportChatModel,
                UI_TEXT_KEYS.importChatModel,
            ],
            [ModelType.Embeddings]: [
                UI_TEXT_KEYS.selectStartEmbeddingsModel,
                UI_TEXT_KEYS.deselectStopEmbeddingsModel,
                UI_TEXT_KEYS.addLocalEmbeddingsModel,
                UI_TEXT_KEYS.addExternalEmbeddingsModel,
                UI_TEXT_KEYS.addEmbeddingsModelFromHuggingface,
                UI_TEXT_KEYS.viewEmbeddingsModelDetails,
                UI_TEXT_KEYS.deleteEmbeddingsModel,
                UI_TEXT_KEYS.exportEmbeddingsModel,
                UI_TEXT_KEYS.importEmbeddingsModel,
            ],
            [ModelType.Tools]: [
                UI_TEXT_KEYS.selectStartToolsModel,
                UI_TEXT_KEYS.deselectStopToolsModel,
                UI_TEXT_KEYS.addLocalToolsModel,
                UI_TEXT_KEYS.addExternalToolsModel,
                UI_TEXT_KEYS.addToolsModelFromHuggingface,
                UI_TEXT_KEYS.viewToolsModelDetails,
                UI_TEXT_KEYS.deleteToolsModel,
                UI_TEXT_KEYS.exportToolsModel,
                UI_TEXT_KEYS.importToolsModel,
            ],
        };

        const modelKeys = keys[type] || [];
        return modelKeys.map(key => ({
            label: this.app.configuration.getUiText(key) ?? ""
        }));
    }

    async processActions(type: ModelType, selected: vscode.QuickPickItem): Promise<void> {
        const details = this.getTypeDetails(type);
        const actionMap = this.getActionMap(type);
        const action = Object.keys(actionMap).find(key => selected.label === actionMap[key]);
        if (!action) return;

        switch (action) {
            case 'select':
                await this.selectModel(type, details.modelsList);
                break;
            case 'deselect':
                await this.deselectModel(type, details);
                break;
            case 'addLocal':
                await this.addModel(type, 'local');
                break;
            case 'addExternal':
                await this.addModel(type, 'external');
                break;
            case 'addHf':
                await this.addModel(type, 'hf');
                break;
            case 'delete':
                await this.deleteModel(details.modelsList, details.modelsListSettingName);
                break;
            case 'view':
                await this.viewModel(type, details.modelsList);
                break;
            case 'export':
                await this.exportModel(type, details.modelsList);
                break;
            case 'import':
                await this.importModel(details.modelsList, details.modelsListSettingName);
                break;
        }
    }

    private getActionMap(type: ModelType): Record<string, string> {
        const typeStr = type.charAt(0).toUpperCase() + type.slice(1);
        return {
            select: this.app.configuration.getUiText(UI_TEXT_KEYS[`selectStart${typeStr}Model` as keyof typeof UI_TEXT_KEYS]) ?? "",
            deselect: this.app.configuration.getUiText(UI_TEXT_KEYS[`deselectStop${typeStr}Model` as keyof typeof UI_TEXT_KEYS]) ?? "",
            addLocal: this.app.configuration.getUiText(UI_TEXT_KEYS[`addLocal${typeStr}Model` as keyof typeof UI_TEXT_KEYS]) ?? "",
            addExternal: this.app.configuration.getUiText(UI_TEXT_KEYS[`addExternal${typeStr}Model` as keyof typeof UI_TEXT_KEYS]) ?? "",
            addHf: this.app.configuration.getUiText(UI_TEXT_KEYS[`add${typeStr}ModelFromHuggingface` as keyof typeof UI_TEXT_KEYS]) ?? "",
            view: this.app.configuration.getUiText(UI_TEXT_KEYS[`view${typeStr}ModelDetails` as keyof typeof UI_TEXT_KEYS]) ?? "",
            delete: this.app.configuration.getUiText(UI_TEXT_KEYS[`delete${typeStr}Model` as keyof typeof UI_TEXT_KEYS]) ?? "",
            export: this.app.configuration.getUiText(UI_TEXT_KEYS[`export${typeStr}Model` as keyof typeof UI_TEXT_KEYS]) ?? "",
            import: this.app.configuration.getUiText(UI_TEXT_KEYS[`import${typeStr}Model` as keyof typeof UI_TEXT_KEYS]) ?? "",
        };
    }

    selectModel = async (type: ModelType, modelsList: LlmModel[]): Promise<LlmModel | undefined> => {
        const details = this.getTypeDetails(type);
        let allModels = modelsList.concat(PREDEFINED_LISTS.get(type) as LlmModel[])
        let modelsItems: QuickPickItem[] = this.getModels(modelsList, "", true);
        modelsItems = modelsItems.concat(this.getModels(PREDEFINED_LISTS.get(type) as LlmModel[], "(predefined) ", true, modelsList.length));

        const launchToEndpoint = new Map([
            ["launch_completion", "endpoint"],
            ["launch_chat", "endpoint_chat"],
            ["launch_embeddings", "endpoint_embeddings"],
            ["launch_tools", "endpoint_tools"]
        ]);
        
        modelsItems.push({ label: (modelsItems.length + 1) + ". Use settings", description: "" });

        const selectedModelItem = await vscode.window.showQuickPick(modelsItems);
        if (selectedModelItem) {
            let model: LlmModel;
            if (parseInt(selectedModelItem.label.split(". ")[0], 10) == modelsItems.length) {
                // Use settings
                const aiModel = this.app.configuration.ai_model;
                const endpoint = this.app.configuration[launchToEndpoint.get(details.launchSettingName) as keyof Configuration] as string;
                const localStartCommand = this.app.configuration[details.launchSettingName as keyof Configuration] as string
                model = {
                    name: "Use settings",
                    aiModel: aiModel,
                    isKeyRequired: false,
                    endpoint: endpoint,
                    localStartCommand: localStartCommand
                };
            } else {
                const index = parseInt(selectedModelItem.label.split(". ")[0], 10) - 1;
                model = allModels[index];
            }

            await this.selectStartModel(model, type, details);

            return model;
        }
        return undefined
    }

    public async selectStartModel(model: LlmModel, type: ModelType, details: ModelTypeDetails) {
        await this.addApiKey(model);
        this.app.menu.setSelectedModel(type, model);

        await details.killCmd();
        if (model.localStartCommand) await details.shellCmd(this.sanitizeCommand(model.localStartCommand ?? ""));
        await this.app.persistence.setValue(this.getSelectedProp(type), model);
    }

    public async addModel(type: ModelType, kind: 'local' | 'external' | 'hf'): Promise<void> {
        const details = this.getTypeDetails(type);
        const strategy = this.strategies[kind];
        if (strategy) {
            await strategy.add(details);
        }
    }

    async deleteModel(modelsList: LlmModel[], settingName: string): Promise<void> {
        const modelsItems: QuickPickItem[] = this.getModels(modelsList, "", false);
        const modelItem = await vscode.window.showQuickPick(modelsItems);
        if (modelItem) {
            let modelIndex = parseInt(modelItem.label.split(". ")[0], 10) - 1;
            const shouldDeleteModel = await Utils.confirmAction("Are you sure you want to delete the model below?",
                this.getDetails(modelsList[modelIndex])
            );
            if (shouldDeleteModel) {
                modelsList.splice(modelIndex, 1);
                this.app.configuration.updateConfigValue(settingName, modelsList);
                vscode.window.showInformationMessage("The model is deleted.")
            }
        }
    }

    public async viewModel(type: ModelType , modelsList: LlmModel[]): Promise<void> {
        let allModels = modelsList.concat(PREDEFINED_LISTS.get(type) as LlmModel[])
        let modelsItems: QuickPickItem[] = this.getModels(modelsList, "", false);
        modelsItems = modelsItems.concat(this.getModels(PREDEFINED_LISTS.get(type) as LlmModel[], "(predefined) ", false, modelsList.length));
        let modelItem = await vscode.window.showQuickPick(modelsItems);
        if (modelItem) {
            let modelIndex = parseInt(modelItem.label.split(". ")[0], 10) - 1;
            let selectedModel = allModels[modelIndex];
            await this.showModelDetails(selectedModel);
        }
    }

    public async showModelDetails(model: LlmModel): Promise<void> {
        await Utils.showOkDialog("Model details: " + this.getDetails(model));
    }

    async exportModel(type: ModelType, modelsList: LlmModel[]): Promise<void> {
        let allModels = modelsList.concat(PREDEFINED_LISTS.get(type) as LlmModel[])
        let modelsItems: QuickPickItem[] = this.getModels(modelsList, "", false);
        modelsItems = modelsItems.concat(this.getModels(PREDEFINED_LISTS.get(type) as LlmModel[], "(predefined) ", false, modelsList.length));
        let modelItem = await vscode.window.showQuickPick(modelsItems);
        if (modelItem) {
            let modelIndex = parseInt(modelItem.label.split(". ")[0], 10) - 1;
            let selectedModel = allModels[modelIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following model? \n\n" +
                this.getDetails(selectedModel)
            );

            if (shouldExport) {
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedModel.name + '.json')),
                    filters: {
                        'Model Files': ['json'],
                        'All Files': ['*']
                    },
                    saveLabel: 'Export Model'
                });

                if (uri) {
                    const jsonContent = JSON.stringify(selectedModel, null, 2);
                    fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                    vscode.window.showInformationMessage("Model is saved.")
                }
            }
        }
    }

    async importModel(modelList: LlmModel[], settingName: string): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Import Model',
            filters: {
                'Model Files': ['json'],
                'All Files': ['*']
            },
        });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const newModel = JSON.parse(fileContent);
        // Sanitize imported model
        if (newModel.name) newModel.name = this.sanitizeInput(newModel.name);
        if (newModel.localStartCommand) newModel.localStartCommand = this.sanitizeCommand(newModel.localStartCommand);
        if (newModel.endpoint) newModel.endpoint = this.sanitizeInput(newModel.endpoint);
        if (newModel.aiModel) newModel.aiModel = this.sanitizeInput(newModel.aiModel);

        const modelDetails = this.getDetails(newModel);
        const shouldAddModel = await Utils.confirmAction("A new model will be added. Do you want to add the model?", modelDetails);

        if (shouldAddModel) {
            modelList.push(newModel);
            this.app.configuration.updateConfigValue(settingName, modelList);
            vscode.window.showInformationMessage("The model is added.");
        }
        vscode.window.showInformationMessage("Model imported: " + newModel.name);
    }

    public async deselectModel(type: ModelType, details: ModelTypeDetails): Promise<void> {
        await details.killCmd();
        this.app.menu.clearModel(type);
    }

    getDetails(model: LlmModel): string {
        return "name: " + model.name +
            "\nlocal start command: " + model.localStartCommand +
            "\nendpoint: " + model.endpoint +
            "\nmodel name for provider: " + model.aiModel +
            "\napi key required: " + model.isKeyRequired;
    }

    private getModels(models: LlmModel[], prefix: string, hasDetails: boolean, lastModelNumber: number = 0): QuickPickItem[] {
        const modelsItems: QuickPickItem[] = [];
        let i = lastModelNumber;
        for (let model of models) {
            i++;
            if (hasDetails) {
                modelsItems.push({
                    label: i + ". " + prefix + model.name,
                    description: model.localStartCommand,
                    detail: "Selects the model" + (model.localStartCommand ? ", downloads the model (if not yet done) and starts a llama-server with it." : "")
                });
            } else {
                modelsItems.push({
                    label: i + ". " + prefix + model.name,
                    description: model.localStartCommand
                })
            }
        }
        return modelsItems;
    }

    public getTypeDetails(type: ModelType): ModelTypeDetails {
        const config = MODEL_TYPE_CONFIG[type];
        return {
            modelsList: (this.app.configuration as any)[config.settingName],
            modelsListSettingName: config.settingName,
            newModelPort: (this.app.configuration as any)[config.portSetting],
            newModelHost: (this.app.configuration as any)[config.hostSetting],
            selModelPropName: config.propName,
            launchSettingName: config.launchSetting,
            killCmd: (this.app.llamaServer as any)[config.killCmdName],
            shellCmd: (this.app.llamaServer as any)[config.shellCmdName]
        };
    }

    private getSelectedProp(type: ModelType): string {
        const propMap = {
            [ModelType.Completion]: MODEL_TYPE_CONFIG[ModelType.Completion].propName,
            [ModelType.Chat]: MODEL_TYPE_CONFIG[ModelType.Chat].propName,
            [ModelType.Embeddings]: MODEL_TYPE_CONFIG[ModelType.Embeddings].propName,
            [ModelType.Tools]: MODEL_TYPE_CONFIG[ModelType.Tools].propName
        };
        return propMap[type] || '';
    }

    public async addApiKey(model: LlmModel): Promise<void> {
        if (model.isKeyRequired) {
            const apiKey = this.app.persistence.getApiKey(model.endpoint ?? "");
            if (!apiKey) {
                let result = await vscode.window.showInputBox({
                    placeHolder: 'Enter your api key for ' + model.endpoint,
                    prompt: 'your api key for ' + model.endpoint,
                    value: ''
                });
                result = this.sanitizeInput(result || '');
                if (result) {
                    this.app.persistence.setApiKey(model.endpoint ?? "", result);
                    vscode.window.showInformationMessage("Your API key for " + model.endpoint + " was saved.")
                }
            }
        }
    }

    sanitizeCommand = (command: string): string => {
        if (!command) return '';
        // TODO Consider escaping some chars: return command.trim().replace(/[`#$\<>\?\\|!{}()[\]^"]/g, '\\$&');
        return command.trim();
    }

    public sanitizeInput(input: string): string {
        return input ? input.trim() : '';
    }
}