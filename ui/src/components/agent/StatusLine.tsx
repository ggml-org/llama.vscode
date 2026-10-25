import React from 'react';
import { formatFullNumber, formatPrice, formatTokens } from '../../utils/formatNumber';
import { RequestStats } from '../../hooks/useExtensionMessages';

export type AgentStatusKind = 'idle' | 'working' | 'stopping' | 'error' | 'done';

interface StatusLineProps {
  stateText: string;
  isWorking: boolean;
  // A stop is pending: the dot keeps pulsing, the text says what is happening.
  stopRequested?: boolean;
  stats: RequestStats;
}

// Maps the free-form state text produced by `setAgentState(...)` in
// llama-agent.ts to a signal colour. The `isWorking` flag comes from the
// extension (LlamaAgent.isAgentInProgress), so only the error/done wording is
// matched here.
export const getStatusKind = (stateText: string, isWorking: boolean, stopRequested: boolean = false): AgentStatusKind => {
  if (stopRequested) return 'stopping';
  if (isWorking) return 'working';
  const text = (stateText || '').toLowerCase();
  if (!text) return 'idle';
  if (text.includes('error') || text.includes('exceeded') || text.includes('not responding')) return 'error';
  if (text.includes('finished') || text.includes('completed')) return 'done';
  return 'idle';
};

const tooltipForRequest = (stats: RequestStats): string =>
  `Last request: ${formatFullNumber(stats.lastRequestTokens)} tokens ` +
  `(input ${formatFullNumber(stats.lastRequestInputTokens)}, ` +
  `cached ${formatFullNumber(stats.lastRequestCachedTokens)}, ` +
  `output ${formatFullNumber(stats.lastRequestOutputTokens)}). ` +
  `Price works only for openrouter and orcarouter; not finished/stopped requests are not included but are taxed.`;

const tooltipForChat = (stats: RequestStats): string =>
  `Chat total: ${formatFullNumber(stats.chatTotalTokens)} tokens ` +
  `(input ${formatFullNumber(stats.chatInputTokens)}, ` +
  `cached ${formatFullNumber(stats.chatCachedTokens)}, ` +
  `output ${formatFullNumber(stats.chatOutputTokens)}). ` +
  `Price works only for openrouter and orcarouter; not finished/stopped requests are not included but are taxed.`;

const StatusLine: React.FC<StatusLineProps> = ({ stateText, isWorking, stopRequested = false, stats }) => {
  const kind = getStatusKind(stateText, isWorking, stopRequested);
  const requestPrice = formatPrice(stats.lastRequestPrice);
  const chatPrice = formatPrice(stats.chatPrice);

  return (
    <div className="status-line" role="status" title={stateText || 'Ready'}>
      <span className={`status-indicator ${kind}`} aria-hidden="true" />
      <span className="status-text">{stateText || 'Ready'}</span>
      {(stats.lastRequestTokens > 0 || stats.chatTotalTokens > 0) && (
        <span className="status-metrics">
          {stats.lastRequestTokens > 0 && (
            <span className="metric" title={tooltipForRequest(stats)}>
              {formatTokens(stats.lastRequestTokens)}
              {requestPrice && <span className="metric-price"> · {requestPrice}</span>}
            </span>
          )}
          {stats.lastRequestTokens > 0 && stats.chatTotalTokens > 0 && (
            <span className="metric-sep" aria-hidden="true">·</span>
          )}
          {stats.chatTotalTokens > 0 && (
            <span className="metric" title={tooltipForChat(stats)}>
              Σ {formatTokens(stats.chatTotalTokens)}
              {chatPrice && <span className="metric-price"> · {chatPrice}</span>}
            </span>
          )}
        </span>
      )}
    </div>
  );
};

export default StatusLine;
