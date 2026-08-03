import {Application} from "./application";

export class DslInterpreter {
    private app: Application

    constructor(application: Application) {
        this.app = application;
    }

    execute = async (script: string): Promise<any> => {
        const commandsMap = this.app.dslCommands.commandsFunc;

        // Execution context. For now it only keeps the result of the last
        // executed command, but it is designed to be extended with variables
        // and operator state in the future.
        const context: { lastResult?: any; variables: Map<string, any> } = {
            lastResult: undefined,
            variables: new Map<string, any>()
        };

        // Each command is on a separate line.
        const lines = script.split(/\r?\n/);

        for (const rawLine of lines) {
            const line = rawLine.trim();

            // Skip empty lines.
            if (line.length === 0) {
                continue;
            }

            // Handle "return" statement: the value after return is returned
            // from the execute method and the script execution stops.
            if (line === "return" || line.startsWith("return ")) {
                const returnValue = line.slice("return".length).trim();
                return returnValue;
            }

            await this.executeLine(line, commandsMap, context);
        }

        // If there was only one command (line), the return value of this
        // command is the return value of the script. For multiple commands,
        // the result of the last executed command is returned.
        return context.lastResult;
    }

    /**
     * Executes a single command line of the form: <command_name> [arguments]
     * The command name and the arguments are separated by a space. The
     * arguments are the string after the command until the end of the line,
     * trimmed.
     *
     * The command name is used to find the function to execute in the
     * commandsMap and the function is invoked with the arguments string.
     */
    private executeLine = async (
        line: string,
        commandsMap: Map<string, (...args: any[]) => any>,
        context: { lastResult?: any; variables: Map<string, any> }
    ): Promise<any> => {
        // Split the line into the command name (first token) and the
        // arguments (the rest of the line, trimmed).
        const firstSpaceIndex = line.indexOf(" ");

        let commandName: string;
        let args: string;
        if (firstSpaceIndex === -1) {
            // No arguments - the whole line is the command name.
            commandName = line;
            args = "";
        } else {
            commandName = line.substring(0, firstSpaceIndex);
            args = line.substring(firstSpaceIndex + 1).trim();
        }

        // Find the function to execute for this command.
        const commandFunc = commandsMap.get(commandName.toLocaleLowerCase());
        if (!commandFunc) {
            throw new Error(`Unknown DSL command: "${commandName}"`);
        }

        // Execute the command with the arguments and remember the result so it
        // can be used as the script return value (and later by variables and
        // operators).
        const result = await commandFunc(args);
        context.lastResult = result;
        return result;
    }
}
