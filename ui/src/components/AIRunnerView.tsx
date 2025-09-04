import React from 'react';
import { vscode } from '../types/vscode';

interface AIRunnerViewProps {
  currentChatModel: string;
}

const AIRunnerView: React.FC<AIRunnerViewProps> = ({ currentChatModel }) => {
  const handleInstallLlamacpp = () => {
    vscode.postMessage({
      command: 'installLlamacpp'
    });
  };

  const handleAddHuggingfaceModel = () => {
    vscode.postMessage({
      command: 'addHuggingfaceModel'
    });
  };

  const handleSelectChatModel = () => {
    vscode.postMessage({
      command: 'selectModelForChat'
    });
  };

  const handleChatWithAI = () => {
    vscode.postMessage({
      command: 'chatWithAI'
    });
  };

  return (
    <div className="llm-buttons">
      <div className="single-button-frame">
        <div className="frame-label">Local AI Runner</div>
        <button
          onClick={handleInstallLlamacpp}
          className="modern-btn secondary"
          title="Install/Upgrade llama.cpp"
        >
          llama.cpp
        </button>
        <button
          onClick={handleAddHuggingfaceModel}
          title="Add Huggingface Model"
          className="modern-btn secondary"
        >
          Add
        </button>
        <button
          onClick={handleSelectChatModel}
          title={`Selected: ${currentChatModel}`}
          className="modern-btn secondary"
        >
          Select
        </button>
        <button
          onClick={handleChatWithAI}
          title="Chat With AI"
          className="modern-btn secondary"
        >
          Chat
        </button>
      </div>
    </div>
  );
};

export default AIRunnerView;
