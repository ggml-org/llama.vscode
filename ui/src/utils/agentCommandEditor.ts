/**
 * State model + conversions for the Agent Command Editor.
 *
 * The editor FORM STATE lives in App.tsx, not inside the AgentCommandEditor
 * component: App.tsx renders the component only while
 * `view === "agentcommandeditor"`, so component state would be destroyed every
 * time the user switches to another view (chat, editor, env, ...). Keeping the
 * state (and the `loadAgentCommand` handling) one level up means the selected
 * agent command is still there when the user comes back to the editor.
 */

export interface AgentCommandEditDetails {
  name: string;
  description: string;
  prompt: string;
  noPrompt: boolean;
  isScript: boolean;
  executePeriodically: boolean;
  startTime: string;
  period: string;
  totalExecutionTimes: string;
  executedTimes: string;
}

export interface PeriodParts {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

export const emptyAgentCommandEditDetails: AgentCommandEditDetails = {
  name: "",
  description: "",
  prompt: "",
  noPrompt: false,
  isScript: false,
  executePeriodically: false,
  startTime: "",
  period: "",
  totalExecutionTimes: "",
  executedTimes: "0"
};

export const emptyPeriodParts: PeriodParts = {
  days: "",
  hours: "",
  minutes: "",
  seconds: ""
};

// Convert a total number of seconds into its Days/Hours/Minutes/Seconds parts.
export const secondsToParts = (totalSeconds: number): { days: number; hours: number; minutes: number; seconds: number } => {
  const total = Math.max(0, Math.floor(totalSeconds));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
};

// Convert Days/Hours/Minutes/Seconds parts into a total number of seconds.
export const partsToSeconds = (days: number, hours: number, minutes: number, seconds: number): number => {
  return (Math.max(0, Math.floor(days)) * 86400) +
         (Math.max(0, Math.floor(hours)) * 3600) +
         (Math.max(0, Math.floor(minutes)) * 60) +
         Math.max(0, Math.floor(seconds));
};

// A stored period (seconds, possibly a string or missing) -> editor parts.
// An empty / zero / invalid period maps to four empty inputs.
export const periodToParts = (period: unknown): PeriodParts => {
  const seconds = period !== undefined && period !== null && period !== "" ? Number(period) : 0;
  const total = !isNaN(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (total <= 0) return { ...emptyPeriodParts };
  const p = secondsToParts(total);
  return { days: String(p.days), hours: String(p.hours), minutes: String(p.minutes), seconds: String(p.seconds) };
};

// Total number of seconds described by the four period inputs.
export const periodPartsToSeconds = (parts: PeriodParts): number => partsToSeconds(
  parsePartValue(parts.days),
  parsePartValue(parts.hours),
  parsePartValue(parts.minutes),
  parsePartValue(parts.seconds)
);

// Parse a user-entered period part value (empty or non-numeric -> 0).
export const parsePartValue = (value: string): number => {
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : Math.max(0, n);
};

// ISO datetime string -> value for an <input type="datetime-local"> (e.g. "2025-01-01T09:00:00").
export const isoToLocalInputValue = (iso: string): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// value from an <input type="datetime-local"> (e.g. "2025-01-01T09:00") -> ISO datetime string.
export const localInputValueToIso = (value: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toISOString();
};

// `loadAgentCommand` message posted by the extension -> editor form details.
// Missing / null values fall back to empty (the extension omits absent fields).
export const detailsFromLoadAgentCommandMessage = (message: any): AgentCommandEditDetails => ({
  name: message?.name ?? "",
  description: message?.description ?? "",
  prompt: message?.prompt ?? "",
  noPrompt: Boolean(message?.noPrompt),
  isScript: Boolean(message?.isScript),
  executePeriodically: Boolean(message?.executePeriodically),
  startTime: message?.startTime ?? "",
  period: message?.period !== undefined && message?.period !== null && message?.period !== "" ? String(message.period) : "",
  totalExecutionTimes: message?.totalExecutionTimes !== undefined && message?.totalExecutionTimes !== null ? String(message.totalExecutionTimes) : "",
  executedTimes: message?.executedTimes !== undefined && message?.executedTimes !== null ? String(message.executedTimes) : "0"
});

// Restores persisted webview state (vscode.getState()) into valid editor state.
export const detailsFromPersistedState = (details: any): AgentCommandEditDetails => {
  if (!details || typeof details !== "object") return { ...emptyAgentCommandEditDetails };
  return {
    name: typeof details.name === "string" ? details.name : "",
    description: typeof details.description === "string" ? details.description : "",
    prompt: typeof details.prompt === "string" ? details.prompt : "",
    noPrompt: Boolean(details.noPrompt),
    isScript: Boolean(details.isScript),
    executePeriodically: Boolean(details.executePeriodically),
    startTime: typeof details.startTime === "string" ? details.startTime : "",
    period: details.period !== undefined && details.period !== null ? String(details.period) : "",
    totalExecutionTimes: details.totalExecutionTimes !== undefined && details.totalExecutionTimes !== null ? String(details.totalExecutionTimes) : "",
    executedTimes: details.executedTimes !== undefined && details.executedTimes !== null ? String(details.executedTimes) : "0"
  };
};

export const periodPartsFromPersistedState = (parts: any): PeriodParts => {
  if (!parts || typeof parts !== "object") return { ...emptyPeriodParts };
  const part = (value: any) => (typeof value === "string" ? value : (typeof value === "number" ? String(value) : ""));
  return {
    days: part(parts.days),
    hours: part(parts.hours),
    minutes: part(parts.minutes),
    seconds: part(parts.seconds)
  };
};
