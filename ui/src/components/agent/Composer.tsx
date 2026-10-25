import React, { useLayoutEffect, useRef } from 'react';
import ContextChips from './ContextChips';
import { isTriggerPosition, PickerTrigger, replaceRange } from '../../utils/pickerItems';
import { ImageIcon, QueueIcon, SendIcon, StopIcon, WrenchIcon } from '../common/Icons';

interface ComposerProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSend: () => void;
  onSendInSession: () => void;
  onStop: () => void;
  // `trigger` describes where the typed "@" / "/" ended up in the text, so the
  // picker can replace it with the picked item. It is null when the picker was
  // opened from the toolbar instead of from a keystroke.
  onAddFile: (trigger?: PickerTrigger | null) => void;
  onAddCommand: (trigger?: PickerTrigger | null) => void;
  onAddImage: () => void;
  onConfigureTools: () => void;
  // Same actions as the "..." menu entries "Select Agent..." / "Select Tools Model..."
  onSelectAgent: () => void;
  onSelectToolsModel: () => void;
  isWorking: boolean;
  // A stop was requested and the run has not unwound yet.
  stopRequested: boolean;
  currentAgent: string;
  currentToolsModel: string;
  contextFiles: Map<string, string>;
  imagePath: string;
  onOpenContextFile: (fileLongName: string) => void;
  onRemoveContextFile: (fileLongName: string) => void;
  onRemoveContextImage: (imagePath: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

const MIN_TEXTAREA_HEIGHT = 64;
const MAX_TEXTAREA_HEIGHT = 200;

const Composer: React.FC<ComposerProps> = ({
  inputText,
  setInputText,
  onSend,
  onSendInSession,
  onStop,
  onAddFile,
  onAddCommand,
  onAddImage,
  onConfigureTools,
  onSelectAgent,
  onSelectToolsModel,
  isWorking,
  stopRequested,
  currentAgent,
  currentToolsModel,
  contextFiles,
  imagePath,
  onOpenContextFile,
  onRemoveContextFile,
  onRemoveContextImage,
  textareaRef
}) => {
  const hasText = inputText.trim().length > 0;

  // Caret to apply once a programmatic edit has been committed to the DOM.
  const pendingCaretRef = useRef<number | null>(null);

  // Auto-grow between 64 and 200 px. Height is reset first so the textarea can
  // shrink again after a deletion.
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    const next = Math.min(Math.max(element.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
    element.style.height = next + 'px';
  }, [inputText, textareaRef]);

  // A controlled value resets the caret to the end, so the selection recorded
  // by an edit is restored after the commit. Focus is deliberately left alone:
  // the picker takes it as soon as it opens and must not be fought over.
  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    pendingCaretRef.current = null;
    textareaRef.current?.setSelectionRange(caret, caret);
  }, [inputText, textareaRef]);

  // The picker moves the focus into its own filter box as soon as it opens, so
  // a character typed at that moment would land there instead of in the
  // composer. The trigger character is therefore inserted here and the browser
  // default is cancelled by the caller.
  const insertTriggerChar = (char: '@' | '/'): PickerTrigger => {
    const element = textareaRef.current;
    const start = element ? (element.selectionStart ?? inputText.length) : inputText.length;
    const end = element ? (element.selectionEnd ?? start) : start;
    const { text, caret } = replaceRange(inputText, start, end, char);
    pendingCaretRef.current = caret;
    setInputText(text);
    return { char, index: caret - char.length };
  };

  // Esc stops a running session. Enter sends, Shift+Enter adds a newline.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.key === '@' || event.key === '/') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const caret = event.currentTarget.selectionStart ?? inputText.length;
      // Only open a picker at the start of a word, so paths ("ui/src") and
      // addresses ("me@example.com") can still be typed normally.
      if (!isTriggerPosition(inputText.slice(0, caret))) return;
      event.preventDefault();
      const char: '@' | '/' = event.key;
      const trigger = insertTriggerChar(char);
      if (char === '@') onAddFile(trigger);
      else onAddCommand(trigger);
      return;
    }
    if (event.key === 'Escape' && isWorking) {
      event.preventDefault();
      onStop();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (hasText) {
        if (event.ctrlKey || event.metaKey) onSendInSession();
        else onSend();
      }
      return;
    }
  };

  return (
    <div className="composer">
      {stopRequested && (
        <div className="stop-banner" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span className="stop-banner-text">
            Stop requested — the agent finishes the current step, then stops.
          </span>
          <button
            type="button"
            className="stop-banner-again"
            onClick={onStop}
            title="Send another stop request"
          >
            Stop again
          </button>
        </div>
      )}
      <ContextChips
        contextFiles={contextFiles}
        imagePath={imagePath}
        onOpenFile={onOpenContextFile}
        onRemoveFile={onRemoveContextFile}
        onRemoveImage={onRemoveContextImage}
      />

      <textarea
        ref={textareaRef}
        value={inputText}
        onChange={(event) => setInputText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your code…"
        className="modern-textarea composer-textarea"
        aria-label="Message the agent"
        spellCheck={false}
      />

      <div className="composer-toolbar">
        <div className="composer-tools">
          <button type="button" className="tool-btn" onClick={() => onAddFile()} title="Add a file to the context (@)">
            <span className="tool-btn-key">@</span>
            <span className="tool-btn-label">File</span>
          </button>
          <button type="button" className="tool-btn" onClick={() => onAddCommand()} title="Run an agent command (/)">
            <span className="tool-btn-key">/</span>
            <span className="tool-btn-label">Command</span>
          </button>
          <button type="button" className="tool-btn" onClick={onAddImage} title="Add/replace an image in the context">
            <ImageIcon />
            <span className="tool-btn-label">Image</span>
          </button>
          <button type="button" className="tool-btn" onClick={onConfigureTools} title="Select the tools available to the agent">
            <WrenchIcon />
            <span className="tool-btn-label">Tools</span>
          </button>
        </div>

        <div className="composer-send">
          {isWorking ? (
            <>
              <button
                type="button"
                className="modern-btn secondary send-in-session"
                onClick={onSendInSession}
                disabled={!hasText || stopRequested}
                title="Send in the current session, at the next tool-call boundary (Ctrl/Cmd+Enter)"
              >
                <QueueIcon />
                <span>Send to session</span>
              </button>
              {/* The stop control is the primary feedback: it turns into a busy
                  "Stopping..." button the moment the request is sent, so the
                  click visibly does something even while the run unwinds. */}
              <button
                type="button"
                className={`modern-btn stop${stopRequested ? ' stopping' : ''}`}
                onClick={onStop}
                disabled={stopRequested}
                title={stopRequested ? 'Stop requested - waiting for the agent to finish the current step' : 'Stop the agent (Esc)'}
                aria-label={stopRequested ? 'Stopping the agent' : 'Stop the agent'}
                aria-busy={stopRequested}
              >
                {stopRequested ? <span className="spinner" aria-hidden="true" /> : <StopIcon />}
                <span>{stopRequested ? 'Stopping…' : 'Stop'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="modern-btn send"
              onClick={onSend}
              disabled={!hasText}
              title="Send (Enter)"
              aria-label="Send message"
            >
              <SendIcon />
              <span>Send</span>
            </button>
          )}
        </div>
      </div>

      <div className="composer-footer">
        <span className="composer-hint">Enter to send · Shift+Enter for a new line · @ files · / commands</span>
        <span className="composer-context">
          <button
            type="button"
            className="context-link"
            onClick={onSelectAgent}
            title={`Agent: ${currentAgent}\nClick to select another agent`}
            aria-label={`Selected agent ${currentAgent}, click to select another agent`}
          >
            {currentAgent}
          </button>
          <span className="context-sep" aria-hidden="true">·</span>
          <button
            type="button"
            className="context-link"
            onClick={onSelectToolsModel}
            title={`Tools model: ${currentToolsModel}\nClick to select another tools model`}
            aria-label={`Selected tools model ${currentToolsModel}, click to select another tools model`}
          >
            {currentToolsModel}
          </button>
        </span>
      </div>
    </div>
  );
};

export default Composer;
