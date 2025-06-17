import {Application} from "./application";

export class Prompts {
    private app: Application

    CHAT_GET_KEY_WORDS = "Analyze the text below and extract the most important keywords. Don't include @ in the keywords. Ensure no word is repeated in the output. Format the response strictly as:\nkeyword1|keyword2|...\nText: {prompt}"
    CHAT_GET_SYNONYMS = "Get up to two different synonyms for each of the following words and make one list from all of them in format word1|word2|word3.\nWords: {keywords} "

    CHAT_EDIT_TEXT = `Modify the following original code according to the instructions. Output only the modified code. No explanations.\n\ninstructions:\n{instructions}\n\noriginal code:\n{originalText}\n\nmodified code:`

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

TOOLS_SYSTEM_PROMPT_ACTION = `You are an agent - please keep going until the user’s query is completely resolved, before ending your turn and yielding back to the user. 
Only terminate your turn when you are sure that the problem is solved, or if you need more info from the user to solve the problem.
If you are not sure about anything pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.
You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully.
`
TOOLS_SYSTEM_PROMPT_PLANNING = `You are a project manager of a software team and an expert in planning. You are in a planning mode. You just plan. You do not take actions.`

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
The final goal is: Rename variable architect to arch in file @extension.ts
However, now you should execute just one step in achievening it - the task below. 
Include all important results from the task in the <result> tag. It will be saved and could be used by the following steps.

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

constructor(application: Application) {
        this.app = application;
    }

    public replacePlaceholders(template: string, replacements: { [key: string]: string }): string {
        return template.replace(/{(\w+)}/g, (_, key) => replacements[key] || "");
    }

    public replaceOnePlaceholders(template: string, key: string, replacement: string): string {
        return template.replace("{"+key+"}", replacement);
    }
}
