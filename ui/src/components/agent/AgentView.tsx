import React, { useCallback, useEffect, useRef, useState } from 'react';
import { vscode } from '../../types/vscode';
import { EMPTY_REQUEST_STATS, RequestStats, useExtensionMessages } from '../../hooks/useExtensionMessages';
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
  // True while the extension is still computing the list (this can take a
  // moment on big projects), so we do not falsely report "0 results".
  const [pickerLoading, setPickerLoading] = useState<boolean>(false);
  // Where the "@" / "/" that opened the picker sits in the composer text. Kept
  // in a ref because the picker callbacks must not re-create the element.
  const pickerTriggerRef = useRef<PickerTrigger | null>(null);
  // Set the moment the user presses Stop. The run may keep streaming for a
  // while (the in-flight request has to unwind), so the composer has to show
  // that the request was received instead of looking frozen.
  const [stopRequested, setStopRequested] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const stopResetTimerRef = useRef<number | null>(null);

  const hasToolsModel = !currentToolsModel.startsWith(NO_MODEL);

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

  useExtensionMessages({
    onUpdateText: setDisplayText,
    onClearText: () => setDisplayText(''),
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
    onUpdateFileList: (files: string[]) => {
      setPickerItems(files);
      setPickerLoading(false);
      // Only fill a picker that is still open - the user may have closed it
      // while the list was being computed.
      setPickerMode((prev: PickerMode | null) => prev);
    },
    onUpdateContextFiles: setContextFiles,
    onUpdateContextImage: setContextImage,
    onUpdateRequestStats: setStats
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
    setPickerLoading(false);
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
    pickerTriggerRef.current = trigger ?? null;
    setPickerItems([]);
    setPickerLoading(true);
    setPickerMode(mode);
    vscode.postMessage({ command: mode === 'files' ? 'getFileList' : 'getAgentCommands' });
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
    setPickerMode(null);
    setPickerItems([]);
    setPickerLoading(false);
    return trigger;
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

  const sendText = useCallback(() => {
    if (!inputText.trim()) return;
    if (isWorking) {
      vscode.postMessage({ command: 'sendInSessionText', text: inputText });
    } else {
      vscode.postMessage({ command: 'sendText', text: inputText });
    }
    setInputText('');
    setIsWorking(true);
    setCurrentState('AI is working...');
  }, [inputText, isWorking, setInputText, setCurrentState]);

  const sendInSession = useCallback(() => {
    if (!inputText.trim()) return;
    vscode.postMessage({ command: 'sendInSessionText', text: inputText });
    setInputText('');
  }, [inputText, setInputText]);

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
        </div>
      ) : (
        <>
          <ChatMessages
            displayText={displayText}
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
