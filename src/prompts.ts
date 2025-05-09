import {Application} from "./application";

export class Prompts {
    private app: Application

    CHAT_GET_KEY_WORDS = "Analyze the text below and extract the most important keywords. Don't include @ in the keywords. Ensure no word is repeated in the output. Format the response strictly as:\nkeyword1|keyword2|...\nText: {prompt}"
    CHAT_GET_SYNONYMS = "Get up to two different synonyms for each of the following words and make one list from all of them in format word1|word2|word3.\nWords: {keywords} "

    CHAT_EDIT_TEXT = `{chunks}\n\nModify the following original code according to the instructions. Output only the modified code. No explanations.\n\ninstructions:\n{instructions}\n\noriginal code:\n{originalText}\n\nmodified code:`

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
