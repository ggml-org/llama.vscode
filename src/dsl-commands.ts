import {Application} from "./application";
import { ModelType, PREDEFINED_LISTS_KEYS, SETTING_NAME_FOR_LIST } from "./constants";
import { PREDEFINED_LISTS } from "./lists";
import { Agent, Env, LlmModel } from "./types";
import { Utils } from "./utils";

type CommandsMap = Map<string, (...args: any[]) => any>;

export class DslCommands {
    private app: Application
    commandsFunc: CommandsMap = new Map();
    private eventInput: Map<string, any> = new Map<string, any>();

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
        this.commandsFunc.set("managecomplmodels", this.manageComplModels);
        this.commandsFunc.set("managechatmodels", this.manageChatModels);
        this.commandsFunc.set("manageembsmodels", this.manageEmbsModels);
        this.commandsFunc.set("managetoolsmodels", this.manageToolsModels);
        this.commandsFunc.set("geteventinput", this.getEventInput);
    }

    setEventInput = (eventInput: Map<string, any>): void => {
        this.eventInput = eventInput;
    }

    public getEventInput = async (key: string): Promise<any> => {
        return this.eventInput.get(key);
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
        return this.addModel(args, ModelType.Tools);
    }

    public addCompletionModel = async (args: string) => {
        return this.addModel(args, ModelType.Completion);
    }

    public addEmbeddigsModel = async (args: string) => {
        return this.addModel(args, ModelType.Embeddings);
    }

    public addChatModel = async (args: string) => {
        return this.addModel(args, ModelType.Chat);
    }

    public addEnv = async (args: string) => {
        try{
            const envParams = args.split(",");
            const complModel: LlmModel | undefined = this.getModelFromName(this.stripArgumentValue(envParams[0].trim()), ModelType.Completion);
            const chatModel: LlmModel | undefined = this.getModelFromName(this.stripArgumentValue(envParams[1].trim()), ModelType.Chat);
            const embsModel: LlmModel | undefined = this.getModelFromName(this.stripArgumentValue(envParams[2].trim()), ModelType.Embeddings);
            const toolsModel: LlmModel | undefined = this.getModelFromName(this.stripArgumentValue(envParams[3].trim()), ModelType.Tools);
            const agent: Agent | undefined = this.app.agentService.getAllAgentsList().find(a => a.name === this.stripArgumentValue(envParams[4].trim()))
            let newEnv: Env = {
                name: this.stripArgumentValue(envParams[0].trim()),
                description: this.stripArgumentValue(envParams[1].trim()),
                completion: complModel,
                chat: chatModel,
                embeddings: embsModel,
                tools: toolsModel,
                agent: agent,
                ragEnabled: this.stripArgumentValue(envParams[5].trim()).toLowerCase() === "true" ? true : false,
                envStartLastUsed: this.stripArgumentValue(envParams[6].trim()).toLowerCase() === "true" ? true : false,
                complEnabled: this.stripArgumentValue(envParams[7].trim()).toLowerCase() === "true" ? true : false,
            };
            await this.app.envService.persistEnv(newEnv, this.app.configuration.envs_list, SETTING_NAME_FOR_LIST.ENVS)
            return "Environment is added: " + newEnv.name;
        }
        catch (error) {
            return "Environment is NOT added: " + error;
        }
    }

    public deleteToolsModel = async (modelName: string) => {
        try {
            this.deleteModel(modelName, ModelType.Tools);
            return "Model is deleted " + modelName
        } catch (error){
            return "Model is not deleted " + error
        }
    }

    public deleteCompletionModel = async (modelName: string) => {
        try {
            this.deleteModel(modelName, ModelType.Completion);
            return "Model is deleted " + modelName
        } catch (error){
            return "Model is not deleted " + error
        }
    }

    public deleteEmbeddigsModel = async (modelName: string) => {
        try {
            this.deleteModel(modelName, ModelType.Embeddings);
            return "Model is deleted " + modelName
        } catch (error){
            return "Model is not deleted " + error
        }
    }

    public deleteChatModel = async (modelName: string) => {
        try {
            this.deleteModel(modelName, ModelType.Chat);
            return "Model is deleted " + modelName
        } catch (error){
            return "Model is not deleted " + error
        }
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

    public log = async (details: string) => {
        this.app.logger.addEventLog("LVS", this.eventInput.get("toolName") , details)
        return "Logging is done."
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

    public manageComplModels = async () => {
        await this.app.modelService.processModelActions(ModelType.Completion);
        return "Manage completion models menu is shown."
    }
    
    public manageChatModels = async () => {
        await this.app.modelService.processModelActions(ModelType.Chat);
        return "Manage chat models menu is shown."
    }

    public manageEmbsModels = async () => {
        await this.app.modelService.processModelActions(ModelType.Embeddings);
        return "Manage embeddings models menu is shown."
    }

    public manageToolsModels = async () => {
        await this.app.modelService.processModelActions(ModelType.Tools);
        return "Manage tools models menu is shown."
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
        const agent = this.getAllAgentsList().find((agnt) => agnt.name === agentName);
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

    private deleteModel(modelName: string, modelType: ModelType) {
        const details = this.app.modelService.getTypeDetails(modelType);
        const modelIndex = details.modelsList.findIndex(mdl => mdl.name === modelName);
        this.app.modelService.deleteModelByIndex(details.modelsList, modelIndex, details.modelsListSettingName);
    }

    private getModelFromName(modelName: string, modelType: ModelType) {   
        let complModel: LlmModel | undefined = undefined;
        if (modelName) {
            switch (modelType) {
                case ModelType.Tools:
                    complModel = this.app.modelService.getAllToolsModelsList().find(mdl => mdl.name == modelName);
                    break;
                case ModelType.Completion:
                    complModel = this.app.modelService.getAllComplModelsList().find(mdl => mdl.name == modelName);
                    break;
                case ModelType.Chat:
                    complModel = this.app.modelService.getAllChatModelsList().find(mdl => mdl.name == modelName);
                    break;
                case ModelType.Embeddings:
                    complModel = this.app.modelService.getAllEmbsModelsList().find(mdl => mdl.name == modelName);
                    break;
            }
            
        }
        return complModel;
    }

    private addModel(args: string, modelType: ModelType) {
        let response = ""
        const modelParams = args.split(",");
        try {
            let toolsModel: LlmModel = {
                name: this.stripArgumentValue(modelParams[0].trim()),
                localStartCommand: this.stripArgumentValue(modelParams[1].trim()),
                endpoint: this.stripArgumentValue(modelParams[2].trim()),
                aiModel: this.stripArgumentValue(modelParams[3].trim()),
                isKeyRequired: this.stripArgumentValue(modelParams[4].trim()).toLowerCase() === "true" ? true : false
            };
            const details = this.app.modelService.getTypeDetails(modelType);
            this.app.modelService.addPersistModel(toolsModel, details);
            response = modelType + " model is added.";
        } catch (error) {
            response = modelType + " model is not added. " + error;
        }

        return response;
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
