
import { Application } from "../application";
import vscode, { QuickPickItem } from "vscode";
import { Agent, AgentCommand } from "../types";
import { Utils } from "../utils";
import * as fs from 'fs';
import * as path from 'path';
import { PREDEFINED_LISTS_KEYS, SETTING_NAME_FOR_LIST, UI_TEXT_KEYS } from "../constants";
import { PREDEFINED_LISTS } from "../lists";

export class AgentCommandService {
    private app: Application;

    constructor(app: Application) {
        this.app = app;
    }

    public getAgentCommandsActions(): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.addAgentCommand) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.viewAgentCommandDetails) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgentCommand) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.exportAgentCommand) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.importAgentCommand) ?? ""
            },
        ];
    }

    async processActions(selected: QuickPickItem): Promise<void> {
        const label = selected.label;
        try {
            switch (label) {
                case this.app.configuration.getUiText(UI_TEXT_KEYS.addAgentCommand):
                    await this.addAgentCommand(this.app.configuration.agent_commands, SETTING_NAME_FOR_LIST.AGENT_COMMANDS);
                    break;
                case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgentCommand):
                    await this.deleteAgentCommandFromList(this.app.configuration.agent_commands, SETTING_NAME_FOR_LIST.AGENT_COMMANDS);
                    break;
                case this.app.configuration.getUiText(UI_TEXT_KEYS.viewAgentCommandDetails):
                    await this.viewAgentCommandFromList(this.app.configuration.agent_commands);
                    break;
                case this.app.configuration.getUiText(UI_TEXT_KEYS.exportAgentCommand):
                    await this.exportAgentCommandFromList(this.app.configuration.agent_commands);
                    break;
                case this.app.configuration.getUiText(UI_TEXT_KEYS.importAgentCommand):
                    await this.importAgentCommandToList(this.app.configuration.agent_commands, SETTING_NAME_FOR_LIST.AGENT_COMMANDS);
                    break;
                default:
                    vscode.window.showWarningMessage("Unknown action");
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error processing action: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error(error);
        }
    }

    private async addAgentCommand(commands: AgentCommand[], settingName: string): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: this.app.configuration.getUiText(UI_TEXT_KEYS.enterName) ?? "Enter agent command name",
            validateInput: (value) => value ? null : "Name is required"
        });
        if (!name) return;

        const command = await vscode.window.showInputBox({
            prompt: "Enter the command",
            validateInput: (value) => value ? null : "Command is required"
        });
        if (!command) return;

        const description = await vscode.window.showInputBox({ prompt: "Enter description (optional)" });

        const newCommand: AgentCommand = { name, prompt: [command], description: description || "" };
        await this.persistAgentCommandToSetting(newCommand, this.app.configuration.agent_commands, settingName);
    }

    private async deleteAgentCommandFromList(agentCommands: AgentCommand[], settingName: string) {
        const modelsItems: QuickPickItem[] = Utils.getStandardQpList(agentCommands, "");
        const model = await vscode.window.showQuickPick(modelsItems);
        if (model) {
            let modelIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            const shoulDeleteModel = await Utils.confirmAction("Are you sure you want to delete the agent command below?", 
                this.getAgentCommandDetailsAsString(agentCommands[modelIndex])
            );
            if (shoulDeleteModel) {
                agentCommands.splice(modelIndex, 1);
                this.app.configuration.updateConfigValue(settingName, agentCommands);
                vscode.window.showInformationMessage("The agent command is deleted.")
            }
        }
    }

    private async viewAgentCommandFromList(agentCommands: any[]) {
        let allAgentCommands = agentCommands.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as AgentCommand[])
        let agentComandItems: QuickPickItem[] = Utils.getStandardQpList(agentCommands, "");
        agentComandItems = agentComandItems.concat(Utils.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as AgentCommand[], "(predefined) ", agentCommands.length));
        let agentCommand = await vscode.window.showQuickPick(agentComandItems);
        if (agentCommand) {
            let agentCommandIndex = parseInt(agentCommand.label.split(". ")[0], 10) - 1;
            let selectedAgentCommand =  allAgentCommands[agentCommandIndex];
            await this.showAgentCommandDetails(selectedAgentCommand);
        }
    }

    public async showAgentCommandDetails(selectedAgentCommand: any) {
        await Utils.showOkDialog(
            this.getAgentCommandDetailsAsString(selectedAgentCommand)
        );
    }

    private async persistAgentCommandToSetting(newAgentCommand: AgentCommand, agentCommands: any[], settingName: string) {
        let modelDetails = this.getAgentCommandDetailsAsString(newAgentCommand);
        const shouldAddModel = await Utils.confirmAction("A new agent command will be added. Do you want to add the agent command?", modelDetails);

        if (shouldAddModel) {
            agentCommands.push(newAgentCommand);
            this.app.configuration.updateConfigValue(settingName, agentCommands);
            vscode.window.showInformationMessage("The agent command is added.");
        }
    }

    private async exportAgentCommandFromList(agentCommands: any[]) {
        let allAgentCommands = agentCommands.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as Agent[])
        let agentComandItems: QuickPickItem[] = Utils.getStandardQpList(agentCommands, "");
        agentComandItems = agentComandItems.concat(Utils.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as Agent[], "(predefined) ", agentCommands.length));
        let agentCommand = await vscode.window.showQuickPick(agentComandItems);
        if (agentCommand) {
            let modelIndex = parseInt(agentCommand.label.split(". ")[0], 10) - 1;
            let selectedAgentCommand =  allAgentCommands[modelIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following agent command? \n\n" +
            this.getAgentCommandDetailsAsString(selectedAgentCommand)
            );

            if (shouldExport){
                const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedAgentCommand.name+'.json')),
                        filters: {
                            'Agent Command Files': ['json'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export Agent Command'
                    });

                if (!uri) {
                    return;
                }

                const jsonContent = JSON.stringify(selectedAgentCommand, null, 2);
                fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                vscode.window.showInformationMessage("Agent command is saved.")
            }
        }
    }
    
    private async importAgentCommandToList(agentCommands: any[], settingName: string) {
        let name = "";
        const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Import Agent Command',
                filters: {
                    'Agent Command Files': ['json'],
                    'All Files': ['*']
                },
            });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const newAgentCommand = JSON.parse(fileContent);
        // Sanitize imported agent command
        if (newAgentCommand.name) newAgentCommand.name = this.app.modelService.sanitizeInput(newAgentCommand.name);
        if (newAgentCommand.description) newAgentCommand.description = this.app.modelService.sanitizeInput(newAgentCommand.description);
        if (newAgentCommand.prompt) newAgentCommand.prompt = newAgentCommand.prompt.map((s: string) => this.app.modelService.sanitizeInput(s));
        if (newAgentCommand.context) newAgentCommand.context = newAgentCommand.context.map((s: string) => this.app.modelService.sanitizeInput(s));

        await this.persistAgentCommandToSetting(newAgentCommand, agentCommands, settingName);
    }

     private getAgentCommandDetailsAsString(selectedAgentCommand: AgentCommand): string {
        return "Agent command details: " +
            "\nname: " + selectedAgentCommand.name +
            "\ndescription: " + selectedAgentCommand.description +
            "\nprompt: \n" + selectedAgentCommand.prompt.join("\n") +
            "\n\ncontext: " + (selectedAgentCommand.context ? selectedAgentCommand.context.join(", ") : "");
    }
}