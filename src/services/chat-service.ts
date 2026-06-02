import * as fs from 'fs';
import * as path from 'path';
import { Application } from "../application";
import { Chat } from "../types";
import { PERSISTENCE_KEYS, UI_TEXT_KEYS } from "../constants";
import vscode, { QuickPickItem } from "vscode";
import { Utils } from '../utils';

export class ChatService {
    private app: Application;

    constructor(application: Application) {
        this.app = application;
    }

    selectChatFromList = async () => {
        let chatsList = this.app.persistence.getChats()
        if (!chatsList || chatsList.length == 0){
            vscode.window.showInformationMessage("No chats in the history.")
            return;
        }
        const chatsItems: QuickPickItem[] = Utils.getStandardQpList(chatsList, "");
        const chat = await vscode.window.showQuickPick(chatsItems);
        if (chat) {
            let futureChat: Chat;
            futureChat = chatsList[parseInt(chat.label.split(". ")[0], 10) - 1] 
            if(!futureChat){
                vscode.window.showWarningMessage("No chat selected.");
                return;
            }
            await this.selectUpdateChat(futureChat)
        }
    }

    updateChatHistory = async () => {
        // if chat exists - update it, otherwise, just add it
        if (this.app.isChatSelected()){
            let chatToAdd = this.app.getChat();
            await this.addChatToHistory(chatToAdd);
        }
    }
    
    selectUpdateChat = async (chatToSelect: Chat) => {
        if (!chatToSelect.id){
            this.app.setChat(chatToSelect);
            await this.app.persistence.setValue(PERSISTENCE_KEYS.SELECTED_CHAT, this.app.getChat());
        } else {
            await this.updateChatHistory();
            this.app.setChat(chatToSelect);
            await this.app.persistence.setValue(PERSISTENCE_KEYS.SELECTED_CHAT, chatToSelect);
            await this.app.llamaAgent.selectChat(chatToSelect);
            this.app.llamaWebviewProvider.updateLlamaView();
        }      
    }

    deleteChatFromList = async (chatList: Chat[]) => {
        const chatsItems: QuickPickItem[] = Utils.getStandardQpList(chatList, "");
        const chat = await vscode.window.showQuickPick(chatsItems);
        if (chat) {
            const shoulDeleteChat = await Utils.confirmAction("Are you sure you want to delete the chat below?", 
                "name: " + chat.label + "\ndescription: " + chat.description
            );
            if (shoulDeleteChat) {
                let chatToDelIndex = parseInt(chat.label.split(". ")[0], 10) - 1
                chatList.splice(chatToDelIndex, 1);
                await this.app.persistence.setChats(chatList);  
                vscode.window.showInformationMessage("The chat is deleted: " + chat.label)          
            }
        }
    }

    deleteCurrentChat = async () => {
        console.log('deleteCurrentChat called');
        try {
            const currentChat = this.app.getChat();
            console.log('Got current chat, has ID:', !!currentChat?.id, 'name:', currentChat?.name);
            
            if (!currentChat || !currentChat.id) {
                console.log('No current chat to delete - showing info message');
                vscode.window.showInformationMessage("No chat to delete.");
                return;
            }
            
            console.log('Asking user for confirmation');
            const shouldDelete = await Utils.confirmAction(
                "Are you sure you want to delete the current chat?",
                "name: " + currentChat.name + "\ndescription: " + currentChat.description
            );
            console.log('User confirmed deletion:', shouldDelete);
            
            if (shouldDelete) {
                console.log('Getting chats list from persistence');
                let chatsList = this.app.persistence.getChats();
                console.log('Chats list length before:', chatsList?.length);
                
                if (!chatsList || chatsList.length === 0) {
                    console.log('Chat list is empty');
                    return;
                }
                
                const index = chatsList.findIndex((ch: Chat) => ch.id === currentChat.id);
                console.log('Chat index to delete:', index);
                
                if (index !== -1) {
                    console.log('Splicing chat at index:', index);
                    chatsList.splice(index, 1);
                    console.log('Chats list length after splice:', chatsList.length);
                    
                    console.log('Saving chats to persistence');
                    await this.app.persistence.setChats(chatsList);
                    console.log('Persistence updated');
                    
                    console.log('Updating current chat selection');
                    await this.selectUpdateChat({ name: "", id: "" });
                    console.log('Chat selection updated');
                    
                    console.log('Showing success message');
                    vscode.window.showInformationMessage("The chat '" + currentChat.name + "' is deleted.");
                    console.log('Delete completed successfully');
                } else {
                    console.log('Chat not found in list at index:', index);
                }
            } else {
                console.log('User cancelled deletion');
            }
        } catch (error) {
            console.error('Error in deleteCurrentChat:', error instanceof Error ? error.message : String(error));
            if (error instanceof Error) {
                console.error('Error stack:', error.stack);
            }
            vscode.window.showErrorMessage('Error: ' + (error instanceof Error ? error.message : String(error)));
        }
    }

    public getChatActions(): vscode.QuickPickItem[] {
        return [
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartChat) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.deleteChat) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.exportChat) ?? ""
            },
            {
                label: this.app.configuration.getUiText(UI_TEXT_KEYS.importChat) ?? ""
            },
        ];
    }

    public processChatActions = async (selected:vscode.QuickPickItem) => {
        switch (selected.label) {
            case this.app.configuration.getUiText(UI_TEXT_KEYS.selectStartChat):
                await this.selectChatFromList();
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.deleteChat):
                await this.deleteChatFromList(this.app.persistence.getChats());
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.exportChat):
                await this.exportChatFromList(this.app.persistence.getChats())
                break;
            case this.app.configuration.getUiText(UI_TEXT_KEYS.importChat):
                await this.importChatToList()
                break;
        }
    }

    private async importChatToList() {
        let name = "";
        const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Import Chat',
                filters: {
                    'Chat Files': ['json'],
                    'All Files': ['*']
                },
            });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const newChat = JSON.parse(fileContent);
        // Sanitize imported chat
        if (newChat.name) newChat.name = this.app.modelService.sanitizeInput(newChat.name);
        if (newChat.description) newChat.description = this.app.modelService.sanitizeInput(newChat.description);
        if (newChat.messages) {
            newChat.messages = newChat.messages.map((msg: any) => ({
                ...msg,
                content: this.app.modelService.sanitizeInput(msg.content || ''),
                role: this.app.modelService.sanitizeInput(msg.role || '')
            }));
        }

        await this.addChatToHistory(newChat);
    }

    private async exportChatFromList(chatsList: any[]) {
        const chatsItems: QuickPickItem[] = Utils.getStandardQpList(chatsList, "");
        let chat = await vscode.window.showQuickPick(chatsItems);
        if (chat) {
            let modelIndex = parseInt(chat.label.split(". ")[0], 10) - 1;
            let selectedChat =  chatsList[modelIndex];
            let shouldExport = await Utils.showYesNoDialog("Do you want to export the following chat? \n\n" +
                "name: " + chat.label +
                "\ndescription: " + chat.description
            );

            if (shouldExport){
                const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', selectedChat.name+'.json')),
                        filters: {
                            'Chat Files': ['json'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export Chat'
                    });

                if (!uri) {
                    return;
                }

                const jsonContent = JSON.stringify(selectedChat, null, 2);
                fs.writeFileSync(uri.fsPath, jsonContent, 'utf8');
                vscode.window.showInformationMessage("Chat is saved.")
            }
        }
    }    

    private async addChatToHistory(chatToAdd: Chat) {
        let chats = this.app.persistence.getChats();
        if (!chats) chats = [];
        const index = chats.findIndex((ch: Chat) => ch.id === chatToAdd.id);
        if (index !== -1) {
            chats.splice(index, 1);
        }
        chats.push(chatToAdd);
        if (chats.length > this.app.configuration.chats_max_history) chats.shift();
        await this.app.persistence.setChats(chats);
        vscode.window.showInformationMessage("The chat '" + chatToAdd.name + "' is added/updated.");
    }
}
