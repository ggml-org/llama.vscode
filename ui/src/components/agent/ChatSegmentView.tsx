import React, { useCallback, useMemo, useState } from 'react';
import ReactMarkdown, { Components, defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatSegment } from '../../utils/parseChatSegments';
import { copyToClipboard } from '../../utils/clipboard';
import { ChevronDownIcon, ChevronRightIcon, CopyIcon, RetryIcon, WrenchIcon } from '../common/Icons';

// ReactMarkdown's default URL transform strips non-http(s)/mailto protocols.
// The extension renders "Files changes" entries as markdown links using the
// `command:` URI scheme (see llama-agent.ts getFileChangeLink), so we must
// keep those links intact to make them clickable. Everything else keeps the
// default safe behavior.
export const markdownUrlTransform = (url: string, key: string, node: any): string => {
  if (url.startsWith('command:')) {
    return url;
  }
  return defaultUrlTransform(url);
};

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  children?: React.ReactNode;
}

// Code blocks get a hover-revealed copy button. `pre` receives the fenced code
// node, so the inner text is used for the clipboard payload.
const CodeBlock: React.FC<CodeBlockProps> = ({ children, ...rest }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = extractText(children);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="code-block">
      <button
        type="button"
        className="code-copy-btn"
        onClick={handleCopy}
        title="Copy code"
        aria-label="Copy code block"
      >
        <CopyIcon />
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <pre {...rest}>{children}</pre>
    </div>
  );
};

const extractText = (node: React.ReactNode): string => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).reduce((acc, part) => acc + part, '');
  const element = node as React.ReactElement<any>;
  if (element.props && element.props.children !== undefined) {
    return extractText(element.props.children);
  }
  return '';
};

// Wrapper isolates the `node` prop react-markdown passes to custom renderers so
// it never ends up spread onto a DOM element.
const MarkdownPre: React.FC<React.ComponentProps<'pre'> & { node?: unknown }> = ({ node, ...rest }) => (
  <CodeBlock {...rest} />
);

// A markdown table has a min-content width of its widest row, and no wrapping
// can shrink it. Wrapping it in a scroller keeps a wide table from widening the
// whole chat column (which pushed the Send button and the scrollbar out of the
// panel on a narrow sidebar).
const MarkdownTable: React.FC<React.ComponentProps<'table'> & { node?: unknown }> = ({ node, ...rest }) => (
  <div className="table-scroll">
    <table {...rest} />
  </div>
);

const markdownComponents: Components = {
  pre: MarkdownPre as Components['pre'],
  table: MarkdownTable as Components['table']
};

interface ChatSegmentViewProps {
  segment: ChatSegment;
  index: number;
  onReRun: (text: string) => void;
  // The agent run is still alive. A tool block at the very end of the log has
  // no closing content yet, so only a live run can mean "this tool is still
  // running" - a restored chat or a finished run must show it as done.
  sessionActive?: boolean;
}

const ChatSegmentView: React.FC<ChatSegmentViewProps> = ({ segment, index, onReRun, sessionActive }) => {
  const [copied, setCopied] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);

  const isUser = segment.type === 'user';
  const plainText = useMemo(() => (segment.type === 'user' || segment.type === 'assistant' ? segment.content : ''), [segment]);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(plainText);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [plainText]);

  if (segment.type === 'notice') {
    return (
      <div className="chat-notice" key={index}>
        {segment.content}
      </div>
    );
  }

  if (segment.type === 'tool') {
    // `finished` is set by the parser when other log content closed the block;
    // a block that is still the tail of the log is only running while the run
    // itself is alive.
    const isRunning = !segment.finished && !!sessionActive;
    return (
      <div className="tool-block" key={index}>
        <button
          type="button"
          className="tool-block-header"
          onClick={() => setToolOpen(prev => !prev)}
          aria-expanded={toolOpen}
          title={segment.details ? 'Show tool details' : 'No details (enable llama-vscode.tools_log_calls)'}
        >
          {toolOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
          <WrenchIcon />
          <span className="tool-block-name">{segment.name}</span>
          <span className="tool-block-state">{isRunning ? 'running' : 'done'}</span>
        </button>
        {toolOpen && segment.details && (
          <pre className="tool-block-details">{segment.details}</pre>
        )}
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="message-row user" key={index}>
        <div className="user-message-bubble">
          <ReactMarkdown
            className="markdown-content-inner"
            remarkPlugins={[remarkGfm]}
            urlTransform={markdownUrlTransform}
          >
            {segment.content}
          </ReactMarkdown>
          <div className="msg-actions">
            <button
              type="button"
              className="msg-action"
              onClick={handleCopy}
              title="Copy message"
              aria-label="Copy message"
            >
              <CopyIcon />
            </button>
            {onReRun && (
              <button
                type="button"
                className="msg-action"
                onClick={() => onReRun(segment.content)}
                title="Put this prompt back in the composer"
                aria-label="Put this prompt back in the composer"
              >
                <RetryIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-row assistant" key={index}>
      <div className="markdown-content-inner assistant">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={markdownUrlTransform}
          components={markdownComponents}
        >
          {segment.content}
        </ReactMarkdown>
      </div>
      {plainText.trim().length > 0 && (
        <div className="msg-actions">
          <button
            type="button"
            className="msg-action"
            onClick={handleCopy}
            title="Copy answer"
            aria-label="Copy answer"
          >
            <CopyIcon />
          </button>
        </div>
      )}
    </div>
  );
};

// Only the last segment changes while streaming; everything before it keeps
// its props identity, so this memo skips the expensive markdown re-render.
// `index` and `onReRun` are intentionally ignored: `onReRun` is a stable
// callback and the index is only used for React keys by the parent.
const areEqual = (prev: ChatSegmentViewProps, next: ChatSegmentViewProps) => {
  if (prev.sessionActive !== next.sessionActive) return false;
  const a = prev.segment;
  const b = next.segment;
  if (a.type !== b.type) return false;
  if (a.type === 'tool' && b.type === 'tool') {
    return a.name === b.name && a.details === b.details && a.finished === b.finished;
  }
  return (a as { content: string }).content === (b as { content: string }).content;
};

export default React.memo(ChatSegmentView, areEqual);
