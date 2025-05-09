import {Application} from "./application";
import vscode from "vscode";

export class Menu {
    private app: Application
    constructor(application: Application) {
        this.app = application;
    }

    createMenuItems = (currentLanguage: string | undefined, isLanguageEnabled: boolean): vscode.QuickPickItem[] => {
        let menuItems = [
            {
                label: `${this.app.extConfig.enabled ?  this.app.extConfig.getUiText('Disable') :  this.app.extConfig.getUiText('Enable')} ${this.app.extConfig.getUiText("All Completions")}`,
                description: `${this.app.extConfig.enabled ? this.app.extConfig.getUiText('Turn off completions globally') : this.app.extConfig.getUiText('Turn on completions globally')}`
            },
            currentLanguage ? {
                label: `${isLanguageEnabled ?  this.app.extConfig.getUiText('Disable') :  this.app.extConfig.getUiText('Enable')} ${ this.app.extConfig.getUiText("Completions for")} ${currentLanguage}`,
                description: `${ this.app.extConfig.getUiText("Currently")} ${isLanguageEnabled ?  this.app.extConfig.getUiText('enabled') :  this.app.extConfig.getUiText('disabled')}`
            } : null,
            {
                label: "$(gear) " + this.app.extConfig.getUiText("Edit Settings..."),
            },
            {
                label: "$(book) " + this.app.extConfig.getUiText("View Documentation..."),
            }]

        if (this.app.extConfig.endpoint_chat && this.app.extConfig.endpoint_chat.trim() != "")
            menuItems.push(
                {
                    label: this.app.extConfig.getUiText("Chat with AI") ?? "",
                    description: this.app.extConfig.getUiText(`Opens a chat with AI window inside VS Code using server from property endpoint_chat`)
                },
                {
                    label: this.app.extConfig.getUiText("Chat with AI with project context") ?? "",
                    description: this.app.extConfig.getUiText(`Opens a chat with AI window with project context inside VS Code using server from property endpoint_chat`)
                })

        if (process.platform === 'darwin') { // if mac os
            menuItems.push(
                {
                    label: this.app.extConfig.getUiText('Start completion model') + ' Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)',
                    description: this.app.extConfig.getUiText(`Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`)
                },
                {
                    label: this.app.extConfig.getUiText('Start completion model') + ' Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)',
                    description: this.app.extConfig.getUiText(`Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`)
                },
                {
                    label: this.app.extConfig.getUiText('Start completion model') + ' Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)',
                    description: this.app.extConfig.getUiText(`Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`)
                },
                {
                    label: this.app.extConfig.getUiText('Start completion model') + ' Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)',
                    description: this.app.extConfig.getUiText(`Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`)
                },
                {
                    label: this.app.extConfig.getUiText('Start chat model') + ' Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)',
                    description: this.app.extConfig.getUiText(`Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`)
                },
                {
                    label: this.app.extConfig.getUiText('Start chat model') + ' Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)',
                    description: this.app.extConfig.getUiText(`Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`)
                },
                {
                    label: this.app.extConfig.getUiText('Start chat model') + ' Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)',
                    description: this.app.extConfig.getUiText(`Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`)
                },
                {
                    label: this.app.extConfig.getUiText('Start chat model') + ' Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)',
                    description: this.app.extConfig.getUiText(`Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`)
                },
                {
                    label: this.app.extConfig.getUiText('Start embeddings model') + ' Nomic-Embed-Text-V2-GGUF',
                    description: this.app.extConfig.getUiText(`Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`)
                })
        }

        menuItems.push(
            {
                label: this.app.extConfig.getUiText("Start completion llama.cpp server")??"",
                description: this.app.extConfig.getUiText(`Runs the command from property launch_completion`)
            },
            {
                label: this.app.extConfig.getUiText("Start chat llama.cpp server")??"",
                description: this.app.extConfig.getUiText(`Runs the command from property launch_chat`)
            },
            {
                label: this.app.extConfig.getUiText("Start embeddings llama.cpp server")??"",
                description: this.app.extConfig.getUiText(`Runs the command from property launch_embeddings`)
            })
        if (this.app.extConfig.launch_training_completion.trim() != "") {
            menuItems.push(
            {
                label: this.app.extConfig.getUiText("Start training completion model")??"",
                description: this.app.extConfig.getUiText(`Runs the command from property launch_training_completion`)
            })
        }
        if (this.app.extConfig.launch_training_chat.trim() != "") {
                menuItems.push(
            {
                label: this.app.extConfig.getUiText("Start training chat model")??"",
                description: this.app.extConfig.getUiText(`Runs the command from property launch_training_chat`)
            })
        }
        menuItems.push(
            {
                label: this.app.extConfig.getUiText("Stop completion llama.cpp server")??"",
                description: this.app.extConfig.getUiText(`Stops completion llama.cpp server if it was started from llama.vscode menu`)
            },
            {
                label: this.app.extConfig.getUiText("Stop chat llama.cpp server")??"",
                description: this.app.extConfig.getUiText(`Stops chat llama.cpp server if it was started from llama.vscode menu`)
            },
            {
                label: this.app.extConfig.getUiText("Stop embeddings llama.cpp server")??"",
                description: this.app.extConfig.getUiText(`Stops embeddings llama.cpp server if it was started from llama.vscode menu`)
            })
        if (this.app.extConfig.launch_training_completion.trim() != "" || this.app.extConfig.launch_training_chat.trim() != "") {
            menuItems.push(
            {
                label: this.app.extConfig.getUiText("Stop training")??"",
                description: this.app.extConfig.getUiText(`Stops training if it was started from llama.vscode menu`)
            })
        }

        return menuItems.filter(Boolean) as vscode.QuickPickItem[];
    }

    handleMenuSelection = async (selected: vscode.QuickPickItem, currentLanguage: string | undefined, languageSettings: Record<string, boolean>, context: vscode.ExtensionContext) => {
        const DEFAULT_PORT_FIM_MODEL = "8012"
        const PRESET_PLACEHOLDER = "[preset]";
        const MODEL_PLACEHOLDER = "[model]"
        let endpointParts = this.app.extConfig.endpoint.split(":");
        let port = endpointParts[endpointParts.length -1]
        let endpointChatParts = this.app.extConfig.endpoint_chat.split(":");
        let endpointEmbeddingParts = this.app.extConfig.endpoint_embeddings.split(":");
        let portChat = endpointChatParts[endpointChatParts.length -1]
        let portEmbedding = endpointEmbeddingParts[endpointEmbeddingParts.length -1]
        if (!Number.isInteger(Number(port))) port =  DEFAULT_PORT_FIM_MODEL
        let llmMacVramTemplate = " brew install llama.cpp && llama-server --" + PRESET_PLACEHOLDER + " --port " + port
        let llmMacCpuTemplate = " brew install llama.cpp && llama-server -hf " + MODEL_PLACEHOLDER + " --port " + port + " -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256"
        let llmMacChatVramTemplate = " brew install llama.cpp && llama-server -hf " + MODEL_PLACEHOLDER + " --port " + portChat + " -ngl 99 -fa -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 "
        let llmMacChatCpuTemplate = " brew install llama.cpp && llama-server -hf " + MODEL_PLACEHOLDER + " --port " + portChat + " -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256"
        let llmMacEmbeddingCpuTemplate = " brew install llama.cpp && llama-server -hf " + MODEL_PLACEHOLDER + " --port " + portEmbedding + " -ub 2048 -b 2048 --ctx-size 2048 --embeddings"

        switch (selected.label) {
            case "$(gear) " +  this.app.extConfig.getUiText("Edit Settings..."):
                await vscode.commands.executeCommand('workbench.action.openSettings', 'llama-vscode');
                break;
            case this.app.extConfig.getUiText('Start completion model') + ' Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)':
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(llmMacVramTemplate.replace(PRESET_PLACEHOLDER, "fim-qwen-1.5b-default"));
                break;
            case this.app.extConfig.getUiText('Start completion model') + ' Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)':
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(llmMacVramTemplate.replace(PRESET_PLACEHOLDER, "fim-qwen-3b-default"));
                break;
            case this.app.extConfig.getUiText('Start completion model') + ' Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)':
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(llmMacVramTemplate.replace(PRESET_PLACEHOLDER, "fim-qwen-7b-default"));
                break;
            case this.app.extConfig.getUiText('Start completion model') + ' Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)':
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(llmMacCpuTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-0.5B-Instruct-Q8_0-GGUF"));
                break;
            case this.app.extConfig.getUiText('Start chat model') + ' Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)':
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(llmMacChatVramTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF"));
                break;
            case this.app.extConfig.getUiText('Start chat model') + ' Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)':
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(llmMacChatVramTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF"));
                break;
            case this.app.extConfig.getUiText('Start chat model') + ' Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)':
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(llmMacChatVramTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF"));
                break;
            case this.app.extConfig.getUiText('Start chat model') + ' Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)':
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(llmMacChatCpuTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF"));
                break;
            case this.app.extConfig.getUiText('Start embeddings model') + ' Nomic-Embed-Text-V2-GGUF':
                await this.app.llamaServer.killEmbeddingsCmd();
                await this.app.llamaServer.shellEmbeddingsCmd(llmMacEmbeddingCpuTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Nomic-Embed-Text-V2-GGUF"));
                break;
            case this.app.extConfig.getUiText('Start completion llama.cpp server'):
                await this.app.llamaServer.killFimCmd();
                let commandCompletion = this.app.extConfig.launch_completion
                if ( this.app.extConfig.lora_completion != undefined
                    && this.app.extConfig.lora_completion.trim() != "undefined" 
                    && this.app.extConfig.lora_completion.trim() != "") commandCompletion += " --lora " + this.app.extConfig.lora_completion
                await this.app.llamaServer.shellFimCmd(commandCompletion);
                break;
            case this.app.extConfig.getUiText('Start chat llama.cpp server'):
                await this.app.llamaServer.killChatCmd();
                let commandChat = this.app.extConfig.launch_chat
                if (this.app.extConfig.lora_chat != undefined
                    && this.app.extConfig.lora_chat.trim() != "undefined" 
                    && this.app.extConfig.lora_chat.trim() != "") commandChat += " --lora " + this.app.extConfig.lora_chat
                await this.app.llamaServer.shellChatCmd(commandChat);
                break;
            case this.app.extConfig.getUiText('Start embeddings llama.cpp server'):
                await this.app.llamaServer.killEmbeddingsCmd();
                let commandEmbeddings = this.app.extConfig.launch_embeddings
                await this.app.llamaServer.shellEmbeddingsCmd(commandEmbeddings);
                break;
            case this.app.extConfig.getUiText('Start training completion model'):
                await this.app.llamaServer.killTrainCmd();
                await this.app.llamaServer.shellTrainCmd(this.app.extConfig.launch_training_completion);
                break;
            case this.app.extConfig.getUiText('Start training chat model'):
                await this.app.llamaServer.killTrainCmd();
                await this.app.llamaServer.shellTrainCmd(this.app.extConfig.launch_training_chat);
                break;
            case this.app.extConfig.getUiText("Stop completion llama.cpp server"):
                await this.app.llamaServer.killFimCmd();
                break;
            case this.app.extConfig.getUiText("Stop embeddings llama.cpp server"):
                await this.app.llamaServer.killEmbeddingsCmd();
                break;
            case this.app.extConfig.getUiText("Stop chat llama.cpp server"):
                await this.app.llamaServer.killChatCmd();
                break;
            case this.app.extConfig.getUiText("Stop training"):
                await this.app.llamaServer.killTrainCmd();
                break;
            case "$(book) " + this.app.extConfig.getUiText("View Documentation..."):
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggml-org/llama.vscode'));
                break;
            case this.app.extConfig.getUiText("Chat with AI"):
                this.app.askAi.showChatWithAi(false, context)
                break;
            case this.app.extConfig.getUiText("Chat with AI with project context"):
                this.app.askAi.showChatWithAi(true, context)
                break;
            default:
                await this.handleCompletionToggle(selected.label, currentLanguage, languageSettings);
                break;
        }
        this.app.statusbar.updateStatusBarText();
    }

    private async handleCompletionToggle(label: string, currentLanguage: string | undefined, languageSettings: Record<string, boolean>) {
        const config = this.app.extConfig.config;
        if (label.includes(this.app.extConfig.getUiText('All Completions')??"")) {
            await config.update('enabled', !this.app.extConfig.enabled, true);
        } else if (currentLanguage && label.includes(currentLanguage)) {
            const isLanguageEnabled = languageSettings[currentLanguage] ?? true;
            languageSettings[currentLanguage] = !isLanguageEnabled;
            await config.update('languageSettings', languageSettings, true);
        }
    }

    showMenu = async (context: vscode.ExtensionContext) => {
        const currentLanguage = vscode.window.activeTextEditor?.document.languageId;
        const isLanguageEnabled = currentLanguage ? this.app.extConfig.isCompletionEnabled(undefined, currentLanguage) : true;

        const items = this.app.menu.createMenuItems(currentLanguage, isLanguageEnabled);
        const selected = await vscode.window.showQuickPick(items, { title: "Llama Menu" });

        if (selected) {
            await this.handleMenuSelection(selected, currentLanguage, this.app.extConfig.languageSettings, context);
        }
    }
}
