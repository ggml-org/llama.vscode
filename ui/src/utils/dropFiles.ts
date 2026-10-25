// Drag & drop parsing for the agent composer.
//
// This started as a move of the logic that used to live in AgentView.tsx, so
// the overall extraction order is verified working. Two things had to be fixed
// after the webview refactor:
//  1. In a webview the drag payload crosses a document boundary, so the
//     application types (CodeFiles, ResourceURLs, application/vnd.code.tree.*)
//     return '' from getData() and are only reachable via item.getAsString().
//  2. Those payloads are JSON, so the values are quoted
//     ('["/abs/app.ts"]'). Unwrapping is mandatory - see parsePayloadValues.
// Re-test a real Explorer drop before changing the extraction order again.

export interface DroppedFile {
  filePath: string;
  fileName: string;
}

// File extensions accepted from a drag & drop. Everything here can be opened by
// vscode.workspace.openTextDocument on the extension side.
export const ALLOWED_DROP_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
  '.rs', '.go', '.rb', '.css', '.scss', '.less', '.html', '.json', '.jsonc', '.xml',
  '.md', '.mdx', '.txt', '.rst', '.sh', '.bat', '.ps1', '.yaml', '.yml', '.toml', '.ini',
  '.cfg', '.conf', '.env', '.sql', '.graphql', '.vue', '.svelte', '.astro', '.php', '.swift',
  '.kt', '.scala', '.dart', '.lua', '.r', '.m', '.mm', '.zig', '.nim', '.v', '.cs',
  '.dockerfile', '.gitignore', '.editorconfig'
];

export const isDropExtensionAllowed = (fileName: string): boolean => {
  const lower = fileName.toLowerCase();
  // Extensionless files such as "Dockerfile", "Makefile" or ".env" are text too.
  if (!lower.includes('.')) return true;
  const ext = '.' + lower.split('.').pop();
  return ALLOWED_DROP_EXTENSIONS.includes(ext);
};

// Values that are not paths at all but placeholders a browser puts into a
// DataTransfer when it refuses to expose the real payload.
const BLOCKED_PLACEHOLDER = /^about:blank(#blocked)?$/i;

/**
 * Best-effort file name of whatever is being dragged.
 *
 * VS Code strips the payload of drags that start inside the workbench, but the
 * *types* of the drag are still visible during `dragover`/`drop`, and some of
 * them embed the resource label. When anything usable leaks through it is used
 * only as a hint for the fallback file dialog (filter + title), never trusted as
 * a path.
 */
export const bestEffortDroppedFileName = (dataTransfer: DataTransfer | null): string => {
  if (!dataTransfer) return '';
  const candidates: string[] = [];
  for (const type of Array.from(dataTransfer.types || [])) {
    if (!/uri|text|code|tree|file/i.test(type)) continue;
    try {
      const data = dataTransfer.getData(type);
      if (data && !BLOCKED_PLACEHOLDER.test(data.trim())) candidates.push(data);
    } catch {
      // getData can throw for protected types
    }
  }
  for (const raw of candidates) {
    for (const value of parsePayloadValues(raw)) {
      const info = extractFileInfo(value);
      if (info) return info.fileName;
      // Fall back to the last path-like segment: a bare "app.ts" label is enough
      // to pick the dialog filter.
      const segment = value.split(/[\\/]/).pop();
      if (segment && /\.[A-Za-z0-9]{1,12}$/.test(segment)) return segment;
    }
  }
  return '';
};

// A path the extension can open. `llama-agent.ts` does
// `vscode.workspace.openTextDocument(vscode.Uri.file(path))`, and `Uri.file`
// resolves a relative path against the extension host CWD, so a bare
// "src/app.ts" would silently fail - only absolute paths are usable.
export const isAbsolutePath = (filePath: string): boolean =>
  filePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\');

/**
 * Splits a drag payload into the individual path values it carries.
 *
 * VS Code wraps most payloads in JSON, and in a webview those payloads are only
 * reachable through `item.getAsString()`:
 * - `CodeFiles` -> '["/abs/a.ts","/abs/b.py"]' (array of plain paths)
 * - `ResourceURLs` -> '["file:///abs/a.ts"]' (array of URIs)
 * - `application/vnd.code.tree.*` -> '[{"id":"file:///abs/a.ts"}]'
 * Quoting must be unwrapped here, otherwise '"..."' leaks into the path.
 */
export const parsePayloadValues = (rawValue: string): string[] => {
  const trimmed = rawValue.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('"') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      const values: string[] = [];
      for (const entry of entries) {
        if (typeof entry === 'string') {
          values.push(entry);
          continue;
        }
        // VS Code tree items: {"id":"file:///a/b.ts","type":"file"}
        const candidate = entry?.id ?? entry?.uri ?? entry?.fsPath ?? entry?.path;
        if (typeof candidate === 'string') values.push(candidate);
      }
      if (values.length > 0) {
        return values.map(value => value.trim()).filter(Boolean);
      }
      // Valid JSON but nothing usable - fall through to line splitting
    } catch {
      // Not JSON - fall through to line splitting
    }
  }

  // A single payload may carry several values separated by newlines
  // (text/uri-list, multi-selection dropped from a file manager).
  return trimmed
    .split(/\r?\n/)
    .map(part => part.trim())
    .filter(part => part.length > 0 && !part.startsWith('#')); // skip comments / blanks
};

// Extract a clean file system path + name from a URI string or plain path.
// Returns null when the value cannot be turned into a usable file path.
export const extractFileInfo = (rawValue: string): DroppedFile | null => {
  const [value] = parsePayloadValues(rawValue);
  if (!value) return null;
  if (BLOCKED_PLACEHOLDER.test(value)) return null;

  let filePath = '';

  if (value.startsWith('file://')) {
    try {
      const url = new URL(value);
      filePath = decodeURIComponent(url.pathname);
      // On Windows a file URI looks like file:///C:/path -> /C:/path, strip the leading slash
      if (/^\/[a-zA-Z]:\//.test(filePath)) {
        filePath = filePath.substring(1);
      }
    } catch {
      return null;
    }
  } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
    // Some other scheme (vscode-remote://, untitled:, etc.) - not a local file we can open.
    return null;
  } else {
    // Assume it is already a plain file system path
    filePath = value;
  }

  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
  if (!fileName) return null;

  return { filePath, fileName };
};

// Files opened in the VS Code editor are marked with a custom type; the same
// payload also carries `ResourceURLs`. The marker is used to tell a webview
// internal drag apart from an OS file drop (only the OS drop has `files`).
export const EDITORS_MIME = 'CodeEditors';

export interface DroppedFileContent {
  fileName: string;
  text: string;
}

// Files larger than this are refused: the whole content travels through
// postMessage into the extension host, so a binary is dropped rather than
// silently pasted into the prompt as megabytes of garbage.
const MAX_DROPPED_FILE_BYTES = 512 * 1024;

// VS Code (Electron) used to expose the real path on the dropped File object as
// `path`/`fullPath`. Recent Electron removes it and tells extensions to use
// `webUtils.getPathForFile`, which is not available inside a webview - so a drop
// from the OS now carries a File with a name and content but no usable path.
export const readableDroppedFileCount = (dataTransfer: DataTransfer): number => {
  if (!dataTransfer.files) return 0;
  let count = 0;
  for (let i = 0; i < dataTransfer.files.length; i++) count++;
  return count;
};

/**
 * Reads the content of dropped OS files. This is the fallback that makes a drop
 * from outside VS Code work: without a path the extension cannot open the
 * document, but it can register the text the webview read here.
 *
 * Must be called synchronously from the drop handler (the DataTransfer is
 * invalidated when it returns); the returned promise resolves with the files
 * whose content could be read as UTF-8 text.
 */
export const readDroppedFileContents = (dataTransfer: DataTransfer): Promise<DroppedFileContent[]> => {
  const files: File[] = [];
  if (dataTransfer.files) {
    for (let i = 0; i < dataTransfer.files.length; i++) files.push(dataTransfer.files[i]);
  }
  if (files.length === 0) return Promise.resolve([]);

  const readOne = (file: File): Promise<DroppedFileContent | null> =>
    new Promise(resolve => {
      if (!isDropExtensionAllowed(file.name)) return resolve(null);
      if (file.size > MAX_DROPPED_FILE_BYTES) return resolve(null);
      // `file.text()` is a no-op for binaries and returns mojibake, so a NUL
      // byte in the first KB (a cheap binary check) also rejects the file.
      file
        .slice(0, 1024)
        .arrayBuffer()
        .then(head => {
          const bytes = new Uint8Array(head);
          if (bytes.includes(0)) return resolve(null);
          file
            .text()
            .then(text => resolve({ fileName: file.name, text }))
            .catch(() => resolve(null));
        })
        .catch(() => resolve(null));
    });

  return Promise.all(files.map(readOne)).then(results =>
    results.filter((entry): entry is DroppedFileContent => entry !== null)
  );
};

/**
 * Collects the dropped files from a DataTransfer into `droppedFiles`.
 * `onCollected` is called once every payload has been read (string items are
 * read asynchronously via getAsString).
 */
export const collectDroppedFiles = (
  dataTransfer: DataTransfer,
  droppedFiles: Map<string, string>,
  onCollected: () => void
) => {
  // `text/plain` holds the human-readable label from the Explorer, which is a
  // workspace-relative path ("src/app.ts") for VS Code and a plain path
  // elsewhere. It is collected separately so a definitive payload that also
  // arrived with the same drag (`CodeFiles`, `ResourceURLs`, tree JSON - all
  // absolute) can take precedence instead of attaching an unopenable path.
  const labelFiles = new Map<string, string>();

  const addFromString = (raw: string, type?: string) => {
    if (!raw) return;
    const target = !type || type === 'text/plain' ? labelFiles : droppedFiles;
    for (const value of parsePayloadValues(raw)) {
      const info = extractFileInfo(value);
      if (info) target.set(info.filePath, info.fileName);
    }
  };

  // Only the drop handler can read `files`/`getData`/`getAsString`; the
  // DataTransfer is invalidated as soon as it returns. All reads below are
  // therefore either synchronous or started before the first await.
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      const filePath = (file as any).fullPath || (file as any).path || '';
      if (filePath) droppedFiles.set(filePath, file.name);
    }
  }

  // Synchronous getData fallbacks. In a webview (cross-document drag) most of
  // these return '' for application-defined types and only `getAsString()`
  // yields the payload - which is why both paths are attempted.
  const collectViaGetData = () => {
    const candidateTypes = new Set<string>(['text/uri-list', 'text/plain']);
    // CodeFiles / ResourceURLs carry the absolute paths VS Code attaches itself
    // (`fillEditorsDragData`), so they must not be missed.
    candidateTypes.add('CodeFiles');
    candidateTypes.add('ResourceURLs');
    // VS Code tree views expose data under a dynamic
    // application/vnd.code.tree.<viewId> MIME type - include all present.
    for (const type of Array.from(dataTransfer.types)) {
      if (type.startsWith('application/vnd.code.tree.')) {
        candidateTypes.add(type);
      }
    }
    for (const type of candidateTypes) {
      try {
        const data = dataTransfer.getData(type);
        if (data) addFromString(data, type);
      } catch {
        // ignore - the item path below may still succeed
      }
    }
  };

  // Finish: the absolute paths from CodeFiles / ResourceURLs / tree JSON win.
  // `text/plain` only carries a workspace-relative label ("src/app.ts"), which
  // `vscode.Uri.file()` would resolve against the extension host CWD, so it is
  // used only for files no absolute payload described.
  const finish = () => {
    const absoluteNames = new Set(
      Array.from(droppedFiles.values()).map(fileName => fileName.toLowerCase())
    );
    const pendingLabels: Array<[string, string]> = [];
    for (const [filePath, fileName] of labelFiles) {
      if (isAbsolutePath(filePath)) {
        droppedFiles.set(filePath, fileName);
        continue;
      }
      // Skip a relative label that describes a file already collected with its
      // absolute path - otherwise the same drop attaches "app.ts" twice.
      if (absoluteNames.has(fileName.toLowerCase())) continue;
      pendingLabels.push([filePath, fileName]);
    }
    // Labels are the last resort: the extension resolves them against the
    // workspace folder (see addContextDroppedFile). Only used when this drop
    // produced no absolute path at all.
    if (droppedFiles.size === 0) {
      for (const [filePath, fileName] of pendingLabels) {
        droppedFiles.set(filePath, fileName);
      }
    }
    onCollected();
  };

  // VS Code exposes dragged explorer files as string items (text/uri-list
  // and/or a custom application/vnd.code.tree.* type), NOT as file items.
  // getAsString is asynchronous, so gather them and flush once complete.
  const stringItems: DataTransferItem[] = [];
  // The item type must be read NOW: once the drop handler returns, the item is
  // dead and `item.type` reads as '' inside the getAsString callback - which
  // silently routed `text/plain` payloads (the absolute-path ones from other
  // tools) into the label bucket.
  const stringItemTypes: string[] = [];
  if (dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.kind === 'string') {
        stringItems.push(item);
        stringItemTypes.push(item.type);
      }
    }
  }

  if (stringItems.length === 0) {
    collectViaGetData();
    finish();
    return;
  }

  // getData works synchronously during the drop event - do it first.
  collectViaGetData();

  let pending = stringItems.length;
  const onStringRead = () => {
    pending--;
    if (pending === 0) finish();
  };

  stringItems.forEach((item, index) => {
    const itemType = stringItemTypes[index];
    try {
      item.getAsString((str) => {
        addFromString(str, itemType);
        onStringRead();
      });
    } catch {
      onStringRead();
    }
  });
};
