import {Application} from "./application";

export class Prompts {
    private app: Application

    CHAT_GET_KEY_WORDS = "Analyze the text below and extract the most important keywords. Don't include @ in the keywords. Ensure no word is repeated in the output. Format the response strictly as:\nkeyword1|keyword2|...\nText: {prompt}"
    CHAT_GET_SYNONYMS = "Get up to two different synonyms for each of the following words and make one list from all of them in format word1|word2|word3.\nWords: {keywords} "
    CHAT_EDIT_TEXT = `Modify the following original code according to the instructions. Output only the modified code. No explanations.\n\ninstructions:\n{instructions}\n\noriginal code:\n{originalText}\n\nmodified code:`
    CHAT_GET_SUMMARY = "Summarize the following conversation between the user and AI assistant. Focus on key decisions, code snippets, requirements, and important context. Keep the summary concise (under 300 words) and preserve technical details."


    CREATE_GIT_DIFF_COMMIT = `Please generate a readable and concise git commit message based on the file changes.

Requirements:
1. **Type** (feat, fix, docs, style, refactor, perf, test, chore)
2. **Short description** (no more than 50 characters)
3. **Detailed description** (optional, up to 72 characters)
4. **Output format** must follow the below format:

[Type]: [Short description]
[Detailed description]

**Example OUTPUT:**
feat: add user authentication feature

- Implemented JWT-based authentication
- Added login and registration endpoints

**INPUT:**

{diff}

**OUTPUT:**:
`

TOOLS_SYSTEM_PROMPT_ACTION = `You are an agent for software development - please keep going until the user’s query is completely resolved, before ending your turn and yielding back to the user. 
Only terminate your turn when you are sure that the problem is solved.
If you are not sure about anything pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.
You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully.
Read the file content or a section of the file before editing a the file.

# Workflow

## High-Level Problem Solving Strategy

1. Understand the problem deeply. Carefully read the issue and think critically about what is required.
2. Investigate the codebase. Explore relevant files, search for key functions, and gather context.
3. Develop a clear, step-by-step plan. Break down the fix into manageable, incremental steps.
4. Implement the fix incrementally. Make small, testable code changes.
5. Debug as needed. Use debugging techniques to isolate and resolve issues.
6. Iterate until the root cause is fixed.
7. Reflect and validate comprehensively.

Refer to the detailed sections below for more information on each step.

## 1. Deeply Understand the Problem
Carefully read the issue and think hard about a plan to solve it before coding.

## 2. Codebase Investigation
- Explore relevant files and directories.
- Search for key functions, classes, or variables related to the issue.
- Read and understand relevant code snippets.
- Identify the root cause of the problem.
- Validate and update your understanding continuously as you gather more context.

## 3. Develop a Detailed Plan
- Outline a specific, simple, and verifiable sequence of steps to fix the problem.
- Break down the fix into small, incremental changes.

## 4. Making Code Changes
- Before editing, always read the relevant file contents or section to ensure complete context.
- If a patch is not applied correctly, attempt to reapply it.
- Make small, testable, incremental changes that logically follow from your investigation and plan.

## 5. Debugging
- Make code changes only if you have high confidence they can solve the problem
- When debugging, try to determine the root cause rather than addressing symptoms
- Debug for as long as needed to identify the root cause and identify a fix
- Use print statements, logs, or temporary code to inspect program state, including descriptive statements or error messages to understand what's happening
- To test hypotheses, you can also add test statements or functions
- Revisit your assumptions if unexpected behavior occurs.
 

## 6. Final Verification
- Confirm the root cause is fixed.
- Review your solution for logic correctness and robustness.
- Iterate until you are extremely confident the fix is complete.

## 7. Final Reflection
- If there are changed files, build the application to check for errors.
- Reflect carefully on the original intent of the user and the problem statement.
- Think about potential edge cases or scenarios.
- Continue refining until you are confident the fix is robust and comprehensive.

Obligatory read the file before editing it with a tool.

`

TOOLS_SYSTEM_PROMPT_PLANNING = `You are an expert in planning. You are working in a planning mode and just plan. You do not take actions.`

TOOLS_ANALYSE_GOAL = `
Analyze the goal and make sure it could be implemented with the available tools. Ask the user for clarifications if something is unclear or can't be implemented. At the end formulate the goal clearly. Output only the goal, nothing else, and stop. Example:
<goal>
Rename the variable application to app in file extension.ts.
</goal>
Goal:
{goal}
`
TOOLS_CREATE_PLAN = `
Create a detailed plan with simple steps for achieving the goal. Each step should include obligatory 3 parts - step number, step description, expected result. Formulate step description as a high quality prompto for LLM. For each step use format: step number::step description::expected result. Each step should be achievable only based on the results of the previous steps and with the available tools. Format the plan using xml tags <plan> and <step>. Avoid using line numbers in the plan. Use context, lines to remove and new lines. Example plan:
<plan>
<step>1 :: Step 1 descripton :: Step 1 expected result</step>
<step>2 :: Step 2 descripton :: Step 2 expected result</step>
<step>3 :: Step 3 descripton :: Step 3 expected result</step>
</plan>
Do not try to achieve the goal! Output only the plan without additional explanations or comments.
Create and output a plan for achieving the goal:
{goal}
`

TOOLS_EXECUTE_STEP = `
Instructions:
The final goal is: 
{goal}

Current progress:
{progress}

Now you should execute just one step in achievening it - the task below. 
Include ALL important detailed results from the task in the <result> tag. It will be available for the following steps.

Important requirements:
- You MUST use the tools if this is specified in the task
- Do NOT respond with Done unless you have actually executed the task and verified success
- If you encounter any issues, explain what went wrong in the <result> section
- Never claim the task is done if you haven't actually performed it
- Answer with state (done or failed) and result (result of the execution) in xml format. 
Example answer:
<state>Done</state>
<result>
[Detailed results or error message]
</result>

Context:
{context}
Task: 
{task} 

Expected result: 
{expected_result}
`
EDIT_FILE_REMINDER = `[REMINDER] When using edit_file:

1. "search" MUST be a VERBATIM, exact copy (character-for-character, spaces, tabs, newlines) of the text from the current file. NO approximations.
2. The "search" block MUST appear exactly ONCE in the file (unless replace_all=true). Include 3-5 surrounding lines to guarantee uniqueness.
3. If an edit fails, RE-READ the file immediately and retry with a more specific search block.`

EDIT_FILE_DESC = `
Tool: edit_file

Purpose:
Performs a precise, surgical edit to an existing file OR creates a new file. The tool uses exact string matching to ensure deterministic, safe modifications.

Parameters:
- file_path (string, Required): Absolute path to the file. Always use absolute paths to avoid ambiguity.
- search (string, Conditional): The exact text to find and replace. Must be non-empty for edits. For file creation, set to an empty string ("").
- replace (string, Required): The new content to insert. Can be an empty string ("") to delete the search block.
- replace_all (boolean, Optional, default: false): If true, replaces all occurrences of search. If false, search must appear exactly once.

Mode 1: Editing an Existing File (Primary Use)
Use this mode when modifying a file that already exists on disk.

Prerequisites:
1. The file must have been read earlier in this conversation (via Read or cat).
2. The file must not have been modified externally since you last read it (staleness check).

Rules for search:
- Must be an exact, verbatim copy of the text you want to replace, character for character.
- Include 3 to 5 lines of surrounding context to guarantee uniqueness and help the tool locate the correct block.
- Preserve indentation (spaces/tabs), newlines (\n), and case exactly as they appear in the file.
- NEVER shorten, summarize, or "approximate" the search block. A single mismatched character will cause the edit to fail.

Validity checks for editing:
- If search appears 0 times -> FAIL. Error: "Search string not found." Re-read the file and correct the block.
- If search appears more than once and replace_all is false (default) -> FAIL. Error: "Found X matches. Provide more context or set replace_all=true."
- If search appears exactly once -> SUCCESS. Perform the replacement.
- If search appears more than once and replace_all is true -> SUCCESS. Replace all occurrences. Use this option sparingly and with caution.

Mode 2: Creating a New File (Fallback Only)
Use this mode only when the file does not exist yet.

Rules:
- file_path must point to a location that does not currently exist on disk.
- search MUST be an empty string ("").
- replace must contain the complete content for the new file.

Validity checks for creation:
- If file already exists and search is "" -> FAIL. Error: "File already exists. Use edit mode (non-empty search) to modify it."
- If file does not exist and search is "" -> SUCCESS. Create the new file with the content from replace.
- If file does not exist and search is non-empty -> FAIL. Error: "Cannot edit a non-existent file. To create a file, set search to ""."

Examples (plain text):

Example 1: Replace a function definition (existing file)
file_path = "/home/user/src/app.py"
search = "def calculate():\n    return 42\n"
replace = "def calculate():\n    return 100\n"
replace_all = false

Example 2: Delete a line (set replace to empty string)
file_path = "/home/user/config.json"
search = "\"debug\": true,\n"
replace = ""
replace_all = false

Example 3: Create a new file
file_path = "/home/user/src/new_module.py"
search = ""
replace = "import os\n\ndef main():\n    print('Hello')\n"

Critical Guidelines for the Agent:
1. Always use absolute paths. Never rely on relative paths or the current working directory.
2. Read before editing. Always read the file first to obtain the exact current content and to satisfy the staleness check.
3. If an edit fails, immediately re-read the file (using Read or cat) and retry with a more specific search block. The file may have changed externally.
4. Make small, focused edits. Break large changes into multiple small edit_file calls. This reduces token usage, makes failures easier to debug, and minimises risk.
5. Never ignore whitespace. The match is literal. Copy indentation and line endings exactly from the current file.
6. Deleting content: To remove text, set replace to an empty string (""). This deletes the search block entirely.
7. Do not rewrite entire files unless absolutely necessary (for example, the file is very small and a complete restructure is required). For existing files, prefer surgical edits.

Failure Responses and Agent Recovery Actions:
- "Search string not found." -> Re-read the file (the content may have changed). Adjust search to match exactly.
- "Found X matches. Provide more context or set replace_all=true." -> Add more surrounding lines to search to make it unique, or use replace_all=true if appropriate.
- "File already exists. Use edit mode." -> You tried to create a file that exists. Provide a non-empty search block and edit it instead.
- "Cannot edit a non-existent file." -> You tried to edit a file that doesn't exist. Set search to "" to create it.
- "File has been modified since last read." -> Re-read the file to refresh your context, then attempt the edit again (this prevents overwriting external changes).

Summary:
- Editing: search = exact block to replace, replace = new content, replace_all = false by default.
- Creating: search = "", replace = full file content.
- Deleting: search = text to remove, replace = "".
- Always provide absolute file_path, always read the file first, and always make small, focused changes.
`

MULTI_EDIT_FILE_DESC = `Tool: multi_edit_file

Purpose:
Performs multiple find-and-replace operations on a single file in one atomic call. This is the preferred tool when you need to make several changes to the same file, as it reduces the number of tool invocations and ensures that either all edits are applied or none are (atomicity).

Parameters:
- file_path (string, Required): The absolute path to the file to modify. Always use an absolute path.
- edits (array, Required): An array of edit operations. Must contain at least one operation.
  Each operation in the array has the following fields:
  - old_string (string, Required): The exact text to find and replace. Must match character-for-character, including whitespace, indentation, and newlines.
  - new_string (string, Required): The replacement text. Can be an empty string ("") to delete old_string.
  - replace_all (boolean, Optional, default: false): If true, replaces every occurrence of old_string in the file. If false (default), old_string must appear exactly once in the file for this operation to succeed.

Behavior:
1. Atomic execution: The tool performs all edits as a single transaction. If any individual edit fails (e.g., old_string not found, multiple matches found without replace_all), the entire operation is aborted and no changes are written to disk.
2. Sequential application: Edits are applied in the order they appear in the edits array. This allows later edits to target text that was introduced or modified by an earlier edit in the same call.
3. Uniqueness enforcement: For each operation, unless replace_all is true, the corresponding old_string must occur exactly once in the current state of the file (after applying previous edits in the array). If it occurs zero times or multiple times, the operation fails and the whole multi_edit is rolled back.
4. File staleness: The file must have been read earlier in the current conversation. If the file has been modified externally since the last read, the tool will reject the operation. Re-read the file and retry.

Prerequisites:
- The file must have been read (via the Read tool or a cat command) in the current session.
- The file must not have been modified on disk since the last read (staleness check).

Success and Failure:
- Success: Returns a confirmation message indicating that all edits were applied successfully.
- Failure: Returns an error message describing the specific failure. Common failures include:
  - "Search string not found" – old_string does not exist.
  - "Found X matches, provide more context or set replace_all=true" – ambiguous match.
  - "File has been modified since last read" – staleness detected.
  - "File does not exist" – cannot edit a missing file (use the single edit_file tool to create it).

Guidelines for the Agent:
1. Provide exact, verbatim old_string blocks. Copy directly from the file, including all whitespace and indentation.
2. Include 3–5 lines of surrounding context in each old_string to guarantee uniqueness, unless you intend to replace all occurrences.
3. Break large changes into logical groups within the edits array, but keep the total number of operations reasonable (typically under 10 per call). For very large rewrites, consider using multiple multi_edit_file calls.
4. If an edit fails, re-read the file immediately (the file may have changed) and retry with a more specific old_string or by adjusting the replace_all flag.
5. Use replace_all only when you are certain that every occurrence of old_string must be replaced. This is commonly used for renaming variables or updating boilerplate text.

Examples (illustrative, not code):

Example 1: Replace two function names in the same file.
file_path: "/home/user/src/app.py"
edits:
  - old_string: "def calculate_old():\n    return 42\n"
    new_string: "def calculate_new():\n    return 42\n"
    replace_all: false
  - old_string: "result = calculate_old()"
    new_string: "result = calculate_new()"
    replace_all: false

Example 2: Replace all occurrences of a deprecated constant.
file_path: "/home/user/src/config.js"
edits:
  - old_string: "OLD_API_URL"
    new_string: "NEW_API_URL"
    replace_all: true

Example 3: Delete an entire import line and update a function call (sequential dependency).
file_path: "/home/user/src/main.py"
edits:
  - old_string: "from old_lib import helper\n"
    new_string: ""   # Deletes the import line
    replace_all: false
  - old_string: "helper.process()"
    new_string: "new_helper.process()"  # This edit sees the file after the import is removed
    replace_all: false

Important Notes:
- This tool is designed for existing files. To create a new file, use the single edit_file tool with an empty search string.
- To delete a block of text, set new_string to an empty string ("").
- The tool operates on a best-effort basis to preserve line endings and encoding. Always normalize newlines to LF (\n) before performing comparisons to avoid platform-specific mismatches.
- If you need to replace a large, complex block, ensure old_string matches exactly, including any trailing newline or spaces at the end of the block.

Summary:
- Use multi_edit_file when you have two or more targeted changes in the same file.
- Each old_string must be unique unless replace_all is true.
- Edits run sequentially and atomically – all succeed or none are applied.
- Always read the file before editing, and re-read if an error occurs.`


// Reused from Roocode. Thanks to the authors for keeping it open source.
TOOL_UPDATE_TODO_LIST_DESCRIPTION = `## update_todo_list

**Description:**
Replace the entire TODO list with an updated checklist reflecting the current state. Always provide the full list; the system will overwrite the previous one. This tool is designed for step-by-step task tracking, allowing you to confirm completion of each step before updating, update multiple task statuses at once (e.g., mark one as completed and start the next), and dynamically add new todos discovered during long or complex tasks.

**Checklist Format:**
- Use a single-level markdown checklist (no nesting or subtasks).
- List todos in the intended execution order.
- Status options:
	 - [ ] Task description (pending)
	 - [x] Task description (completed)
	 - [-] Task description (in progress)

**Status Rules:**
- [ ] = pending (not started)
- [x] = completed (fully finished, no unresolved issues)
- [-] = in_progress (currently being worked on)

**Core Principles:**
- Before updating, always confirm which todos have been completed since the last update.
- You may update multiple statuses in a single update (e.g., mark the previous as completed and the next as in progress).
- When a new actionable item is discovered during a long or complex task, add it to the todo list immediately.
- Do not remove any unfinished todos unless explicitly instructed.
- Always retain all unfinished tasks, updating their status as needed.
- Only mark a task as completed when it is fully accomplished (no partials, no unresolved dependencies).
- If a task is blocked, keep it as in_progress and add a new todo describing what needs to be resolved.
- Remove tasks only if they are no longer relevant or if the user requests deletion.

**Usage Example:**
<update_todo_list>
<todos>
[x] Analyze requirements
[x] Design architecture
[-] Implement core logic
[ ] Write tests
[ ] Update documentation
</todos>
</update_todo_list>

*After completing "Implement core logic" and starting "Write tests":*
<update_todo_list>
<todos>
[x] Analyze requirements
[x] Design architecture
[x] Implement core logic
[-] Write tests
[ ] Update documentation
[ ] Add performance benchmarks
</todos>
</update_todo_list>

**When to Use:**
- The task is complicated or involves multiple steps or requires ongoing tracking.
- You need to update the status of several todos at once.
- New actionable items are discovered during task execution.
- The user requests a todo list or provides multiple tasks.
- The task is complex and benefits from clear, stepwise progress tracking.

**When NOT to Use:**
- There is only a single, trivial task.
- The task can be completed in one or two simple steps.
- The request is purely conversational or informational.

**Task Management Guidelines:**
- Mark task as completed immediately after all work of the current task is done.
- Start the next task by marking it as in_progress.
- Add new todos as soon as they are identified.
- Use clear, descriptive task names.
`

TOOL_UPDATE_TODO_LIST_PARAMETER_DESCRIPTION = `Full markdown checklist in execution order, using [ ] for pending, [x] for completed, and [-] for in progress`

TOOL_DELEGATE_TASK_DESCRIPTION = `Delegates a specific task to a subagent. 
Use this when you encounter a subtask that is better handled by a dedicated agent (e.g. providing help for llama.vscode, performing calculations, retrieving specific data) or for optimizing context length. 
Provide the subagent's name and a clear, self-contained description of the task to be performed. 
Optionally, include relevant context (such as user preferences or key conversation snippets) to help the subagent. 
The subagent will execute the task using its own tools and return a result. 
If the delegation fails, an error status with details will be returned.`

TOOL_CREATE_AGENT_DESCRIPTION = `Creates a new agent in the system. The agent's configuration must be provided as a JSON string conforming to the schema defined in the description of property "agent_json". 
Upon successful creation, returns a confirmation message containing the unique identifier of the new agent. Ensure that any tool names listed in the tools field correspond to existing tools in the system.`

// Reused from copilot. Thanks for keeping it open source.
TOOL_GET_ERRORS_DESCRIPTION = `Get any compile or lint errors in a specific file or across all files. If the user mentions errors or problems in a file, they may be referring to these. 
Use the tool to see the same errors that the user is seeing. If the user asks you to analyze all errors, or does not specify a file, use this tool to gather errors for all files. 
Also use this tool after editing a file to validate the change.`

// Reused from copilot. Thanks for keeping it open source.
TOOL_RENAME_SYMBOL_DESCRIPTION = `Rename a code symbol across the workspace using the language server's rename functionality. This performs a precise, semantics-aware rename that updates all references.

Input:
- "symbol": The exact current name of the symbol to rename.
- "newName": The new name for the symbol.
- "uri": A full URI (e.g. "file:///path/to/file.ts") of a file where the symbol appears. Provide either "uri" or "filePath".
- "filePath": A workspace-relative file path (e.g. "src/utils/helpers.ts") of a file where the symbol appears. Provide either "uri" or "filePath".
- "lineContent": A substring of the line of code where the symbol appears. This is used to locate the exact position in the file. Must be the actual text from the file - do NOT fabricate it.

IMPORTANT: The file and line do NOT need to be the definition of the symbol. Any occurrence works - a usage, an import, a call site, etc. You can pick whichever occurrence is most convenient.

If the tool returns an error, retry with corrected input - ensure the file path is correct, the line content matches the actual file content, and the symbol name appears in that line.

If the file's language has no rename provider registered, the tool returns an error.`

AUTO_MEMORY_PROMPT = `Use folder {auto_memory_folder} for persistent memory (auto memory). ONLY in this folder create, read, update and delete *.md files for persistent auto memory across conversations for the current project.
Store codebase conventions, build commands, project structure facts, verified practices, user preferences, etc..
Use descriptive file names for each note, e.g. "project_structure.md", "build_commands.md", "user_preferences.md". From the files names you should be able to determine if you need to read the file content. 
Keep the number of files in the auto memory folder folder not more than {max_auto_memory_files}. If there are more files - reorganize and make them not more than the limit.
IMPORTANT: Before creating new auto memory files, first view what already exists. This helps avoid duplicates and maintain organized notes.
STORE PERSISTENT .MD FILES ONLY IN FOLDER {auto_memory_folder}.`


PROPERTY_AGENT_JSON_DESCRIPTION = `A JSON string that defines the agent to be created. The object must include the following fields:

    name (string): The name of the agent.

    description (string): A brief explanation of the agent's purpose and behavior.

    subagentEnabled (boolean): Set to true if this agent can be invoked as a subagent by other agents; otherwise false.

    systemInstruction (string): The system prompt or instruction that guides the agent's responses and actions.

    tools (string, optional): A comma-separated list of tool names that the agent is permitted to use. Do not include spaces around the commas (e.g., "tool1,tool2,tool3"). If omitted, the agent will have no tools.

Example value:
{
  "name": "CustomerSupportAgent",
  "description": "Handles customer inquiries and returns troubleshooting steps.",
  "subagentEnabled": true,
  "systemInstruction": "You are a helpful customer support representative...",
  "tools": "searchKnowledgeBase,ticketCreator"
}
`

SUBAGENTS_DESCRIPTION = `Subagents
You have access to specialized subagents via the delegate_task tool. Use it when you encounter a well‑defined subtask that can be handled independently — for example, providing help for llama.vscode, performing complex calculations, or retrieving data from a specific source.
If the delegation fails (error or timeout), decide whether to retry with a different subagent, handle the task yourself, or report the issue to the user.`

SUMMARIZE_PROMPT = `
You are an expert conversation summarizer. Your task is to condense the provided conversation history into a structured Continuity Brief. This brief will entirely replace the raw chat history in the next turn, so the AI must be able to continue the conversation seamlessly without asking for repeated information.

Your strict objectives:

    Preserve Actionable Data: Keep all facts, figures, code snippets, URLs, user preferences, constraints (budget/time), and specific requirements.

    Preserve Progress: Clearly state what has been decided and what is still pending.

    Preserve the "Ball": Explicitly detail the last question asked or the last task initiated so the next response answers the right thing.

    Remove Fluff: Discard greetings, pleasantries, filler clarifications, repeated statements, and off-topic tangents.

Output Format (Use exactly this structure):

CONTINUITY BRIEF

1. User's Core Objective:
[State the user's primary goal, project name, or end-game in 1-2 sentences.]

2. Established Context & Constraints:
[List all immutable facts, preferences, budgets, technical stacks, or personal details the user has confirmed. E.g., "Using Python 3.11", "Budget is $500", "Prefers dark mode".]

3. Decisions Made So Far:
[List the concrete conclusions we have reached. E.g., "Decided to use PostgreSQL over MySQL", "Agreed on the minimalist design".]

4. Current Status & Unresolved Items:
[Describe exactly where we are in the workflow. List any open questions, bugs to fix, or choices waiting for user input.]

5. The Immediate Next Step (Crucial):
[Paraphrase the very last request or question the user asked. Frame it as a directive so the AI knows exactly what to respond to first.]

Important Constraints for You:

    Write the summary in the third person (e.g., "The user is building...", "The assistant provided...").

    Do not add new information, assumptions, or solutions that were not explicitly discussed.

    If the conversation involved code, include the final working version of that code in Section 4 (Status) if it was accepted by the user.

Now, summarize the conversation below:
`

constructor(application: Application) {
        this.app = application;
    }

    public replacePlaceholders(template: string, replacements: { [key: string]: string }): string {
        return template.replace(/{(\w+)}/g, (_, key) => replacements[key] || "");
    }

    public replaceOnePlaceholder(template: string, key: string, replacement: string): string {
        return template.replace("{"+key+"}", replacement);
    }
}
