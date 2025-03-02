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
                label: `${this.app.extConfig.enabled ? 'Disable' : 'Enable'} All Completions`,
                description: `Turn ${this.app.extConfig.enabled ? 'off' : 'on'} completions globally`
            },
            currentLanguage ? {
                label: `${isLanguageEnabled ? 'Disable' : 'Enable'} Completions for ${currentLanguage}`,
                description: `Currently ${isLanguageEnabled ? 'enabled' : 'disabled'}`
            } : null,
            {
                label: "$(gear) Edit Settings...",
            },
            {
                label: "$(book) View Documentation...",
            }]

        if (this.app.extConfig.endpoint_chat && this.app.extConfig.endpoint_chat.trim() != "")
            menuItems.push(
                {
                    label: "Chat with AI",
                    description: `Opens a chat with AI window inside VS Code using server from property chatendpoint`
                },
                {
                    label: "Chat with AI with project context",
                    description: `Opens a chat with AI window with project context inside VS Code using server from property chatendpoint`
                })


        if (process.platform === 'darwin') { // if mac os
            menuItems.push(
                {
                    label: "Start completion model Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                },
                {
                    label: "Start completion model Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                },
                {
                    label: "Start completion model Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                },
                {
                    label: "Start completion model Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                }, 
                {
                    label: "Start chat model Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                },
                {
                    label: "Start chat model Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                },
                {
                    label: "Start chat model Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                },
                {
                    label: "Start chat model Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                })
        }

        menuItems.push(
            {
                label: "Start completion llama.cpp server with custom command from launch_completion property",
                description: `Runs the command from property launch_fim`
            },
            {
                label: "Start chat llama.cpp server with custom command from launch_chat property",
                description: `Runs the command from property launch_chat`
            },
            {
                label: "Stop completion llama.cpp server",
                description: `Stops completion llama.cpp server if it was started from llama.vscode menu."`
            },
            {
                label: "Stop chat llama.cpp server",
                description: `Stops chat llama.cpp server if it was started from llama.vscode menu."`
            })     

        return menuItems.filter(Boolean) as vscode.QuickPickItem[];
    }

    handleMenuSelection = async (selected: vscode.QuickPickItem, currentLanguage: string | undefined, languageSettings: Record<string, boolean>, context: vscode.ExtensionContext) => {
        const DEFAULT_PORT_FIM_MODEL = "8012"
        const PRESET_PLACEHOLDER = "[preset]";
        const MODEL_PLACEHOLDER = "[model]"
        let endpointParts = this.app.extConfig.endpoint.split(":");
        let port = endpointParts[endpointParts.length -1]
        let endpointChatParts = this.app.extConfig.endpoint_chat.split(":");
        let portChat = endpointChatParts[endpointChatParts.length -1]
        if (!Number.isInteger(Number(port))) port =  DEFAULT_PORT_FIM_MODEL
        let llmMacVramTemplate = " brew install llama.cpp && llama-server --" + PRESET_PLACEHOLDER + " --port " + port 
        let llmMacCpuTemplate = " brew install llama.cpp && llama-server -hf " + MODEL_PLACEHOLDER + " --port " + port + " -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256"
        let llmMacChatVramTemplate = " brew install llama.cpp && llama-server -hf " + MODEL_PLACEHOLDER + " --port " + portChat + " -ngl 99 -fa -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 " 
        let llmMacChatCpuTemplate = " brew install llama.cpp && llama-server -hf " + MODEL_PLACEHOLDER + " --port " + portChat + " -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256"
        
        switch (selected.label) {
            case "$(gear) Edit Settings...":
                await vscode.commands.executeCommand('workbench.action.openSettings', 'llama-vscode');
                break;
            case "Start completion model Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)":
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(llmMacVramTemplate.replace(PRESET_PLACEHOLDER, "fim-qwen-1.5b-default"));
                break;
            case "Start completion model Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)":
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(llmMacVramTemplate.replace(PRESET_PLACEHOLDER, "fim-qwen-3b-default"));
                break;
            case "Start completion model Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)":
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(llmMacVramTemplate.replace(PRESET_PLACEHOLDER, "fim-qwen-7b-default"));
                break;  
            case "Start completion model Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)":
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(llmMacCpuTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-0.5B-Instruct-Q8_0-GGUF"));
                break;
            case "Start chat model Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)":
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(llmMacChatVramTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF"));
                break;
            case "Start chat model Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)":
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(llmMacChatVramTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF"));
                break;
            case "Start chat model Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)":
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(llmMacChatVramTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF"));
                break;  
            case "Start chat model Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)":
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(llmMacChatCpuTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF"));
                break;
            case "Start completion llama.cpp server with custom command from launch_completion property":
                await this.app.llamaServer.killFimCmd();
                await this.app.llamaServer.shellFimCmd(this.app.extConfig.launch_completion);
                break;
            case "Start chat llama.cpp server with custom command from launch_chat property":
                await this.app.llamaServer.killChatCmd();
                await this.app.llamaServer.shellChatCmd(this.app.extConfig.launch_chat);
                break;       
            case "Stop completion llama.cpp server":
                await this.app.llamaServer.killFimCmd();
                break;
            case "Stop chat llama.cpp server":
                await this.app.llamaServer.killChatCmd();
                break;
            case "$(book) View Documentation...":
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggml-org/llama.vscode'));
                break;
            case "Chat with AI":
                this.app.askAi.showChatWithAi(false, context)
                break;
            case "Chat with AI with project context":
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
        if (label.includes('All Completions')) {
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
