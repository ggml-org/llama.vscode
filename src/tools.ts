import {Application} from "./application";
import * as vscode from 'vscode';
import {Utils} from "./utils";
import path from "path";
import fs from 'fs';

type ToolsMap = Map<string, (...args: any[]) => any>;

export class Tools {
    private app: Application;
    toolsFunc: ToolsMap = new Map();
    toolsFuncDesc: ToolsMap = new Map();
    tools: any[] = [];
    vscodeTools: any[] = [];
    vscodeToolsSelected: Map<string, boolean> = new Map();
    
    constructor(application: Application) {
        this.app = application;
        this.toolsFunc.set("run_terminal_command", this.runTerminalCommand);
        this.toolsFunc.set("search_source", this.searchSource)
        this.toolsFunc.set("read_file", this.readFile)
        this.toolsFunc.set("list_directory", this.readDirectory)
        this.toolsFunc.set("regex_search",this.getRegextMatches)
        this.toolsFunc.set("delete_file", this.deleteFile)
        this.toolsFunc.set("get_diff", this.getDiff)
        this.toolsFunc.set("edit_file", this.editFile)
        this.toolsFunc.set("ask_user", this.askUser)
        this.toolsFunc.set("custom_tool", this.customTool)
        this.toolsFunc.set("custom_eval_tool", this.customEvalTool)   
        this.toolsFunc.set("llama_vscode_help", this.llamaVscodeHelp)     
        this.toolsFuncDesc.set("run_terminal_command", this.runTerminalCommandDesc);
        this.toolsFuncDesc.set("search_source", this.searchSourceDesc)
        this.toolsFuncDesc.set("read_file", this.readFileDesc)
        this.toolsFuncDesc.set("list_directory", this.readDirectoryDesc)
        this.toolsFuncDesc.set("regex_search",this.getRegextMatchesDesc)
        this.toolsFuncDesc.set("delete_file", this.deleteFileDesc)
        this.toolsFuncDesc.set("get_diff", this.getDiffDesc)
        this.toolsFuncDesc.set("edit_file", this.editFileDesc)
        this.toolsFuncDesc.set("ask_user", this.askUserDesc)
        this.toolsFuncDesc.set("custom_tool", this.customToolDesc)
        this.toolsFuncDesc.set("custom_eval_tool", this.customEvalToolDesc)
        this.toolsFuncDesc.set("llama_vscode_help", this.llamaVscodeHelpDesc)
        
    }

    public runTerminalCommand = async (args: string ) => {
        let command = JSON.parse(args).command;
        
        if (command == undefined) return "The terminal command is not provided."

        let commandOutput = "";
        if ( (!this.app.configuration.tool_permit_some_terminal_commands || Utils.isModifyingCommand(command))) {
            let [yesApply, yesDontAsk] = await Utils.showYesYesdontaskNoDialog("Do you give a permission to execute the terminal command:\n" + command + 
                "\n\n If you answer with 'Yes, don't ask again', the safe terminal commands (do not change files or environment) will be executed without confirmation.")
            if (yesDontAsk) {
                this.app.configuration.updateConfigValue("tool_permit_some_terminal_commands", true)
                vscode.window.showInformationMessage("Setting tool_permit_some_terminal_commands is set to true.")
            }
            if (!yesApply) return "The user doesn't give a permission to execute this command.";;
        } else {
            let {stdout, stderr} = await this.app.llamaServer.executeCommandWithTerminalFeedback(command);
            commandOutput = (stdout + "\n\n" + stderr).slice(0, this.app.configuration.MAX_CHARS_TOOL_RETURN);
        }
        return commandOutput;
    }

    public runTerminalCommandDesc = async (args: string ) => {
        let command = JSON.parse(args).command;
        return "Executing terminal command: " + command;
    }


    public searchSource = async (args: string ) => {
        let query = JSON.parse(args).query;

        if (query == undefined) return "The searhc request is not provided."
        
        await this.indexFilesIfNeeded();
        let contextChunks = await this.app.chatContext.getRagContextChunks(query)
        let relevantSource = await this.app.chatContext.getContextChunksInPlainText(contextChunks);
        
        return relevantSource;
    }

    public searchSourceDesc = async (args: string ) => {
        let query = JSON.parse(args).query;
        
        return " Searching source code for: " + query;
    }

    public readFile = async (args: string ) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        let uri: vscode.Uri;

        if (filePath == undefined) return "The file is not provided."

        try {
            let absolutePath = Utils.getAbsolutFilePath(filePath);
            if (absolutePath == "") "File not found: " + filePath
            uri = vscode.Uri.file(absolutePath);
            const document = await vscode.workspace.openTextDocument(uri)
            if (params.should_read_entire_file) return document.getText()
            if (params.last_line_inclusive > document.lineCount) params.last_line_inclusive = document.lineCount
            if (params.first_line < 0 || params.first_line > params.last_line_inclusive) {
                return 'Invalid line range';
            }

            let lastLine = Math.min(params.last_line_inclusive - 1, params.first_line + 249, document.lineCount -1)

            // Create range from first line's start to last line's end
            const startPos = new vscode.Position(Math.max(params.first_line -1, 0), 0);
            const endPos = new vscode.Position(lastLine, document.lineAt(lastLine).text.length);
            const range = new vscode.Range(startPos, endPos);

            return document.getText(range);
        } catch (error) {
            return "File not found: " + filePath;
        }
    }

    public readFileDesc = async (args: string ) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        
        return "Reading file: " + filePath;
    }

    public readDirectory = async (args: string ) => {
        let params = JSON.parse(args);
        let dirPath = params.directory_path;
        let uri: vscode.Uri;
        
        if (dirPath == undefined) return "The directory is not provided."
        
        let absolutePath = dirPath;
        if (!path.isAbsolute(dirPath)) {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                return "File not found: " + dirPath;
            }
            
            // Resolve against first workspace folder
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            absolutePath = path.join(workspaceRoot, dirPath);
        }
        try {
            return Utils.listDirectoryContents(absolutePath);
        } catch (error) {
            return "Error reading directory: " + dirPath;
        }
    }

    public readDirectoryDesc = async (args: string ) => {
        let params = JSON.parse(args);
        let dirPath = params.directory_path;
        
        return "Listing directory: " + dirPath;
    }

    public getRegextMatches = async (args: string ) => {
        let params = JSON.parse(args);
        
        if (params.regex == undefined) return "The regex is not provided."
        
        await this.indexFilesIfNeeded();
        return Utils.getRegexpMatches(params.include_pattern, params.exclude_pattern??"", params.regex, this.app.chatContext.entries)
    }   

    public getRegextMatchesDesc = async (args: string ) => {
        let params = JSON.parse(args);
        return "Regex search for: " + params.regex;
    }

    public deleteFile = async (args: string ) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;

        if (filePath == undefined) return "The file is not provided."

        try {
            const absolutePath = Utils.getAbsolutFilePath(filePath);
            if (!this.app.configuration.tool_permit_file_changes && !await Utils.showYesNoDialog("Do you give a permission to delete file:\n" + absolutePath)) {
                return Utils.MSG_NO_UESR_PERMISSION;

            }
            if (!fs.existsSync(absolutePath)) {
                return `File not found at ${filePath}`;
            }
            fs.unlinkSync(absolutePath);
        } catch (error) {
            if (error instanceof Error) {
                return `Failed to delete file at ${filePath}: ${error.message}`;
            }
            return `Failed to delete file at ${filePath} due to an unknown error`;
        }
    
        return `Successfully deleted file ${filePath}`;
    }

    public deleteFileDesc = async (args: string ) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        
        return "Deleted file: " + filePath;
    }

    public getDiff = async (args: string) => {
        try {
            const diff = await this.app.git.getLatestChanges();
            console.log('Changes since last commit:', diff);
            return diff??"";
        } catch (error) {
            console.error('Error changes since last commit:', error);
            throw error;
        }        
    }

    public getDiffDesc = async (args: string) => {
        return "Getting latest changes."       
    }
    
    public editFile = async (args: string) => {
        let params = JSON.parse(args);
        let changes = params.input;

        if (params.input == undefined) return "The input is not provided."

        try {
            if (!this.app.configuration.tool_permit_file_changes){
                let filePath = this.getFilePath(params.input);
                let [yesApply, yesDontAsk] = await Utils.showYesYesdontaskNoDialog("Do you permit file " + filePath + " to be changed?")
                if (yesDontAsk) {
                    this.app.configuration.updateConfigValue("tool_permit_file_changes", true)
                    vscode.window.showInformationMessage("Setting tool_permit_file_changes is set to true.")
                }
                if (!yesApply) return Utils.MSG_NO_UESR_PERMISSION;
            }
            await Utils.applyEdits(changes)
            return "The file is updated ";
        } catch (error) {
            console.error('Error changes since last commit:', error);
            throw error;
        }        
    }

    public editFileDesc = async (args: string) => {
        let params = JSON.parse(args);
        let diffText = params.input;
        if (!diffText) return "EditFile Desc - parameter input not found."
        
        let filePath = this.getFilePath(diffText);
        
        return "Edited file " + filePath;
    }

    public askUser = async (args: string) => {
        let params = JSON.parse(args);
        let question = params.question;

        if (question == undefined) return "The question is not provided."

        const answer = await vscode.window.showInputBox({
            placeHolder: 'Answer',
            prompt: question,
            validateInput: text => {
                return text.length === 0 ? 'Please enter a value' : null;
            }
        });
        
        if (answer !== undefined) {
            return answer;
        }

        return "No answer from the user."
    }

    public askUserDesc = async (args: string) => {
        let params = JSON.parse(args);
        let question = params.question;

        return "Ask user: " + question
    }
    
    public customTool = async (args: string) => {
        let result = "";
        
        let workspaceFolder = "";
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]){
            workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        let source = this.app.configuration.tool_custom_tool_source;
        if (source.startsWith("http")){
            let htmlResult = await Utils.fetchWebPage(source)
            result = Utils.extractTextFromHtml(htmlResult)
        } else if (fs.existsSync(source)){
            result = fs.readFileSync(source, 'utf-8');
        } else {
            result = "File " + source + " does not exist!"
        }

        return result
    }

    public customToolDesc = async (args: string) => {
        return "Custom tool is executed."
    }

     public customEvalTool = async (args: string) => {
        let params = JSON.parse(args);

        if (params.input == undefined) return "The input is not provided."
        let functionCode = ""
        let settingValue = this.app.configuration.tool_custom_eval_tool_code
        if (settingValue.startsWith("function")){
            functionCode = settingValue;
        } else {
            // Assumes this is a file
            if (fs.existsSync(settingValue)) functionCode = fs.readFileSync(settingValue, 'utf-8');
            else return "Error: There is no function to eval!"
        }

        const functionString = '('+ functionCode +')';
        const toolFunction = eval(functionString);
        
        let result = toolFunction(params.input)

        return result === null ? "null" : result === undefined ? "undefined" : String(result)
    }

    public customEvalToolDesc = async (args: string) => {
        let params = JSON.parse(args);

        return "Custom eval tool is executed. Input: " + params.input
    }

    public llamaVscodeHelp = async (args: string) => {
        return await Utils.getExtensionHelp()
    }

    public llamaVscodeHelpDesc = async (args: string) => {
        return "llama_vscode_help tool is executed. "
    }
    
    
    public init = () => {
        this.tools = [
            ...(this.app.configuration.tool_run_terminal_command_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "run_terminal_command",
                    "description": "Runs the provided command in a terminal and returns the result. For Windows uses powershell.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "command": {
                                "type": "string",
                                "description": "The command to be executed in the terminal"
                            }
                        },
                        "required": [
                            "command"
                        ],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_search_source_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "search_source",
                    "description": "Searches the code base and returns relevant code frangments from the files.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The query to search the relevat code"
                            }
                        },
                        "required": [
                            "query"
                        ],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_read_file_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "Read the contents of a file from first_line to last_line_inclusive, at most 250 lines at a time or the entire file if parameter should_read_entire_file is true.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "first_line": {
                                "type": "integer",
                                "description": "The number of first line to read. Starts with 1."
                            },
                            "last_line_inclusive": {
                                "type": "integer",
                                "description": "The number of last line to read. Line numbers start with 1"
                            },
                            "should_read_entire_file": {
                                "type": "boolean",
                                "description": "Whether to read the entire file. Defaults to false.",
                            },
                            "file_path": {
                                "type": "string",
                                "description": "The path of the file to read"
                            }
                        },
                        "required": [
                            "first_line", "last_line_inclusive", "file_path"
                        ],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_list_directory_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "list_directory",
                    "description": "List the contents of a directory. The quick tool to understand the file structure and explore the codebase.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "directory_path": {
                                "type": "string",
                                "description": "Absolute or relative workspace path"
                            },
                        },
                        "required": [
                            "directory_path"
                        ],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_regex_search_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "regex_search",
                    "description": "Fast text-based regex search in the code base (prefer it for finding exact function names or expressions) that finds exact pattern matches with file names and line numbers within files or directories. If there is no exclude_pattern - provide an empty string. Returns up to 50 matches in format file_name:line_number: line_content",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "include_pattern": {
                                "type": "string",
                                "description": "Glob pattern for files to include (e.g. '*.ts' for TypeScript files)"
                            },
                            "exclude_pattern": {
                                "type": "string",
                                "description": "Glob pattern for files to exclude"
                            },
                            "regex": {
                                "type": "string",
                                "description": "A string for constructing a typescript RegExp pattern to search for. Escape special regex characters when needed."
                            }
                        },
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_delete_file_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "delete_file",
                    "description": "Deletes a file at the specified path.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "description": "The path of the file to delete, absolute or relative to the workspace root.", 
                                "type": "string"
                            },
                        },
                        "required": [
                            "file_path"
                        ],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_get_diff_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "get_diff",
                    "description": "Gets the files changes since last commit",
                    "parameters": {
                        "type": "object",
                        "required": [
                        ],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_edit_file_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "edit_file",
                    "description": this.app.prompts.TOOL_APPLY_EDITS ,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "input": {
                                "description": `Files changes in SEARCH/REPLACE block format`,
                                "type": "string",
                            },
                        },
                        "required": [
                            "input"
                        ],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_ask_user_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "ask_user",
                    "description": "Use this tool to ask the user for clarifications if something is unclear.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "question": {
                                "type": "string",
                                "description": "The question to the user."
                            },
                        },
                        "required": [
                            "question"
                        ],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_custom_tool_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "custom_tool",
                    "description": this.app.configuration.tool_custom_tool_description,
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": [],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_custom_eval_tool_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "custom_eval_tool",
                    "description": this.app.configuration.tool_custom_eval_tool_description,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "input": {
                                "type": "string",
                                "description": this.app.configuration.tool_custom_eval_tool_property_description
                            },
                        },
                        "required": [],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_llama_vscode_help_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "llama_vscode_help",
                    "description": "Returns a help text for llama-vscode in .md format. Use this tool for information about llama-vscode (synonim: llama.vscode) extension: how to use it, what are chat, completion, embeddings and tools models, what is orchestra, how to add/edit/remove them, how to select them, etc.",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": [],
                    },
                    "strict": true
                }
            }
            ] : []),
        ]        
    }

    selectTools = async () => {
        // Define items with initial selection state
        const toolItems: vscode.QuickPickItem[] = []
        const appPrefix = "llama.vscode_"
        const config = this.app.configuration.config;
        for (let internalTool of this.toolsFunc.keys()){
            toolItems.push({ label: appPrefix + internalTool, description: "", picked: (this.app.configuration as { [key: string]: any; })[this.getToolEnabledPropertyName(internalTool)]})
        }
        for (let tool of vscode.lm.tools){
            toolItems.push({ label: tool.name, description: tool.description, picked: this.vscodeToolsSelected.has(tool.name) })
        }

        // Show multi-select quick pick
        const selection = await vscode.window.showQuickPick(toolItems, {
            canPickMany: true,
            placeHolder: 'Select tools',
        });

        // Handle user selection
        if (selection) {
            const selectedLabels = selection.map(item => item.label);
            this.vscodeToolsSelected = new Map()
            for (let toolName of  this.toolsFunc.keys()){
                await config.update(this.getToolEnabledPropertyName(toolName), false, true);
            }
            for (let toolName of  selectedLabels){
                if (toolName.startsWith(appPrefix)){
                    await config.update(this.getToolEnabledPropertyName(toolName.slice(appPrefix.length)), true, true);
                } else {
                    this.vscodeToolsSelected.set(toolName, true)
                }
            }
        } else {
            // User canceled
        }
    }

    addSelectedTools = () => {
        this.vscodeToolsSelected.set("mcp_playwright_browser_navigate", true)
        this.vscodeTools = [];
        for (let tool of vscode.lm.tools) {
            if (this.vscodeToolsSelected.has(tool.name) && tool.inputSchema && tool.inputSchema  && 'properties' in tool.inputSchema) {
                let propertyNames: string[] = Object.keys((tool.inputSchema as { [key: string]: any; })["properties"]);
                let toolProperties = {};
                let toolRequiredProps = []
                for (let property of propertyNames) {
                    let propType = tool.inputSchema.properties ? (tool.inputSchema.properties as { [key: string]: any; })[property].type : "";
                    let propDesc = tool.inputSchema.properties ? (tool.inputSchema.properties as { [key: string]: any; })[property].description : "";
                    toolProperties = { ...toolProperties, [property]: { type: propType, description: propDesc } };
                    toolRequiredProps = (tool.inputSchema as { [key: string]: any; })["required"];
                }
                let newTool = {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": {
                            "type": "object",
                            "properties": toolProperties
                        },
                        "required": toolRequiredProps,
                        "strict": true
                    },
                };
                this.vscodeTools.push(newTool);
            }

        }
    }

    private getFilePath(diffText: string) {
        let filePath = "";
        const blocks = diffText.split("```diff")
        if (blocks.slice(1).length > 0) {
            let blockParts = Utils.extractConflictParts("```diff" + blocks.slice(1)[0]);
            filePath = blockParts[0].trim();
        } else {
            if (diffText.length > 0) filePath = Utils.extractConflictParts("```diff\n" + diffText)[0].trim()
            else return "";
        }
        return filePath;
    }

    private async indexFilesIfNeeded() {
        if (!this.app.configuration.rag_enabled) {
            vscode.window.showInformationMessage("Enable RAG to avoid reindexing. Project files will be indexed now.");
            await this.app.chatContext.indexWorkspaceFiles();
        }
    }

    private getToolEnabledPropertyName(toolName: string): string {
        return "tool_" + toolName + "_enabled";
    }
}
