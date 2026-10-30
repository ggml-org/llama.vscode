import * as path from 'path';

// Terminal command helpers for the agent tool `run_terminal_command`.
//
// Why it exists: the tool used to decide "is this command safe?" with a single
// regex applied to the FIRST token of the whole command, and the read-only list
// short-circuited to "safe". With `tool_permit_some_terminal_commands = true`
// that let `ls; rm -rf .`, `echo x > src/main.ts`, `find . -delete` and any
// multi-line script run with no confirmation at all. It then ran the command
// through `child_process.exec` with no timeout, no abort signal, the default
// 1 MiB `maxBuffer` and no exit code, and echoed the raw command into a visible
// terminal with `echo "…"` (which still expands `$(…)`).
//
// Kept free of the `vscode` module (only `path`) so it is unit-testable with
// plain mocha, like services/workspace-text-search.ts. The rule of thumb for
// the analyzer: a false "modifying" only costs one dialog, a false "safe" can
// delete the workspace.

// ---- limits -------------------------------------------------------------

// A command that waits for input (no TTY, no stdin) would otherwise block the
// agent loop forever.
export const DEFAULT_TIMEOUT_MS = 300_000;        // 5 min; overridable per call
export const MIN_TIMEOUT_MS = 5_000;
export const MAX_TIMEOUT_MS = 3_600_000;
// 1 MiB (the exec default) kills verbose builds although only a few thousand
// chars are returned to the model.
export const DEFAULT_MAX_BUFFER_BYTES = 4 * 1024 * 1024;
// Twice the buffered limit: both streams are captured together, head AND tail.
export const MAX_CAPTURED_OUTPUT_BYTES = 2 * DEFAULT_MAX_BUFFER_BYTES;
export const CAPTURE_HEAD_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MAX_OUTPUT_CHARS = 5_000;    // mirrors Configuration.MAX_CHARS_TOOL_RETURN
export const MAX_COMMAND_CHARS = 10_000;          // a runaway heredoc must not be accepted
// The marker inserted when the output is cut in the middle.
const TRUNCATION_RESERVE = 120;
// Below this the labelled output would be nothing but labels.
export const MIN_OUTPUT_CHARS = 500;

// ---- streaming capture --------------------------------------------------

/**
 * Keeps the FIRST CAPTURE_HEAD_BYTES and the LAST
 * (MAX_CAPTURED_OUTPUT_BYTES - CAPTURE_HEAD_BYTES) of a stream, so a 100 MiB
 * build log neither exhausts memory nor loses its final lines: the head/tail
 * split of formatCommandOutput must find both ends still there. Appending
 * everything and slicing later (the naive version) kept the head and silently
 * threw the tail away.
 */
export interface StreamCapture { head: string; tail: string; overflowed: boolean }

export const createStreamCapture = (): StreamCapture => ({ head: '', tail: '', overflowed: false });

export const addToStreamCapture = (capture: StreamCapture, text: string): void => {
    if (text === '') return;
    if (!capture.overflowed && capture.head.length + text.length <= CAPTURE_HEAD_BYTES) {
        capture.head += text;
        return;
    }
    capture.overflowed = true;
    capture.tail = (capture.tail + text).slice(-(MAX_CAPTURED_OUTPUT_BYTES - CAPTURE_HEAD_BYTES));
};

export const capturedText = (capture: StreamCapture): string => capture.head + capture.tail;

// ---- types --------------------------------------------------------------

export interface CommandExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;      // numeric exit status, -1 when the process was killed or never ran
    timedOut: boolean;
    cancelled: boolean;
}

export interface CommandAnalysis {
    modifying: boolean;
    reason: string;        // short, human readable; used in the dialog, the log and the tests
}

export interface ShellInvocation { file: string; args: string[] }

// ---- classifier ---------------------------------------------------------

const READ_ONLY_TOKENS = new Set<string>([
    'ls','cat','head','tail','wc','pwd','echo','printf','file','stat','du','df','tree','diff','cmp',
    'uniq','cut','tr','basename','dirname','realpath','jq','whoami','hostname','uname','date','which',
    'whereis','type','man','help','grep','egrep','fgrep','rg','find','sort','git','node','npm','npx',
    'python','python3','pip','cargo','go','dotnet','java','tsc','eslint','jest','pytest'
]);

// Read-only aliases of PowerShell/cmd. `dir`, `type` and `tree` also exist on
// POSIX, so the set stays behind the `win32` platform check.
const WIN_ONLY_TOKENS = new Set<string>([
    'dir','type','get-content','get-childitem','select-string','where','cls','tree','measure-object','test-path'
]);

// Commands that can always change files or the environment, either directly
// (`rm`, `tee`, `cp`) or by running something else (`bash`, `env`, `xargs`,
// `powershell`). Listed explicitly so the reason names the offending token.
const NEVER_ALLOWED = new Set<string>([
    'env','nohup','eval','exec','xargs','sudo','su','doas','chmod','chown','kill','pkill','killall',
    'tee','dd','cp','mv','rm','rmdir','mkdir','touch','truncate','ln','install','curl','wget','ssh',
    'scp','rsync','docker','kubectl','systemctl','service','apt','apt-get','yum','dnf','pacman','brew',
    'msiexec','reg','netsh','diskpart','format','attrib','icacls','start','open','osascript',
    'powershell','pwsh','cmd','bash','sh','zsh','fish'
]);

const GIT_READ_ONLY = new Set<string>([
    'status','log','diff','show','branch','remote','rev-parse','ls-files','blame','shortlog','describe','stash','tag','config'
]);

const VERSION_ONLY = /^(?:-v|-V|--version|version|-version)$/;

const INTERPRETERS = new Set<string>([
    'node','npm','npx','python','python3','pip','cargo','go','dotnet','java','tsc','eslint','jest','pytest'
]);

/**
 * Splits a command line on newlines and on the shell chain operators that are
 * outside quotes. An unterminated quote yields the rest of the input as one
 * segment, so a heredoc body can never turn into a "safe" standalone command.
 * A single `&` separates too: `ls & rm -rf .` runs rm.
 */
export const splitSegments = (command: string): string[] => {
    const segments: string[] = [];
    let current = '';
    let quote: string | null = null;
    for (let i = 0; i < command.length; i++) {
        const ch = command[i];
        if (ch === '\\' && quote !== "'" && i + 1 < command.length) {
            current += ch + command[i + 1];
            i++;
            continue;
        }
        if (quote !== null) {
            current += ch;
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
        if (ch === '\n' || ch === '\r' || ch === ';') { segments.push(current); current = ''; continue; }
        if ((ch === '&' || ch === '|') && command[i + 1] === ch) { segments.push(current); current = ''; i++; continue; }
        if (ch === '|' || ch === '&') { segments.push(current); current = ''; continue; }
        current += ch;
    }
    segments.push(current);
    return segments.map(s => s.trim()).filter(s => s.length > 0);
};

const firstToken = (segment: string): string => {
    const m = segment.match(/^\s*([^\s]+)/);
    return m ? m[1].toLowerCase() : '';
};

/** Per-command argument rules. Returns '' when the segment is read-only. */
const checkArguments = (token: string, segment: string): string => {
    const lower = segment.toLowerCase();
    if (token === 'find') {
        // -fprintf/-fls write files just as much as -delete removes them.
        if (/(?:^|\s)-(?:delete|exec|execdir|ok|okdir|fprint|fprintf|fls)\b/.test(lower)) return 'destructive find predicate';
    }
    if (token === 'sort') {
        if (/(?:^|\s)(?:-o|--output)\b/.test(lower)) return 'sort writes a file';
    }
    if (token === 'git') {
        const parts = lower.split(/\s+/).filter(p => p !== '');
        const sub = parts[1] ?? '';
        if (!GIT_READ_ONLY.has(sub)) return 'git subcommand is not read-only: ' + sub;
        if (sub === 'branch' || sub === 'tag') {
            if (/(?:^|\s)-(?:d|D|m|M|f|delete|force)\b/.test(lower)) return 'git ' + sub + ' modifies refs';
        }
        if (sub === 'stash' && !/^git\s+stash\s+list\b/.test(lower)) return 'only git stash list is read-only';
        if (sub === 'config' && !/(?:^|\s)(?:--get|--get-all|--list|-l)\b/.test(lower)) return 'only git config --get/--list is read-only';
    }
    if (INTERPRETERS.has(token)) {
        // `node --version` is a read-only query, `node app.js` runs arbitrary code.
        const rest = segment.split(/\s+/).slice(1).filter(p => p !== '');
        if (rest.length === 0 || !rest.every(p => VERSION_ONLY.test(p))) return token + ' runs a program, not a version query';
    }
    return '';
};

/**
 * Decides whether a command may run without the confirmation dialog.
 * Deny by default: every chained segment must be allowlisted, and any
 * redirection, command substitution or environment assignment makes the whole
 * command modifying.
 */
export const analyzeCommand = (command: string, platform: NodeJS.Platform = process.platform): CommandAnalysis => {
    const modifying = (reason: string): CommandAnalysis => ({ modifying: true, reason });
    if (typeof command !== 'string' || command.trim() === '') return modifying('empty command');

    // A redirection or a command substitution makes a read-only verdict
    // impossible: `echo x > src/main.ts` and `ls $(rm -rf .)` both look harmless.
    if (/[<>]/.test(command)) return modifying('output redirection');
    if (/\$\(|`/.test(command)) return modifying('command substitution');
    if (command.length > MAX_COMMAND_CHARS) return modifying('command too long');

    // Every segment of a chain decides on its own: `ls; rm -rf .` is an rm.
    const segments = splitSegments(command);
    if (segments.length === 0) return modifying('empty command');

    for (const segment of segments) {
        if (/^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(segment)) return modifying('environment assignment');
        const token = firstToken(segment);
        if (token === '') return modifying('empty segment');
        if (NEVER_ALLOWED.has(token)) return modifying('not in the read-only allowlist: ' + token);
        if (!READ_ONLY_TOKENS.has(token) && !(platform === 'win32' && WIN_ONLY_TOKENS.has(token))) {
            return modifying('not in the read-only allowlist: ' + token);
        }
        const argRule = checkArguments(token, segment);
        if (argRule !== '') return modifying(argRule);
    }
    return { modifying: false, reason: 'all segments are read-only' };
};

export const isModifyingCommand = (command: string, platform: NodeJS.Platform = process.platform): boolean =>
    analyzeCommand(command, platform).modifying;

// ---- shell invocation ---------------------------------------------------

/**
 * Builds the (file, args) pair for `child_process.execFile`. Passing the whole
 * command as ONE argv element removes the old `replace(/'/g, "'\\''")` quoting
 * hack: nothing is interpolated into a shell string any more, while the shell
 * still parses the command exactly as before via `-c`.
 */
export const buildShellInvocation = (
    command: string,
    platform: NodeJS.Platform = process.platform,
    shellPath: string = process.env.SHELL ?? ''
): ShellInvocation => {
    if (platform === 'win32') {
        // The tool description promises PowerShell; cmd.exe silently rejects
        // Select-String/Out-File and makes the classifier's verdicts meaningless.
        return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', command] };
    }
    const shell = shellPath.trim() !== '' ? shellPath : '/bin/bash';
    const name = path.basename(shell);
    // -i keeps the rc files sourced (that is where many users put PATH); the TTY
    // warnings it produces without a TTY stay filtered in the executor.
    if (name === 'fish') return { file: shell, args: ['-l', '-c', command] };
    if (name === 'bash' || name === 'zsh' || name === 'ksh' || name === 'sh') {
        return { file: shell, args: ['-ilc', command] };
    }
    return { file: shell, args: ['-c', command] };
};

// ---- formatting ---------------------------------------------------------

/** Drops ANSI escapes, collapses `\r` progress bars and trims blank lines. */
const sanitize = (text: string): string => String(text ?? '')
    .replace(/\u001b\][^\u0007]*\u0007/g, '')
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    .split(/\r?\n/)
    .map(line => { const i = line.lastIndexOf('\r'); return i >= 0 ? line.slice(i + 1) : line; })
    .map(line => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');

/**
 * Formats the result for the model: labelled streams, the exit code (so
 * "failed with no output" is distinguishable from "succeeded with no output")
 * and a truncation that keeps both ends. The TAIL is preserved on purpose:
 * compiler errors and failing test summaries live at the end of the output.
 */
export const formatCommandOutput = (
    result: CommandExecutionResult,
    options?: { maxChars?: number; note?: string }
): string => {
    const maxChars = Math.max(MIN_OUTPUT_CHARS, options?.maxChars ?? DEFAULT_MAX_OUTPUT_CHARS);
    const out = sanitize(result.stdout);
    const err = sanitize(result.stderr);
    const lines: string[] = [];
    if (options?.note) lines.push(options.note);
    lines.push('exit code: ' + result.exitCode);
    lines.push('stdout:');
    lines.push(out.length > 0 ? out : '(no output)');
    lines.push('stderr:');
    lines.push(err.length > 0 ? err : '(no output)');
    let text = lines.join('\n');

    if (text.length > maxChars) {
        // The marker is reserved up front so the result fits the limit. The
        // split is on UTF-16 code units, so a surrogate pair can be cut in
        // half; that is a cosmetic risk inside a truncated log.
        const budget = maxChars - TRUNCATION_RESERVE;
        const head = Math.max(0, Math.floor(budget * 0.4));
        const tail = Math.max(0, budget - head);
        const omitted = text.length - head - tail;
        text = text.slice(0, head) + '\n[… output truncated: ' + omitted + ' chars omitted …]\n' +
               text.slice(text.length - tail);
    }
    return text;
};

// ---- result summary for the user ---------------------------------------
//
// executeCommandWithTerminalFeedback awaits the command but only writes the
// output tail to the output channel, so a user who installs llama.cpp from the
// menu saw the "Command Terminal" flash and nothing else - no success and no
// failure. The summary below is the missing "did it work?" answer.
//
// Winget reports failures as an HRESULT in the exit code. Windows hands that
// back as a SIGNED int32, so 0x8A150061 ("a version of the package is already
// installed" - the most common, harmless outcome of a re-install) arrives as
// -1978335135. Both spellings are normalized, otherwise every upgrade attempt
// on an up-to-date machine looked like a failed install.

export interface CommandResultSummary {
    succeeded: boolean;
    /** One-line headline, short enough for showInformationMessage/showErrorMessage. */
    message: string;
    /** Multi-line detail (command, exit code, meaning, output tail) for a dialog or the log. */
    details: string;
}

interface KnownExitCode { meaning: string; harmless: boolean }

const KNOWN_EXIT_CODES: Record<number, KnownExitCode> = {
    0x8a150061: { meaning: 'a version of the package is already installed', harmless: true },
    0x8a15002b: { meaning: 'no applicable update was found (already up to date)', harmless: true },
    0x8a150010: { meaning: 'none of the package installers is applicable for this machine', harmless: false },
    0x8a150011: { meaning: 'the downloaded installer did not match the expected hash', harmless: false },
    0x8a150014: { meaning: 'no package matching the criteria was found', harmless: false },
    0x8a150019: { meaning: 'the command requires administrator privileges', harmless: false },
    0x8a15001c: { meaning: 'the Microsoft Store app is blocked by policy', harmless: false },
    0x8a15003a: { meaning: 'the operation is blocked by group policy', harmless: false },
    0x8a15005f: { meaning: 'an install location must be provided', harmless: false },
};

/** Converts a signed 32-bit exit code back to the unsigned value Windows reported. */
export const unsignedExitCode = (exitCode: number): number =>
    exitCode < 0 ? exitCode + 0x1_0000_0000 : exitCode;

/** `0x8A150061` for an HRESULT-looking code, '' otherwise (0 and small values stay plain). */
export const formatExitCodeHex = (exitCode: number): string => {
    if (exitCode === 0) return '';
    const value = unsignedExitCode(exitCode);
    return value >= 0x8000_0000 ? '0x' + value.toString(16).toUpperCase() : '';
};

/** Last `maxChars` chars of a stream, cut at a newline so no partial line is shown. */
const outputTail = (text: string, maxChars: number): string => {
    const clean = sanitize(text);
    if (clean === '') return '';
    if (clean.length <= maxChars) return clean;
    const cut = clean.slice(-maxChars);
    const newline = cut.indexOf('\n');
    return newline >= 0 ? cut.slice(newline + 1) : cut;
};

/**
 * Turns a finished command into what the user needs to know: did it work, and
 * if not, why (with the meaning of the exit code when it is a known one) plus
 * the tail of the output, which is where installers put the actual error.
 */
export const summarizeCommandResult = (
    command: string,
    result: CommandExecutionResult,
    options?: { maxOutputChars?: number }
): CommandResultSummary => {
    const maxOutputChars = Math.max(MIN_OUTPUT_CHARS, options?.maxOutputChars ?? 2_000);
    const known = KNOWN_EXIT_CODES[unsignedExitCode(result.exitCode)];
    const succeeded = !result.timedOut && !result.cancelled &&
        (result.exitCode === 0 || (known !== undefined && known.harmless));

    const hex = formatExitCodeHex(result.exitCode);
    const exitText = 'exit code ' + result.exitCode + (hex ? ' (' + hex + ')' : '') +
        (known ? ' - ' + known.meaning : '');

    let message: string;
    if (result.cancelled) {
        message = 'The command was cancelled.';
    } else if (result.timedOut) {
        message = 'The command timed out.';
    } else if (succeeded && result.exitCode !== 0) {
        message = 'Nothing to do: ' + known!.meaning + '.';
    } else if (succeeded) {
        message = 'The command completed successfully.';
    } else {
        message = 'The command failed (' + exitText + ').';
    }

    const err = outputTail(result.stderr, maxOutputChars);
    const out = outputTail(result.stdout, maxOutputChars);
    const details = [
        'command: ' + command,
        'result: ' + message,
        'exit code: ' + result.exitCode + (hex ? ' (' + hex + ')' : '') + (known ? '\nmeaning: ' + known.meaning : ''),
        'stderr:\n' + (err !== '' ? err : '(no output)'),
        'stdout:\n' + (out !== '' ? out : '(no output)'),
    ].join('\n\n');

    return { succeeded, message, details };
};
