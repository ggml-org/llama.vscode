import React, { useState, useEffect } from 'react';
import { AgentView, AIRunnerView, AddEnvView } from './components';
import { vscode } from './types/vscode';

interface AppProps { }

const App: React.FC<AppProps> = () => {
  const noEnvSelected = 'No env selected';
  const noModelSelected = 'No model selected';
  const noAgentSelected = 'No agent selected';
  const noViewSet = 'agent';
  const viewAiRunner = "airunner"
  const viewAddEnv = "addenv"
  
  // Initialize state from VS Code's persisted state or defaults
  const initialState = vscode.getState() || {};
  const [displayText, setDisplayText] = useState<string>(
    initialState.displayText || ''
  );
  const [inputText, setInputText] = useState<string>(
    initialState.inputText || ''
  );
  const [currentToolsModel, setCurrentToolsModel] = useState<string>(
    initialState.currentToolsModel || noModelSelected
  );
  const [currentChatModel, setCurrentChatModel] = useState<string>(
    initialState.currentChatModel || noModelSelected
  );
  const [currentEmbeddingsModel, setCurrentEmbeddingsModel] = useState<string>(
    initialState.currentEmbeddingsModel || noModelSelected
  );
  const [currentCompletionModel, setCurrentCompletionModel] = useState<string>(
    initialState.currentCompletionModel || noModelSelected
  );
  const [currentAgent, setCurrentAgent] = useState<string>(
    initialState.currentAgent || noAgentSelected
  );
  const [currentEnv, setCurrentEnv] = useState<string>(
    initialState.currentEnv || noEnvSelected
  );
  const [currentState, setCurrentState] = useState<string>(
    initialState.currentState || ''
  );
  const [view, setView] = useState<string>(
    initialState.view || noViewSet
  );
  const [contextFiles, setContextFiles] = useState<Map<string, string>>(new Map());

  // Save state to VS Code whenever it changes
  useEffect(() => {
    vscode.setState({
      displayText,
      inputText,
      currentToolsModel,
      currentChatModel,
      currentEmbeddingsModel,
      currentCompletionModel,
      currentAgent,
      currentEnv: currentEnv,
      currentState,
      view
    });
  }, [displayText, inputText, currentToolsModel, currentChatModel, currentEmbeddingsModel, currentCompletionModel, currentAgent, currentEnv, currentState, view]);

  useEffect(() => {
    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'updateToolsModel':
          setCurrentToolsModel(message.model || noModelSelected);
          break;
        case 'updateChatModel':
          setCurrentChatModel(message.model || noModelSelected);
          break;
        case 'updateEmbeddingsModel':
          setCurrentEmbeddingsModel(message.model || noModelSelected);
          break;
        case 'updateCompletionModel':
          setCurrentCompletionModel(message.model || noModelSelected);
          break;
        case 'updateAgent':
          setCurrentAgent(message.agent || noAgentSelected);
          break;
        case 'updateEnv':
          setCurrentEnv(message.model || noEnvSelected);
          break;
        case 'updateView':
          setView(message.text || noViewSet);
          break;
        case 'updateContextFiles':
          setContextFiles(new Map(message.files || []));
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSelectEnv = () => {
    vscode.postMessage({
      command: 'selectEnv'
    });
  };

  const handleStopEnv = () => {
    vscode.postMessage({
      command: 'stopEnv'
    });
  };

  const handleShowAddEnvView = () => {
    vscode.postMessage({
      command: 'showEnvView'
    });
  };

  const handleShowAgentView = () => {
    vscode.postMessage({
      command: 'showAgentView'
    });
  };
  

  const handleSelectedModels = () => {
    vscode.postMessage({
      command: 'showSelectedModels'
    });
  };

  return (
    <div className="app">
      <div className="header">
            <div className="header-content">
              <div className="header-actions">
                  <div>
                    <button
                      onClick={handleSelectEnv}
                      title={`Select/Start Env (Selected: ${currentEnv})`}
                      className="modern-btn secondary"
                    >
                      Select Env
                    </button>
                  </div>
                  <button
                    onClick={handleStopEnv}
                    title={`Deselect the environment and stop the local models`}
                    className="modern-btn secondary"
                  >
                    Deselect Env
                  </button>
                  <button
                    onClick={handleShowAddEnvView}
                    className="header-btn secondary"
                    title="Show Current Environment"
                  >
                    {"\u{1F310}\uFE0E"}
                  </button>
                  <button
                    onClick={handleShowAgentView}
                    className="header-btn secondary"
                    title="Show Llama Agent"
                  >
                    {"💬"}
                  </button>
              </div>
            </div>
          </div>
      {view === noViewSet && (
        <div>
          {/* Environment Selection Header for Agent View */}
          

          <AgentView
            displayText={displayText}
            setDisplayText={setDisplayText}
            inputText={inputText}
            setInputText={setInputText}
            currentToolsModel={currentToolsModel}
            currentAgent={currentAgent}
            currentState={currentState}
            setCurrentState={setCurrentState}
            contextFiles={contextFiles}
            setContextFiles={setContextFiles}
          />
        </div>
      )}
      
      {view === viewAiRunner && (
        <div className="content">
          <AIRunnerView currentChatModel={currentChatModel} />
        </div>
      )}
      
      {view === viewAddEnv && (
        <div className="content">
          <AddEnvView
            currentToolsModel={currentToolsModel}
            currentChatModel={currentChatModel}
            currentEmbeddingsModel={currentEmbeddingsModel}
            currentCompletionModel={currentCompletionModel}
            currentAgent={currentAgent}
          />
        </div>
      )}
    </div>
  );
};

export default App; 