// --------------------------------------------------------------------------- //
//  Domain objects
// --------------------------------------------------------------------------- //
type ActionType = "add" | "delete" | "update";

interface FileChange {
    type: ActionType;
    old_content?: string;
    new_content?: string;
    move_path?: string;
}

interface Commit {
    changes: Record<string, FileChange>;
}

// --------------------------------------------------------------------------- //
//  Exceptions
// --------------------------------------------------------------------------- //
class DiffError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DiffError";
    }
}

// --------------------------------------------------------------------------- //
//  Helper interfaces used while parsing patches
// --------------------------------------------------------------------------- //
interface Chunk {
    orig_index: number;
    del_lines: string[];
    ins_lines: string[];
}

interface PatchAction {
    type: ActionType;
    new_file?: string;
    chunks: Chunk[];
    move_path?: string;
}

interface Patch {
    actions: Record<string, PatchAction>;
}

// --------------------------------------------------------------------------- //
//  Core implementation
// --------------------------------------------------------------------------- //
export async function applyPatch(
    patchText: string,
    openFn: (path: string) => Promise<string>,
    writeFn: (path: string, content: string) => Promise<void>,
    removeFn: (path: string) => Promise<void>
): Promise<void> {
    if (!patchText.startsWith("*** Begin Patch")) {
        throw new DiffError("Patch text must start with *** Begin Patch");
    }

    // Identify required files
    const paths = [
        ...extractPaths(patchText, "*** Update File: "),
        ...extractPaths(patchText, "*** Delete File: "),
    ];

    // Load original file contents
    const orig: Record<string, string> = {};
    for (const path of paths) {
        orig[path] = await openFn(path);
    }

    // Parse and apply patch
    const patch = parsePatch(patchText, orig);
    const commit = createCommit(patch, orig);
    await applyChanges(commit, writeFn, removeFn);
}

// --------------------------------------------------------------------------- //
//  Helper functions
// --------------------------------------------------------------------------- //
function extractPaths(text: string, prefix: string): string[] {
    return text
        .split("\n")
        .filter(line => line.startsWith(prefix))
        .map(line => line.slice(prefix.length));
}

function parsePatch(text: string, orig: Record<string, string>): Patch {
    const lines = text.split("\n");
    if (!Parser.validateSentinels(lines)) {
        throw new DiffError("Invalid patch text - missing sentinels");
    }

    const parser = new Parser(orig, lines);
    parser.parse();
    return parser.patch;
}

function createCommit(patch: Patch, orig: Record<string, string>): Commit {
    const commit: Commit = { changes: {} };
    for (const [path, action] of Object.entries(patch.actions)) {
        if (action.type === "delete") {
            commit.changes[path] = {
                type: "delete",
                old_content: orig[path],
            };
        } else if (action.type === "add") {
            if (!action.new_file) {
                throw new DiffError(`ADD action without content for: ${path}`);
            }
            commit.changes[path] = {
                type: "add",
                new_content: action.new_file,
            };
        } else if (action.type === "update") {
            commit.changes[path] = {
                type: "update",
                old_content: orig[path],
                new_content: applyFileChanges(orig[path], action, path),
                move_path: action.move_path,
            };
        }
    }
    return commit;
}

async function applyChanges(
    commit: Commit,
    writeFn: (path: string, content: string) => Promise<void>,
    removeFn: (path: string) => Promise<void>
): Promise<void> {
    for (const [path, change] of Object.entries(commit.changes)) {
        if (change.type === "delete") {
            await removeFn(path);
        } else if (change.type === "add") {
            if (!change.new_content) {
                throw new DiffError(`Missing content for new file: ${path}`);
            }
            await writeFn(path, change.new_content);
        } else if (change.type === "update") {
            if (!change.new_content) {
                throw new DiffError(`Missing content for update: ${path}`);
            }
            const target = change.move_path || path;
            await writeFn(target, change.new_content);
            if (change.move_path) {
                await removeFn(path);
            }
        }
    }
}

function applyFileChanges(
    content: string,
    action: PatchAction,
    path: string
): string {
    if (action.type !== "update") {
        throw new DiffError("Invalid operation for file changes");
    }

    const origLines = content.split("\n");
    const newLines: string[] = [];
    let cursor = 0;

    for (const chunk of action.chunks) {
        // Validate chunk position
        if (chunk.orig_index > origLines.length) {
            throw new DiffError(
                `${path}: Chunk position ${chunk.orig_index} out of bounds`
            );
        }
        if (cursor > chunk.orig_index) {
            throw new DiffError(
                `${path}: Overlapping chunks at ${cursor} > ${chunk.orig_index}`
            );
        }

        // Add content before chunk
        newLines.push(...origLines.slice(cursor, chunk.orig_index));
        cursor = chunk.orig_index;

        // Apply changes
        newLines.push(...chunk.ins_lines);
        cursor += chunk.del_lines.length;
    }

    // Add remaining content
    newLines.push(...origLines.slice(cursor));
    return newLines.join("\n");
}

// --------------------------------------------------------------------------- //
//  Parser implementation
// --------------------------------------------------------------------------- //
class Parser {
    current_files: Record<string, string>;
    lines: string[];
    index: number;
    patch: Patch;
    fuzz: number;

    constructor(orig: Record<string, string>, lines: string[]) {
        this.current_files = orig;
        this.lines = lines;
        this.index = 1; // Skip begin sentinel
        this.patch = { actions: {} };
        this.fuzz = 0;
    }

    static validateSentinels(lines: string[]): boolean {
        return (
            lines.length >= 2 &&
            this.normalize(lines[0]).startsWith("*** Begin Patch") &&
            this.normalize(lines[lines.length - 1]) === "*** End Patch"
        );
    }

    private static normalize(line: string): string {
        return line.replace(/\r$/, "");
    }

    parse(): void {
        while (!this.isAtEnd()) {
            const path = this.tryParseSection();
            if (!path) break;
        }

        if (this.currentLine() !== "*** End Patch") {
            throw new DiffError("Missing *** End Patch sentinel");
        }
    }

    private tryParseSection(): string | null {
        const updatePath = this.tryRead("*** Update File: ");
        if (updatePath) return this.parseUpdate(updatePath);

        const deletePath = this.tryRead("*** Delete File: ");
        if (deletePath) return this.parseDelete(deletePath);

        const addPath = this.tryRead("*** Add File: ");
        if (addPath) return this.parseAdd(addPath);

        throw new DiffError(`Unknown line: ${this.currentLine()}`);
    }

    private parseUpdate(path: string): string {
        if (this.patch.actions[path]) {
            throw new DiffError(`Duplicate update for: ${path}`);
        }
        if (!(path in this.current_files)) {
            throw new DiffError(`Missing file for update: ${path}`);
        }

        const moveTo = this.tryRead("*** Move to: ");
        const content = this.current_files[path];
        const action = this.parseUpdateContent(content);
        action.move_path = moveTo || undefined;
        this.patch.actions[path] = action;
        return path;
    }

    private parseDelete(path: string): string {
        if (this.patch.actions[path]) {
            throw new DiffError(`Duplicate delete for: ${path}`);
        }
        if (!(path in this.current_files)) {
            throw new DiffError(`Missing file for delete: ${path}`);
        }
        this.patch.actions[path] = { type: "delete", chunks: [] };
        return path;
    }

    private parseAdd(path: string): string {
        if (this.patch.actions[path]) {
            throw new DiffError(`Duplicate add for: ${path}`);
        }
        if (path in this.current_files) {
            throw new DiffError(`File already exists: ${path}`);
        }
        this.patch.actions[path] = this.parseAddContent();
        return path;
    }

    private parseUpdateContent(text: string): PatchAction {
        const action: PatchAction = { type: "update", chunks: [] };
        const lines = text.split("\n");
        let cursor = 0;

        while (!this.isAtEnd(["*** Update File:", "*** Delete File:", "*** Add File:"])) {
            const [context, chunks, endIndex] = this.parseChunkSection();
            const position = this.findContextPosition(lines, context, cursor);
            
            for (const chunk of chunks) {
                chunk.orig_index += position;
                action.chunks.push(chunk);
            }
            cursor = position + context.length;
            this.index = endIndex;
        }
        return action;
    }

    private parseAddContent(): PatchAction {
        const lines: string[] = [];
        while (!this.isAtEnd(["*** Update File:", "*** Delete File:", "*** Add File:"])) {
            const line = this.consumeLine();
            if (!line.startsWith("+")) {
                throw new DiffError(`Invalid add line: ${line}`);
            }
            lines.push(line.slice(1));
        }
        return { type: "add", new_file: lines.join("\n"), chunks: [] };
    }

    private parseChunkSection(): [string[], Chunk[], number] {
        const context: string[] = [];
        const chunks: Chunk[] = [];
        let delBuffer: string[] = [];
        let insBuffer: string[] = [];
        const startIndex = this.index;

        while (this.index < this.lines.length) {
            const line = this.lines[this.index];
            if (this.isSectionBoundary(line)) break;
            this.index++;
            
            const firstChar = line[0] || " ";
            const content = line.slice(1);
            
            switch (firstChar) {
                case " ":
                    this.finalizeChunk(delBuffer, insBuffer, chunks, context);
                    context.push(content);
                    break;
                case "-":
                    delBuffer.push(content);
                    context.push(content);
                    break;
                case "+":
                    insBuffer.push(content);
                    break;
                default:
                    throw new DiffError(`Invalid diff line: ${line}`);
            }
        }
        
        this.finalizeChunk(delBuffer, insBuffer, chunks, context);
        return [context, chunks, this.index];
    }

    private finalizeChunk(
        del: string[],
        ins: string[],
        chunks: Chunk[],
        context: string[]
    ) {
        if (del.length > 0 || ins.length > 0) {
            chunks.push({
                orig_index: context.length - del.length,
                del_lines: [...del],
                ins_lines: [...ins],
            });
            del.length = 0;
            ins.length = 0;
        }
    }

    private findContextPosition(
        fileLines: string[],
        context: string[],
        start: number
    ): number {
        if (context.length === 0) return start;
        
        for (let i = start; i <= fileLines.length - context.length; i++) {
            if (this.contextMatches(fileLines, context, i)) {
                return i;
            }
        }
        
        throw new DiffError(
            `Context not found:\n${context.join("\n")}\n` +
            `After line ${start} in file`
        );
    }

    private contextMatches(
        fileLines: string[],
        context: string[],
        start: number
    ): boolean {
        for (let j = 0; j < context.length; j++) {
            if (Parser.normalize(fileLines[start + j]) !== Parser.normalize(context[j])) {
                return false;
            }
        }
        return true;
    }

    // ----------------------------------------------------------------------- //
    //  Parser utilities
    // ----------------------------------------------------------------------- //
    private currentLine(): string {
        if (this.index >= this.lines.length) {
            throw new DiffError("Unexpected end of input");
        }
        return this.lines[this.index];
    }

    private tryRead(prefix: string): string | null {
        const line = this.currentLine();
        if (line.startsWith(prefix)) {
            this.index++;
            return line.slice(prefix.length);
        }
        return null;
    }

    private consumeLine(): string {
        return this.lines[this.index++];
    }

    private isAtEnd(prefixes?: string[]): boolean {
        if (this.index >= this.lines.length) return true;
        const line = this.currentLine();
        return prefixes
            ? prefixes.some(p => line.startsWith(p))
            : line === "*** End Patch";
    }

    private isSectionBoundary(line: string): boolean {
        return [
            "@@",
            "*** End Patch",
            "*** Update File:",
            "*** Delete File:",
            "*** Add File:",
            "*** End of File",
            "***"
        ].some(b => line.startsWith(b));
    }

    applyEdits = (originalText: string, diffText: string): string => {
        // Extract edit blocks from the diff-fenced format
        let editBlocks: string[][] = [];
        const pattern1 = /```diff\n(.*?)\n<<<<<<< SEARCH\n(.*?)=======\n(.*?)>>>>>>> REPLACE\n```/gs;
        let match;
        while ((match = pattern1.exec(diffText)) !== null) {
            editBlocks.push([match[1], match[2], match[3]]);
        }

        // Fallback to pattern without code fences if no matches found
        if (editBlocks.length === 0) {
            const pattern2 = /(.*?)\n<<<<<<< SEARCH\n(.*?)=======\n(.*?)>>>>>>> REPLACE/gs;
            while ((match = pattern2.exec(diffText)) !== null) {
                editBlocks.push([match[1], match[2], match[3]]);
            }
        }

        if (editBlocks.length === 0) {
            return originalText;
        }

        // Apply each edit block
        let result = originalText;
        for (const block of editBlocks) {
            if (block.length === 3) {
                const searchText = block[1].trim();
                const replaceText = block[2].trim();

                if (result.includes(searchText)) {
                    // Replace all occurrences globally
                    result = result.split(searchText).join(replaceText);
                } else {
                    // Handle empty search text case
                    if (searchText === '') {
                        result += '\n' + replaceText;
                    }
                }
            }
        }

        return result;
    }
}