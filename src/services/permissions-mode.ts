import { ToolsPermissionsMode } from "../constants";

/**
 * Description of one value of the `tools_permissions_mode` setting.
 *
 * This is the single place where the agent chat UI gets its labels and
 * explanations from: `llama-webview-provider.updatePermissionsModeInView()`
 * posts the whole list, so the webview never has to hard-code the modes (an
 * older bundle simply ignores the message and shows no button).
 *
 * `details` is the text of `enumDescriptions` in package.json (the settings UI
 * shows the same text) and `label` is `enumItemLabels`. The unit test
 * `permissions-mode.test.ts` asserts that both stay identical to package.json,
 * so the two copies cannot drift apart.
 */
export interface ToolsPermissionsModeInfo {
    // Value stored in the setting (ToolsPermissionsMode enum member).
    value: ToolsPermissionsMode;
    // Short form for the compact composer footer button.
    shortLabel: string;
    // `enumItemLabels` from package.json - the full mode name.
    label: string;
    // One-sentence explanation shown in the mode menu.
    description: string;
    // `enumDescriptions` from package.json - shown as the item tooltip.
    details: string;
}

export const TOOLS_PERMISSIONS_MODES: ToolsPermissionsModeInfo[] = [
    {
        value: ToolsPermissionsMode.AllowAll,
        shortLabel: "allow all",
        label: "allow all commands",
        description: "Every command runs without asking. Fast, but the AI can do anything - be careful.",
        details: "Alows all commands to be executed by AI. Known also as YOLO mode. Be careful with this mode."
    },
    {
        value: ToolsPermissionsMode.AutoAskIfUnsure,
        shortLabel: "auto ask",
        label: "auto - ask if unsure",
        description: "Safe commands run and dangerous ones are denied. The AI judges the rest and asks you when it is unsure.",
        details: "Obviously safe commands (read-only, inside the project or the auto memory folder) run without asking. Obviously dangerous ones (privilege escalation, recursive/forced deletes, credentials and profile paths, system directories, downloads piped into a shell) are denied. Only the commands in between are judged by the LLM: allow if safe, deny if not, ask the user if unsure. Uses chat model (if available) or tools model."
    },
    {
        value: ToolsPermissionsMode.AutoDenyIfUnsure,
        shortLabel: "auto deny",
        label: "auto - deny if unsure",
        description: "Safe commands run and dangerous ones are denied. The AI judges the rest and denies the command when it is unsure.",
        details: "Obviously safe commands (read-only, inside the project or the auto memory folder) run without asking. Obviously dangerous ones (privilege escalation, recursive/forced deletes, credentials and profile paths, system directories, downloads piped into a shell) are denied. Only the commands in between are judged by the LLM; if it is unsure or cannot answer, the command is denied. Uses chat model (if available) or tools model."
    },
    {
        value: ToolsPermissionsMode.Ask,
        shortLabel: "ask",
        label: "ask for permission",
        description: "Asks you for permission before a command is executed.",
        details: "Ask for permission."
    }
];

// The most restrictive mode: used when the setting holds an unknown value, so a
// corrupted setting can never silently turn into "run everything".
const DEFAULT_MODE = ToolsPermissionsMode.Ask;

export const isToolsPermissionsMode = (value: unknown): value is ToolsPermissionsMode =>
    typeof value === "string" && TOOLS_PERMISSIONS_MODES.some(mode => mode.value === value);

/**
 * Maps whatever the setting contains to a mode the UI knows. `Ask` is the
 * fallback, matching the setting default in package.json.
 */
export const normalizeToolsPermissionsMode = (value: unknown): ToolsPermissionsMode =>
    isToolsPermissionsMode(value) ? value : DEFAULT_MODE;

export const getToolsPermissionsModeInfo = (value: unknown): ToolsPermissionsModeInfo => {
    const mode = normalizeToolsPermissionsMode(value);
    const info = TOOLS_PERMISSIONS_MODES.find(candidate => candidate.value === mode);
    // `Ask` is part of the list above, so this is unreachable - but the find()
    // result has to be narrowed for the compiler.
    return info ?? (TOOLS_PERMISSIONS_MODES[TOOLS_PERMISSIONS_MODES.length - 1] as ToolsPermissionsModeInfo);
};
