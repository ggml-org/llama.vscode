// Tools permissions modes shown in the composer footer.
//
// The extension is the source of truth (src/services/permissions-mode.ts posts
// the list with `updatePermissionsMode`), but the webview keeps its own copy so
// that:
//   - a bundle running against an older extension still shows the button,
//   - the first render (before the extension has answered) is not empty.
// Values must match the `llama-vscode.tools_permissions_mode` enum in
// package.json. An unknown value coming from the extension is ignored instead
// of rendered, so a future mode can never produce a broken menu entry.

export type PermissionsMode = 'AllowAll' | 'AutoAskIfUnsure' | 'AutoDenyIfUnsure' | 'Ask';

export interface PermissionsModeInfo {
  // Value stored in the `tools_permissions_mode` setting.
  value: PermissionsMode;
  // Compact text for the small footer button ("allow all", "auto ask", ...).
  shortLabel: string;
  // Full name of the mode, same text as `enumItemLabels` in package.json.
  label: string;
  // One-sentence explanation for the menu.
  description: string;
  // Long explanation, same text as `enumDescriptions` in package.json.
  details: string;
}

// Mode used when the setting holds something unknown: the most restrictive
// one, matching the setting default, so a corrupted value can never read as
// "run everything".
export const DEFAULT_PERMISSIONS_MODE: PermissionsMode = 'Ask';

export const DEFAULT_PERMISSIONS_MODES: PermissionsModeInfo[] = [
  {
    value: 'AllowAll',
    shortLabel: 'allow all',
    label: 'allow all commands',
    description: 'Every command runs without asking. Fast, but the AI can do anything — be careful.',
    details:
      'Allows all commands to be executed by the AI. Known also as YOLO mode. Be careful with this mode.'
  },
  {
    value: 'AutoAskIfUnsure',
    shortLabel: 'auto ask',
    label: 'auto - ask if unsure',
    description:
      'Safe commands run and dangerous ones are denied. The AI judges the rest and asks you when it is unsure.',
    details:
      'Obviously safe commands (read-only, inside the project or the auto memory folder) run without asking. Obviously dangerous ones (privilege escalation, recursive/forced deletes, credentials and profile paths, system directories, downloads piped into a shell) are denied. Only the commands in between are judged by the LLM: allow if safe, deny if not, ask the user if unsure.'
  },
  {
    value: 'AutoDenyIfUnsure',
    shortLabel: 'auto deny',
    label: 'auto - deny if unsure',
    description:
      'Safe commands run and dangerous ones are denied. The AI judges the rest and denies the command when it is unsure.',
    details:
      'Obviously safe commands (read-only, inside the project or the auto memory folder) run without asking. Obviously dangerous ones (privilege escalation, recursive/forced deletes, credentials and profile paths, system directories, downloads piped into a shell) are denied. Only the commands in between are judged by the LLM; if it is unsure or cannot answer, the command is denied.'
  },
  {
    value: 'Ask',
    shortLabel: 'ask',
    label: 'ask for permission',
    description: 'Asks you for permission before a command is executed.',
    details: 'Asks you for permission before a tool command is executed.'
  }
];

export const isPermissionsMode = (value: unknown): value is PermissionsMode =>
  typeof value === 'string' && DEFAULT_PERMISSIONS_MODES.some(mode => mode.value === value);

/**
 * Validates the list posted by the extension. Anything unexpected (old
 * extension, truncated payload, a mode the bundle does not know) is dropped; an
 * empty result means "use the built-in list".
 */
export const parsePermissionsModes = (raw: unknown): PermissionsModeInfo[] => {
  if (!Array.isArray(raw)) return [];
  const parsed: PermissionsModeInfo[] = [];
  raw.forEach(entry => {
    const value = (entry as Partial<PermissionsModeInfo> | null)?.value;
    if (!isPermissionsMode(value)) return;
    if (parsed.some(mode => mode.value === value)) return;
    const fallback = DEFAULT_PERMISSIONS_MODES.find(mode => mode.value === value) as PermissionsModeInfo;
    const label = typeof (entry as PermissionsModeInfo).label === 'string' && (entry as PermissionsModeInfo).label
      ? (entry as PermissionsModeInfo).label
      : fallback.label;
    const shortLabel = typeof (entry as PermissionsModeInfo).shortLabel === 'string' && (entry as PermissionsModeInfo).shortLabel
      ? (entry as PermissionsModeInfo).shortLabel
      : fallback.shortLabel;
    const description = typeof (entry as PermissionsModeInfo).description === 'string' && (entry as PermissionsModeInfo).description
      ? (entry as PermissionsModeInfo).description
      : fallback.description;
    const details = typeof (entry as PermissionsModeInfo).details === 'string' && (entry as PermissionsModeInfo).details
      ? (entry as PermissionsModeInfo).details
      : fallback.details;
    parsed.push({ value, shortLabel, label, description, details });
  });
  return parsed;
};

/** The info of the current mode, falling back to "ask" for unknown values. */
export const getPermissionsModeInfo = (
  mode: string,
  modes: PermissionsModeInfo[] = DEFAULT_PERMISSIONS_MODES
): PermissionsModeInfo => {
  const found = modes.find(candidate => candidate.value === mode);
  if (found) return found;
  const ask = DEFAULT_PERMISSIONS_MODES.find(candidate => candidate.value === DEFAULT_PERMISSIONS_MODE);
  return ask as PermissionsModeInfo;
};

/** Text of the footer button: compact, so three items fit in a narrow panel. */
export const permissionsModeButtonLabel = (info: PermissionsModeInfo): string => info.shortLabel;

/** Tooltip of the footer button: the full value plus what it means. */
export const permissionsModeButtonTitle = (info: PermissionsModeInfo): string =>
  `Permissions mode: ${info.value} (${info.label})\n${info.description}\nClick to select another permissions mode`;

/** Accessible name of the footer button. */
export const permissionsModeButtonAriaLabel = (info: PermissionsModeInfo): string =>
  `Tools permissions mode: ${info.label} (${info.value}). Click to select another permissions mode.`;

// Minimum distance kept between the open menu and the panel edge.
export const PERMISSIONS_MODE_MENU_MARGIN_PX = 8;
// Preferred menu width: the explanations are a reading surface and need room.
export const PERMISSIONS_MODE_MENU_WIDTH_PX = 320;

/**
 * Horizontal shift, in pixels, to apply to the menu - which is otherwise
 * anchored to the right edge of the button - so that it stays inside the panel.
 *
 * The button is the FIRST item of a right-aligned group, so a long agent or
 * model name next to it pushes the button away from the panel edge and a plain
 * `right: 0` menu would render off-screen to the left in a narrow sidebar
 * (verified in a real browser: the menu landed at x = -207 with a 380px panel).
 * Returns 0 when the preferred placement already fits, a positive value to move
 * the menu right, a negative one to move it left.
 */
export const permissionsModeMenuOffset = ({
  buttonRight,
  viewportWidth,
  menuWidth = PERMISSIONS_MODE_MENU_WIDTH_PX,
  margin = PERMISSIONS_MODE_MENU_MARGIN_PX
}: {
  buttonRight: number;
  viewportWidth: number;
  menuWidth?: number;
  margin?: number;
}): number => {
  // The menu is never wider than the panel minus both margins.
  const width = Math.min(menuWidth, Math.max(0, viewportWidth - 2 * margin));
  const minLeft = margin;
  const maxRight = viewportWidth - margin;
  if (maxRight - minLeft <= 0 || width <= 0) return 0; // Degenerate viewport.
  // Anchored to the button's right edge, so it initially spans [left, right].
  const left = buttonRight - width;
  const right = buttonRight;
  // Shift right to clear the left margin (the common case: the button is the
  // first item of a right-aligned group and long names push it left), and left
  // to clear the right margin (a button very close to the panel edge).
  let offset = 0;
  if (left < minLeft) offset = Math.min(minLeft - left, Math.max(0, maxRight - right));
  else if (right > maxRight) offset = -Math.min(right - maxRight, Math.max(0, left - minLeft));
  return Math.round(offset);
};
