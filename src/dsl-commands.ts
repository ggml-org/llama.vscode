import {Application} from "./application";
import { ModelType, PREDEFINED_LISTS_KEYS } from "./constants";
import { PREDEFINED_LISTS } from "./lists";
import { Agent, LlmModel } from "./types";

type CommandsMap = Map<string, (...args: any[]) => any>;

export class DslCommands {
    private app: Application
    commandsFunc: CommandsMap = new Map();

    constructor(application: Application) {
        this.app = application;
        this.commandsFunc.set("settoolsmodel", this.setToolsModel);
        this.commandsFunc.set("setcompletionmodel", this.setCompletionModel);
        this.commandsFunc.set("setembeddigsmodel", this.setEmbeddigsModel);
        this.commandsFunc.set("setchatmodel", this.setChatModel);
        this.commandsFunc.set("setenv", this.setEnv);
        this.commandsFunc.set("deselecttoolsmodel", this.deselectToolsModel);
        this.commandsFunc.set("deselectcompletionmodel", this.deselectCompletionModel);
        this.commandsFunc.set("deselectembeddigsmodel", this.deselectEmbeddigsModel);
        this.commandsFunc.set("deselectchatmodel", this.deselectChatModel);
        this.commandsFunc.set("addtoolsmodel", this.addToolsModel);
        this.commandsFunc.set("deselectenv", this.deselectEnv);
        this.commandsFunc.set("addcompletionmodel", this.addCompletionModel);
        this.commandsFunc.set("addembeddigsmodel", this.addEmbeddigsModel);
        this.commandsFunc.set("addchatmodel", this.addChatModel);
        this.commandsFunc.set("addenv", this.addEnv);
        this.commandsFunc.set("deletetoolsmodel", this.deleteToolsModel);
        this.commandsFunc.set("deletecompletionmodel", this.deleteCompletionModel);
        this.commandsFunc.set("deleteembeddigsmodel", this.deleteEmbeddigsModel);
        this.commandsFunc.set("deletechatmodel", this.deleteChatModel);
        this.commandsFunc.set("deleteenv", this.deleteEnv);
        this.commandsFunc.set("exporttoolsmodel", this.exportToolsModel);
        this.commandsFunc.set("exportcompletionmodel", this.exportCompletionModel);
        this.commandsFunc.set("exportembeddigsmodel", this.exportEmbeddigsModel);
        this.commandsFunc.set("exportchatmodel", this.exportChatModel);
        this.commandsFunc.set("exportenv", this.exportEnv);
        this.commandsFunc.set("importtoolsmodel", this.importToolsModel);
        this.commandsFunc.set("importcompletionmodel", this.importCompletionModel);
        this.commandsFunc.set("importembeddigsmodel", this.importEmbeddigsModel);
        this.commandsFunc.set("importchatmodel", this.importChatModel);
        this.commandsFunc.set("importenv", this.importEnv);
        this.commandsFunc.set("addContextfile", this.addContextFile);
        this.commandsFunc.set("removecontextfile", this.removeContextFile);
        this.commandsFunc.set("removeallcontextfiles", this.removeAllContextFiles);
        this.commandsFunc.set("addcontextimage", this.addContextImage);
        this.commandsFunc.set("removecontextimage", this.removeContextImage);
        this.commandsFunc.set("executecommand", this.executeCommand);
        this.commandsFunc.set("executeterminalcommand", this.executeTerminalCommand);
        this.commandsFunc.set("addapikey", this.addApiKey);
        this.commandsFunc.set("deleteapikey", this.deleteApiKey);
        this.commandsFunc.set("installupgradellamacpp", this.installUpgradeLlamaCpp);
        this.commandsFunc.set("disableallcompletions", this.disableAllCompletions);
        this.commandsFunc.set("enableallcompletions", this.enableAllCompletions);
        this.commandsFunc.set("disablerag", this.disableRag);
        this.commandsFunc.set("enablerag", this.enableRag);
        this.commandsFunc.set("chataboutllamavscode", this.chatAboutLlamaVscode);
        this.commandsFunc.set("showview", this.showView);
        this.commandsFunc.set("log", this.log);
        this.commandsFunc.set("setsetting", this.setSetting);
        this.commandsFunc.set("getsetting", this.getSetting);
        this.commandsFunc.set("setchat", this.setChat);
        this.commandsFunc.set("deletechat", this.deleteChat);
        this.commandsFunc.set("newchat", this.newChat);
        this.commandsFunc.set("getchats", this.getChats);
        this.commandsFunc.set("gettools", this.getTools);
        this.commandsFunc.set("addtools", this.addTools);
        this.commandsFunc.set("removetools", this.removeTools);
        this.commandsFunc.set("setagent", this.setAgent);
        this.commandsFunc.set("getagents", this.getAgents);
        this.commandsFunc.set("addagent", this.addAgent);
        this.commandsFunc.set("removeagent", this.removeAgent);
        this.commandsFunc.set("exportagent", this.exportAgent);
        this.commandsFunc.set("importagent", this.importAgent);
        this.commandsFunc.set("run_terminal_command", this.setToolsModel);
        this.commandsFunc.set("run_terminal_command", this.setToolsModel);
        this.commandsFunc.set("run_terminal_command", this.setToolsModel);
        this.commandsFunc.set("run_terminal_command", this.setToolsModel);
        this.commandsFunc.set("run_terminal_command", this.setToolsModel);
        this.commandsFunc.set("run_terminal_command", this.setToolsModel);
        this.commandsFunc.set("run_terminal_command", this.setToolsModel);
    }

    public  setToolsModel = async (modelName: string) => {
        return await this.setModel(ModelType.Tools, modelName);
    }

    public setCompletionModel = async (modelName: string) => {
        return await this.setModel(ModelType.Completion, modelName);
    }

    public setEmbeddigsModel = async (modelName: string) => {
        return await this.setModel(ModelType.Embeddings, modelName);
    }

    public setChatModel = async (modelName: string) => {
        return await this.setModel(ModelType.Embeddings, modelName);
    }

    public setEnv = async (args: string) => {
        return "Not implemented"
    }

    public deselectToolsModel = async (args: string) => {
        return "Not implemented"
    }

    public deselectCompletionModel = async (args: string) => {
        return "Not implemented"
    }

    public deselectEmbeddigsModel = async (args: string) => {
        return "Not implemented"
    }

    public deselectChatModel = async (args: string) => {
        return "Not implemented"
    }

    public addToolsModel = async (args: string) => {
        return "Not implemented"
    }

    public deselectEnv = async (args: string) => {
        return "Not implemented"
    }

    public addCompletionModel = async (args: string) => {
        return "Not implemented"
    }

    public addEmbeddigsModel = async (args: string) => {
        return "Not implemented"
    }

    public addChatModel = async (args: string) => {
        return "Not implemented"
    }

    public addEnv = async (args: string) => {
        return "Not implemented"
    }

    public deleteToolsModel = async (args: string) => {
        return "Not implemented"
    }

    public deleteCompletionModel = async (args: string) => {
        return "Not implemented"
    }

    public deleteEmbeddigsModel = async (args: string) => {
        return "Not implemented"
    }

    public deleteChatModel = async (args: string) => {
        return "Not implemented"
    }

    public deleteEnv = async (args: string) => {
        return "Not implemented"
    }

    public exportToolsModel = async (args: string) => {
        return "Not implemented"
    }

    public exportCompletionModel = async (args: string) => {
        return "Not implemented"
    }

    public exportEmbeddigsModel = async (args: string) => {
        return "Not implemented"
    }

    public exportChatModel = async (args: string) => {
        return "Not implemented"
    }

    public exportEnv = async (toolsModel: string) => {
        return "Not implemented"
    }

    public importToolsModel = async (args: string) => {
        return "Not implemented"
    }
    
    public importCompletionModel = async (args: string) => {
        return "Not implemented"
    }

    public importEmbeddigsModel = async (args: string) => {
        return "Not implemented"
    }

    public importChatModel = async (args: string) => {
        return "Not implemented"
    }

    public importEnv = async (args: string) => {
        return "Not implemented"
    }

    public addContextFile = async (args: string) => {
        return "Not implemented"
    }

    public removeContextFile = async (args: string) => {
        return "Not implemented"
    }

    public removeAllContextFiles = async (args: string) => {
        return "Not implemented"
    }

    public addContextImage = async (args: string) => {
        return "Not implemented"
    }

    public removeContextImage = async (args: string) => {
        return "Not implemented"
    }

    public executeCommand = async (args: string) => {
        return "Not implemented"
    }

    public executeTerminalCommand = async (args: string) => {
        return "Not implemented"
    }

    public addApiKey = async (args: string) => {
        return "Not implemented"
    }

    public deleteApiKey = async (args: string) => {
        return "Not implemented"
    }

    public installUpgradeLlamaCpp = async (args: string) => {
        return "Not implemented"
    }

    public disableAllCompletions = async (args: string) => {
        return "Not implemented"
    }

    public enableAllCompletions = async (args: string) => {
        return "Not implemented"
    }

    public disableRag = async (args: string) => {
        return "Not implemented"
    }

    public enableRag = async (args: string) => {
        return "Not implemented"
    }

    public chatAboutLlamaVscode = async (args: string) => {
        return "Not implemented"
    }

    // for agent, env, edit-agent, chat-with-ai, local-ai-runner
    public showView = async (args: string) => {
        return "Not implemented"
    }

    public log = async (args: string) => {
        return "Not implemented"
    }
    
    public setSetting = async (args: string) => {
        const splitIndex = args.indexOf(" ")
        const settingName = args.slice(0, splitIndex)
        
        const settingValue = args.slice(splitIndex + 1)
        // TODO Get the setting from setting name and get the type - check for types instead for settings
        if (settingName.toLowerCase() === "enabled"
            ||settingName.toLowerCase() === "rag_enabled") await this.app.configuration.updateConfigValue(settingName, settingValue.toLowerCase() == "true")
        else await this.app.configuration.updateConfigValue(settingName, settingValue)
        
        return `Setting ${settingName} is set to ${settingValue}`
    }

    public getSetting = async (args: string) => {
        return "Not implemented"
    }

    public setChat = async (args: string) => {
        return "Not implemented"
    }

    public deleteChat = async (args: string) => {
        return "Not implemented"
    }

    public newChat = async (args: string) => {
        return "Not implemented"
    }

    public getChats = async (args: string) => {
        return "Not implemented"
    }

    public getTools = async (args: string) => {
        return "Not implemented"
    }

    public addTools = async (args: string) => {
        return "Not implemented"
    }

    public removeTools = async (args: string) => {
        return "Not implemented"
    }

    public setAgent = async (agentName: string) => {
        const agent = this.getAllAgentsList().find((agnt) => agnt.name === agentName);;
        let response = ""
        if (agent) {
            await this.app.agentService.selectAgent(agent)
            response = `The agent ${agent.name} is set.`
        } else {
            response = `The agent ${agentName} is not found.`
        }

        return response
    }

    public getAgents = async (args: string) => {
        return "Not implemented"
    }

    public addAgent = async (args: string) => {
        return "Not implemented"
    }

    public removeAgent = async (args: string) => {
        return "Not implemented"
    }

    public exportAgent = async (args: string) => {
        return "Not implemented"
    }

    public importAgent = async (args: string) => {
        return "Not implemented"
    }

    private async setModel(modelType: ModelType, modelName: string) {
        const model = this.getAllModelsList(modelType).find((model) => model.name === modelName);
        let result = "";
        if (model) {
            await this.app.modelService.selectStartModel(model, modelType, this.app.modelService.getTypeDetails(modelType));
            result = `The ${modelType} model is set to ${modelName}`;
        } else {
            result = `The ${modelType} model ${modelName} is not found.`;
        }
        return result;
    }

    // TODO Add commands (synonims)  select* for the tools + selectChat + selectAgent)
    // return is also a command, but will be handled by the interpreter

    private getAllModelsList(modelType: ModelType): LlmModel[] {
        switch (modelType) {
            case ModelType.Tools:  
                return this.app.configuration.tools_models_list
                    .concat((PREDEFINED_LISTS.get(ModelType.Tools) as LlmModel[]))
                break;
            case ModelType.Chat:  
                return this.app.configuration.chat_models_list
                    .concat((PREDEFINED_LISTS.get(ModelType.Tools) as LlmModel[]))
                break;
            case ModelType.Completion:  
                return this.app.configuration.completion_models_list
                    .concat((PREDEFINED_LISTS.get(ModelType.Tools) as LlmModel[]))
                break;
            case ModelType.Embeddings:  
                return this.app.configuration.embeddings_models_list
                    .concat((PREDEFINED_LISTS.get(ModelType.Tools) as LlmModel[]))
                break;
            default:
                return [];
        }
    }

    private getAllAgentsList(): Agent[] {
            return this.app.configuration.agents_list
                    .concat((PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[]))
        }
}
