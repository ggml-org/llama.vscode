// Chat log parsing for the agent view.
//
// The extension builds the log as plain text (see llama-agent.ts):
//   - user messages are wrapped in ***...*** markers
//   - the assistant streams raw markdown
//   - tool activity is appended as `tool: <name>`, then the tool description,
//     then (only when `llama-vscode.tools_log_calls` is enabled) an
//     `arguments: {...}` section and a `result:  \n...` section
//   - after every iteration `Total iterations: N` and, at the end,
//     `Finish reason: ...` are appended
//
// Those bookkeeping lines are glued to the answer with a two-space hard break
// and no blank line in front, so they must be pulled out of the markdown
// wherever they appear - otherwise markdown renders them as text of the answer
// (or as `<br/>` inside its last list item). See pushMarkdown.
//
// A tool call has no explicit "finished" marker: the log only keeps growing, so
// a block is finished once something else follows it (the next iteration, the
// next tool call, or the answer written after the tool returned). Only a block
// that is still the tail of the log can be running.
//
// Splitting that into typed segments lets the UI render user bubbles, markdown,
// collapsed tool blocks and small bookkeeping notices instead of one blob.

export type ChatSegment =
  | { type: 'user'; content: string }
  | { type: 'assistant'; content: string }
  | { type: 'tool'; name: string; details: string; finished: boolean }
  | { type: 'notice'; content: string };

// The extension appends these characters while it waits for the model to start
// answering (see AGENT_WAITING_MARKER in src/llama-agent.ts). They are never a
// real message: the UI turns them into an animated "waiting" row and drops them
// from the log, so a restored chat never shows them.
export const WAITING_MARKER = '\u00b7';
const WAITING_ONLY_REGEX = /^[\u00b7\u2022\s]+$/;

/** True when the log holds nothing but "still waiting for the model" markers. */
export const isWaitingOnly = (text: string): boolean =>
  text.length > 0 && WAITING_ONLY_REGEX.test(text);

/** True when the log still ends with waiting markers (the model has not spoken yet). */
export const endsWithWaitingMarker = (text: string): boolean =>
  /[\u00b7\u2022][ .]*$/.test(text);

// User messages are wrapped in ***...*** by the extension (llama-agent.ts).
// The opening marker always starts at a line boundary and the closing marker
// is always followed by a newline, so anchor the match to line boundaries to
// avoid treating `***bold italic***` inside AI responses as a user message.
const USER_MESSAGE_REGEX = /(^|\n)\*\*\*([\s\S]*?)\*\*\*(?=\n|$)/g;

// A tool call block starts on its own line with `tool: ` (the extension adds
// two leading spaces, so allow surrounding whitespace).
const TOOL_START_REGEX = /^[ \t]*tool:[ \t]*([^\r\n]+?)[ \t]*$/;
// Sections logged after the tool description.
const SECTION_REGEX = /^[ \t]*(arguments|result):/;
const RESULT_SECTION_REGEX = /^[ \t]*result:/;
// Machine bookkeeping the extension appends between iterations. It stays in the
// log (and in restored chats) but must not compete with the answer.
const META_LINE_REGEX =
  /^[ \t]*(Total iterations:|Finish reason:|Warning: response was truncated|Prompt tokens:|No response from AI|Error: )/;

const isBlank = (line: string) => line.trim() === '';
const isIndented = (line: string) => /^[ \t]/.test(line);
const isFence = (line: string) => /^[ \t]*(```|~~~)/.test(line);
// A line holding nothing but waiting markers must not reach the markdown renderer.
const isWaitingLine = (line: string) => line.trim().length > 0 && WAITING_ONLY_REGEX.test(line);

// Removes the waiting markers from a line WITHOUT dropping the line: an empty
// result means the line only carried markers, and dropping those lines would
// break the blank-line based tool block structure. A surviving line is returned
// trimmed on the right, which is where the markers are appended.
const stripWaitingMarkers = (line: string): string =>
  line.includes(WAITING_MARKER) ? line.replace(/[\u00b7\u2022]+[ .]*/g, '').replace(/\s+$/, '') : line;

const splitUserSegments = (text: string): { type: 'user' | 'assistant'; content: string }[] => {
  const segments: { type: 'user' | 'assistant'; content: string }[] = [];
  USER_MESSAGE_REGEX.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = USER_MESSAGE_REGEX.exec(text)) !== null) {
    // Keep the leading newline (match[1]) attached to the preceding text.
    if (match.index > lastIndex) {
      segments.push({ type: 'assistant', content: text.slice(lastIndex, match.index) + (match[1] || '') });
    } else {
      segments.push({ type: 'assistant', content: match[1] || '' });
    }
    segments.push({ type: 'user', content: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'assistant', content: text.slice(lastIndex) });
  }
  return segments;
};

// Emits a markdown chunk and pulls the machine bookkeeping lines out of it so
// they render as small notices instead of markdown prose.
//
// The extension appends its bookkeeping right after the answer, with no blank
// line in front (`"...answer  \nTotal iterations: N  \n"`), so such a line ends
// up glued to the last line of the answer - inside a paragraph, or even inside
// a list item, where markdown only turns it into a `<br/>`. Peeling the chunk
// edges is not enough either: a following `Finish reason:` / `Files changes:`
// section keeps the iteration line away from the chunk end. Bookkeeping lines
// are therefore extracted wherever they appear (a fenced code block is the one
// exception - there such a line is sample content). Everything else keeps its
// blank-line structure, so the renderer still receives whole paragraphs.
const pushMarkdown = (segments: ChatSegment[], rawLines: string[]) => {
  // Drop marker-only lines (they would become stray "·" lines) and strip
  // inline markers from the rest; the text is otherwise left untouched, so
  // paragraph spacing for the markdown renderer is preserved.
  const lines: string[] = [];
  for (const raw of rawLines) {
    if (isWaitingLine(raw)) continue;
    lines.push(stripWaitingMarkers(raw));
  }

  let body: string[] = [];
  let notices: string[] = [];
  // Trailing spaces of the line inside a fence are code, never a hard break.
  let lastBodyLineIsCode = false;
  let insideFence = false;
  // The extension always glues its bookkeeping to the line before it with a
  // two-space hard break (or puts it after a blank line), so that is what tells
  // a bookkeeping line apart from the model writing a line that merely starts
  // with the same words (e.g. quoting `Error: ...` from a build).
  const followsBookkeepingBreak = (prev: string | null): boolean =>
    prev === null || isBlank(prev) || META_LINE_REGEX.test(prev) || /[ \t]{2}$/.test(prev);
  let prevLine: string | null = null;

  const flushNotices = () => {
    if (notices.length === 0) return;
    segments.push({ type: 'notice', content: notices.join('\n') });
    notices = [];
  };

  const flushBody = () => {
    // Blank lines next to a bookkeeping notice only separate it from the
    // answer, so they are dropped instead of moving to the segment edges.
    let start = 0;
    let end = body.length - 1;
    while (start <= end && isBlank(body[start])) start++;
    while (end >= start && isBlank(body[end])) end--;
    if (end >= start && !lastBodyLineIsCode) {
      // The bookkeeping line was glued to this line with a markdown hard break
      // ("  \n"); trim it so the answer does not end with an empty <br/>.
      body[end] = body[end].replace(/[ \t]+$/, '');
    }
    const content = body.slice(start, end + 1);
    body = [];
    if (content.join('\n').trim().length === 0) return;
    segments.push({ type: 'assistant', content: content.join('\n') });
  };

  for (const line of lines) {
    const prev = prevLine;
    prevLine = line;
    if (isFence(line)) {
      flushNotices();
      body.push(line);
      insideFence = !insideFence;
      lastBodyLineIsCode = false;
      continue;
    }
    if (!insideFence && META_LINE_REGEX.test(line) && followsBookkeepingBreak(prev)) {
      flushBody();
      notices.push(line.trim());
      continue;
    }
    if (!insideFence && isBlank(line) && notices.length > 0) {
      // A blank line ends a bookkeeping block: keep the next one separate.
      flushNotices();
      continue;
    }
    // Anything else belongs to the answer, so emit pending notices first to
    // keep the original order.
    flushNotices();
    body.push(line);
    lastBodyLineIsCode = insideFence;
  }

  flushBody();
  flushNotices();
};

/**
 * Splits an assistant chunk into markdown, tool-call blocks and notices.
 *
 * A tool block starts at `tool: <name>` and swallows the whole tool description
 * paragraph (which may span several lines - a shell command with heredocs or
 * `&&` chains does) plus any `arguments:` / `result:` payload. It ends at a
 * bookkeeping line or at the first paragraph of prose the model writes
 * afterwards (an unindented, non-empty line outside a section).
 */
const splitToolBlocks = (content: string, isLastChunk: boolean): ChatSegment[] => {
  if (!content || content.indexOf('tool:') === -1) {
    if (!content) return [];
    const segments: ChatSegment[] = [];
    pushMarkdown(segments, content.split('\n'));
    return segments;
  }

  const segments: ChatSegment[] = [];
  let markdown: string[] = [];
  let tool: { name: string; details: string[]; hasResultSection: boolean } | null = null;
  // Set right after a `tool:` line: the description the extension logs there is
  // plain prose that belongs to the block. It is a whole PARAGRAPH, not a single
  // line - the command of run_terminal_command often spans several lines
  // (heredocs, `&&` chains, multi-line scripts) - and the extension always ends
  // it with a blank line. Without treating the whole paragraph as part of the
  // block, every continuation line of a multi-line command ended the block and
  // was rendered as markdown of the answer, outside the tool call box.
  let inDescription = false;
  // True while inside an `arguments:` / `result:` payload section. The payload
  // stays in the block regardless of its indentation.
  let inSection = false;
  // Decided once per paragraph: the first line decides whether the whole
  // paragraph is markdown (ends the tool block) or part of the tool output.
  let paragraphIsMarkdown: boolean | null = null;
  // Tracks ``` fences so a `tool:` line inside a code block stays markdown.
  let insideFence = false;

  const flushMarkdown = () => {
    pushMarkdown(segments, markdown);
    markdown = [];
  };

  // `closedByFollowingContent` is true for every flush inside the line loop,
  // because those are triggered by a line that belongs to something else (a
  // bookkeeping notice, the next tool call or the answer the model wrote after
  // the tool returned). Only the final flush after the loop can leave the block
  // as the tail of the log, which is exactly the "tool still running" state.
  const flushTool = (closedByFollowingContent: boolean) => {
    if (!tool) return;
    segments.push({
      type: 'tool',
      name: tool.name,
      details: tool.details.join('\n').trim(),
      // The `result:` section is only logged when llama-vscode.tools_log_calls
      // is enabled, so it cannot be the only "is it done" signal - otherwise a
      // tool call stays "running" forever with the default settings.
      finished: tool.hasResultSection || closedByFollowingContent
    });
    tool = null;
    inDescription = false;
    inSection = false;
    paragraphIsMarkdown = null;
  };

  for (const rawLine of content.split('\n')) {
    // Marker-only lines are removed and inline markers stripped, but the line
    // itself is kept so the blank-line based block structure stays intact.
    const line = isWaitingLine(rawLine) ? '' : stripWaitingMarkers(rawLine);
    // ---- the tool description logged right after `tool:` ----
    // Handled before the fence tracking: a command description is literal text
    // (a heredoc may well contain ``` or ~~~), so its lines never open a
    // markdown code block.
    if (inDescription) {
      // Only a really empty line ends the description - that is the blank line
      // the extension appends after it. A whitespace-only line is an empty line
      // INSIDE the command; the extension keeps it blank-looking but non-empty
      // precisely so it cannot be mistaken for the terminator.
      const endsDescription =
        (isBlank(line) && !isIndented(line)) ||
        META_LINE_REGEX.test(line) ||
        SECTION_REGEX.test(line);
      if (endsDescription) {
        // The description is over; the line belongs to the generic handling
        // below (bookkeeping notice, `arguments:`/`result:` section, or the
        // paragraph separator), so fall through to it.
        inDescription = false;
      } else if (tool) {
        tool.details.push(line);
        continue;
      }
    }

    if (isFence(line)) {
      insideFence = !insideFence;
      if (tool && paragraphIsMarkdown !== true) tool.details.push(line);
      else markdown.push(line);
      continue;
    }

    if (insideFence) {
      if (tool && paragraphIsMarkdown !== true) tool.details.push(line);
      else markdown.push(line);
      continue;
    }

    // ---- outside a tool block ----
    if (!tool) {
      const start = TOOL_START_REGEX.exec(line);
      if (start) {
        flushMarkdown();
        tool = { name: start[1].trim(), details: [], hasResultSection: false };
        inDescription = true;
        continue;
      }
      markdown.push(line);
      continue;
    }

    // ---- inside a tool block ----
    // A further `tool:` line opens the next block (unless we are inside an
    // arguments/result payload, where it is just file content).
    if (!inSection) {
      const next = TOOL_START_REGEX.exec(line);
      if (next) {
        flushTool(true);
        tool = { name: next[1].trim(), details: [], hasResultSection: false };
        inDescription = true;
        continue;
      }
    }

    if (SECTION_REGEX.test(line)) {
      if (RESULT_SECTION_REGEX.test(line)) tool.hasResultSection = true;
      tool.details.push(line);
      inSection = true;
      paragraphIsMarkdown = false;
      continue;
    }

    if (inSection) {
      if (META_LINE_REGEX.test(line)) {
        // Bookkeeping after the payload ends both the section and the block.
        flushTool(true);
        markdown.push(line);
        continue;
      }
      tool.details.push(line);
      continue;
    }

    if (isBlank(line)) {
      // Paragraph separator: keep it, the next line decides where we are.
      tool.details.push(line);
      paragraphIsMarkdown = null;
      continue;
    }

    if (META_LINE_REGEX.test(line)) {
      flushTool(true);
      markdown.push(line);
      continue;
    }

    if (paragraphIsMarkdown === null) {
      paragraphIsMarkdown = !isIndented(line);
    }

    if (paragraphIsMarkdown) {
      flushTool(true);
      markdown.push(line);
    } else {
      tool.details.push(line);
    }
  }

  // The block at the tail of the log has not been closed by anything yet: the
  // tool call is still in flight (or the run ended right after it), so it must
  // keep showing "running". An in-session user message starts a new chunk, so a
  // trailing block in front of it was followed by content after all.
  flushTool(!isLastChunk);
  flushMarkdown();
  return segments;
};

export const parseChatSegments = (text: string): ChatSegment[] => {
  if (!text) return [];
  const segments: ChatSegment[] = [];
  const chunks = splitUserSegments(text);
  // Only the trailing assistant chunk can end with a still running tool call;
  // every other chunk is followed by a user message.
  const lastAssistantIndex = chunks.reduce((last, chunk, index) => (chunk.type === 'assistant' ? index : last), -1);
  chunks.forEach((chunk, index) => {
    if (chunk.type === 'user') {
      segments.push({ type: 'user', content: chunk.content });
    } else {
      segments.push(...splitToolBlocks(chunk.content, index === lastAssistantIndex));
    }
  });
  return segments;
};
