import React, { useState, useEffect, useRef } from 'react';
import { vscode } from '../types/vscode';

interface AgentCommandEditDetails {
  name: string;
  description: string;
  prompt: string;
  noPrompt: boolean;
  isScript: boolean;
  executePeriodically: boolean;
  startTime: string;
  period: string;
  totalExecutionTimes: string;
}

const emptyDetails: AgentCommandEditDetails = {
  name: "",
  description: "",
  prompt: "",
  noPrompt: false,
  isScript: false,
  executePeriodically: false,
  startTime: "",
  period: "",
  totalExecutionTimes: ""
};

// Convert a total number of seconds into its Days/Hours/Minutes/Seconds parts.
const secondsToParts = (totalSeconds: number): { days: number; hours: number; minutes: number; seconds: number } => {
  const total = Math.max(0, Math.floor(totalSeconds));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
};

// Convert Days/Hours/Minutes/Seconds parts into a total number of seconds.
const partsToSeconds = (days: number, hours: number, minutes: number, seconds: number): number => {
  return (Math.max(0, Math.floor(days)) * 86400) +
         (Math.max(0, Math.floor(hours)) * 3600) +
         (Math.max(0, Math.floor(minutes)) * 60) +
         Math.max(0, Math.floor(seconds));
};

// ISO datetime string -> value for an <input type="datetime-local"> (e.g. "2025-01-01T09:00:00").
const isoToLocalInputValue = (iso: string): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// value from an <input type="datetime-local"> (e.g. "2025-01-01T09:00") -> ISO datetime string.
const localInputValueToIso = (value: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toISOString();
};

// Parse a user-entered period part value (empty or non-numeric -> 0).
const parsePartValue = (value: string): number => {
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : Math.max(0, n);
};

// The Days/Hours/Minutes/Seconds input fields used to edit the period.
const PERIOD_PART_FIELDS = [
  { key: 'days', label: 'Days', title: 'Days (24 hours)' },
  { key: 'hours', label: 'Hours', title: 'Hours' },
  { key: 'minutes', label: 'Minutes', title: 'Minutes' },
  { key: 'seconds', label: 'Seconds', title: 'Seconds' }
] as const;

const AgentCommandEditor: React.FC = () => {
  const [agentCommandEditDetails, setAgentCommandEditDetails] = useState<AgentCommandEditDetails>(emptyDetails);
  const [periodParts, setPeriodParts] = useState<{ days: string; hours: string; minutes: string; seconds: string }>({
    days: "",
    hours: "",
    minutes: "",
    seconds: ""
  });

  // Refs
  const elemNameRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the name textarea when the component mounts
  useEffect(() => {
    if (elemNameRef.current) {
      elemNameRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('Received message from extension:', message);
      switch (message.command) {
        case 'loadAgentCommand':
          setAgentCommandEditDetails({
            name: message.name ?? "",
            description: message.description ?? "",
            prompt: message.prompt ?? "",
            noPrompt: Boolean(message.noPrompt),
            isScript: Boolean(message.isScript),
            executePeriodically: Boolean(message.executePeriodically),
            startTime: message.startTime ?? "",
            period: message.period !== undefined && message.period !== null ? String(message.period) : "",
            totalExecutionTimes: message.totalExecutionTimes !== undefined && message.totalExecutionTimes !== null ? String(message.totalExecutionTimes) : ""
          });
          // Sync the Days/Hours/Minutes/Seconds inputs with the loaded period.
          setPeriodParts((() => {
            const loadedPeriod = message.period !== undefined && message.period !== null ? Number(message.period) : 0;
            const loadedTotal = !isNaN(loadedPeriod) && loadedPeriod > 0 ? Math.floor(loadedPeriod) : 0;
            if (loadedTotal <= 0) return { days: "", hours: "", minutes: "", seconds: "" };
            const p = secondsToParts(loadedTotal);
            return { days: String(p.days), hours: String(p.hours), minutes: String(p.minutes), seconds: String(p.seconds) };
          })());
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updateDetails = (patch: Partial<AgentCommandEditDetails>) => {
    setAgentCommandEditDetails(prev => ({ ...prev, ...patch }));
  };

  const handlePeriodPartChange = (part: keyof typeof periodParts, value: string) => {
    const nextParts = { ...periodParts, [part]: value };
    setPeriodParts(nextParts);
    const total = partsToSeconds(
      parsePartValue(nextParts.days),
      parsePartValue(nextParts.hours),
      parsePartValue(nextParts.minutes),
      parsePartValue(nextParts.seconds)
    );
    updateDetails({ period: total > 0 ? String(total) : "" });
  };

  const totalPeriodSeconds = partsToSeconds(
    parsePartValue(periodParts.days),
    parsePartValue(periodParts.hours),
    parsePartValue(periodParts.minutes),
    parsePartValue(periodParts.seconds)
  );

  const handleSaveAgentCommand = () => {
    vscode.postMessage({
      command: 'saveEditAgentCommand',
      name: agentCommandEditDetails.name,
      description: agentCommandEditDetails.description,
      prompt: agentCommandEditDetails.prompt,
      noPrompt: agentCommandEditDetails.noPrompt,
      isScript: agentCommandEditDetails.isScript,
      executePeriodically: agentCommandEditDetails.executePeriodically,
      startTime: agentCommandEditDetails.startTime,
      period: agentCommandEditDetails.period,
      totalExecutionTimes: agentCommandEditDetails.totalExecutionTimes
    });
  };

  const handleSelectEditAgentCommand = () => {
    vscode.postMessage({
      command: 'selectEditAgentCommand'
    });
  };

  const handleNewAgentCommand = () => {
    setAgentCommandEditDetails(emptyDetails);
    setPeriodParts({ days: "", hours: "", minutes: "", seconds: "" });
    vscode.postMessage({
      command: 'addEditAgentCommand',
      name: "",
      description: "",
      prompt: "",
      noPrompt: false,
      isScript: false,
      executePeriodically: false,
      startTime: "",
      period: "",
      totalExecutionTimes: ""
    });
  };

  const handleCopyAgentCommand = () => {
    vscode.postMessage({
      command: 'copyAsNewAgentCommand',
      commandName: agentCommandEditDetails.name
    });
  };

  const handleDeleteAgentCommand = () => {
    vscode.postMessage({
      command: 'deleteEditAgentCommand',
      commandName: agentCommandEditDetails.name
    });
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="input-section" style={{ flexShrink: 0 }}>
          <div className="input-container">
            <h1 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold' }}>Agent Command Editor</h1>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button
                onClick={handleSelectEditAgentCommand}
                title="Select Agent Command to Edit"
                className="modern-btn secondary"
              >
                Select
              </button>
              <button
                onClick={handleNewAgentCommand}
                title="New Agent Command"
                className="modern-btn secondary"
              >
                New
              </button>
              <button
                onClick={handleCopyAgentCommand}
                title="Copy Existing Agent Command as New"
                className="modern-btn secondary"
              >
                Copy as New
              </button>
              <button
                onClick={handleDeleteAgentCommand}
                title="Select and Delete Existing Agent Command"
                className="modern-btn secondary"
              >
                Delete
              </button>
            </div>

            <span style={{ display: 'block', marginTop: '20px', marginBottom: '10px', fontWeight: 'bold' }}>{'Name (agent command identifier)'}</span>
            <textarea
              ref={elemNameRef}
              value={agentCommandEditDetails.name}
              onChange={(e) => updateDetails({ name: e.target.value })}
              placeholder="Enter agent command name."
              className="modern-textarea"
              rows={1}
              style={{ height: 'auto', minHeight: '1.5em', resize: 'none' }}
            />

            <span style={{ display: 'block', marginTop: '20px', marginBottom: '10px', fontWeight: 'bold' }}>{'Description'}</span>
            <textarea
              value={agentCommandEditDetails.description}
              onChange={(e) => updateDetails({ description: e.target.value })}
              placeholder="Enter agent command description."
              className="modern-textarea"
              rows={2}
              style={{ height: 'auto', minHeight: '3em', resize: 'none' }}
            />

            <span style={{ display: 'block', marginTop: '20px', marginBottom: '10px', fontWeight: 'bold' }}>{'Prompt/Script'}</span>
            <textarea
              value={agentCommandEditDetails.prompt}
              onChange={(e) => updateDetails({ prompt: e.target.value })}
              placeholder="Enter the prompt for the agent."
              className="modern-textarea"
              rows={8}
              style={{ height: 'auto', minHeight: '12em', resize: 'vertical' }}
            />

            <div style={{ marginBottom: '10px', marginTop: '10px' }}>
              <label className="checkbox-label" title="If enabled, the command does not send a prompt to the agent - for example it just sets a model or a setting.">
                <input
                  type="checkbox"
                  checked={agentCommandEditDetails.noPrompt}
                  onChange={(e) => updateDetails({ noPrompt: e.target.checked })}
                />
                <span style={{ marginLeft: '8px' }}>No prompt to the agent</span>
              </label>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label className="checkbox-label" title="If enabled, the prompt field content is interpreted as a script.">
                <input
                  type="checkbox"
                  checked={agentCommandEditDetails.isScript}
                  onChange={(e) => updateDetails({ isScript: e.target.checked })}
                />
                <span style={{ marginLeft: '8px' }}>Is script</span>
              </label>
            </div>

            <span style={{ display: 'block', marginTop: '20px', marginBottom: '10px', fontWeight: 'bold' }}>{'Periodic Execution'}</span>
            <div style={{ marginBottom: '10px' }}>
              <label className="checkbox-label" title="If enabled, the command is executed periodically by the scheduler in background agent sessions.">
                <input
                  type="checkbox"
                  checked={agentCommandEditDetails.executePeriodically}
                  onChange={(e) => updateDetails({ executePeriodically: e.target.checked })}
                />
                <span style={{ marginLeft: '8px' }}>Execute periodically</span>
              </label>
            </div>
            {agentCommandEditDetails.executePeriodically && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Start Time (ISO datetime, optional)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="datetime-local"
                      step="1"
                      value={isoToLocalInputValue(agentCommandEditDetails.startTime)}
                      onChange={(e) => updateDetails({ startTime: localInputValueToIso(e.target.value) })}
                      title="Pick the date/time when the command should first run (empty = start immediately)"
                      className="modern-input"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => updateDetails({ startTime: "" })}
                      title="Clear start time (start immediately)"
                      className="modern-btn secondary"
                      style={{ padding: '6px 12px', fontSize: '13px', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      Clear
                    </button>
                  </div>
                  {agentCommandEditDetails.startTime && (
                    <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.7, fontFamily: 'SF Mono, Monaco, monospace' }}>
                      ISO: {agentCommandEditDetails.startTime}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Period (Days / Hours / Minutes / Seconds)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {PERIOD_PART_FIELDS.map((field) => (
                      <div key={field.key} style={{ flex: '1 1 70px', minWidth: '70px' }}>
                        <input
                          type="number"
                          min={0}
                          value={periodParts[field.key]}
                          onChange={(e) => handlePeriodPartChange(field.key, e.target.value)}
                          placeholder="0"
                          title={field.title}
                          className="modern-input"
                        />
                        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px', textAlign: 'center' }}>{field.label}</div>
                      </div>
                    ))}
                  </div>
                  {totalPeriodSeconds > 0 && (
                    <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.7 }}>
                      Total: {totalPeriodSeconds} seconds (empty = default 3600 seconds)
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Total Execution Times (empty = infinite, VS Code restart resets execution counters)
                  </label>
                  <input
                    type="number"
                    value={agentCommandEditDetails.totalExecutionTimes}
                    onChange={(e) => updateDetails({ totalExecutionTimes: e.target.value })}
                    placeholder="e.g. 10 (empty = infinite)"
                    className="modern-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            <div className="input-actions">
              <div className="input-buttons">
                <button
                  onClick={handleSaveAgentCommand}
                  className="modern-btn secondary"
                  title="Saves the agent command changes or creates a new agent command if the name does not exist."
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentCommandEditor;
