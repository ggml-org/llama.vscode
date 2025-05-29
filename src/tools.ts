import {Application} from "./application";
import * as vscode from 'vscode';
import {Utils} from "./utils";
import { Uri } from "vscode";
import path from "path";

type ToolsMap = Map<string, (...args: any[]) => any>;

export class Tools {
    private app: Application;
    toolsFunc: ToolsMap = new Map();

    tools = [
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
                },
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
                },
                {
                    "type": "function",
                    "function": {
                        "name": "read_file",
                        "description": "Read the contents of a file from first_line to last_line_inclusive, at most 250 lines at a time.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "first_line": {
                                    "type": "integer",
                                    "description": "The query to search the relevat code"
                                },
                                "last_line_inclusive": {
                                    "type": "integer",
                                    "description": "The query to search the relevat code"
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
            ]
    
        constructor(application: Application) {
            this.app = application;
            this.toolsFunc.set("run_terminal_command", this.runTerminalCommand);
            this.toolsFunc.set("search_source", this.searchSource)
            this.toolsFunc.set("read_file", this.readFile)
        }

        public runTerminalCommand = async (args: string ) => {
            let command = JSON.parse(args).command;
            let commandOutput = "";
            if (Utils.isModifyingCommand(command) && !await Utils.showYesNoDialog("Do you give a permission to execute the terminal command:\n" + command)) {
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

            if (path.isAbsolute(filePath)) {
                uri = vscode.Uri.file(filePath);
            } else {
                if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                    return "File not found: " + filePath;
                }
                
                // Resolve against first workspace folder
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const absolutePath = path.resolve(workspaceRoot, filePath);
                uri = vscode.Uri.file(absolutePath);
            }
            try {
                const document = await vscode.workspace.openTextDocument(uri)
                if (params.first_line < 0 || params.last_line_inclusive >= document.lineCount || params.first_line > params.last_line_inclusive) {
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
}