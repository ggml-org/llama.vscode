import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { vscode } from '../../types/vscode';
import { EMPTY_REQUEST_STATS, FileListUpdate, RequestStats, useExtensionMessages } from '../../hooks/useExtensionMessages';
import { bestEffortDroppedFileName, collectDroppedFiles, isDropExtensionAllowed, readableDroppedFileCount, readDroppedFileContents } from '../../utils/dropFiles';
import { getCommandName, PickerItem, PickerMode, PickerTrigger, replaceTrigger } from '../../utils/pickerItems';
import ChatMessages from './ChatMessages';
import Composer from './Composer';
import Picker from './Picker';
import StatusLine from './StatusLine';
import Menu, { MenuItem } from '../common/Menu';
import IconButton from '../common/IconButton';
import {
  HistoryIcon,
  MoreIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
  WrenchIcon
} from '../common/Icons';

interface AgentViewProps {
  displayText: string;
  setDisplayText: (text: string) => void;
  inputText: string;
  setInputText: (text: string) => void;
  currentToolsModel: string;
  // True when `endpoint_tools` is configured: the agent then works without a
  // selected tools model, so the "no tools model" empty state would be wrong.
  hasToolsEndpoint?: boolean;
  // True while the extension is starting the default tools model.
  startingDefaultToolsModel?: boolean;
  // Name of the configured default tools model, used to explain the wait.
  defaultToolsModel?: string;
  currentAgent: string;
  currentState: string;
  setCurrentState: (state: string) => void;
  // True on hosts where the "Llama app" OpenAI-compatible provider exists
  // (Windows / macOS), sent by the extension. Controls host-only menu entries.
  llamaAppSupported?: boolean;
  contextFiles: Map<string, string>;
  setContextFiles: (files: Map<string, string>) => void;
  imagePath: string;
  setContextImage: (imgPath: string) => void;
}

// `updateToolsModel` posts 'No model selected' (optionally with a
// ": <health status>" suffix), so a prefix check is the reliable test.
const NO_MODEL = 'No model selected';

interface Notice {
  text: string;
  kind: 'info' | 'error';
  // Optional call to action shown as a button. A notice with an action is
  // sticky: it stays until the user acts on it or dismisses it, because the
  // information is not repeated anywhere else.
  action?: { label: string; hint?: string; run: () => void };
}

const NOTICE_TIMEOUT_MS = 6000;
// How long the "Stopping..." state may be shown before the UI stops pretending
// and asks the user to press Stop again.
const STOP_REQUEST_TIMEOUT_MS = 10000;

const AgentView: React.FC<AgentViewProps> = ({
  displayText,
  setDisplayText,
  inputText,
  setInputText,
  currentToolsModel,
  hasToolsEndpoint = false,
  startingDefaultToolsModel = false,
  defaultToolsModel = '',
  currentAgent,
  currentState,
  setCurrentState,
  llamaAppSupported = false,
  contextFiles,
  setContextFiles,
  imagePath,
  setContextImage
}) => {
  const [stats, setStats] = useState<RequestStats>(EMPTY_REQUEST_STATS);
  const [isWorking, setIsWorking] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [pickerItems, setPickerItems] = useState<string[]>([]);
  const [pickerFilter, setPickerFilter] = useState('');
  const [pickerFileDetails, setPickerFileDetails] = useState<Record<string, string>>({});
  const [pickerTruncated, setPickerTruncated] = useState(false);
  const [pickerWorkspaceEmpty, setPickerWorkspaceEmpty] = useState(false);
  const [pickerError, setPickerError] = useState('');
  // True while the extension is still computing the current list/search.
  const [pickerLoading, setPickerLoading] = useState<boolean>(false);
  // Where the "@" / "/" that opened the picker sits in the composer text. Kept
  // in a ref because the picker callbacks must not re-create the element.
  const pickerTriggerRef = useRef<PickerTrigger | null>(null);
  const pickerRequestIdRef = useRef(0);
  const pickerSearchTimerRef = useRef<number | null>(null);
  const pickerRemoteSearchRef = useRef(true);
  // Set the moment the user presses Stop. The run may keep streaming for a
  // while (the in-flight request has to unwind), so the composer has to show
  // that the request was received instead of looking frozen.
  const [stopRequested, setStopRequested] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const stopResetTimerRef = useRef<number | null>(null);
  // Texts posted with "Send to session" that the extension has not confirmed
  // yet. They are rendered as pending user bubbles, so the message appears in
  // the chat the moment the user sends it instead of only when the agent loop
  // reaches the next tool-call boundary. The refs mirror the state so the
  // message handlers can compare without being re-created.
  const [pendingInSession, setPendingInSession] = useState<string[]>([]);
  const pendingInSessionRef = useRef<string[]>([]);
  pendingInSessionRef.current = pendingInSession;
  // The log the last "Send to session" was posted against. The extension only
  // appends to it, so text that was already there belongs to an earlier message
  // (the same prompt can legitimately be sent twice) and must not be mistaken
  // for the echo of this one.
  const inSessionBaseLogRef = useRef('');
  // Mirrors the composer text for the message handlers.
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;

  const hasToolsModel = !currentToolsModel.startsWith(NO_MODEL) || hasToolsEndpoint;

  const showNotice = useCallback((text: string, kind: Notice['kind'] = 'info', action?: Notice['action']) => {
    setNotice({ text, kind, action });
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    // A notice with an action must not disappear before the user can click it.
    if (action) return;
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, NOTICE_TIMEOUT_MS);
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    if (stopResetTimerRef.current !== null) window.clearTimeout(stopResetTimerRef.current);
    if (pickerSearchTimerRef.current !== null) window.clearTimeout(pickerSearchTimerRef.current);
    vscode.postMessage({ command: 'cancelFileList' });
  }, []);

  // The pending stop request is settled when the run is really over. It
  // deliberately does not look at the state text: "Stopping session..." still
  // means the run is alive, and the extension reports "AI is stopped" only once
  // the session has unwound.
  useEffect(() => {
    if (!isWorking) {
      setStopRequested(false);
      if (stopResetTimerRef.current !== null) {
        window.clearTimeout(stopResetTimerRef.current);
        stopResetTimerRef.current = null;
      }
    }
  }, [isWorking]);

  // After a webview reload a running session is only visible through the
  // restored state text, so seed the flag once from it.
  useEffect(() => {
    if (currentState && currentState.toLowerCase().includes('working')) {
      setIsWorking(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The chat is the log built by the extension plus the in-session texts that
  // are still on their way. Each one is written in the same ***...*** form the
  // extension uses for user messages (see formatInSessionTextForUi), so the
  // optimistic bubble and the real one look identical.
  const chatText = useMemo(() => {
    if (pendingInSession.length === 0) return displayText;
    return displayText + pendingInSession
      .map(text => '\n\n***' + text.split(/\r?\n/).join('  \n') + '***\n\n')
      .join('');
  }, [displayText, pendingInSession]);

  // Drops the pending entries whose text the extension has echoed into the log.
  // Only the part of the log that grew since the text was posted is searched, so
  // an identical message from earlier cannot be mistaken for this echo. The echo
  // uses two-space hard breaks, so the comparison applies them to the queued text
  // as well. A text the extension hands back is never echoed: it keeps its bubble
  // until the rejection puts it back into the composer.
  const settlePendingInSession = useCallback((log: string) => {
    const before = pendingInSessionRef.current;
    if (before.length === 0) return;
    const base = inSessionBaseLogRef.current;
    const fresh = log.startsWith(base) ? log.slice(base.length) : log;
    const stillPending = before.filter(entry => !fresh.includes(entry.split(/\r?\n/).join('  \n')));
    if (stillPending.length === before.length) return;
    pendingInSessionRef.current = stillPending;
    setPendingInSession(stillPending);
  }, []);

  useExtensionMessages({
    onUpdateText: (text: string) => {
      setDisplayText(text);
      settlePendingInSession(text);
    },
    onClearText: () => {
      setDisplayText('');
      pendingInSessionRef.current = [];
      setPendingInSession([]);
    },
    onFocusTextarea: (text: string) => {
      if (text) setInputText(text);
      textareaRef.current?.focus();
    },
    onUpdateCurrentState: (text: string, inProgress?: boolean) => {
      setCurrentState(text);
      // Fall back to the historical string check for older extension versions
      // that do not send the `inProgress` flag.
      setIsWorking(typeof inProgress === 'boolean' ? inProgress : text.toLowerCase().includes('working'));
    },
    onUpdateFileList: (update: FileListUpdate) => {
      // No request id is used by older/custom list replies. New replies must
      // belong to the currently open picker, otherwise a cancelled or previous
      // request could replace the current filter's results.
      if (update.requestId !== undefined && update.requestId !== pickerRequestIdRef.current) return;
      if (!pickerMode) return;
      pickerRemoteSearchRef.current = update.kind === 'workspace';
      setPickerItems(update.files);
      setPickerFileDetails(update.fileDetails ?? {});
      setPickerTruncated(Boolean(update.truncated));
      setPickerWorkspaceEmpty(Boolean(update.workspaceEmpty));
      setPickerError(update.error ?? '');
      setPickerLoading(false);
    },
    onUpdateContextFiles: setContextFiles,
    onUpdateContextImage: setContextImage,
    onUpdateRequestStats: setStats,
    // No foreground session took the text (the run ended in between). Put the
    // draft back so the user does not have to retype it.
    onInSessionTextRejected: (text: string, files: Map<string, string>) => {
      pendingInSessionRef.current = pendingInSessionRef.current.filter(entry => entry !== text);
      setPendingInSession(pendingInSessionRef.current);
      if (!inputTextRef.current) setInputText(text);
      if (files.size > 0) setContextFiles(files);
      showNotice(
        'The session had already finished - the message was put back in the composer. Press Send to start a new one.',
        'error'
      );
    }
  });

  // Bridge kept for the extension (`window.focusTextarea`, see architect.ts).
  useEffect(() => {
    // @ts-ignore - Adding to window for extension access
    window.focusTextarea = () => textareaRef.current?.focus();
  }, []);

  // Starts a new chat. Shared by the toolbar "+ New" button and its keyboard
  // shortcut so both always do exactly the same thing.
  const startNewChat = useCallback(() => {
    // A picker opened over the old chat would otherwise float over the emptied
    // one. Only state setters and a ref are touched, so the identity is stable.
    pickerTriggerRef.current = null;
    setPickerMode(null);
    setPickerItems([]);
    setPickerFilter('');
    setPickerFileDetails({});
    setPickerLoading(false);
    pickerRequestIdRef.current++;
    pickerRemoteSearchRef.current = false;
    if (pickerSearchTimerRef.current !== null) {
      window.clearTimeout(pickerSearchTimerRef.current);
      pickerSearchTimerRef.current = null;
    }
    vscode.postMessage({ command: 'cancelFileList' });
    vscode.postMessage({ command: 'clearText' });
  }, []);

  // Ctrl+N starts a new chat - the keyboard equivalent of the toolbar "+ New"
  // button. Bound to the document because the focus may sit in the composer, in
  // the picker's filter box, or nowhere at all.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.shiftKey || event.altKey) return;
      // `event.key` depends on the keyboard layout (with a non-latin layout the
      // latin "n" is never produced), so accept the physical key as well.
      if (event.key.toLowerCase() !== 'n' && event.code !== 'KeyN') return;

      // Ctrl+N is a workbench keybinding (`workbench.action.files.newUntitledFile`,
      // `when: null`). VS Code re-dispatches keydown from a focused webview to
      // its keybinding service and does NOT look at `defaultPrevented`, so
      // preventDefault alone would still open an untitled file next to the new
      // chat. Stopping the propagation keeps the event from reaching the
      // webview host's own window listener, which is what forwards it.
      event.preventDefault();
      event.stopPropagation();

      // Auto-repeat (key held down) must not post clearText over and over.
      if (event.repeat) return;
      // Same rule as the button: without a tools model the button is disabled,
      // so the shortcut does nothing.
      if (!hasToolsModel) return;
      startNewChat();
      // A new chat means the user is about to type a prompt.
      textareaRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [hasToolsModel, startNewChat]);

  // Drag & drop is bound to the whole document on purpose. Binding it only to
  // the `.agent-view` element missed drops that landed on anything outside it
  // (the app header above the view, the composer overlay, ...), which made a
  // drop silently do nothing. Only the first `dragover` of a drag opens the
  // overlay, so nesting can no longer leave it stuck.
  useEffect(() => {
    const clearDragState = () => {
      dragDepthRef.current = 0;
      setIsDragOver(false);
    };

    const onDragEnter = (event: DragEvent) => {
      // preventDefault is what tells the browser this is a valid drop target.
      // Deliberately done even when `dataTransfer` is null: VS Code re-dispatches
      // its own synthetic DragEvents here, and a drag whose dataTransfer could
      // not be transferred must still count as "something is being dragged".
      event.preventDefault();
      dragDepthRef.current++;
      if (dragDepthRef.current === 1) setIsDragOver(true);
    };

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      // Match the user's intent: the drop will copy files into the context.
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      if (dragDepthRef.current === 0) {
        dragDepthRef.current = 1;
        setIsDragOver(true);
      }
    };

    const onDragLeave = (event: DragEvent) => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      // `relatedTarget` is null when the pointer leaves the document itself,
      // which is a reliable "the whole drag is gone" signal.
      if (dragDepthRef.current === 0 || event.relatedTarget === null) clearDragState();
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      clearDragState();
      if (event.dataTransfer) {
        handleDroppedFiles(event.dataTransfer);
        return;
      }
      // The drop arrived but its payload did not: offer the file dialog rather
      // than doing nothing at all (this is what makes a failed VS Code internal
      // drop look broken instead of merely unhelpful).
      offerFileDialog(bestEffortDroppedFileName(event.dataTransfer));
    };

    // `dragend` fires when the drag is released anywhere (including outside the
    // webview), so the overlay can never stay on screen.
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    document.addEventListener('dragend', clearDragState);
    return () => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('dragend', clearDragState);
    };
    // `handleDroppedFiles` is recreated on every render but only reads refs and
    // state setters, so registering the listeners once is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `trigger` is set when the picker was opened by typing "@" / "/" in the
  // composer: the character is already in the text and gets replaced by the
  // picked item. It is null for the toolbar buttons, which just open the list.
  const openPicker = (mode: PickerMode, trigger?: PickerTrigger | null) => {
    if (pickerSearchTimerRef.current !== null) {
      window.clearTimeout(pickerSearchTimerRef.current);
      pickerSearchTimerRef.current = null;
    }
    const requestId = ++pickerRequestIdRef.current;
    pickerRemoteSearchRef.current = mode === 'files';
    pickerTriggerRef.current = trigger ?? null;
    setPickerItems([]);
    setPickerFilter('');
    setPickerFileDetails({});
    setPickerTruncated(false);
    setPickerWorkspaceEmpty(false);
    setPickerError('');
    setPickerLoading(true);
    setPickerMode(mode);
    vscode.postMessage({ command: 'cancelFileList' });
    vscode.postMessage({
      command: mode === 'files' ? 'getFileList' : 'getAgentCommands',
      requestId,
      kind: mode,
      query: ''
    });
  };

  const searchWorkspaceFiles = useCallback((query: string, debounce = false) => {
    if (pickerSearchTimerRef.current !== null) {
      window.clearTimeout(pickerSearchTimerRef.current);
      pickerSearchTimerRef.current = null;
    }
    // Invalidate immediately, not after the debounce: an older search may
    // finish while the user is still typing and must not become current again.
    const requestId = ++pickerRequestIdRef.current;
    setPickerItems([]);
    setPickerFileDetails({});
    setPickerTruncated(false);
    setPickerWorkspaceEmpty(false);
    setPickerError('');
    setPickerLoading(true);
    vscode.postMessage({ command: 'cancelFileList' });
    const postSearch = () => {
      pickerSearchTimerRef.current = null;
      vscode.postMessage({ command: 'getFileList', requestId, kind: 'workspace', query });
    };
    if (debounce) pickerSearchTimerRef.current = window.setTimeout(postSearch, 200);
    else postSearch();
  }, []);

  const changePickerFilter = (filter: string) => {
    setPickerFilter(filter);
    if (pickerSearchTimerRef.current !== null) {
      window.clearTimeout(pickerSearchTimerRef.current);
      pickerSearchTimerRef.current = null;
    }
    // Custom context lists and commands are cheap, complete local lists. Only
    // workspace files need a debounced search so files beyond the initial cap
    // remain discoverable without running one filesystem search per keystroke.
    if (pickerMode !== 'files' || !pickerRemoteSearchRef.current) return;
    searchWorkspaceFiles(filter, true);
  };

  // Moves the focus (and the caret) back into the composer after the picker
  // closes. Deferred so the click that closed the picker has been processed.
  const focusComposer = (caret?: number) => {
    window.setTimeout(() => {
      const element = textareaRef.current;
      if (!element) return;
      element.focus();
      if (typeof caret === 'number') element.setSelectionRange(caret, caret);
    }, 0);
  };

  // Drops the picker state. Deliberately does not touch the composer text: a
  // cancelled picker leaves the typed "@" / "/" where it is.
  const resetPicker = () => {
    const trigger = pickerTriggerRef.current;
    pickerTriggerRef.current = null;
    pickerRequestIdRef.current++;
    pickerRemoteSearchRef.current = false;
    if (pickerSearchTimerRef.current !== null) {
      window.clearTimeout(pickerSearchTimerRef.current);
      pickerSearchTimerRef.current = null;
    }
    setPickerMode(null);
    setPickerItems([]);
    setPickerFilter('');
    setPickerFileDetails({});
    setPickerTruncated(false);
    setPickerWorkspaceEmpty(false);
    setPickerError('');
    setPickerLoading(false);
    vscode.postMessage({ command: 'cancelFileList' });
    return trigger;
  };

  const retryPicker = () => {
    if (pickerMode !== 'files') return;
    if (pickerRemoteSearchRef.current) {
      searchWorkspaceFiles(pickerFilter);
      return;
    }
    const requestId = ++pickerRequestIdRef.current;
    setPickerError('');
    setPickerLoading(true);
    vscode.postMessage({ command: 'getFileList', requestId, kind: 'custom', query: '' });
  };

  const closePicker = () => {
    const trigger = resetPicker();
    // Put the caret right after the cancelled trigger character so the user can
    // keep typing the file name by hand.
    focusComposer(trigger ? trigger.index + trigger.char.length : undefined);
  };

  // Stable callback shared by the example prompts and the per-message re-run
  // action; it must keep its identity or the memoized list re-renders.
  const usePrompt = useCallback((prompt: string) => {
    setInputText(prompt);
    textareaRef.current?.focus();
  }, [setInputText]);

  const sendInSession = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    // Show the message right away: the extension only echoes it back on the next
    // log update, and the agent receives it at the next tool-call boundary, which
    // can be minutes away. Without the pending bubble the button looked dead.
    // The log as it is now is the baseline the echo of this text is searched in.
    inSessionBaseLogRef.current = displayText;
    pendingInSessionRef.current = [...pendingInSessionRef.current, text];
    setPendingInSession(pendingInSessionRef.current);
    vscode.postMessage({ command: 'sendInSessionText', text });
    setInputText('');
  }, [displayText, inputText, setInputText]);

  const sendText = useCallback(() => {
    if (!inputText.trim()) return;
    // Enter and Ctrl/Cmd+Enter share this path, and during a run it means the
    // same as the "Send to session" button.
    if (isWorking) {
      sendInSession();
      return;
    }
    vscode.postMessage({ command: 'sendText', text: inputText });
    setInputText('');
    setIsWorking(true);
    setCurrentState('AI is working...');
  }, [inputText, isWorking, sendInSession, setInputText, setCurrentState]);

  const stopSession = () => {
    // Immediate local feedback: the extension answers with "Stopping session..."
    // as well, but that round trip is not instantaneous.
    setStopRequested(true);
    setCurrentState('Stopping session...');
    vscode.postMessage({ command: 'stopSession', text: inputText });

    // Safety net: if the run does not react (e.g. a tool is not abortable), stop
    // pretending and let the user try again instead of showing a dead button.
    if (stopResetTimerRef.current !== null) window.clearTimeout(stopResetTimerRef.current);
    stopResetTimerRef.current = window.setTimeout(() => {
      setStopRequested(false);
      stopResetTimerRef.current = null;
      showNotice('The session did not stop yet - press Stop again to retry.', 'error');
    }, STOP_REQUEST_TIMEOUT_MS);
  };

  const handlePickerSelect = (item: PickerItem) => {
    const mode = pickerMode;
    const trigger = resetPicker();

    if (mode === 'commands') {
      const commandName = getCommandName(item.raw);
      vscode.postMessage({
        command: 'sendAgentCommand',
        text: commandName,
        agentCommand: commandName
      });
      // The command replaces the composer content: the trigger slash and any
      // text typed around it belong to the command that is now running.
      setInputText('');
      setIsWorking(true);
      setCurrentState('AI is working...');
      return;
    }

    vscode.postMessage({ command: 'addContextProjectFile', fileLongName: item.raw });

    // Put "@name " in the composer, replacing the trigger character when there
    // is one. The file itself is attached through `addContextProjectFile`, the
    // text is what tells the model (and the user) which file is meant.
    const snippet = '@' + item.name + (inputText.endsWith(' ') ? '' : ' ');
    const { text, caret } = replaceTrigger(inputText, trigger, snippet);
    setInputText(text);
    focusComposer(caret);
  };

  // VS Code deliberately withholds the payload of drags that start inside the
  // workbench (Explorer -> webview), so a drop from the file tree can never
  // carry a file. Rather than doing nothing, offer the file dialog that has to
  // stand in for it.
  const offerFileDialog = useCallback(
    (hintName: string) => {
      showNotice(
        'Drag & drop works only for files dragged from outside VS Code: VS Code does not hand a payload to the webview for drags that start in the Explorer. Choose the file instead.',
        'info',
        {
          label: 'Choose file…',
          hint: hintName ? `Suggested: ${hintName}` : undefined,
          run: () => {
            vscode.postMessage({ command: 'addContextFileDialog', fileName: hintName || undefined });
          }
        }
      );
    },
    [showNotice]
  );

  const handleDroppedFiles = (dataTransfer: DataTransfer) => {
    const droppedFiles = new Map<string, string>();
    // Started synchronously: the DataTransfer (and its File objects) is
    // invalidated as soon as the drop handler returns.
    const contentPromise = readDroppedFileContents(dataTransfer);
    collectDroppedFiles(dataTransfer, droppedFiles, () => {
      const byPath = () => {
        let added = 0;
        const rejected: string[] = [];
        for (const [filePath, fileName] of droppedFiles.entries()) {
          if (isDropExtensionAllowed(fileName)) {
            vscode.postMessage({ command: 'addContextDroppedFile', filePath, fileName });
            added++;
          } else {
            rejected.push(fileName);
          }
        }
        return { added, rejected };
      };

      const finishWithContent = async () => {
        // A drop from outside VS Code has no usable path (Electron no longer
        // exposes File.path to webviews), so the content read in the webview is
        // the only way to attach it.
        const contents = await contentPromise;
        let added = 0;
        for (const file of contents) {
          vscode.postMessage({ command: 'importDroppedFile', fileName: file.fileName, text: file.text });
          added++;
        }
        return added;
      };

      if (droppedFiles.size === 0) {
        // No path payload - this is either an OS drop or a drag that exposed
        // nothing we understand.
        void finishWithContent().then(added => {
          if (added > 0) {
            showNotice(`Added ${added} file${added === 1 ? '' : 's'} to the context`);
            return;
          }
          if (readableDroppedFileCount(dataTransfer) > 0) {
            showNotice(
              'The dropped file could not be imported (unsupported type, binary or larger than 512 KB)',
              'error'
            );
            return;
          }
          // No files and no path: a drag that began inside VS Code.
          offerFileDialog(bestEffortDroppedFileName(dataTransfer));
        });
        return;
      }

      const { added, rejected } = byPath();
      if (rejected.length > 0) {
        // A partially successful drop must not read as a plain failure: say what
        // was attached and what was skipped.
        const addedText = added > 0 ? `Added ${added} file${added === 1 ? '' : 's'}. ` : '';
        showNotice(`${addedText}Unsupported file type: ${rejected.join(', ')}`, 'error');
      } else if (added > 0) {
        showNotice(`Added ${added} file${added === 1 ? '' : 's'} to the context`);
      }
    });
  };

  // Shared by the "..." menu and the clickable agent / tools-model names in the
  // composer footer, so both entry points always send the same message.
  const selectAgent = useCallback(() => {
    vscode.postMessage({ command: 'selectAgent' });
  }, []);

  const selectToolsModel = useCallback(() => {
    vscode.postMessage({ command: 'selectModelWithTools' });
  }, []);

  const manageToolsModels = useCallback(() => {
    vscode.postMessage({ command: 'moreToolsModel' });
  }, []);

  const addModelFromLlamaApp = useCallback(() => {
    vscode.postMessage({ command: 'addModelFromLlamaApp' });
  }, []);
  

  const menuItems: MenuItem[] = [
    // { label: 'Chats History', icon: <HistoryIcon />, onSelect: () => vscode.postMessage({ command: 'showChatsHistory' }) },
    
    { label: 'Select Agent…', icon: <ShieldIcon />, onSelect: selectAgent },
    { label: 'Select Tools Model…', icon: <ShieldIcon />, onSelect: selectToolsModel },
    // The Llama app provider exists on Windows and macOS only, so on other
    // hosts there is no local endpoint to import a tools model from.
    ...(llamaAppSupported
      ? [{ label: 'Add Tools Model From Llama App…', icon: <ShieldIcon />, onSelect: addModelFromLlamaApp }]
      : []),
    { label: 'Select Tools…', icon: <WrenchIcon />, onSelect: () => vscode.postMessage({ command: 'configureTools', text: inputText }) },
    { label: 'Delete current chat', icon: <TrashIcon />, danger: true, onSelect: () => vscode.postMessage({ command: 'deleteCurrentChat' }) },
    { label: 'Manage Tools Model…', icon: <ShieldIcon />, onSelect: manageToolsModels }
  ];

  return (
    <div className="agent-view">
      {isDragOver && (
        <div className="drop-hint" aria-hidden="true">
          Drop files to attach — files from outside VS Code only. VS Code does not pass Explorer drags to the panel.
        </div>
      )}

      <div className="agent-toolbar">
        <button
          type="button"
          className="modern-btn secondary toolbar-new"
          onClick={startNewChat}
          title="Start a new chat (Ctrl+N)"
          disabled={!hasToolsModel}
        >
          <PlusIcon />
          <span>New</span>
        </button>
        {/* The Llama app provider exists on Windows and macOS only (same gate
            as the "Add Tools Model From Llama App…" menu entry), so on other
            hosts there is no local endpoint to import a tools model from.
            Deliberately enabled without a tools model: importing one from the
            Llama app is exactly what a user without a model needs. */}
        {llamaAppSupported && (
          <button
            type="button"
            className="modern-btn secondary"
            onClick={addModelFromLlamaApp}
            title="Add Tools Model From Llama App"
          >
            <span>llama app</span>
          </button>
        )}
        <button
          type="button"
          className="modern-btn secondary"
          onClick={() => vscode.postMessage({ command: 'showChatsHistory' })}
          title="View chats history and load an old chat"
        >
          <HistoryIcon />
          <span>History</span>
        </button>
        <div className="more-actions-container">
          <IconButton
            label="More agent actions"
            icon={<MoreIcon />}
            onClick={() => setShowMenu(prev => !prev)}
            active={showMenu}
            dataMenuToggle
          />
          <Menu items={menuItems} open={showMenu} onClose={() => setShowMenu(false)} ariaLabel="Agent actions" />
        </div>
      </div>

      {!hasToolsModel ? (
        <div className="agent-empty-state">
          {startingDefaultToolsModel ? (
            <>
              {/* The default tools model is being started. Showing the empty
                  state here would be wrong (a model IS on its way) and would
                  make the page look broken while weights download. */}
              <span className="spinner" aria-hidden="true" />
              <div className="agent-empty-title">Starting the default tools model…</div>
              <div className="agent-empty-text">
                {defaultToolsModel ? (
                  <>
                    <code>{defaultToolsModel}</code> is set as the default tools model and is being
                    started. This can take a while while the model is downloading.
                  </>
                ) : (
                  'The default tools model is being started. This can take a while while the model is downloading.'
                )}
              </div>
              <button
                type="button"
                className="modern-btn secondary"
                onClick={() => vscode.postMessage({ command: 'selectModelWithTools' })}
              >
                Choose Another Model
              </button>
            </>
          ) : (
            <>
              <WrenchIcon size={28} />
              <div className="agent-empty-title">No tools model selected</div>
              <div className="agent-empty-text">
                The agent needs a tools-capable model (or an endpoint configured in{' '}
                <code>endpoint_tools</code>) to read files and run commands.
              </div>
              <button
                type="button"
                className="modern-btn"
                onClick={() => vscode.postMessage({ command: 'selectModelWithTools' })}
              >
                Select Tools Model
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <ChatMessages
            displayText={chatText}
            onUseExamplePrompt={usePrompt}
            onReRun={usePrompt}
            waiting={isWorking || stopRequested}
            stopRequested={stopRequested}
            sessionActive={isWorking || stopRequested}
          />

          {notice && (
            <div className={`composer-notice ${notice.kind}`} role="status">
              <span className="composer-notice-text">{notice.text}</span>
              {notice.action && (
                <span className="composer-notice-actions">
                  <button
                    type="button"
                    className="modern-btn secondary composer-notice-action"
                    onClick={() => {
                      // The dialog is modal on the extension side; drop the
                      // notice so it cannot be clicked twice.
                      setNotice(null);
                      notice.action?.run();
                    }}
                    title={notice.action.hint || notice.action.label}
                  >
                    {notice.action.label}
                  </button>
                  <button
                    type="button"
                    className="composer-notice-close"
                    onClick={() => setNotice(null)}
                    aria-label="Dismiss"
                    title="Dismiss"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}

          <div className="composer-host">
            {pickerMode && (
              <Picker
                mode={pickerMode}
                items={pickerItems}
                filter={pickerFilter}
                onFilterChange={changePickerFilter}
                fileDetails={pickerFileDetails}
                loading={pickerLoading}
                truncated={pickerTruncated}
                workspaceEmpty={pickerWorkspaceEmpty}
                error={pickerError}
                onRetry={pickerMode === 'files' ? retryPicker : undefined}
                onChooseFile={pickerMode === 'files' ? () => {
                  closePicker();
                  vscode.postMessage({ command: 'addContextFileDialog' });
                } : undefined}
                onSelect={handlePickerSelect}
                onClose={closePicker}
                disabled={pickerMode === 'commands' && isWorking}
                disabledHint="A session is running. Wait for it to finish or stop it before running a command."
              />
            )}

            <Composer
              inputText={inputText}
              setInputText={setInputText}
              onSend={sendText}
              onSendInSession={sendInSession}
              onStop={stopSession}
              onAddFile={(trigger?: PickerTrigger | null) => openPicker('files', trigger)}
              onAddCommand={(trigger?: PickerTrigger | null) => openPicker('commands', trigger)}
              onAddImage={() => vscode.postMessage({ command: 'selectImageFile' })}
              onConfigureTools={() => vscode.postMessage({ command: 'configureTools', text: inputText })}
              onSelectAgent={selectAgent}
              onSelectToolsModel={selectToolsModel}
              isWorking={isWorking}
              stopRequested={stopRequested}
              currentAgent={currentAgent}
              currentToolsModel={currentToolsModel}
              contextFiles={contextFiles}
              imagePath={imagePath}
              onOpenContextFile={(fileLongName: string) => vscode.postMessage({ command: 'openContextFile', fileLongName })}
              onRemoveContextFile={(fileLongName: string) => vscode.postMessage({ command: 'removeContextProjectFile', fileLongName })}
              onRemoveContextImage={(img: string) => vscode.postMessage({ command: 'removeContextProjectImage', image: img })}
              textareaRef={textareaRef}
            />

            <StatusLine
              stateText={stopRequested ? 'Stopping session…' : currentState}
              isWorking={isWorking}
              stopRequested={stopRequested}
              stats={stats}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AgentView;
