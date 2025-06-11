import {Application} from "./application";
import * as vscode from 'vscode';
import {Utils} from "./utils";
import path from "path";
import fs from 'fs';


type ToolsMap = Map<string, (...args: any[]) => any>;

export class Tools {
    private app: Application;
    toolsFunc: ToolsMap = new Map();
    tools: any[] = [];
                
    
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
    }

    public runTerminalCommand = async (args: string ) => {
        let command = JSON.parse(args).command;
        let commandOutput = "";
        if ( (!this.app.extConfig.tool_permit_some_terminal_commands || Utils.isModifyingCommand(command)) && !await Utils.showYesNoDialog("Do you give a permission to execute the terminal command:\n" + command)) {
            commandOutput = "The user doesn't give a permission to execute this command.";

        } else {
            let resultOneCall = await Utils.executeTerminalCommand(command);
            commandOutput = resultOneCall.slice(0, this.app.extConfig.MAX_CHARS_TOOL_RETURN);
        }
        return commandOutput;
    }


    public searchSource = async (args: string ) => {
        let query = JSON.parse(args).query;
        
        let contextChunks = await this.app.chatContext.getRagContextChunks(query)
        let relevantSource = await this.app.chatContext.getContextChunksInPlainText(contextChunks);
        
        return relevantSource;
    }

    public readFile = async (args: string ) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        let uri: vscode.Uri;

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

    public readDirectory = async (args: string ) => {
        let params = JSON.parse(args);
        let dirPath = params.directory_path;
        let uri: vscode.Uri;
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

    public getRegextMatches = async (args: string ) => {
        let params = JSON.parse(args);
        return Utils.getRegexpMatches(params.include_pattern, params.exclude_pattern, params.regex, this.app.chatContext.entries)
    }   

    public deleteFile = async (args: string ) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        try {
            const absolutePath = Utils.getAbsolutFilePath(filePath);
            if (  !await Utils.showYesNoDialog("Do you give a permission to delete file:\n" + absolutePath)) {
                return "The user doesn't give a permission to delete file " + absolutePath;

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

    public getDiff = async (args: string) => {
        try {
            const diff = await this.app.shadowGit.git?.diff(['HEAD']);
            console.log('Changes since last commit:', diff);
            return diff??"";
        } catch (error) {
            console.error('Error changes since last commit:', error);
            throw error;
        }        
    }
    
    public editFile = async (args: string) => {
        let params = JSON.parse(args);
        let filePath = params.file_path;
        let codeEdits = params.code_edits;
        let absolutePath = filePath;
        if (!path.isAbsolute(filePath)) {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                return "File not found: " + filePath;
            }
            
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            absolutePath = path.join(workspaceRoot, filePath);
        }
        try {
            let fileContent = await fs.promises.readFile(absolutePath, 'utf8');
            fileContent = fileContent.split(/\r?\n/).join("\n")
            let updatedFile = Utils.editFile(fileContent, codeEdits)
            return updatedFile??"";
        } catch (error) {
            console.error('Error changes since last commit:', error);
            throw error;
        }        
    }
    
    
    public init = () => {
        this.tools = [...(this.app.extConfig.tool_run_terminal_command_enabled ? [
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
                            "additionalProperties": false
                        },
                        "strict": true
                    }
                }
                ] : []),
                ...(this.app.extConfig.tool_search_source_enabled ? [
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
                            "additionalProperties": false
                        },
                        "strict": true
                    }
                }
                ] : []),
                ...(this.app.extConfig.tool_read_file_enabled ? [
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
                                    "description": "Whether to read the entire file. Defaults to false.",
                                    "type": "boolean",
                                },
                                "file_path": {
                                    "type": "string",
                                    "description": "The path of the file to read"
                                }
                            },
                            "required": [
                                "first_line", "last_line_inclusive", "file_path"
                            ],
                            "additionalProperties": false
                        },
                        "strict": true
                    }
                }
                ] : []),
                ...(this.app.extConfig.tool_list_directory_enabled ? [
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
                            "additionalProperties": false
                        },
                        "strict": true
                    }
                }
                ] : []),
                ...(this.app.extConfig.tool_regex_search_enabled ? [
                {
                    "type": "function",
                    "function": {
                        "name": "regex_search",
                        "description": "Fast text-based regex search in the code base (prefer it for finding exact function names or expressions) that finds exact pattern matches with file names and line numbers within files or directories. If there is no exclude_pattern - provide an empty string. Returns up to 50 matches in format file_name:line_number: line_content",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "include_pattern": {"description": "Glob pattern for files to include (e.g. '*.ts' for TypeScript files)", "type": "string"},
                                "exclude_pattern": {"description": "Glob pattern for files to exclude", "type": "string"},
                                "regex": {"description": "A string for constructing a typescript RegExp pattern to search for. Escape special regex characters when needed.", "type": "string"}
                            },
                            "required": [
                                "include_pattern, exclude_pattern, regex"
                            ],
                            "additionalProperties": false
                        },
                        "strict": true
                    }
                }
                ] : []),
                ...(this.app.extConfig.tool_delete_file_enabled ? [
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
                            "additionalProperties": false
                        },
                        "strict": true
                    }
                }
                ] : []),
                ...(this.app.extConfig.tool_get_diff_enabled ? [
                {
                    "type": "function",
                    "function": {
                        "name": "get_diff",
                        "description": "Gets the files changes since last commit",
                        "parameters": {
                            "type": "object",
                            "required": [
                            ],
                            "additionalProperties": false
                        },
                        "strict": true
                    }
                }
                ] : []),
                ...(this.app.extConfig.tool_edit_file_enabled ? [
                {
                    "type": "function",
                    "function": {
                        "name": "edit_file",
                        "description": "Use this tool to propose edits to an existing file. Use this tool AFTER reading enough lines of the relevant file content with other tools.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "file_path": {
                                    "type": "string",
                                    "description": "The path to the relative the workspace or absolute."
                                },
                                "code_edits": {
                                    "description": `Provide file edits (changes). 
For each edit ALWAYS PROVIDE 3 or more unchanged lines from the original file before the changed lines and 3 or more unchanged lines from the original file after the changed lines. This context is very important for locating where to do the change in the original file!. 
Specify each change in sequence, with the special comment '// ... existing code ...' to represent unchanged code outside the provided edits. 
For example:
// ... existing code ...
hier unchanged line before 1
hier unchanged line before 2
hier unchanged line before 3
hier changed line 1
hier changed line 2
hier unchanged line after 1
hier unchanged line after 2
hier unchanged line after 3
// ... existing code ...
hier unchanged line before 1
hier unchanged line before 2
hier unchanged line before 3
hier changed line 1
hier changed line 2
hier changed line 3
hier unchanged line after 1
hier unchanged line after 2
hier unchanged line after 3
// ... existing code ...

This was an example. Use the real lines from the original file when providing the parameter.
DO NOT omit spans of pre-existing code (or comments) without using the '// ... existing code ...' comment to indicate its absence.`,
                                    "type": "string",
                                },
                            },
                            "required": [
                                "file_path", "code_edits"
                            ],
                            "additionalProperties": false
                        },
                        "strict": true
                    }
                }
                ] : []),
            ]
    }
}
