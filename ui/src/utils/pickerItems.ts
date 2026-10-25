// Parsing of the payloads posted by the extension for the @ / pickers.
//
// File list   (chat-context.getProjectFiles / llama-webview-provider.getFileList)
//             "<file name> | <absolute path>"
// Command list (agent-command-service.getAgentCommandsList)
//             "⏰ [p]name | description"   -> scheduled prompt command
//             "[s]name | description"      -> immediate script command
//             "[s]script.sh"               -> script from the scripts folder
//
// The raw strings are what the extension expects back in
// `addContextProjectFile` / `sendAgentCommand`, so the raw value is kept in
// `raw` and the parsed fields are only used for display.

export type PickerMode = 'files' | 'commands';

export interface PickerItem {
  raw: string;
  // Primary label: file name or command name
  name: string;
  // Secondary, dimmed line: path tail or description
  detail: string;
  // Full text for the title attribute
  fullText: string;
  kind: 'file' | 'prompt' | 'script';
  scheduled: boolean;
}

const shortenPath = (absolutePath: string): string => {
  const parts = absolutePath.split(/[\\/]/).filter(part => part.length > 0);
  if (parts.length <= 2) return absolutePath;
  return '…/' + parts.slice(-2).join('/');
};

export const parsePickerItem = (raw: string, mode: PickerMode): PickerItem => {
  if (mode === 'files') {
    const separatorIndex = raw.indexOf('|');
    const name = (separatorIndex >= 0 ? raw.slice(0, separatorIndex) : raw).trim();
    const path = separatorIndex >= 0 ? raw.slice(separatorIndex + 1).trim() : '';
    return {
      raw,
      name: name || raw,
      detail: path ? shortenPath(path) : '',
      fullText: path || raw,
      kind: 'file',
      scheduled: false
    };
  }

  let working = raw.trim();
  let scheduled = false;
  if (working.startsWith('⏰')) {
    scheduled = true;
    working = working.slice(1).trim();
  }

  let kind: 'prompt' | 'script' = 'prompt';
  if (working.startsWith('[s]')) {
    kind = 'script';
    working = working.slice(3).trim();
  } else if (working.startsWith('[p]')) {
    kind = 'prompt';
    working = working.slice(3).trim();
  }

  const separatorIndex = working.indexOf('|');
  const name = (separatorIndex >= 0 ? working.slice(0, separatorIndex) : working).trim();
  const description = separatorIndex >= 0 ? working.slice(separatorIndex + 1).trim() : '';

  return {
    raw,
    name: name || raw,
    detail: description,
    fullText: raw,
    kind,
    scheduled
  };
};

// Strips the display markers ("⏰", "[p]", "[s]") from a command payload.
export const getCommandName = (raw: string): string => {
  let working = raw.trim();
  if (working.startsWith('⏰')) working = working.slice(1).trim();
  if (working.startsWith('[s]') || working.startsWith('[p]')) working = working.slice(3).trim();
  const separatorIndex = working.indexOf('|');
  return (separatorIndex >= 0 ? working.slice(0, separatorIndex) : working).trim();
};

// Where the character that opened the picker sits in the composer text. The
// character stays in the text while the picker is open, so it can be replaced
// by the picked item (or dropped when the picker is cancelled).
export interface PickerTrigger {
  char: '@' | '/';
  // Index of the trigger character; it occupies [index, index + 1).
  index: number;
}

// Result of an edit in the composer text: the new value plus the caret that has
// to follow the edited region.
export interface ComposerEdit {
  text: string;
  caret: number;
}

// Replaces [start, end) with `insert`. The indices are clamped, so a stale
// selection (e.g. read before a re-render) can never drop text.
export const replaceRange = (text: string, start: number, end: number, insert: string): ComposerEdit => {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  return {
    text: text.slice(0, from) + insert + text.slice(to),
    caret: from + insert.length
  };
};

// Replaces the trigger character that opened the picker with `insert`. If the
// text changed while the picker was open and the character is gone, the insert
// is appended at the end so a selection is never silently dropped.
export const replaceTrigger = (text: string, trigger: PickerTrigger | null, insert: string): ComposerEdit => {
  const end = trigger ? trigger.index + trigger.char.length : -1;
  if (trigger && trigger.index >= 0 && end <= text.length && text.slice(trigger.index, end) === trigger.char) {
    return replaceRange(text, trigger.index, end, insert);
  }
  return replaceRange(text, text.length, text.length, insert);
};

// Triggers do not open a picker in the middle of a word, so paths
// ("ui/src/app.ts") and e-mail addresses ("me@example.com") can be typed
// without a dropdown popping up. After whitespace or punctuation they do.
const WORD_CHAR_BEFORE_TRIGGER = /[A-Za-z0-9_.\-/\\:@]$/;

export const isTriggerPosition = (textBeforeCaret: string): boolean => {
  return !WORD_CHAR_BEFORE_TRIGGER.test(textBeforeCaret);
};
