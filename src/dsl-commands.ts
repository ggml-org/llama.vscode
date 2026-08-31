import {Application} from "./application";
import { ModelType, PREDEFINED_LISTS_KEYS } from "./constants";
import { PREDEFINED_LISTS } from "./lists";
import { Agent, Env, LlmModel } from "./types";
import { Utils } from "./utils";

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
        this.commandsFunc.set("runterminalcommand", this.runTerminalCommand);
        this.commandsFunc.set("showinfo", this.showInfo);
        this.commandsFunc.set("compact", this.compact);
    }

    public compact = async() => {
        const isSummarized = await this.app.llamaAgent.summarize()
        let result = "Chat is not compacted."
        if (isSummarized) result = "Chat is compacted"
        return result
    }

    public stripArgumentValue = (argument: string): string => {
        if (argument.startsWith('"') && argument.endsWith('"')) {
            return argument.slice(1, -1);
        }
        if (argument.startsWith("'") && argument.endsWith("'")) {
            return argument.slice(1, -1);
        }
        if (argument.startsWith('`') && argument.endsWith('`')) {
            return argument.slice(1, -1);
        }
        return argument;
    }

    public runTerminalCommand = async (command: string) => {
        let {stdout, stderr} = await this.app.llamaServer.executeCommandWithTerminalFeedback(command);
        return (stdout + "\n\n" + stderr).slice(0, this.app.configuration.MAX_CHARS_TOOL_RETURN);
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

    public setEnv = async (envName: string) => {
        let result = ""
        envName = this.stripArgumentValue(envName)
        let allEnvs = this.app.configuration.envs_list
            .concat((PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.ENVS) as Env[]))
        const env = allEnvs.find((env) => env.name === envName);
        if (env) {
            await this.app.envService.selectStartEnv(env, true)
            result = `Env ${envName} is selected.`
        } else {
            result = `Env ${envName} is not found.`
        }
        
        return result
    }

    public deselectToolsModel = async () => {
        return await this.deselectModel(ModelType.Tools);
    }

    public deselectCompletionModel = async (args: string) => {
        return await this.deselectModel(ModelType.Completion);
    }

    public deselectEmbeddigsModel = async (args: string) => {
        return await this.deselectModel(ModelType.Embeddings);
    }

    public deselectChatModel = async (args: string) => {
        return await this.deselectModel(ModelType.Chat);
    }

    

    public deselectEnv = async (args: string) => {
        await this.app.envService.stopEnv();

        return `Env is deselected (stopped)`
    }

    public addToolsModel = async (args: string) => {
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

    public showInfo = async (msg: string) => {
        await this.app.dialogs.showOkDialog(msg)
        return "Info is shown"
    }
    
    public setSetting = async (args: string) => {
        const splitIndex = args.indexOf(" ")
        let settingName = args.slice(0, splitIndex).trim().toLowerCase()
        
        let settingValue = args.slice(splitIndex + 1)
        settingName = this.stripArgumentValue(settingName)
        settingValue = this.stripArgumentValue(settingValue)
            
        const value = this.getPropertyType(this.app.configuration, settingName as keyof typeof this.app.configuration);
        if (settingName == "env_start_last_used") await this.app.configuration.updateEnvStartLastUsed(settingValue.toLowerCase() == "true")
        else if (typeof value == "boolean") await this.app.configuration.updateConfigValue(settingName, settingValue.toLowerCase() == "true")
        else if (typeof value == "number") await this.app.configuration.updateConfigValue(settingName, Number(settingValue))
        else await this.app.configuration.updateConfigValue(settingName, settingValue)
        
        return `Setting ${settingName} is set to ${settingValue}`
    }

    public getSetting = async (settingName: string) => {
        const setting = this.app.configuration[settingName.trim().toLowerCase() as keyof typeof this.app.configuration]
        return setting
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
        agentName = this.stripArgumentValue(agentName)
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

    private async deselectModel(modelType: ModelType) {
        await this.app.modelService.deselectAndClearModel(modelType);

        return `The model for ${modelType} is deselected/stopped`;
    }

    private async setModel(modelType: ModelType, modelName: string) {
        modelName = this.stripArgumentValue(modelName)
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

    private getPropertyType<T, K extends keyof T>(obj: T, key: K): T[K] {
        return obj[key];
    }
}
