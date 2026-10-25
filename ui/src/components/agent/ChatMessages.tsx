import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChatSegment, endsWithWaitingMarker, isWaitingOnly, parseChatSegments } from '../../utils/parseChatSegments';
import ChatSegmentView from './ChatSegmentView';
import { ArrowDownIcon } from '../common/Icons';

interface ChatMessagesProps {
  displayText: string;
  onUseExamplePrompt: (prompt: string) => void;
  onReRun: (text: string) => void;
  // The run is in progress and the model has not produced anything yet.
  waiting?: boolean;
  // A stop was requested and the run has not unwound yet.
  stopRequested?: boolean;
  // The agent run is alive, so a tool block at the end of the log is running.
  sessionActive?: boolean;
}

// A "sticky bottom" threshold: while the user is within this distance of the
// bottom, streaming deltas keep the view pinned there.
const STICK_THRESHOLD_PX = 48;
// Guard against freezing on pathological logs: render the tail only.
const MAX_RENDERED_SEGMENTS = 400;

const EXAMPLE_PROMPTS = [
  'Explain the current file',
  'Find build errors in this project',
  'Which files changed in the last commit?'
];

const ChatMessages: React.FC<ChatMessagesProps> = ({ displayText, onUseExamplePrompt, onReRun, waiting, stopRequested, sessionActive }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [showAllSegments, setShowAllSegments] = useState(false);

  // Parsing the whole log on every streamed token is O(n) regex work; memoizing
  // on the display text keeps it to one pass per delta instead of per render.
  const segments: ChatSegment[] = useMemo(() => parseChatSegments(displayText), [displayText]);

  const visibleSegments = useMemo(() => {
    if (showAllSegments || segments.length <= MAX_RENDERED_SEGMENTS) return segments;
    return segments.slice(segments.length - MAX_RENDERED_SEGMENTS);
  }, [segments, showAllSegments]);

  const hiddenCount = segments.length - visibleSegments.length;

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD_PX;
    stickToBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom);
  }, []);

  // Pin to the bottom on new content only when the user has not scrolled away.
  // useLayoutEffect prevents a visible jump between paint and scroll.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !stickToBottomRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [displayText]);

  // A restored or freshly selected chat should start at the end.
  const chatSignature = displayText.length === 0 ? 'empty' : displayText.slice(0, 64);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
    element.scrollTop = element.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSignature]);

  const scrollToLatest = () => {
    const element = scrollRef.current;
    if (!element) return;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
    element.scrollTop = element.scrollHeight;
  };

  const isEmpty = displayText.trim().length === 0;
  // While the extension waits for the model the log contains only the spinner
  // markers, which must never be rendered as (empty) markdown.
  const showEmptyState = isEmpty || isWaitingOnly(displayText);
  // The row is a status indicator, not part of the log: it belongs at the end
  // of the conversation while the run is alive. It shows "Stopping..." as soon
  // as a stop is requested, otherwise "Waiting for the model..." while the
  // request is in flight and no answer has been streamed yet.
  const showWaitingRow = !!waiting;

  return (
    <div className="chat-area">
      <div className="chat-scroll" ref={scrollRef} onScroll={handleScroll}>
        {showEmptyState ? (
          <div className="chat-empty">
            <div className="chat-empty-title">Ask anything about this project</div>
            <div className="chat-empty-subtitle">
              The agent can read files, run commands and edit code.
            </div>
            <div className="chat-empty-examples">
              {EXAMPLE_PROMPTS.map(prompt => (
                <button
                  type="button"
                  key={prompt}
                  className="example-chip"
                  onClick={() => onUseExamplePrompt(prompt)}
                  title={prompt}
                >
                  {prompt}
                </button>
              ))}
            </div>
            {/* A run can start before the log has its first line, so the
                waiting/stopping indicator must also be visible here. */}
            {showWaitingRow && (
              <div className="agent-waiting" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <span>{stopRequested ? 'Stopping…' : 'Waiting for the model…'}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="markdown-content">
            {hiddenCount > 0 && (
              <button type="button" className="show-earlier-btn" onClick={() => setShowAllSegments(true)}>
                Show {hiddenCount} earlier segment{hiddenCount === 1 ? '' : 's'}
              </button>
            )}
            {visibleSegments.map((segment, index) => (
              <ChatSegmentView
                key={hiddenCount + index}
                index={hiddenCount + index}
                segment={segment}
                onReRun={onReRun}
                sessionActive={sessionActive}
              />
            ))}
            {showWaitingRow && (
              <div className="agent-waiting" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <span>{stopRequested ? 'Stopping…' : 'Waiting for the model…'}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showJumpToLatest && (
        <button
          type="button"
          className="jump-to-latest"
          onClick={scrollToLatest}
          title="Jump to the latest message"
        >
          <ArrowDownIcon />
          <span>Latest</span>
        </button>
      )}
    </div>
  );
};

export default ChatMessages;
