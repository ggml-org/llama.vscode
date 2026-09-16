import * as vscode from "vscode";
import { QuickPickItem } from "vscode";
import { Application } from "../application";
import { IAddStrategy, LlmModel, ModelTypeDetails } from "../types";
import { Utils } from "../utils";
import * as axios from "axios";
import { HF_MODEL_TEMPLATES, SETTING_TO_MODEL_TYPE } from "../constants";
import { ServiceUtils } from "./service-utils";

interface HuggingfaceModel {
    modelId: string;
    createdAt: string;
    downloads: number;
    likes: number;
    pipeline_tag: string;
    tags: string[];
    private: boolean;
}

interface HuggingfaceFile {
    type: string;
    path: string;
    size: number;
}

export class HfModelStrategy implements IAddStrategy {
    private app: Application;

    constructor(app: Application) {
        this.app = app;
    }

    add = async (details: ModelTypeDetails): Promise<void> => {
        const modelType = SETTING_TO_MODEL_TYPE[details.modelsListSettingName];
        const template = HF_MODEL_TEMPLATES[modelType]
            .replace('MODEL_PLACEHOLDER', '<model_name>')
            .replace('PORT_PLACEHOLDER', details.newModelPort.toString())
            .replace('HOST_PLACEHOLDER', details.newModelHost);
        const hostEndpoint = "http://" + details.newModelHost;

        let searchWords = await vscode.window.showInputBox({
            placeHolder: 'keywords for searching a model from huggingface',
            prompt: 'Enter keywords to search for models in huggingface',
            value: ""
        });
        searchWords = ServiceUtils.sanitizeInput(searchWords || '');

        if (!searchWords) {
            vscode.window.showInformationMessage("No huggingface model selected.")
            return;
        }
        let hfModelName = await this.getDownloadModelName(searchWords);
        if (hfModelName == "") return;
        let localStartCommand = template.replace('<model_name>', hfModelName);
        localStartCommand = this.app.modelService.sanitizeCommand(localStartCommand);

        let endpoint = hostEndpoint + ":" + details.newModelPort;
        endpoint = ServiceUtils.sanitizeInput(endpoint);
        const aiModel = ""
        const isKeyRequired = false;
        let name = "hf: " + hfModelName;
        name = ServiceUtils.sanitizeInput(name);
        let newHfModel: LlmModel = {
            name: name,
            localStartCommand: localStartCommand,
            endpoint: endpoint,
            aiModel: aiModel,
            isKeyRequired: isKeyRequired
        };

        const shouldAddModel = await this.app.dialogs.confirmAction("You have entered:",
            ServiceUtils.getModelDetailsAsString(newHfModel) +
            "\nDo you want to add a model with these properties?"
        );

        if (shouldAddModel) {
            await ServiceUtils.addPersistModel(newHfModel, details, this.app);
        }
    }

    private async getDownloadModelName(searchWords: string): Promise<string> {
        searchWords = ServiceUtils.sanitizeInput(searchWords);
        const foundModels = await this.getHfModels(searchWords ?? "");
        let hfModelName = "";
        if (foundModels && foundModels.length > 0) {
            const hfModelsQp: QuickPickItem[] = [];
            for (let hfModel of foundModels) {
                if (!hfModel.private) {
                    hfModelsQp.push({
                        label: hfModel.modelId,
                        description: "created: " + hfModel.createdAt + " | downloads: " + hfModel.downloads + " | likes: " + hfModel.likes +
                            " | pipeline: " + hfModel.pipeline_tag + " | tags: " + hfModel.tags
                    });
                }
            }
            const selModel = await vscode.window.showQuickPick(hfModelsQp);
            if (selModel && selModel.label) {
                let modelFiles = await this.getHfModelFiles(selModel.label);
                if (modelFiles && modelFiles.length > 0) {
                    const hfModelsFilesQp: QuickPickItem[] = await this.getFilesOfModel(selModel, modelFiles);
                    if (hfModelsFilesQp.length <= 0) {
                        vscode.window.showInformationMessage("No files found for model " + selModel.label + " or the files are with unexpected naming conventions.");
                        return "";
                    } else {
                        let selFile = await vscode.window.showQuickPick(hfModelsFilesQp);
                        if (!selFile) {
                            vscode.window.showInformationMessage("No files selected for model " + selModel.label + ".");
                            return "";
                        }
                        if (hfModelsFilesQp.length == 1) hfModelName = selModel.label ?? "";
                        else hfModelName = selFile?.label ?? "";
                    }
                } else {
                    vscode.window.showInformationMessage("No files found for model " + selModel.label);
                    return "";
                }
            } else {
                vscode.window.showInformationMessage("No huggingface model selected.");
                return '';
            }
        } else {
            vscode.window.showInformationMessage("No model selected.");
            return "";
        }
        hfModelName = ServiceUtils.sanitizeInput(hfModelName);
        return hfModelName;
    }

    private async getFilesOfModel(selModel: vscode.QuickPickItem, modelFiles: HuggingfaceFile[]): Promise<QuickPickItem[]> {
        const hfModelsFilesQp: QuickPickItem[] = [];
        const ggufSuffix = ".gguf";
        let cleanModelName = selModel.label.split("/")[1].replace(/-gguf/gi, "");
        let arePartsOfOneFile = true;
        let multiplePartsSize = 0;
        let multiplePartsCount = 0;
        for (let file of modelFiles) {
            if (file.type == "file"
                && file.path.toLowerCase().endsWith(ggufSuffix)
                && file.path.toLowerCase().startsWith(cleanModelName.toLowerCase())) {
                let quantization = file.path.slice(cleanModelName.length + 1, -ggufSuffix.length);
                if (arePartsOfOneFile && !this.isOneOfMany(quantization.slice(-14))) arePartsOfOneFile = false;
                if (!arePartsOfOneFile) {
                    hfModelsFilesQp.push({
                        label: selModel.label + (quantization ? ":" + quantization : ""),
                        description: "size: " + (Math.round((file.size / 1000000000) * 100) / 100) + "GB"
                    });
                } else {
                    multiplePartsSize += file.size;
                    multiplePartsCount++;
                }
            }
            if (file.type == "directory") {
                let subfolderFiles = await this.getHfModelSubforlderFiles(selModel.label, file.path);
                let totalSize = 0;
                let totalFiles = 0;
                for (let file of subfolderFiles) {
                    if (file.path.toLowerCase().endsWith(ggufSuffix)) {
                        totalSize += file.size;
                        totalFiles++;
                    }
                }
                hfModelsFilesQp.push({
                    label: selModel.label + ":" + file.path,
                    description: "size: " + (Math.round((totalSize / 1000000000) * 100) / 100) + " GB | files: " + totalFiles
                });
            }
        }
        if (arePartsOfOneFile) {
            hfModelsFilesQp.push({
                label: selModel.label,
                description: "size: " + (Math.round((multiplePartsSize / 1073741824) * 100) / 100) + " GB | files: " + multiplePartsCount
            });
        }
        return hfModelsFilesQp;
    }

    private isOneOfMany(input: string): boolean {
        const regex = /^\d{5}-of-\d{5}$/;
        return regex.test(input);
    }

    private async getHfModels(searchWords: string): Promise<HuggingfaceModel[]> {
        let hfEndpoint = "https://huggingface.co/api/models?limit=1500&search=" + "GGUF+" + searchWords.replace(" ", "+");
        let result = await axios.default.get(
            `${Utils.trimTrailingSlash(hfEndpoint)}`
        );

        if (result && result.data) return result.data as HuggingfaceModel[]
        else return [];
    }

    private async getHfModelFiles(modelId: string): Promise<HuggingfaceFile[]> {
        let hfEndpoint = "https://huggingface.co/api/models/" + modelId + "/tree/main";
        let result = await axios.default.get(
            `${Utils.trimTrailingSlash(hfEndpoint)}`
        );
        if (result && result.data) return result.data as HuggingfaceFile[]
        else return [];
    }

    private async getHfModelSubforlderFiles(modelId: string, subfolder: string): Promise<HuggingfaceFile[]> {
        let hfEndpoint = "https://huggingface.co/api/models/" + modelId + "/tree/main/" + subfolder;
        let result = await axios.default.get(
            `${Utils.trimTrailingSlash(hfEndpoint)}`
        );
        if (result && result.data) return result.data as HuggingfaceFile[]
        else return [];
    } 
}