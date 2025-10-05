
import * as vscode from "vscode";
import { QuickPickItem } from "vscode";
import { Application } from "../application";
import { Agent } from "../types";
import { Utils } from "../utils";
import * as fs from "fs";
import * as path from "path";
import { PREDEFINED_LISTS } from "../lists";
import { UI_TEXT_KEYS, PERSISTENCE_KEYS, SETTING_NAME_FOR_LIST, PREDEFINED_LISTS_KEYS } from "../constants";

export class AgentService {
    private app: Application;

    constructor(app: Application) {
        this.app = app;
    }

    getActions(): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartAgent) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopAgent) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.addAgent) ?? "",
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.viewAgentDetails) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgent) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.exportAgent) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.importAgent) ?? ""
            },
        ];
    }

    async processActions(selected: vscode.QuickPickItem): Promise<void> {
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartAgent):
                await this.pickAndSelectAgent(this.app.configuration.agents_list);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addAgent):
                await this.addAgent(this.app.configuration.agents_list, SETTING_NAME_FOR_LIST.AGENTS);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgent):
                await this.deleteAgent(this.app.configuration.agents_list, SETTING_NAME_FOR_LIST.AGENTS);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.viewAgentDetails):
                await this.viewAgent(this.app.configuration.agents_list);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deselectStopAgent):
                await this.deselectAgent();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportAgent):
                await this.exportAgent(this.app.configuration.agents_list);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importAgent):
                await this.importAgent(this.app.configuration.agents_list, SETTING_NAME_FOR_LIST.AGENTS);
                break;
        }
    }

    public async pickAndSelectAgent(agentsList: Agent[]): Promise<Agent | undefined> {
        let allAgents = agentsList.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[]);
        let agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList, "");
        agentsItems = agentsItems.concat(this.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[], "(predefined) ", agentsList.length));
        let lastUsedAgent = this.app.persistence.getValue(PERSISTENCE_KEYS.SELECTED_AGENT) as Agent;
        if (lastUsedAgent && lastUsedAgent.name.trim() !== "") {
            agentsItems.push({ label: (agentsItems.length + 1) + ". Last used agent", description: lastUsedAgent.name });
        }
        const agentItem = await vscode.window.showQuickPick(agentsItems);
        if (agentItem) {
            let selectedAgent: Agent;
            if (agentItem.label.includes("Last used agent")) {
                selectedAgent = lastUsedAgent;
            } else {
                const index = parseInt(agentItem.label.split(". ")[0], 10) - 1;
                selectedAgent = allAgents[index];
            }
            if (selectedAgent) {
                await this.selectAgent(selectedAgent);
                vscode.window.showInformationMessage(`Agent is selected:  ${selectedAgent.name}`);
                return selectedAgent;
            }
        }
        return undefined;
    }

    async selectAgent(agent: Agent): Promise<void> {
        this.app.setAgent(agent);
        const allTools = Array.from(this.app.tools.toolsFunc.keys());
        for (let toolName of allTools) {
            this.app.configuration.updateConfigValue(`tool_${toolName}_enabled`, agent.tools?.includes(toolName) ?? false);
        }
        await this.app.persistence.setValue(PERSISTENCE_KEYS.SELECTED_AGENT, agent);
        this.app.llamaWebviewProvider.updateLlamaView();
        if (agent.name.trim() !== "") {
            vscode.window.showInformationMessage(`Agent ${agent.name} is selected.`);
        }
    }

    async deselectAgent(): Promise<void> {
        const emptyAgent = { name: "", systemInstruction: [] };
        this.app.setAgent(emptyAgent);
        const allTools = Array.from(this.app.tools.toolsFunc.keys());
        for (let toolName of allTools) {
            this.app.configuration.updateConfigValue(`tool_${toolName}_enabled`, true);
        }
        await this.app.persistence.setValue(PERSISTENCE_KEYS.SELECTED_AGENT, emptyAgent);
        this.app.llamaWebviewProvider.updateLlamaView();
        vscode.window.showInformationMessage("The agent is deselected.");
    }

    async addAgent(agentsList: Agent[], settingName: string): Promise<void> {
        let name = await Utils.getValidatedInput(
            'name for your agent (required)',
            (input) => input.trim() !== '',
            5,
            {
                placeHolder: 'Enter a user friendly name for your agent (required)',
                value: ''
            }
        );
        if (name === undefined) {
            vscode.window.showInformationMessage("Agent addition cancelled.");
            return;
        }
        name = this.app.modelService.sanitizeInput(name);

        let description = await vscode.window.showInputBox({
            placeHolder: 'description for the agent - what is the purpose, when to select etc. ',
            prompt: 'Enter description for the agent.',
            value: ''
        });
        description = this.app.modelService.sanitizeInput(description || '');

        // Collect system instruction lines
        let systemInstruction: string[] = [];
        let line: string | undefined;
        do {
            line = await vscode.window.showInputBox({
                placeHolder: 'Enter a line for system instruction (empty to finish)',
                prompt: 'System instruction line',
                value: ''
            });
            if (line && line.trim() !== '') {
                systemInstruction.push(this.app.modelService.sanitizeInput(line));
            }
        } while (line && line.trim() !== '');

        if (systemInstruction.length === 0) {
            vscode.window.showWarningMessage("No system instruction provided. Agent may not function properly.");
        }

        // Select tools
        const availableTools = Array.from(this.app.tools.toolsFunc.keys()).map(tool => ({
            label: tool,
            picked: true // default all
        }));
        const selectedToolsItems = await vscode.window.showQuickPick(availableTools, {
            canPickMany: true,
            placeHolder: 'Select tools for the agent (Ctrl+click to select multiple)'
        });
        const tools = selectedToolsItems ? selectedToolsItems.map(item => item.label) : Array.from(this.app.tools.toolsFunc.keys());

        let newAgent: Agent = {
            name: name,
            description: description,
            systemInstruction: systemInstruction,
            tools: tools
        };

        await this.persistAgent(newAgent, agentsList, settingName);
    }

    private async persistAgent(newAgent: Agent, agentsList: Agent[], settingName: string): Promise<void> {
        let agentDetails = this.getAgentDetailsAsString(newAgent);
        const shouldAddAgent = await Utils.confirmAction("A new agent will be added. Do you want to add the agent?", agentDetails);

        if (shouldAddAgent) {
            agentsList.push(newAgent);
            this.app.configuration.updateConfigValue(settingName, agentsList);
            vscode.window.showInformationMessage("The agent is added.");
        }
    }

    async deleteAgent(agentsList: Agent[], settingName: string): Promise<void> {
        const agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList, "");
        const agentItem = await vscode.window.showQuickPick(agentsItems);
        if (agentItem) {
            let agentIndex = parseInt(agentItem.label.split(". ")[0], 10) - 1;
            const shouldDeleteAgent = await Utils.confirmAction("Are you sure you want to delete the following agent?",
                this.getAgentDetailsAsString(agentsList[agentIndex])
            );
            if (shouldDeleteAgent) {
                agentsList.splice(agentIndex, 1);
                this.app.configuration.updateConfigValue(settingName, agentsList);
                vscode.window.showInformationMessage("The agent is deleted.")
            }
        }
    }

    async viewAgent(agentsList: Agent[]): Promise<void> {
        let allAgents = agentsList.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[]);
        let agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList, "");
        agentsItems = agentsItems.concat(this.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[], "(predefined) ", agentsList.length));
        let agentItem = await vscode.window.showQuickPick(agentsItems);
        if (agentItem) {
            let agentIndex = parseInt(agentItem.label.split(". ")[0], 10) - 1;
            let selectedAgent = allAgents[agentIndex];
            await this.showAgentDetails(selectedAgent);
        }
    }

    public async showAgentDetails(selectedAgent: Agent) {
        let agentDetails = this.getAgentDetailsAsString(selectedAgent);
        await Utils.showOkDialog(agentDetails);
    }

    async exportAgent(agentsList: Agent[]): Promise<void> {
        let allAgents = agentsList.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[]);
        let agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList, "");
        agentsItems = agentsItems.concat(this.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[], "(predefined) ", agentsList.length));
        let agentItem = await vscode.window.showQuickPick(agentsItems);
        if (agentItem) {
            let agentIndex = parseInt(agentItem.label.split(". ")[0], 10) - 1;
            let selectedAgent = allAgents[agentIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following agent? \n\n" +
                this.getAgentDetailsAsString(selectedAgent)
            );

            if (shouldExport) {
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedAgent.name + '.json')),
                    filters: {
                        'Agent Files': ['json'],
                        'All Files': ['*']
                    },
                    saveLabel: 'Export Agent'
                });

                if (uri) {
                    const jsonContent = JSON.stringify(selectedAgent, null, 2);
                    fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                    vscode.window.showInformationMessage("Agent is saved.")
                }
            }
        }
    }

    async importAgent(agentsList: Agent[], settingName: string): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Import Agent',
            filters: {
                'Agent Files': ['json'],
                'All Files': ['*']
            },
        });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let newAgent: Agent = JSON.parse(fileContent);

        // Sanitize imported agent
        this.sanitizeAgent(newAgent);

        await this.persistAgent(newAgent, agentsList, settingName);
    }

    private sanitizeAgent(agent: Agent): void {
        if (agent.name) agent.name = this.app.modelService.sanitizeInput(agent.name);
        if (agent.description) agent.description = this.app.modelService.sanitizeInput(agent.description);
        if (agent.systemInstruction) {
            agent.systemInstruction = agent.systemInstruction.map((s: string) => this.app.modelService.sanitizeInput(s));
        }
        // tools are strings, no need
    }

    public getAgentDetailsAsString(agent: Agent): string {
        return "Agent details: " +
            "\nname: " + agent.name +
            "\ndescription: " + agent.description +
            "\nsystem prompt: \n" + agent.systemInstruction.join("\n") +
            "\n\ntools: " + (agent.tools ? agent.tools.join(", ") : "");
    }

    private getStandardQpList(list: Agent[], prefix: string, lastAgentNumber: number = 0): QuickPickItem[] {
        const items: QuickPickItem[] = [];
        let i = lastAgentNumber;
        for (let elem of list) {
            i++;
            items.push({
                label: i + ". " + prefix + elem.name,
                description: elem.description,
            });
        }
        return items;
    }
}