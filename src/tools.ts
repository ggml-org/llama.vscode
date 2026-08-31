import {Application} from "./application";
import * as vscode from 'vscode';
import {Utils} from "./utils";
import path from "path";
import fs from 'fs';
import { Plugin } from './plugin';
import { CONFIRMATION_STATE, UI_TEXT_KEYS } from "./constants";
import { Chat, Agent } from "./types";

type ToolsMap = Map<string, (...args: any[]) => any>;

export class Tools {
    private app: Application;
    toolsFunc: ToolsMap = new Map();
    toolsFuncDesc: ToolsMap = new Map();
    private tools: any[] = [];
    vscodeTools: any[] = [];
    vscodeToolsSelected: Map<string, boolean> = new Map();
    private lastSearchToolsResult: any[] = [];
    private fileReadTimestamps = new Map<string, number>()
    
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
        this.toolsFunc.set("update_todo_list", this.updateTodoList) 
        this.toolsFunc.set("delegate_task", this.delegateTask) 
        this.toolsFunc.set("create_agent", this.createAgent)
        this.toolsFunc.set("get_errors", this.getErrors) 
        this.toolsFunc.set("rename_symbol", this.renameSymbol)
        this.toolsFunc.set("multi_edit_file", this.multiEditFile)
        this.toolsFunc.set("search_tools", this.searchTools),
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
        this.toolsFuncDesc.set("update_todo_list", this.updateTodoListDesc)
        this.toolsFuncDesc.set("update_todo_list", this.updateTodoListDesc);
        this.toolsFuncDesc.set("delegate_task", this.delegateTaskDesc)
        this.toolsFuncDesc.set("create_agent ", this.createAgentDesc);
        this.toolsFuncDesc.set("get_errors ", this.getErrorsDesc);
        this.toolsFuncDesc.set("rename_symbol ", this.renameSymbolDesc);
        this.toolsFuncDesc.set("multi_edit_file", this.multiEditFileDesc);
        this.toolsFuncDesc.set("search_tools", this.searchToolsDesc);
    }

    public runTerminalCommand = async (args: string ) => {
        let command = JSON.parse(args).command;
        
        if (command == undefined) return "The terminal command is not provided."

        if ((!this.app.configuration.tool_permit_some_terminal_commands || Utils.isModifyingCommand(command))) {
            let [yesApply, yesDontAsk] = await this.confirmToolPermission("Do you give a permission to execute the terminal command:\n" + command + 
                "\n\n If you answer with 'Yes, don't ask again', the safe terminal commands (do not change files or environment) will be executed without confirmation.")
            if (yesDontAsk) {
                this.app.configuration.updateConfigValue("tool_permit_some_terminal_commands", true)
                vscode.window.showInformationMessage("Setting tool_permit_some_terminal_commands is set to true.")
            }
            if (!yesApply) return "The user doesn't give a permission to execute this command.";;
        }
        
        let {stdout, stderr} = await this.app.llamaServer.executeCommandWithTerminalFeedback(command);
        return (stdout + "\n\n" + stderr).slice(0, this.app.configuration.MAX_CHARS_TOOL_RETURN);
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
            if (absolutePath == "") return "File not found: " + filePath
            absolutePath = path.resolve(absolutePath) // Make the path unique for this file - no .. in the path
            const stats = await fs.promises.stat(absolutePath);
            this.fileReadTimestamps.set(absolutePath, stats.mtimeMs);
            uri = vscode.Uri.file(absolutePath);
            const document = await vscode.workspace.openTextDocument(uri)
            if (params.should_read_entire_file) return document.getText()
            
            // Validate required parameters
            if (params.first_line === undefined || params.last_line_inclusive === undefined) {
                return "first_line and last_line_inclusive parameters are required when should_read_entire_file is false";
            }
            
            // Validate parameter types
            if (typeof params.first_line !== 'number' || typeof params.last_line_inclusive !== 'number') {
                return "first_line and last_line_inclusive must be numbers";
            }
            
            // Convert 1-based line numbers to 0-based
            let lastLine = params.last_line_inclusive - 1
            let firstLine = params.first_line - 1
            
            // Validate line numbers are positive
            if (params.first_line < 1 || params.last_line_inclusive < 1) {
                return "Line numbers must be positive integers starting from 1";
            }
            
            // Clamp to valid document range
            if (firstLine < 0) firstLine = 0 
            if (lastLine >= document.lineCount) lastLine = document.lineCount-1
            
            // Validate line range
            if (firstLine > lastLine || firstLine > document.lineCount - 1) {
                return 'Invalid line range';
            }

            // Apply 250-line limit using the converted 0-based firstLine
            lastLine = Math.min(lastLine, firstLine + 249)

            // Create range from first line's start to last line's end
            const startPos = new vscode.Position(Math.max(firstLine, 0), 0);
            const endPos = new vscode.Position(lastLine, document.lineAt(lastLine).text.length);
            const range = new vscode.Range(startPos, endPos);

            return document.getText(range);
        } catch (error) {
            console.error('Error reading file '+ filePath + ": " + error);
            if (error instanceof Error) return "Error reading file: " + filePath + ": " + error // error.message;
            else return "Error reading file: " + filePath
        }
    }

    public readFileDesc = async (args: string ) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        
        return "Reading file: " + filePath + " " + (params.first_line??"") + (params.last_line_inclusive?`-${params.last_line_inclusive}`:"");
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

    public getErrors = async (args: string ) => {
        let params = JSON.parse(args);
        let result = "No errors found."

        if (params.filePath){
            const uri = vscode.Uri.file(Utils.getAbsolutFilePath(params.filePath));
            const errors = Utils.getErrors(uri);
            if (errors) result = errors;
        } else {
            result= Utils.getAllErrors();
        }
         return result;
    }   

    public getErrorsDesc = async (args: string ) => {
        let params = JSON.parse(args);
        let result = "Getting all errors."
        if (params.filePath) result = "Getting errors for: " + params.filePath;
        return result;
    }

    public renameSymbol = async (args: string ) => {
        let params = JSON.parse(args);

        // Validate required parameters
        if (!params.symbol || !params.newName || !params.lineContent) {
            return "Parameters 'symbol', 'newName', and 'lineContent' are required.";
        }

        let uri: vscode.Uri;
        if (params.url) {
            uri = vscode.Uri.parse(params.url);
        } else if (params.filePath) {
            const absolutePath = Utils.getAbsolutFilePath(params.filePath);
            if (!absolutePath) {
                return `File not found: ${params.filePath}`;
            }
            uri = vscode.Uri.file(absolutePath);
        } else {
            return "Either 'url' or 'filePath' must be provided.";
        }

        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const lineContent = params.lineContent;

            // Find the line containing lineContent
            let targetLine = -1;
            for (let i = 0; i < document.lineCount; i++) {
                const lineText = document.lineAt(i).text;
                if (lineText.includes(lineContent)) {
                    targetLine = i;
                    break;
                }
            }

            if (targetLine === -1) {
                return `Could not find line containing: ${lineContent}`;
            }

            // Find the symbol's position in the line
            const lineText = document.lineAt(targetLine).text;
            const startIndex = lineText.indexOf(params.symbol);
            if (startIndex === -1) {
                return `Symbol '${params.symbol}' not found in the line: ${lineText}`;
            }

            const position = new vscode.Position(targetLine, startIndex);

            // Execute rename
            const edits = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
                'vscode.executeDocumentRenameProvider',
                uri,
                position,
                params.newName
            );

            if (!edits) {
                return `No edits returned for renaming ${params.symbol} to ${params.newName}.`;
            }

            await vscode.workspace.applyEdit(edits);
            return `The symbol ${params.symbol} is successfully renamed. to ${params.newName}`;
        } catch (error) {
            return `Error renaming symbol: ${error instanceof Error ? error.message : String(error)}`;
        }
    }   

    public renameSymbolDesc = async (args: string ) => {
        let params = JSON.parse(args);

        return "Renaming symbol '" + params.symbol + "' to '" + params.newName + "' in file: " + params.filePath;
    }

    public searchTools = async (args: string ) => {
        let params = JSON.parse(args);
        const query = params.query
        // Search tools with keywords matching params.query
        
        if (query == undefined || String(query).trim() == "") return "The search query is not provided."

        this.app.tools.addSelectedTools()
        const allTools = this.tools.concat(this.vscodeTools)
        // 1. Extract the descriptions of the selected tools
        const toolTexts = allTools.map(tool => (tool?.function?.name ?? "") + " " + (tool?.function?.description ?? ""))
        const tokenize = (text: string): string[] => {
            return text.split(/([A-Z]?[a-z]+)|[_\-\.\s]+/)
            .filter(Boolean) // Remove empty strings from the result
            .map(word => word.toLowerCase());
        }
        const tokenizedDocs = toolTexts.map(tokenize);
        // 2. Search for the query in the tools descriptions and score the results - use Utils.computeBM25Stats
        //    There is an example in file src/chat-context.ts line 152, function rankTexts
        const stats = Utils.computeBM25Stats(tokenizedDocs);
        const queryTerms = Array.from(new Set(tokenize(String(query))));
        const scoredTools = allTools
            .map((tool, index) => ({
                tool: tool,
                score: Utils.bm25Score(queryTerms, index, stats),
            }))
            .sort((a, b) => b.score - a.score)
        // 3. Find the top 5 results, which are above the threshold
        const threshold = 0;
        const topTools = scoredTools.filter(scoredTool => scoredTool.score > threshold).slice(0, 5)
        // 4. Store the top 5 results in this.lastSearchToolsResult
        const current = this.lastSearchToolsResult || [];
        const existingNames = new Set();
        for (const tool of current) {
            const name = tool.function?.name;
            if (name != null) existingNames.add(name);
        }
        this.lastSearchToolsResult = current.concat(
            topTools.map(scoredTool => scoredTool.tool).filter(tool => {
                const name = tool.function?.name;
                return name != null && !existingNames.has(name);
            })
        );
        // 5. Return the top 5 results as string for the LLM prompt - tool name + description (cut up to 50 chars)
        if (this.lastSearchToolsResult.length == 0) return "No tools found matching the query '" + query + "'."
        return "Top matching tools: \n" + topTools
            .map(scoredTool => "- " + (scoredTool.tool?.function?.name ?? "unknown") + ": " + String(scoredTool.tool?.function?.description ?? "").slice(0, 50))
            .join("\n");
    }   

    public searchToolsDesc = async (args: string ) => {
        let params = JSON.parse(args);

        return "Searching tools for keywords '" + params.query+ "'";
    }

    public deleteFile = async (args: string ) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;

        if (filePath == undefined) return "The file is not provided."

        try {
            const absolutePath = Utils.getAbsolutFilePath(filePath);
            // Restrict deletion to project folder
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return "Cannot delete file: no workspace folder open.";
            }
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const relativePath = path.relative(workspaceRoot, absolutePath);
            if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
                return `Deletion not allowed: ${filePath} is outside the project folder.`;
            }
            if (!this.app.configuration.tool_permit_file_delete){  
                let [yesApply, yesDontAsk] = await this.confirmToolPermission(`Do you permit file ${filePath} to be deleted?`)
                if (yesDontAsk) {
                    this.app.configuration.updateConfigValue("tool_permit_file_delete", true)
                    vscode.window.showInformationMessage("Setting tool_permit_file_delete is set to true.")
                }
                if (!yesApply) return Utils.MSG_NO_USER_PERMISSION;
            }
            if (!fs.existsSync(absolutePath)) {
                return `File not found at ${filePath}`;
            }
            fs.unlinkSync(absolutePath);
            this.app.chatContext.removeDocument(absolutePath)
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
        let filePath = params.file_path;
        let search = params.search;
        let replace = params.replace;
        let replaceAll = false
        
        if (params?.replace_all){
            replaceAll = params?.replace_all;
        }

        if (!filePath) return "The file is not provided.";
        
        try {
            if (!this.app.configuration.tool_permit_file_changes){  
                let [yesApply, yesDontAsk] = await this.confirmToolPermission(`Do you permit file ${filePath} to be changed?`)
                if (yesDontAsk) {
                    this.app.configuration.updateConfigValue("tool_permit_file_changes", true)
                    vscode.window.showInformationMessage("Setting tool_permit_file_changes is set to true.")
                }
                if (!yesApply) return Utils.MSG_NO_USER_PERMISSION;
            }
            if (!this.isEditAllowed(filePath)) return `Error: File "${filePath}" is outside all workspace folders and outside auto memory folder.`;
            let resultEdit = await Utils.findReplaceFile(filePath, search, replace, replaceAll, this.fileReadTimestamps)
            if (resultEdit == UI_TEXT_KEYS.fileUpdated &&  this.app.configuration.rag_enabled && fs.existsSync(filePath)) {
                this.app.chatContext.udpateFileIndexing(filePath, fs.readFileSync(filePath, 'utf-8'))
            }
            return resultEdit;
        } catch (error) {
            console.error('Error editing file ' + filePath + ":", error);
            throw error;
        }        
    }
    private isEditAllowed = (filePath: string): boolean => {
        let isAllowed = true;
        if (path.isAbsolute(filePath)) {
            const resolvedFilePath = path.resolve(filePath)
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(resolvedFilePath));
            if (!workspaceFolder) {
                if (this.app.extensionContext.storageUri?.fsPath){
                    let auto_memory_folder = path.join(this.app.extensionContext.storageUri?.fsPath, "auto_memory");
                    auto_memory_folder = path.resolve(auto_memory_folder)
                    if (!resolvedFilePath.startsWith(auto_memory_folder)) isAllowed = false;
                } else isAllowed = false; 
            }
        }

        return isAllowed
    }

    public editFileDesc = async (args: string) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        if (!filePath) return "Parameter file_path not found."
        
        return "Edited file " + filePath;
    }

    public multiEditFile = async (args: string) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        let edits = params.edits;

        if (!filePath) return "The file is not provided.";
        if (!edits || !Array.isArray(edits) || edits.length < 1) return "At least one edit operation is required.";
        if (!this.isEditAllowed(filePath)) return `Error: File "${filePath}" is outside all workspace folders and outside auto memory folder.`;

        try {
            if (!this.app.configuration.tool_permit_file_changes){  
                let [yesApply, yesDontAsk] = await this.confirmToolPermission(`Do you permit file ${filePath} to be changed?`)
                if (yesDontAsk) {
                    this.app.configuration.updateConfigValue("tool_permit_file_changes", true)
                    vscode.window.showInformationMessage("Setting tool_permit_file_changes is set to true.")
                }
                if (!yesApply) return Utils.MSG_NO_USER_PERMISSION;
            }
            let resultMultiEdit = await Utils.multiFindReplaceFile(filePath, edits, this.fileReadTimestamps)
            if (resultMultiEdit == UI_TEXT_KEYS.fileUpdated &&  this.app.configuration.rag_enabled && fs.existsSync(filePath)) {
                this.app.chatContext.udpateFileIndexing(filePath, fs.readFileSync(filePath, 'utf-8'))
            }
            return resultMultiEdit;
        } catch (error) {
            console.error('Error editing file ' + filePath + ":", error);
            throw error;
        }        
    }

    public multiEditFileDesc = async (args: string) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        if (!filePath) return "Parameter file_path not found."
        
        return "Multi-edited file " + filePath;
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

    public updateTodoList = async (args: string) => {
        let params = JSON.parse(args);

        if (params.todos == undefined) return "The todos are not provided."
        
        let filePath = Utils.getTodosFilePath();
        
        try {
            fs.writeFileSync(filePath, params.todos, 'utf8');
        } catch (error) {
            return `Error creating/updating todos`
        }

        return "The todos are created/updated."
    }
    
    public updateTodoListDesc = async (args: string) => {
        let ret = "update_todo_list tool is executed. \n\n"
        let params = JSON.parse(args);
        if (params.todos) ret += params.todos.split(/\r?\n/).join("  \n")
        return ret
    }

    public delegateTask = async (args: string) => {
        let params = JSON.parse(args);
        let finalAnswer = "No answer from the subagent.";
        if (params.subagent_name) {
            // store current agent
            await this.app.llamaAgent.updateChat()
            let parentChat = this.app.getChat();
            parentChat.defaultAgent = this.app.getAgent();
            let subagent: Agent = this.app.configuration.agents_list.find(agent => agent.name == params.subagent_name)
            if (!subagent) return "No subagent found with name " + params.subagent_name;
            this.app.llamaAgent.resetContext();
            let newChatName = "delegate_task" + Date.now()
            let newSubagent: Agent =  { ...subagent };
            if (subagent.tools){
                // clone the tools to avoid changing the original agent
                newSubagent.tools = [...subagent.tools];
            } else {
                newSubagent.tools = [];
            }
            newSubagent.tools.push("ask_user")
            // The goal is to get the answer from the subagent in one tools loop - so use a tool call if user input is needed
            newSubagent.systemInstruction.push("For questions to the user, please use the tool 'ask_user'.")
            let newChat: Chat = {
                name: newChatName,
                id: newChatName,
                messages: [],
                defaultAgent: newSubagent,
                log: "subagent: " + params.subagent_name + "  \n  \n"
            }
            
            await this.app.chatService.selectUpdateChat(newChat)

            if (params.task) {
                finalAnswer = await this.app.llamaAgent.askAgent(params.task)
            } else {
                return "No task provided."
            }
            await this.app.chatService.selectUpdateChat(parentChat)
            this.app.llamaWebviewProvider.setState("AI is working")
        } else {
            return "No subagent name provided."
        }
        
        return finalAnswer
    }
    
    public delegateTaskDesc = async (args: string) => {
        let ret = "delegate_task tool is executed. \n\n"
        let params = JSON.parse(args);
        if (params.task && params.subagent_name) ret += "subagent: " +  params.subagent_name + "\ntask: " + params.task
        return ret.split(/\r?\n/).join("  \n")
    }

    public createAgent = async (args: string) => {
        let params = JSON.parse(args);
        let finalAnswer = "The agent is created";
        
        if (params.agent_json) {
            let receivedAgent = JSON.parse(params.agent_json)
            let newAgent:Agent = {
                name: receivedAgent.name,
                description: receivedAgent.description,
                subagentEnabled: receivedAgent.subagentEnabled??false,
                systemInstruction: receivedAgent.systemInstruction.split(/\r?\n/)
            }
            if (receivedAgent.tools) {
                newAgent.tools = receivedAgent.tools.split(",")
            }
            // TODO check if one more parsing of agent_json is needed
            await this.app.agentService.addUpdateAgent(newAgent)
        } else {
            return "No agent provided."
        }
        
        return finalAnswer
    }
    
    public createAgentDesc = async (args: string) => {
        let ret = "create_agent tool is executed. \n\n"
        return ret.split(/\r?\n/).join("  \n")
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
                                "description": "Glob pattern for files to include (specify file extensions only if you are absolutely sure)"
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
                        "properties": {},
                        "required": [],
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
                    "description": this.app.prompts.EDIT_FILE_DESC ,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "description": `Relative or absolute path of the file to edit/create. The file_path must be inside project root folder.`,
                                "type": "string",
                            },
                            "search": {
                                "description": `The exact text to find and replace. Must be non-empty for edits. search should be EXACT MATCH, including spaces tabs, etc.`,
                                "type": "string",
                            },
                            "replace": {
                                "description": `The new content to insert. Can be an empty string to delete the search block.`,
                                "type": "string",
                            },
                            "replace_all": {
                                "description": `If true, replaces all occurrences of search. If false, search must appear exactly once.`,
                                "type": "boolean",
                            },
                        },
                        "required": ["file_path", "search", "replace"],
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
            ...(this.app.configuration.tool_multi_edit_file_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "multi_edit_file",
                    "description": this.app.prompts.MULTI_EDIT_FILE_DESC,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "description": "Relative or absolute path of the file to edit. The file_path must be inside project root folder.",
                                "type": "string",
                            },
                            "edits": {
                                "description": "An array of edit operations (minimum 1 required) to perform sequentially",
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "old_string": {
                                            "description": "The exact text to find and replace",
                                            "type": "string",
                                        },
                                        "new_string": {
                                            "description": "The new content to insert. Can be an empty string to delete the search block.",
                                            "type": "string",
                                        },
                                        "replace_all": {
                                            "description": "If true, replaces all occurrences of old_string. If false, old_string must appear exactly once.",
                                            "type": "boolean",
                                        },
                                    },
                                    "required": ["old_string", "new_string"],
                                },
                            },
                        },
                        "required": ["file_path", "edits"],
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
            ...(this.app.configuration.tool_update_todo_list_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "update_todo_list",
                    "description": this.app.prompts.TOOL_UPDATE_TODO_LIST_DESCRIPTION,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "todos": {
                                "description": this.app.prompts.TOOL_UPDATE_TODO_LIST_PARAMETER_DESCRIPTION,
                                "type": "string",
                            },
                        },
                        "required": [],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_create_agent_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "create_agent",
                    "description": this.app.prompts.TOOL_CREATE_AGENT_DESCRIPTION,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "agent_json": {
                                "description": this.app.prompts.PROPERTY_AGENT_JSON_DESCRIPTION,
                                "type": "string",
                            },                            
                        },
                        "required": [],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_delegate_task_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "delegate_task",
                    "description": this.app.prompts.TOOL_DELEGATE_TASK_DESCRIPTION,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "subagent_name": {
                                "description": "Name of the subagent to invoke. Must be one of the available subagents listed in the system prompt.",
                                "type": "string",
                            },
                            "task": {
                                "description": "Description of the task to be delegated to the subagent.",
                                "type": "string",
                            },
                        },
                        "required": [],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_get_errors_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "get_errors",
                    "description": this.app.prompts.TOOL_GET_ERRORS_DESCRIPTION,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "filePath": {
                                "description": "The absolute paths to the files or folders to check for errors. Omit 'filePaths' when retrieving all errors.",
                                "type": "string",
                            },
                        },
                        "required": [],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_rename_symbol_enabled ? [
            {
                "type": "function",
                "function": {
                    "name": "rename_symbol",
                    "description": this.app.prompts.TOOL_RENAME_SYMBOL_DESCRIPTION,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "filePath": {
                                "description": "A workspace-relative file path where the symbol appears (e.g. \"src/utils/helpers.ts\"). Provide either \"uri\" or \"filePath\".",
                                "type": "string",
                            },
                            "lineContent": {
                                "description": "A substring of the line of code where the symbol appears. Used to locate the exact position. Must be actual text from the file.",
                                "type": "string",
                            },
                            "newName": {
                                "description": "The new name for the symbol.",
                                "type": "string",
                            },
                            "symbol": {
                                "description": "The exact current name of the symbol to rename.",
                                "type": "string",
                            },
                            "url": {
                                "description": "A full URI of a file where the symbol appears (e.g. \"file:///path/to/file.ts\"). Provide either \"uri\" or \"filePath\".",
                                "type": "string",
                            },
                        },
                        "required": [],
                    },
                    "strict": true
                }
            }
            ] : []),
            ...(this.app.configuration.tool_search_tools_enabled ? [
            this.getSearchToolsTool(),
            ] : []),
        ] 
        
        for (let tool of this.app.configuration.tools_custom){
            if (tool.enabled) {
                this.tools.push(tool.tool)
                if (tool.tool_function && fs.existsSync(tool.tool_function)) {
                    let toolFunction = Utils.getFunctionFromFile(tool.tool_function);
                    this.toolsFunc.set(tool.tool.function.name, toolFunction as (...args: any[]) => any )
                } else {                   
                    this.toolsFunc.set(tool.tool.function.name, Plugin.getFunction(tool.tool_function) as (...args: any[]) => any )
                }
                if (tool.tool_function_desc && fs.existsSync(tool.tool_function_desc)) {
                    let toolFunction = Utils.getFunctionFromFile(tool.tool_function_desc);
                    this.toolsFuncDesc.set(tool.tool.function.name, toolFunction as (...args: any[]) => any )
                } else {
                    this.toolsFuncDesc.set(tool.tool.function.name, Plugin.getFunction(tool.tool_function_desc) as (...args: any[]) => any )
                }
            }
        }
        
    }

    getTools = () => {
        return this.tools;
    }

    getLlamaVscodeToolsMap = (): Map<string, boolean> => {
        let llamaVscodeTools: Map<string, boolean> = new Map()
        for (let internalTool of this.toolsFunc.keys()){
            llamaVscodeTools.set(internalTool,(this.app.configuration as { [key: string]: any; })[this.getToolEnabledPropertyName(internalTool)])
        }
        return llamaVscodeTools;
    }

    addLlamaVscodeTools = async (tools: string[] ) => {
        for (let internalTool of tools){
            await this.app.configuration.updateConfigValue(this.getToolEnabledPropertyName(internalTool), true);
        }
    }

    removeLlamaVscodeTools = async (tools: string[] ) => {
        for (let internalTool of tools){
            await this.app.configuration.updateConfigValue(this.getToolEnabledPropertyName(internalTool), false);
        }
    }

    selectTools = async () => {
        // Define items with initial selection state
        const toolItems: vscode.QuickPickItem[] = []
        let customToolsNames: string[] = []
        const appPrefix = "llama.vscode_"

        for (let customTool of this.app.configuration.tools_custom){
            toolItems.push({ label: appPrefix + customTool.tool.function.name, description: "", picked: customTool.enabled})
            customToolsNames.push(customTool.tool.function.name)
        }

        for (let internalTool of this.toolsFunc.keys()){
            if (!customToolsNames.includes(internalTool)) {
                toolItems.push({ label: appPrefix + internalTool, description: "", picked: (this.app.configuration as { [key: string]: any; })[this.getToolEnabledPropertyName(internalTool)]})
            }
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
            
            let toolsCustom = this.app.configuration.tools_custom
            for (let customTool of toolsCustom){
                customTool.enabled = selectedLabels.includes(appPrefix + customTool.tool.function.name)
            }
            await this.app.configuration.updateConfigValue("tools_custom", toolsCustom);
            
            for (let toolName of this.toolsFunc.keys()){
                if (!customToolsNames.includes(toolName)){
                    let newEnabledValue = selectedLabels.includes(appPrefix + toolName)
                    await this.app.configuration.updateConfigValue(this.getToolEnabledPropertyName(toolName), newEnabledValue);
                }
            }
            
            for (let toolName of  selectedLabels){
                if (!toolName.startsWith(appPrefix)){
                    this.vscodeToolsSelected.set(toolName, true)
                }
            }
        } else {
            // User canceled
        }
    }

    addSelectedTools = () => {
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

    private async confirmToolPermission(confirmText: string): Promise<[any, any]> {
        // Show confirmation dialog and a question to the Telegram user (if enabled)
        this.confirmToolDialogRequest(confirmText);
        if (this.app.configuration.telegram_bot_enabled) {
            this.app.telegramBot.sendResponse(confirmText + "\n\n" + 
                this.app.configuration.getUiText(UI_TEXT_KEYS.telegramAnswerExactly))
            this.app.telegramBot.sendResponse(CONFIRMATION_STATE.YES);
            this.app.telegramBot.sendResponse(CONFIRMATION_STATE.NO);
            this.app.telegramBot.sendResponse(CONFIRMATION_STATE.YES_DONT_ASK);
        }
        this.app.llamaAgent.setConfirmationState(CONFIRMATION_STATE.WAITING);
        // loop and check every 300 ms for an answer (confirmationState change)
        const startTime = Date.now();
        const timeout = 60*this.app.configuration.tools_permission_timeout;
        // if the answer is not received after tools_permission_timeout (setting) seconds, change the confirmationState to Inactive and assume the user answered with No
        while (this.app.llamaAgent.getConfirmationState() == CONFIRMATION_STATE.WAITING && Date.now() - startTime < 1000*timeout) {
            // wait 300 ms for the next check with a promise
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        if (this.app.llamaAgent.getConfirmationState() == CONFIRMATION_STATE.WAITING
                && Date.now() - startTime >= 1000*timeout) {
            this.app.llamaAgent.setConfirmationState(CONFIRMATION_STATE.INACTIVE);
            return [false, false];
        } else {
            const confState = this.app.llamaAgent.getConfirmationState();
            this.app.llamaAgent.setConfirmationState(CONFIRMATION_STATE.INACTIVE);            
            if (confState == CONFIRMATION_STATE.NO) return [false, false];
            else if (confState == CONFIRMATION_STATE.YES_DONT_ASK) return [true, true]; 
            else if (confState == CONFIRMATION_STATE.YES) return [true, false];
            else return [false, false];
        }
        
    }

    private async confirmToolDialogRequest(confirmText: string) {

        let [yesApply, yesDontAsk] = await this.app.dialogs.showYesYesdontaskNoDialog(confirmText);
        // This confirmation mechanism works without question identifier, which is simple.
        // Potentially, this could lead to confirming a different question 
        // (a new one, which is not yet answered, while this one is answered by Telegram and therefore dialog not closed), 
        // but accept the risk as after 60s the question is automatically answered with NO (so this should happen within 30s interval)
        // If the answer is already given by other channel - just ignore it
        if (this.app.llamaAgent.getConfirmationState() == CONFIRMATION_STATE.WAITING){
            if (yesApply && !yesDontAsk) this.app.llamaAgent.setConfirmationState(CONFIRMATION_STATE.YES);
            if (yesApply && yesDontAsk) this.app.llamaAgent.setConfirmationState(CONFIRMATION_STATE.YES_DONT_ASK);
            if (!yesApply) this.app.llamaAgent.setConfirmationState(CONFIRMATION_STATE.NO);
        }
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

    clearToolSearch = () => {
        this.lastSearchToolsResult = [];
    }

    getLastSearchToolsResult = () => {
        return this.lastSearchToolsResult;
    }

    
    getSearchToolsTool = () => {
        return {
                "type": "function",
                "function": {
                    "name": "search_tools",
                    "description": "Search available tools by keyword and return matching tool names and summaries",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "description": "Search keyword, e.g. github or database",
                                "type": "string",
                            },
                        },
                        "required": ["query"],
                    },
                    "strict": true
                }
            }        
    }
        
}
