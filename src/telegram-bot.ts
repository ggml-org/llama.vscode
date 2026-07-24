
import TelegramBotApi, { Message } from "node-telegram-bot-api";
import {Application} from "./application";
import { ModelType, PREDEFINED_LISTS_KEYS, TELEGRAM_BOT_COMMANDS, UI_TEXT_KEYS } from "./constants";
import { PREDEFINED_LISTS } from "./lists";
import { Agent, LlmModel } from "./types";

export class TelegramBot {
    private app: Application
    private bot: TelegramBotApi | null = null
    private lastChatId: number | null = null

    constructor(application: Application) {
        this.app = application;
        if (this.app.configuration.telegram_bot_enabled) {
            this.createBot(this.app.configuration.telegram_api_token)
        }
    }

    createBot = (token: string) => {
        if (this.bot) {
            this.bot.close();
        }
        try {
            if (this.app.configuration.telegram_bot_enabled && token) {
                this.bot = new TelegramBotApi(token, {polling: true});
                this.bot.on("message", this.handleMessage);
                this.app.logger.addEventLog("TELEGRAM", "BOT_CREATED", "Telegram bot created and polling started.");
            }
        } catch (error) {
            this.app.logger.addEventLog("TELEGRAM", "BOT_CREATE_ERROR", "Failed to create telegram bot: " + error);
        }
    }

    private handleMessage = async (msg: Message) => {
        const receivedMessage = msg.text;
        this.lastChatId = msg.chat.id;
        if (!this.app.configuration.telegram_bot_users.split(",").map(item => item.trim()).includes(msg.chat?.id.toString()??"")) {
            this.sendResponse(
                this.app.configuration.getUiText(UI_TEXT_KEYS.telegramTheUser) + 
                " " + msg.from?.first_name + " " + 
                this.app.configuration.getUiText(UI_TEXT_KEYS.telegramUserNotAuthorized)
            )
            return;
        }
        if (!receivedMessage 
            || receivedMessage == "/start") {
                return;
            }
        if (this.app.llamaAgent.isAgentInProgress()) {
            if (receivedMessage.toLocaleLowerCase().trim() =="/stop") {
                this.app.llamaAgent.stopAgent()
                this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramStopRequestSent)??"");
                return;
            }
            this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramAgentRunningWait)??"");
            return;
        }

        switch (receivedMessage.toLocaleLowerCase().trim()) {
            case TELEGRAM_BOT_COMMANDS.SHOW_ENVIRONMENT:
                const msgEnv = "tools model: \n" + this.app.getToolsModel()?.name + "\nagent: " + this.app.getAgent()?.name;
                this.sendResponse(msgEnv);
                return; 
            case TELEGRAM_BOT_COMMANDS.SHOW_MODELS:
                const propModelsCount = this.app.configuration.tools_models_list.length
                const msgModels = "Available models: \n" +
                                    this.getAllModelsList()
                                    .map((mdl, index) => `${index + 1}. ${index >= propModelsCount ? "(predefined) " + mdl.name : mdl.name}`)
                                    .join("\n ");
                this.sendResponse(msgModels);
                return;
            case TELEGRAM_BOT_COMMANDS.SHOW_AGENTS:
                const propAgentsCount = this.app.configuration.agents_list.length
                const allAgents = this.getAllAgentsList();
                const msgAgents = "Available agents: \n" +
                        allAgents.map((agent, index) => `${index+1}. ${index >= propAgentsCount ? "(predefined) " + agent.name : agent.name}`)
                        .join("\n ");
                this.sendResponse(msgAgents);
                return;
            case TELEGRAM_BOT_COMMANDS.STOP_AGENT:
                this.app.llamaAgent.stopAgent()
                this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramStopRequestSent)??"");
                return; 
            case TELEGRAM_BOT_COMMANDS.SHOW_AGENT_STATUS:
                if (this.app.llamaAgent.isAgentInProgress()) {
                    this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramAgentRunning)??"");
                } else {
                    this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramAgentNotRunnin)??"");
                }
                return;    
            case TELEGRAM_BOT_COMMANDS.SHOW_HELP:
                this.sendResponse(
                    this.app.configuration.getUiText(UI_TEXT_KEYS.telegramHelpSendPrompt) + " \n" +
                    this.app.configuration.getUiText(UI_TEXT_KEYS.telegramHelpConfigure) + " \n" +
                    this.app.configuration.getUiText(UI_TEXT_KEYS.telegramHelpAgentCommands) + "\n" +
                    this.getCommandsHelp()
                );
                return;
        }

        if (receivedMessage.toLowerCase().startsWith(TELEGRAM_BOT_COMMANDS.SHOW_CHAT)){
            const chatSize = receivedMessage.split(" ")[1];
            let maxChatChars = 1000
            if (chatSize){
                maxChatChars = Number(chatSize);
                if (isNaN(maxChatChars)) {
                    maxChatChars = 1000;
                }
            }
            const msgChat = "Current chat: \n" + this.app.llamaAgent.getAgentLogText().slice(-maxChatChars);
            await this.sendResponse(msgChat);
            return;
        }

        if (receivedMessage.toLowerCase().startsWith(TELEGRAM_BOT_COMMANDS.SET_AGENT)){
            const agentNumber = receivedMessage.split(" ")[1];
            if (agentNumber){
                let agentIndex = Number(agentNumber);
                if (!isNaN(agentIndex)) {
                    agentIndex -= 1;
                } else {
                    this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramEnterCorrectAgent)??"");
                    return;
                }
                const agent = this.getAllAgentsList()[agentIndex];
                if (agent) {
                    await this.app.agentService.selectAgent(agent)
                    this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramAgentSetTo) + " " + agent.name);
                    return;
                } else {
                    this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramAgentNotFound)??"");
                    return;
                }
            } else {
                this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramEnterAgentNumber)??"");
                return;
            }
        }

        if (receivedMessage.toLowerCase().startsWith(TELEGRAM_BOT_COMMANDS.SET_MODEL)){
            const modelNumber = receivedMessage.split(" ")[1];
            if (modelNumber){
                let modelIndex = Number(modelNumber);
                if (!isNaN(modelIndex)) {
                    modelIndex -= 1;
                } else {
                    this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramEnterCorrectModel)??"");
                    return;
                }
                const model = this.getAllModelsList()[modelIndex];
                if (model) {
                    await this.app.modelService.selectStartModel(model, ModelType.Tools, this.app.modelService.getTypeDetails(ModelType.Tools))
                    this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramModelSetTo) + " " + model.name);
                    return;
                } else {
                    this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramEnterCorrectModel)??"");
                    return;
                }
            } else {
                this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramEnterCorrectModel)??"");
                return;
            }
        }

        let command = ""
        if (receivedMessage.toLowerCase().startsWith("//")){
            command = receivedMessage.slice(2)
        } else if (receivedMessage.toLowerCase().startsWith("/")) {
            this.sendResponse(this.app.configuration.getUiText(UI_TEXT_KEYS.telegramUnknownCommand) + ": " + receivedMessage + "\n" +
                this.getCommandsHelp()
            );
            return;
        }

        try {
            await this.app.llamaAgent.run(receivedMessage, command, true);
        } catch (error) {
            this.app.logger.addEventLog("TELEGRAM", "AGENT_RUN_ERROR", "Failed to run llama agent: " + error);
        }
    }

    getCommandsHelp = (): string => {
        return this.app.configuration.getUiText(UI_TEXT_KEYS.telegramAvailableCommands) +"\n" +
                TELEGRAM_BOT_COMMANDS.SHOW_ENVIRONMENT + " - " + this.app.configuration.getUiText(UI_TEXT_KEYS.telegramCmdEnvDesc) + "\n" + 
                TELEGRAM_BOT_COMMANDS.SHOW_MODELS + " - " + this.app.configuration.getUiText(UI_TEXT_KEYS.telegramCmdModelsDesc)+ "\n" + 
                TELEGRAM_BOT_COMMANDS.SHOW_AGENTS + " - " + this.app.configuration.getUiText(UI_TEXT_KEYS.telegramCmdAgentsDesc) + "\n" + 
                TELEGRAM_BOT_COMMANDS.SET_MODEL + " n - " + this.app.configuration.getUiText(UI_TEXT_KEYS.telegramCmdSetModelDesc) + "\n" + 
                TELEGRAM_BOT_COMMANDS.SET_AGENT + " n - " + this.app.configuration.getUiText(UI_TEXT_KEYS.telegramCmdSetAgentDesc) + "\n" + 
                TELEGRAM_BOT_COMMANDS.STOP_AGENT + " - " + this.app.configuration.getUiText(UI_TEXT_KEYS.telegramCmdStopDesc) + "\n" + 
                TELEGRAM_BOT_COMMANDS.SHOW_AGENT_STATUS + " - " + this.app.configuration.getUiText(UI_TEXT_KEYS.telegramCmdStatusDesc) + "\n" + 
                TELEGRAM_BOT_COMMANDS.SHOW_CHAT + " n - " + this.app.configuration.getUiText(UI_TEXT_KEYS.telegramCmdChatDesc) + "\n" +
                TELEGRAM_BOT_COMMANDS.SHOW_HELP + " - " + this.app.configuration.getUiText(UI_TEXT_KEYS.telegramCmdHelpDesc)
    }

    sendResponse = async (response: string) => {
        if (!this.bot) {
            this.app.logger.addEventLog("TELEGRAM", "SEND_RESPONSE_NO_BOT", "Telegram bot is not created.");
            return;
        }
        if (this.lastChatId === null) {
            this.app.logger.addEventLog("TELEGRAM", "SEND_RESPONSE_NO_CHAT", "No chat available to send the response to.");
            return;
        }
        try {
            await this.bot.sendMessage(this.lastChatId, response);
        } catch (error) {
            this.app.logger.addEventLog("TELEGRAM", "SEND_RESPONSE_ERROR", "Failed to send bot response: " + error);
        }
    }

    private getAllModelsList(): LlmModel[] {
        return this.app.configuration.tools_models_list
                .concat((PREDEFINED_LISTS.get(ModelType.Tools) as LlmModel[]))
    }

    private getAllAgentsList(): Agent[] {
        return this.app.configuration.agents_list
                .concat((PREDEFINED_LISTS.get(PREDEFINED_LISTS_KEYS.AGENTS) as Agent[]))
    }
}