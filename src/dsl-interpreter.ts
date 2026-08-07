import {Application} from "./application";

export class DslInterpreter {
    private app: Application

    constructor(application: Application) {
        this.app = application;
    }

    execute = async (script: string): Promise<any> => {
        const commandsMap = this.app.dslCommands.commandsFunc;

        // Execution context with variables and the stack of conditional blocks.
        // Each control frame describes one enclosing `if` block:
        //   ifTaken - the `if` condition evaluated to true
        //   elseSeen - an `else` for this block was already encountered
        //   active  - lines in the current section of this block should execute
        interface ControlFrame {
            ifTaken: boolean;
            elseSeen: boolean;
            active: boolean;
        }
        const context: { lastResult?: any; variables: Map<string, any>; conditionStack: ControlFrame[] } = {
            lastResult: undefined,
            variables: new Map<string, any>(),
            conditionStack: []
        };

        // Helper function to substitute variables in a string
        const substituteVariables = (str: string): string => {
            return str.replace(/\$(\w+)/g, (_, varName) => {
                return `"${context.variables.get(varName) || ''}"` ;
            });
        };

        // Each command is on a separate line.
        const lines = script.split(/\r?\n/);

        for (const rawLine of lines) {
            const line = rawLine.trim();

            // Skip empty lines and comment lines.
            if (line.length === 0 || line.trim().startsWith("//")) {
                continue;
            }

            const isIf = line.startsWith('if ');
            const isElse = line === 'else' || line.startsWith('else ');
            const isEndif = line === 'endif' || line.startsWith('endif ');

            // Handle the if/else/endif control-flow commands first so they are
            // processed both when the current block is active and when it is
            // being skipped.
            if (isIf) {
                // Handle if conditions. A nested `if` that appears while its
                // enclosing block is skipped simply pushes a non-active frame
                // so that its matching `else`/`endif` are tracked correctly.
                const parentActive = context.conditionStack.every((frame) => frame.active);
                const condition = line.substring(3).trim();
                const substitutedCondition = substituteVariables(condition);
                const parts = substitutedCondition.match(/(".*?"|'.*?'|`.*?`|\S+)/g) || [];

                if (parts.length !== 3) {
                    throw new Error('Invalid if condition syntax. Use: if $var == "value" (quotes required for spaces)');
                }

                const left = parts[0].replace(/^["'`]|["]$|['`]$|[`]$/g, '');
                const operator = parts[1];
                const right = parts[2].replace(/^["'`]|["]$|['`]$|[`]$/g, '');
                
                const areOperandsNumbes = Number(left) && Number(right)
                const leftOperand = areOperandsNumbes ? Number(left) : left
                const rightOperand = areOperandsNumbes ? Number(right) : right
                let conditionResult = false;
                switch (operator) {
                    case '==':
                        conditionResult = leftOperand === rightOperand;
                        break;
                    case '!=':
                        conditionResult = leftOperand !== rightOperand;
                        break;
                    case '>':
                        conditionResult = leftOperand > rightOperand;
                        break;
                    case '>=':
                        conditionResult = leftOperand >= rightOperand;
                        break;
                    case '<':
                        conditionResult = leftOperand < rightOperand;
                        break;
                    case '<=':
                        conditionResult = leftOperand <= rightOperand;
                        break;
                    default:
                        throw new Error(`Unsupported operator in if condition: ${operator}`);
                }

                context.conditionStack.push({
                    ifTaken: parentActive && conditionResult,
                    elseSeen: false,
                    active: parentActive && conditionResult
                });
                continue;
            }

            if (isElse) {
                const frame = context.conditionStack[context.conditionStack.length - 1];
                if (!frame) {
                    throw new Error('Syntax error: "else" without a matching "if"');
                }
                if (frame.elseSeen) {
                    throw new Error('Syntax error: multiple "else" for the same "if"');
                }
                frame.elseSeen = true;
                // The else branch runs only when the `if` condition was false.
                frame.active = !frame.ifTaken;
                continue;
            }

            if (isEndif) {
                if (context.conditionStack.length === 0) {
                    throw new Error('Syntax error: "endif" without a matching "if"');
                }
                context.conditionStack.pop();
                continue;
            }

            // Skip the lines that are inside a non-active conditional block.
            if (context.conditionStack.some((frame) => !frame.active)) {
                continue;
            }

            // Handle "return" statement with variable substitution
            if (line === "return" || line.startsWith("return ")) {
                const returnValue = line.slice("return".length).trim();
                const substitutedValue = substituteVariables(returnValue);
                return substitutedValue;
            }

            // Handle variable assignment
            if (line.startsWith('set ')) {
                const args = line.substring(4).trim();
                const [varName, ...valueParts] = args.split(' ');
                const valueCommand = valueParts.join(' ');
                
                if (valueCommand) {
                    // Substitute variables in the command first
                    const substitutedCommand = substituteVariables(valueCommand);
                    // Execute the command and capture result
                    let result = ""
                    if (!commandsMap.get(substitutedCommand.split(" ")[0].toLowerCase())){
                        result = this.app.dslCommands.stripArgumentValue(substitutedCommand)
                    } else {
                        result = await this.executeLine(substitutedCommand, commandsMap, context);
                    }
                    context.variables.set(varName, result);
                } else {
                    context.variables.set(varName, '');
                }
                continue;
            }

            // For regular commands, substitute variables and execute
            const substitutedLine = substituteVariables(line);
            try {
                await this.executeLine(substitutedLine, commandsMap, context);
            } catch (err){
                if (err instanceof Error){
                    console.log(err.message)
                    return err.message
                } 
            }
        }

        if (context.conditionStack.length > 0) {
            throw new Error('Syntax error: missing "endif" for an "if" block');
        }

        // Return the last result if no explicit return
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
