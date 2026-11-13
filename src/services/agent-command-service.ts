
import { Application } from "../application";
import vscode, { QuickPickItem } from "vscode";
import { Agent, AgentCommand } from "../types";
import { Utils } from "../utils";
import * as fs from 'fs';
import * as path from 'path';
import { AGENT_COMMAND, PREDEFINED_LISTS_KEYS, SETTING_NAME_FOR_LIST, UI_TEXT_KEYS } from "../constants";
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
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.editAgentCommandDetails) ?? ""
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

    removePreffix = (agentCommandName: string): string => {
        let strippedCommand = agentCommandName;
        // Strip the periodic-execution marker (⏰) if present - it is added
        // by getAgentCommandsList to visually mark scheduled commands.
        if (strippedCommand.startsWith("⏰ ")) {
            strippedCommand = strippedCommand.slice(2);
        }
        if (strippedCommand.startsWith(`[${AGENT_COMMAND.type_preffix_script}]`)) {
            strippedCommand = strippedCommand.slice(`[${AGENT_COMMAND.type_preffix_script}]`.length);
        } else if (strippedCommand.startsWith(`[${AGENT_COMMAND.type_preffix_prompt}]`)) {
            strippedCommand = strippedCommand.slice(`[${AGENT_COMMAND.type_preffix_prompt}]`.length);
        }

        return strippedCommand;
    }

    async processActions(selected: QuickPickItem): Promise<void> {
        const label = selected.label;
        try {
            switch (label) {
                case this.app.configuration.getUiText(UI_TEXT_KEYS.addAgentCommand):
                    await this.addAgentCommand();
                    break;
                case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgentCommand):
                    await this.deleteAgentCommandFromList(this.app.configuration.agent_commands, SETTING_NAME_FOR_LIST.AGENT_COMMANDS);
                    break;
                case this.app.configuration.getUiText(UI_TEXT_KEYS.viewAgentCommandDetails):
                    await this.viewAgentCommandFromList(this.app.configuration.agent_commands);
                    break;
                case this.app.configuration.getUiText(UI_TEXT_KEYS.editAgentCommandDetails):
                    await this.editAgentCommandFromList(this.app.configuration.agent_commands);
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

    public async addAgentCommand(): Promise<void> {
        this.app.llamaWebviewProvider.addEditAgentCommand({}, null as any)
    }

    private async deleteAgentCommandFromList(agentCommands: AgentCommand[], settingName: string) {
        const modelsItems: QuickPickItem[] = Utils.getStandardQpList(agentCommands, "");
        const model = await vscode.window.showQuickPick(modelsItems);
        if (model) {
            let modelIndex = parseInt(model.label.split(". ")[0], 10) - 1;
            const shoulDeleteModel = await this.app.dialogs.confirmAction("Are you sure you want to delete the agent command below?", 
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

    public async editAgentCommandFromList(agentCommands: any[]) {
        let allAgentCommands = agentCommands.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as AgentCommand[])
        // Mark commands executed periodically with a "(scheduled) " prefix.
        let agentComandItems: QuickPickItem[] = this.getAgentCommandQpList(agentCommands, "");
        agentComandItems = agentComandItems.concat(this.getAgentCommandQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as AgentCommand[], "(predefined) ", agentCommands.length));
        let agentCommand = await vscode.window.showQuickPick(agentComandItems);
        if (agentCommand) {
            let agentCommandIndex = parseInt(agentCommand.label.split(". ")[0], 10) - 1;
            let selectedAgentCommand =  allAgentCommands[agentCommandIndex] as AgentCommand;
            this.app.llamaWebviewProvider.addEditAgentCommandToUi(selectedAgentCommand)
        }
    }

    public async showAgentCommandDetails(selectedAgentCommand: any) {
        await this.app.dialogs.showOkDialog(
            this.getAgentCommandDetailsAsString(selectedAgentCommand)
        );
    }

    /**
     * Returns a user-defined agent command by name (configuration.agent_commands
     * only - predefined commands are not returned).
     */
    public getAgentCommand(commandName: string): AgentCommand | undefined {
        let commands = this.app.configuration.agent_commands as AgentCommand[]
        commands = commands.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as AgentCommand[]) as AgentCommand[];
        return (commands).find(cmd => cmd.name === commandName);
    }

    /**
     * Writes executedTimes for one user-defined command (matched by name) and saves
     * the agent_commands setting. Returns false when the command does not exist or
     * the stored value already equals the new one (no write in that case - the
     * settings change re-enters the scheduler's reschedule()).
     * Only the counter is touched - all other fields are preserved as stored.
     */
    public async setExecutedTimes(commandName: string, executedTimes: number): Promise<boolean> {
        // Look up ONLY the user commands: predefined commands must never be written.
        const agentCommands = this.app.configuration.agent_commands as AgentCommand[];
        const command = agentCommands.find(cmd => cmd.name === commandName);
        if (!command) return false;
        const normalized = Utils.normalizeExecutedTimes(executedTimes);
        if (Utils.normalizeExecutedTimes(command.executedTimes) === normalized) return false; // no change, no write
        command.executedTimes = normalized;
        // Write at the scope the user actually stores agent_commands in.
        await this.app.configuration.updateAgentCommands(agentCommands);
        return true;
    }

    /**
     * Adds a new agent command or updates an existing one (matched by name).
     * Used by the AgentCommandEditor UI.
     */
    public async addUpdateAgentCommand(agentCommand: AgentCommand): Promise<void> {
        const agentCommands = this.app.configuration.agent_commands as AgentCommand[];
        const existing = agentCommands.find(cmd => cmd.name === agentCommand.name);
        if (existing) {
            const shouldUpdate = await this.app.dialogs.confirmAction(
                "Do you want to update the agent command?",
                this.getAgentCommandDetailsAsString(agentCommand)
            );
            if (shouldUpdate) {
                // The editor does not own executedTimes - a stale form value must
                // never overwrite a counter the scheduler bumped meanwhile.
                const storedExecutedTimes = existing.executedTimes;
                Object.assign(existing, agentCommand);
                existing.executedTimes = Utils.normalizeExecutedTimes(storedExecutedTimes);
                this.app.configuration.updateConfigValue(SETTING_NAME_FOR_LIST.AGENT_COMMANDS, agentCommands);
                vscode.window.showInformationMessage("The agent command is updated: " + existing.name);
            }
        } else {
            await this.persistAgentCommandToSetting(agentCommand, agentCommands, SETTING_NAME_FOR_LIST.AGENT_COMMANDS);
        }
    }

    public async copyAgentCommand(): Promise<void> {
        let agentCommandsList = this.app.configuration.agent_commands
        let allAgentCommands = agentCommandsList.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as Agent[]);
        let agentCommandsItems: QuickPickItem[] = this.getStandardQpList(agentCommandsList, "");
        agentCommandsItems = agentCommandsItems.concat(this.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as AgentCommand[], "(predefined) ", agentCommandsList.length));
        let agentCommandItem = await vscode.window.showQuickPick(agentCommandsItems);
        if (agentCommandItem) {
            this.app.llamaWebviewProvider.showAgentCommandEditorInUi();
            let agentCommandIndex = parseInt(agentCommandItem.label.split(". ")[0], 10) - 1;
            const selectedAgentCommand = allAgentCommands[agentCommandIndex];
            const copyCommand: AgentCommand = {
                ...selectedAgentCommand,
                name: "Copy of " + selectedAgentCommand.name,
                // A copy with a consumed budget would silently refuse to run.
                executedTimes: 0
            };
            this.app.llamaWebviewProvider.addEditAgentCommandToUi(copyCommand)
        }
    }

    private getStandardQpList(list: AgentCommand[], prefix: string, lastAgentCommandNumber: number = 0): QuickPickItem[] {
        const items: QuickPickItem[] = [];
        let i = lastAgentCommandNumber;
        for (let elem of list) {
            i++;
            items.push({
                label: i + ". " + prefix + elem.name,
                description: elem.description,
            });
        }
        return items;
    }

    /**
     * Same as getStandardQpList but marks agent commands scheduled for
     * periodic execution (executePeriodically === true) with a
     * "(scheduled) " prefix in front of the command name.
     */
    private getAgentCommandQpList(list: AgentCommand[], prefix: string, lastAgentCommandNumber: number = 0): QuickPickItem[] {
        const items: QuickPickItem[] = [];
        let i = lastAgentCommandNumber;
        for (let elem of list) {
            i++;
            items.push({
                label: i + ". " + prefix + (elem?.executePeriodically ? "(scheduled) " : "") + elem?.name,
                description: elem?.description,
            });
        }
        return items;
    }

    /**
     * Deletes a user-defined agent command by name.
     */
    public async deleteAgentCommandByName(commandName: string): Promise<boolean> {
        const agentCommands = this.app.configuration.agent_commands as AgentCommand[];
        const index = agentCommands.findIndex(cmd => cmd.name === commandName);
        if (index === -1) {
            vscode.window.showWarningMessage("The agent command to delete is not found!");
            return false;
        }
        const shouldDelete = await this.app.dialogs.confirmAction(
            "Are you sure you want to delete the agent command below?",
            this.getAgentCommandDetailsAsString(agentCommands[index])
        );
        if (shouldDelete) {
            agentCommands.splice(index, 1);
            this.app.configuration.updateConfigValue(SETTING_NAME_FOR_LIST.AGENT_COMMANDS, agentCommands);
            vscode.window.showInformationMessage("The agent command is deleted.");
            return true;
        }
        return false;
    }

    getAgentCommandsList = () => {
        let commands = this.getAgentCommands();
        
        let agentCommands =  commands.map(cmd =>
            `${cmd.executePeriodically ? "⏰ " : ""}[${cmd.noPrompt?AGENT_COMMAND.type_preffix_script:AGENT_COMMAND.type_preffix_prompt}]${cmd.name} | ${cmd.description}` +
            // Progress of a scheduled command, appended AFTER the description so the
            // picker parser (everything after the first "|") keeps working.
            (cmd.executePeriodically
                ? ` (executed: ${Utils.normalizeExecutedTimes(cmd.executedTimes)}/${Utils.normalizeExecutedTimes(cmd.totalExecutionTimes) || "∞"})`
                : "")
        )
        
        const scriptsFolder = path.join(this.app.configuration.scripts_folder, "")
        let scriptCommands = this.getScriptCommands()
        scriptCommands = scriptCommands.map(dirent => `[${AGENT_COMMAND.type_preffix_script}]${dirent}`)
        
        agentCommands = agentCommands.concat(scriptCommands)
        
        return agentCommands;
    }

    getAgentCmdsListForTelegram = () => {
        let commands = this.getAgentCommands();
        
        let agentCommands =  commands.map(cmd => `/${cmd.name} [${cmd.noPrompt?AGENT_COMMAND.type_preffix_script:AGENT_COMMAND.type_preffix_prompt}] | ${cmd.description}`)
        
        let scriptCommands = this.getScriptCommands();
        scriptCommands = scriptCommands.map(cmd => `/${cmd} [${AGENT_COMMAND.type_preffix_script}]`)
        agentCommands = agentCommands.concat(scriptCommands)
        
        return agentCommands;
    }

    isAgentCommand = (cmdToFind: string): boolean => {
        let isCommand = false;
        cmdToFind = cmdToFind.trim();
        if (this.getAgentCommands().find(cmd => cmd.name == cmdToFind)
            ||this.getScriptCommands().find(cmd => cmd == cmdToFind)){
            isCommand = true
        }
        
        return isCommand
    }

    private getScriptCommands(): string[] {
        let scriptCommands:string[] = []
        const scriptsFolder = path.join(this.app.configuration.scripts_folder, "");
        if (fs.existsSync(scriptsFolder)){
            scriptCommands = fs.readdirSync(scriptsFolder, { withFileTypes: true }).filter(dirent => dirent.isFile() && dirent.name.toLowerCase().endsWith(".lvs")).map(file => file.name);
        }
        return scriptCommands;
    }

    private getAgentCommands() {
        let commands = this.app.configuration.agent_commands as AgentCommand[];
        commands = commands.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENT_COMMANDS) as AgentCommand[]) as AgentCommand[];

        if (this.app.configuration.enabled) commands = commands.filter(cmd => cmd.name != "enable_completions");
        else commands = commands.filter(cmd => cmd.name != "disable_completions");

        if (this.app.configuration.rag_enabled) commands = commands.filter(cmd => cmd.name != "enable_rag");
        else commands = commands.filter(cmd => cmd.name != "disable_rag");
        return commands;
    }

    private async persistAgentCommandToSetting(newAgentCommand: AgentCommand, agentCommands: any[], settingName: string) {
        let modelDetails = this.getAgentCommandDetailsAsString(newAgentCommand);
        const shouldAddModel = await this.app.dialogs.confirmAction("A new agent command will be added. Do you want to add the agent command?", modelDetails);

        if (shouldAddModel) {
            // Always persisted as an explicit number (0 when absent) so the field is
            // discoverable in the settings JSON and never written as null/NaN.
            newAgentCommand.executedTimes = Utils.normalizeExecutedTimes(newAgentCommand.executedTimes);
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
            let shouldExport = await this.app.dialogs.showYesNoDialog("Do you want to export the following agent command? \n\n" +
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
        if (newAgentCommand.startTime) newAgentCommand.startTime = this.app.modelService.sanitizeInput(newAgentCommand.startTime);
        // Numeric / boolean scheduling fields are used as-is but coerced to the
        // expected types so a malformed import cannot break the scheduler.
        newAgentCommand.executePeriodically = Boolean(newAgentCommand.executePeriodically);
        newAgentCommand.period = newAgentCommand.period !== undefined && newAgentCommand.period !== null ? Number(newAgentCommand.period) : undefined;
        newAgentCommand.totalExecutionTimes = newAgentCommand.totalExecutionTimes !== undefined && newAgentCommand.totalExecutionTimes !== null ? Number(newAgentCommand.totalExecutionTimes) : undefined;
        // An imported file may carry the execution counter - honour it; a file
        // without the field starts at 0.
        newAgentCommand.executedTimes = Utils.normalizeExecutedTimes(newAgentCommand.executedTimes);

        await this.persistAgentCommandToSetting(newAgentCommand, agentCommands, settingName);
    }

     private getAgentCommandDetailsAsString(selectedAgentCommand: AgentCommand): string {
        return "Agent command details: " +
            "\nname: " + selectedAgentCommand.name +
            "\ndescription: " + selectedAgentCommand.description +
            "\nprompt: \n" + selectedAgentCommand.prompt.join("\n") +
            "\nis script: " + selectedAgentCommand.isScript +
            "\nno prompt to the agent: " + selectedAgentCommand.noPrompt +
            "\n\nexecute periodically: " + selectedAgentCommand.executePeriodically +
            "\nstart time: " + selectedAgentCommand.startTime +
            "\nperiod (seconds): " + selectedAgentCommand.period +
            "\ntotal execution times: " + (selectedAgentCommand.totalExecutionTimes || "infinite") +
            "\nexecuted times: " + Utils.normalizeExecutedTimes(selectedAgentCommand.executedTimes) +
            "\n\ncontext: " + (selectedAgentCommand.context ? selectedAgentCommand.context.join(", ") : "");
    }
}