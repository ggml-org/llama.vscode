import { Application } from "./application";
import vscode from "vscode";
import { Utils } from "./utils";


export class Git {
    private app: Application

    constructor(application: Application) {
        this.app = application;
    }

    generateCommitMessage = async (): Promise<void> => {
        let chatUrl = this.app.configuration.endpoint_chat
        if (!chatUrl) chatUrl = this.app.configuration.endpoint_tools;
        let chatModel = this.app.getChatModel();    
        if (!this.app.isChatModelSelected() && !this.app.configuration.endpoint_chat) chatModel = this.app.getToolsModel();
        if (chatModel.endpoint) {
            const chatEndpoint = Utils.trimTrailingSlash(chatModel.endpoint)
            chatUrl = chatEndpoint ? chatEndpoint + "/" : "";
        }
        if (!chatUrl) {
            await Utils.suggestModelSelection(
                "Select a chat or tools model or an env with chat or tools model to generate a commit message.",
                "After the chat/tools model is loaded, try again generating commit message.",
                "No endpoint for the chat model. Select a chat or tools model or an env with chat or tools model or enter the endpoint of a server with chat model in setting endpoint_chat.",
                this.app
            );

            return
        }

        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        const git = gitExtension?.getAPI(1);
        if (!git) {
            vscode.window.showErrorMessage('extension vscode.git not found');
            return;
        }

        if (git.repositories.length === 0) {
            vscode.window.showErrorMessage('can`t use on non git dir');
            return;
        }
        const repo = git.repositories[0];

        try {
            let diff = await repo.diff(true);

            if (!diff || diff.trim() === '') {
                // use unstaged change
                diff = await repo.diff(false);
                if (!diff || diff.trim() === '') {
                    vscode.window.showWarningMessage('git diff is empty');
                    return;
                }
                vscode.window.showWarningMessage('git staged change is empty, using unstaged change');
            }

            const prompt = this.app.prompts.replaceOnePlaceholder(this.app.prompts.CREATE_GIT_DIFF_COMMIT, "diff", diff);
            vscode.window.withProgress({
                location: vscode.ProgressLocation.SourceControl,
                title: 'llama.vscode is generating a commit message...',
                cancellable: false
            }, async (progress) => {
                try {
                    // TODO stream output the commit message, need for llamaServer with stream output support
                    const completion = await this.app.llamaServer.getChatCompletion(prompt)
                    const commitMessage = completion?.choices[0]?.message.content

                    if (commitMessage) {
                        repo.inputBox.value = commitMessage;
                    } else {
                        vscode.window.showErrorMessage('unexpected error for generating commit message is empty');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`errors in generateCommitMessage: ${error instanceof Error ? error.message : String(error)}`);
                }
                progress.report({ increment: 100 });
            });
        } catch (error) {
            vscode.window.showErrorMessage(`errors in generateCommitMessage: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    getLatestChanges = async (): Promise<string> => {
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        const git = gitExtension?.getAPI(1);
        if (!git) {
            vscode.window.showErrorMessage('extension vscode.git not found');
            return "";
        }

        if (git.repositories.length === 0) {
            vscode.window.showErrorMessage('can`t use on non git dir');
            return "";
        }
        const repo = git.repositories[0];

        try {
            let diff = await repo.diff(true);

            if (!diff || diff.trim() === '') {
                // use unstaged change
                diff = await repo.diff(false);
                if (!diff || diff.trim() === '') {
                    vscode.window.showWarningMessage('git diff is empty');
                    return "";
                }
                vscode.window.showWarningMessage('git staged change is empty, using unstaged change');
            }


            return diff??"";
            
        } catch (error) {
            vscode.window.showErrorMessage(`errors in generateCommitMessage: ${error instanceof Error ? error.message : String(error)}`);
            return "";
        }
    }
}
