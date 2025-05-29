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
    TOOLS_SYSTEM_PROMPT = `You are an agent - please keep going until the user’s query is completely resolved, before ending your turn and yielding back to the user. 
Only terminate your turn when you are sure that the problem is solved, or if you need more info from the user to solve the problem.
If you are not sure about anything pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.
You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully.
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
