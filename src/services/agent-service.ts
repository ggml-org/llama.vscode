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
    public editedAgentTools: Map<string,string> = new Map();

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
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.editAgent) ?? "",
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.copyAgent) ?? "",
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

    async processActions(): Promise<void> {
        let agentsActions: vscode.QuickPickItem[] = this.app.agentService.getActions();
        let actionSelected = await vscode.window.showQuickPick(agentsActions);
        if (!actionSelected) return
        switch (actionSelected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartAgent):
                await this.pickAndSelectAgent(this.app.configuration.agents_list);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.addAgent):
                await this.addAgent(this.app.configuration.agents_list, SETTING_NAME_FOR_LIST.AGENTS);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.editAgent):
                this.editAgent(this.app.configuration.agents_list);
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.copyAgent):
                this.copyAgent();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteAgent):
                await this.deleteAgent();
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
        this.app.llamaWebviewProvider.showAgentEditor();
        this.app.llamaWebviewProvider.addEditAgent({name: "", description: "", systemInstruction: [], tools: []})
    }

    selectTools = async (currentTools: string[]): Promise<string[]> => {
        const availableTools = Array.from(this.app.tools.toolsFunc.keys()).map(tool => ({
            label: tool,
            picked: currentTools.includes(tool)
        }));
        const selectedToolsItems = await vscode.window.showQuickPick(availableTools, {
            canPickMany: true,
            placeHolder: 'Select tools for the agent'
        });
        const tools = selectedToolsItems ? selectedToolsItems.map(item => item.label) : Array.from(this.app.tools.toolsFunc.keys());

        return tools;
    }

    private async persistNewAgent(newAgent: Agent, agentsList: Agent[], settingName: string, confirmMessage: string): Promise<void> {
        let agentDetails = this.getAgentDetailsAsString(newAgent);
        const shouldAddAgent = await Utils.confirmAction(confirmMessage, agentDetails);

        if (shouldAddAgent) {
            agentsList.push(newAgent);
            this.app.configuration.updateConfigValue(settingName, agentsList);
            vscode.window.showInformationMessage("The agent is added.");
        }
    }

    private async persistEditedAgent(editedAgent: Agent, agentsList: Agent[], settingName: string): Promise<void> {
        let agentDetails = this.getAgentDetailsAsString(editedAgent);
        const shouldAddAgent = await Utils.confirmAction("Do you want to update agent?", agentDetails);
        
        if (shouldAddAgent) {
            let agentExisting = agentsList.find(agn => agn.name.trim() == editedAgent.name.trim())
            if (agentExisting){
                agentExisting.description = editedAgent.description
                agentExisting.systemInstruction = editedAgent.systemInstruction
                agentExisting.tools = editedAgent.tools
                this.app.configuration.updateConfigValue(settingName, agentsList);
                vscode.window.showInformationMessage("The agent is updated: " + agentExisting.name);
            } else {
                vscode.window.showWarningMessage("The agent to update is not found!")
            }
        }
    }

    addUpdateAgent = async (agentToAddUpdate: Agent) => {
        let agentsList = this.app.configuration.agents_list;
        if (agentsList.findIndex(agn => agn.name.trim() == agentToAddUpdate.name.trim()) == -1){
            await this.persistNewAgent(
                agentToAddUpdate, 
                agentsList, 
                SETTING_NAME_FOR_LIST.AGENTS,
                "A new agent will be added. Do you want to add the agent?"
            );
        } else {
            await this.persistEditedAgent(agentToAddUpdate, agentsList, SETTING_NAME_FOR_LIST.AGENTS)
        }
    }

    async deleteAgent(): Promise<void> {
        let agentsList: Agent[] = this.app.configuration.agents_list;
        const agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList, "");
        const agentItem = await vscode.window.showQuickPick(agentsItems);
        if (agentItem) {
            let agentIndex = parseInt(agentItem.label.split(". ")[0], 10) - 1;
            const shouldDeleteAgent = await Utils.confirmAction("Are you sure you want to delete the following agent?",
                this.getAgentDetailsAsString(agentsList[agentIndex])
            );
            if (shouldDeleteAgent) {
                agentsList.splice(agentIndex, 1);
                this.app.configuration.updateConfigValue(SETTING_NAME_FOR_LIST.AGENTS, agentsList);
                vscode.window.showInformationMessage("The agent is deleted.")
            }
        }
    }

    async editAgent(agentsList: Agent[]): Promise<void> {
        const agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList, "");
        const agentItem = await vscode.window.showQuickPick(agentsItems);
        if (agentItem) {
            let agentIndex = parseInt(agentItem.label.split(". ")[0], 10) - 1;
            this.app.llamaWebviewProvider.showAgentEditor();
            setTimeout(() => {
                this.app.llamaWebviewProvider.addEditAgent(agentsList[agentIndex])
            }, 500);
            
        }
    }

    async copyAgent(): Promise<void> {
        let agentsList = this.app.configuration.agents_list
        let allAgents = agentsList.concat(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[]);
        let agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList, "");
        agentsItems = agentsItems.concat(this.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[], "(predefined) ", agentsList.length));
        let agentItem = await vscode.window.showQuickPick(agentsItems);
        if (agentItem) {
            let agentIndex = parseInt(agentItem.label.split(". ")[0], 10) - 1;
            this.app.llamaWebviewProvider.showAgentEditor();
            const selectedAgent = allAgents[agentIndex];
            const newAgent: Agent = {
                name: "Copy of " + agentItem.label,
                description: selectedAgent.description,
                systemInstruction: selectedAgent.systemInstruction,
                tools: selectedAgent.tools
            }
            setTimeout(() => {
                this.app.llamaWebviewProvider.addEditAgent(newAgent)
            }, 500);
        }
        
        // let agentsItems: QuickPickItem[] = this.getStandardQpList(agentsList, "");
        // agentsItems = agentsItems.concat(this.getStandardQpList(PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[], "(predefined) ", agentsList.length));
        // const agentItem = await vscode.window.showQuickPick(agentsItems);
        // if (agentItem) {
        //     let agentIndex = parseInt(agentItem.label.split(". ")[0], 10) - 1;
        //     this.app.llamaWebviewProvider.showAgentEditor();
        //     const selectedAgent = agentsList[agentIndex];
        //     const newAgent: Agent = {
        //         name: "Copyt of " + selectedAgent.name,
        //         description: selectedAgent.description,
        //         systemInstruction: selectedAgent.systemInstruction,
        //         tools: selectedAgent.tools
        //     }
        //     setTimeout(() => {
        //         this.app.llamaWebviewProvider.addEditAgent(newAgent)
        //     }, 500);
            
       // }
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

        await this.persistNewAgent(newAgent, agentsList, settingName,"A new agent will be added. Do you want to add the agent?");
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

    resetEditedAgentTools = () => {
        this.editedAgentTools.clear();
        this.app.llamaWebviewProvider.updateContextFilesInfo();
    }

    addEditedAgentTools = (toolName: string, toolDescription: string) => {
        this.editedAgentTools.set(toolName, toolDescription);
    }

    removeEditedAgentTools = (toolName: string) => {
        this.editedAgentTools.delete(toolName);
    }

    getEditedAgentTools = () => {
        return this.editedAgentTools;
    }
}