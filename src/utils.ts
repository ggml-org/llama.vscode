import vscode from "vscode";

export class Utils {
    static getLeadingSpaces = (input: string): string => {
        // Match the leading spaces using a regular expression
        const match = input.match(/^[ \t]*/);
        return match ? match[0] : "";
    }

    static delay = (ms: number) => {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    static getPrefixLines = (document: vscode.TextDocument, position: vscode.Position, nPrefix: number): string[] => {
        const startLine = Math.max(0, position.line - nPrefix);
        return Array.from({ length: position.line - startLine }, (_, i) => document.lineAt(startLine + i).text);
    }

    static getSuffixLines = (document: vscode.TextDocument, position: vscode.Position, nSuffix: number): string[] => {
        const endLine = Math.min(document.lineCount - 1, position.line + nSuffix);
        return Array.from({ length: endLine - position.line }, (_, i) => document.lineAt(position.line + 1 + i).text);
    }

    static removeTrailingNewLines = (suggestionLines: string[]) => {
        while (suggestionLines.length > 0 && suggestionLines.at(-1)?.trim() == "") {
            suggestionLines.pop();
        }
    }

    static getChunksInPlainText = (chunksToSend: any[]) => {
        let extraCont = "Here are pieces of code from different files of the project: \n" 
        + chunksToSend.reduce((accumulator, currentValue) => accumulator + "\nFile Name: " 
        + currentValue.filename + "\nText:\n" + currentValue.text + "\n\n", "");
        return extraCont;
    }
}
