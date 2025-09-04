import React, { useState, useEffect } from 'react';
import { vscode } from '../types/vscode';

interface AddEnvViewProps {
  currentToolsModel: string;
  currentChatModel: string;
  currentEmbeddingsModel: string;
  currentCompletionModel: string;
  currentAgent: string;
  completionsEnabled?: boolean;
  ragEnabled?: boolean;
  autoStartEnv?: boolean;
}

const noModelSelected = 'No model selected';
const noAgentSelected = 'No agent selected';

const AddEnvView: React.FC<AddEnvViewProps> = ({
  currentToolsModel,
  currentChatModel,
  currentEmbeddingsModel,
  currentCompletionModel,
  currentAgent,
  completionsEnabled = false,
  ragEnabled = false,
  autoStartEnv = false
}) => {
  const [isCompletionsEnabled, setIsCompletionsEnabled] = useState(completionsEnabled);
  const [isRagEnabled, setIsRagEnabled] = useState(ragEnabled);
  const [isAutoStartEnv, setIsAutoStartEnv] = useState(autoStartEnv);

  // Get the VS Code setting on component mount
  useEffect(() => {
    // Delay to ensure webview is ready
    setTimeout(() => {
      vscode.postMessage({
        command: 'getVscodeSetting',
        key: 'enabled'
      });
    }, 1000);
    setTimeout(() => {
      vscode.postMessage({
        command: 'getVscodeSetting',
        key: 'rag_enabled'
      });
    }, 1000);
    setTimeout(() => {
      vscode.postMessage({
        command: 'getVscodeSetting',
        key: 'env_start_last_used'
      });
    }, 1000);
  }, []);

  // Listen for messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'vscodeSettingValue') {
        if (message.key === 'enabled') setIsCompletionsEnabled(message.value);
        else if (message.key === 'rag_enabled') setIsRagEnabled(message.value);
        else if (message.key === 'env_start_last_used') setIsAutoStartEnv(message.value);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSelectToolsModel = () => {
    vscode.postMessage({
      command: 'selectModelWithTools'
    });
  };

  const handleSelectChatModel = () => {
    vscode.postMessage({
      command: 'selectModelForChat'
    });
  };

  const handleSelectEmbModel = () => {
    vscode.postMessage({
      command: 'selectModelForEmbeddings'
    });
  };

  const handleSelectCompletionModel = () => {
    vscode.postMessage({
      command: 'selectModelForCompletion'
    });
  };

  const handleDeselectCompletionModel = () => {
    vscode.postMessage({
      command: 'deselectCompletionModel'
    });
  };

  const handleDeselectChatModel = () => {
    vscode.postMessage({
      command: 'deselectChatModel'
    });
  };

  const handleDeselectEmbsModel = () => {
    vscode.postMessage({
      command: 'deselectEmbsModel'
    });
  };

  const handleDeselectToolsModel = () => {
    vscode.postMessage({
      command: 'deselectToolsModel'
    });
  };

  const handleDeselectAgent = () => {
    vscode.postMessage({
      command: 'deselectAgent'
    });
  };

  const handleShowCompletionModel = () => {
    vscode.postMessage({
      command: 'showCompletionModel'
    });
  };

  const handleShowChatModel = () => {
    vscode.postMessage({
      command: 'showChatModel'
    });
  };

  const handleShowEmbsModel = () => {
    vscode.postMessage({
      command: 'showEmbsModel'
    });
  };

  const handleShowToolsModel = () => {
    vscode.postMessage({
      command: 'showToolsModel'
    });
  };

  const handleShowAgentModel = () => {
    vscode.postMessage({
      command: 'showAgentDetails'
    });
  };

  const handleSelectAgent = () => {
    vscode.postMessage({
      command: 'selectAgent'
    });
  }

  const handleAddEnv = () => {
    vscode.postMessage({
      command: 'addEnv'
    });
  };

  const handleToggleCompletionsEnabled = (enabled: boolean) => {
    setIsCompletionsEnabled(enabled);
    vscode.postMessage({
      command: 'toggleCompletionsEnabled',
      enabled
    });
  };

  const handleToggleRagEnabled = (enabled: boolean) => {
    setIsRagEnabled(enabled);
    vscode.postMessage({
      command: 'toggleRagEnabled',
      enabled
    });
  };

  const handleToggleAutoStartEnv = (enabled: boolean) => {
    setIsAutoStartEnv(enabled);
    vscode.postMessage({
      command: 'toggleAutoStartEnv',
      enabled
    });
  };

  return (
    <div>
          <div className="llm-buttons">
          <div className="single-button-frame">
            <div className="frame-label">Compl Model</div>
            {currentCompletionModel === noModelSelected  && (
            <button
              onClick={handleSelectCompletionModel}
              title={`Select/Start Completion Model`}
              className="modern-btn secondary"
            >
              Select
            </button>
            )}
            {currentCompletionModel != noModelSelected  && (
              <button
              onClick={handleDeselectCompletionModel}
              title={`Deselect/Stop Completion Model`}
              className="modern-btn secondary"
            >
            Deselect
            </button>
            )}
            <span className="model-text">{currentCompletionModel}</span>
            {currentCompletionModel != noModelSelected  && (
              <button
              onClick={handleShowCompletionModel}
              title={`Show Completion Model Details`}
              className="modern-btn secondary"
            >
            ...
            </button>
            )}
          </div>
      </div>
          <div className="llm-buttons">
          <div className="single-button-frame">
            <div className="frame-label">Chat Model</div>
            {currentChatModel === noModelSelected  && (
            <button
              onClick={handleSelectChatModel}
              title={`Select/Start Chat Model`}
              className="modern-btn secondary"
            >
              Select
            </button>
            )}
            {currentChatModel != noModelSelected  && (
              <button
              onClick={handleDeselectChatModel}
              title={`Deselect/Stop Chat Model`}
              className="modern-btn secondary"
            >
            Deselect
            </button>
            )}
            <span className="model-text">{currentChatModel}</span>
            {currentChatModel != noModelSelected  && (
              <button
              onClick={handleShowChatModel}
              title={`Show Chat Model Details`}
              className="modern-btn secondary"
            >
            ...
            </button>
            )}
          </div>
          </div>
          <div className="llm-buttons">
          <div className="single-button-frame">
            <div className="frame-label">Embs Model</div>
            {currentEmbeddingsModel === noModelSelected  && (
            <button
              onClick={handleSelectEmbModel}
              title={`Select/Start Embs Model`}
              className="modern-btn secondary"
            >
              Select
            </button>
            )}
            {currentEmbeddingsModel != noModelSelected  && (
              <button
              onClick={handleDeselectEmbsModel}
              title={`Deselect/Stop Embeddings Model`}
              className="modern-btn secondary"
            >
            Deselect
            </button>
            )}
            <span className="model-text">{currentEmbeddingsModel}</span>
            {currentEmbeddingsModel != noModelSelected  && (
              <button
              onClick={handleShowEmbsModel}
              title={`Show Embeddings Model Details`}
              className="modern-btn secondary"
            >
              ...
            </button>
            )}
          </div>
          </div>
          
      <div className="llm-buttons">
          <div className="single-button-frame">
            <div className="frame-label">Tools Model</div>
            {currentToolsModel === noModelSelected  && (
            <button
              onClick={handleSelectToolsModel}
              title={`Select/Start Tools Model (Selected: ${currentToolsModel})`}
              className="modern-btn secondary"
            >
              Select
            </button>
            )}
            {currentToolsModel != noModelSelected  && (
              <button
              onClick={handleDeselectToolsModel}
              title={`Deselect/Stop Tools Model`}
              className="modern-btn secondary"
            >
            Deselect
            </button>
            )}
            <span className="model-text">{currentToolsModel}</span>
            {currentToolsModel != noModelSelected  && (
              <button
              onClick={handleShowToolsModel}
              title={`Show Tools Model Details`}
              className="modern-btn secondary"
            >
              ...
            </button>
            )}
          </div>
          </div>
          <div className="llm-buttons">
          <div className="single-button-frame">
            <div className="frame-label">Agent</div>
            {currentAgent === noAgentSelected  && (
            <button
              onClick={handleSelectAgent}
              title={`Select Agent`}
              className="modern-btn secondary"
            >
              Select
            </button>
            )}
            {currentAgent != noAgentSelected  && (
              <button
              onClick={handleDeselectAgent}
              title={`Deselect/Stop Agent Model`}
              className="modern-btn secondary"
            >
            Deselect
            </button>
            )}
            <span className="model-text">{currentAgent}</span>
            {currentAgent != noAgentSelected  && (
              <button
              onClick={handleShowAgentModel}
              title={`Show Agent Details`}
              className="modern-btn secondary"
            >
              ...
            </button>
            )}
          </div>
          </div>
          <div className="llm-buttons">
            <div className="single-button-frame" style={{ display: 'block', alignItems: 'flex-start' }}>
              <div className="frame-label">Settings</div>
              <div style={{ marginBottom: '8px' }}>
                <label className="checkbox-label" title="Enable code completions">
                  <input
                    type="checkbox"
                    checked={isCompletionsEnabled}
                    onChange={(e) => handleToggleCompletionsEnabled(e.target.checked)}
                  />
                  <span style={{ marginLeft: '8px' }}>Completions Enabled</span>
                </label>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <label className="checkbox-label" title="Disable if you use only code completion feature. If enabled - indexes files on startup. Needed for search_source tool">
                  <input
                    type="checkbox"
                    checked={isRagEnabled}
                    onChange={(e) => handleToggleRagEnabled(e.target.checked)}
                  />
                  <span style={{ marginLeft: '8px' }}>RAG Enabled</span>
                </label>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <label className="checkbox-label" title="If enabled - starts the last selected Env on startup of VS Code">
                  <input
                    type="checkbox"
                    checked={isAutoStartEnv}
                    onChange={(e) => handleToggleAutoStartEnv(e.target.checked)}
                  />
                  <span style={{ marginLeft: '8px' }}>Auto Start Env</span>
                </label>
              </div>
            </div>
          </div>
      <button
        onClick={handleAddEnv}
        title={`Create a new env with the selected models, agent and settings.`}
        className="modern-btn secondary"
        style={{ marginTop: '10px', marginLeft: '10px', padding: '8px 16px' }}
      >
        Save As New Env
      </button>
    </div>
  );
};

export default AddEnvView;
