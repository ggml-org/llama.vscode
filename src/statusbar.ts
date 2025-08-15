import {Application} from "./application";
import {LlamaResponse} from "./llama-server";
import vscode from "vscode";

export class Statusbar {
    private app: Application
    public llamaVscodeStatusBarItem:vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    constructor(application: Application) {
        this.app = application;
    }

    showTextInfo = (text: string | undefined) =>{
        if (text == undefined ) this.llamaVscodeStatusBarItem.text = "llama-vscode";
        else this.llamaVscodeStatusBarItem.text = "llama-vscode | " + text;
    }

    showInfo = (data: LlamaResponse | undefined) => {
        if (data == undefined || data.content == undefined || data.content.trim() == "" ) {
            if (this.app.configuration.show_info) {
                this.llamaVscodeStatusBarItem.text = `llama-vscode | ${this.app.configuration.getUiText("no suggestion")} | r: ${this.app.extraContext.chunks.length} / ${this.app.configuration.ring_n_chunks}, e: ${this.app.extraContext.ringNEvict}, q: ${this.app.extraContext.queuedChunks.length} / ${this.app.configuration.MAX_QUEUED_CHUNKS} | t: ${Date.now() - this.app.extraContext.lastComplStartTime} ms `;
            } else {
                this.llamaVscodeStatusBarItem.text = `llama-vscode | ${this.app.configuration.getUiText("no suggestion")} | t: ${Date.now() - this.app.extraContext.lastComplStartTime} ms `;
            }
        } else {
            if (this.app.configuration.show_info) {
                this.llamaVscodeStatusBarItem.text = `llama-vscode | c: ${data.tokens_cached} / ${data.generation_settings.n_ctx ?? 0}, r: ${this.app.extraContext.chunks.length} / ${this.app.configuration.ring_n_chunks}, e: ${this.app.extraContext.ringNEvict}, q: ${this.app.extraContext.queuedChunks.length} / ${this.app.configuration.MAX_QUEUED_CHUNKS} | p: ${data.timings?.prompt_n} (${data.timings?.prompt_ms?.toFixed(2)} ms, ${data.timings?.prompt_per_second?.toFixed(2)} t/s) | g: ${data.timings?.predicted_n} (${data.timings?.predicted_ms?.toFixed(2)} ms, ${data.timings?.predicted_per_second?.toFixed(2)} t/s) | t: ${Date.now() - this.app.extraContext.lastComplStartTime} ms `;
            } else {
                this.llamaVscodeStatusBarItem.text = `llama-vscode | t: ${Date.now() - this.app.extraContext.lastComplStartTime} ms `;
            }
        }
        this.llamaVscodeStatusBarItem.show();
    }

    showCachedInfo = () => {
        if (this.app.configuration.show_info) {
            this.llamaVscodeStatusBarItem.text = `llama-vscode | C: ${this.app.lruResultCache.size()} / ${this.app.configuration.max_cache_keys} | t: ${Date.now() - this.app.extraContext.lastComplStartTime} ms`;
        }else {
            this.llamaVscodeStatusBarItem.text = `llama-vscode | t: ${Date.now() - this.app.extraContext.lastComplStartTime} ms`;
        }
        this.llamaVscodeStatusBarItem.show();
    }

    showTimeInfo = (startTime: number) => {
        this.llamaVscodeStatusBarItem.text = `llama-vscode | t: ${Date.now() - startTime} ms`;
        this.llamaVscodeStatusBarItem.show();
    }

    showThinkingInfo = () => {
        this.llamaVscodeStatusBarItem.text = `llama-vscode | ${this.app.configuration.getUiText("thinking...")}`;
        this.llamaVscodeStatusBarItem.show();
    }

    initializeStatusBar = () => {
        this.llamaVscodeStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            1000
        );
        this.llamaVscodeStatusBarItem.command = 'llama-vscode.showMenu';
        this.llamaVscodeStatusBarItem.tooltip = "Show llama-vscode menu (Ctrl+Shift+M)";
        this.updateStatusBarText();
        this.llamaVscodeStatusBarItem.show();
    }

    updateStatusBarText = () => {
        const editor = vscode.window.activeTextEditor;
        const currentLanguage = editor?.document.languageId;
        const isEnabled = this.app.configuration.enabled;
        const isLanguageEnabled = currentLanguage ? this.app.configuration.isCompletionEnabled(editor.document) : true;

        if (!isEnabled) {
            this.llamaVscodeStatusBarItem.text = "$(x) llama.vscode";
        } else if (currentLanguage && !isLanguageEnabled) {
            this.llamaVscodeStatusBarItem.text = `$(x) llama.vscode (${currentLanguage})`;
        } else {
            this.llamaVscodeStatusBarItem.text = "$(check) llama.vscode";
        }
    }

    registerEventListeners = (context: vscode.ExtensionContext) => {
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('llama-vscode')) {
                    this.updateStatusBarText();
                }
            }),
            vscode.window.onDidChangeActiveTextEditor(() => {
                this.updateStatusBarText();
            })
        );
    }
}
