import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'

// Declare the vscode API
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
}

const vscode = window.acquireVsCodeApi();

interface AppProps { }

const App: React.FC<AppProps> = () => {
  const noEnvSelected = 'No env selected';
  const noModelSelected = 'No model selected';
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
  const [currentEnv, setCurrentEnv] = useState<string>(
    initialState.currentEnv || noEnvSelected
  );
  const [currentState, setCurrentState] = useState<string>(
    initialState.currentState || ''
  );
  const [view, setView] = useState<string>(
    initialState.view || noViewSet
  );
  const [showFileSelector, setShowFileSelector] = useState<boolean>(false);
  const [fileList, setFileList] = useState<string[]>([]);
  const [fileFilter, setFileFilter] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [contextFiles, setContextFiles] = useState<Map<string, string>>(new Map());


  // Create a ref for the textarea to enable auto-focus
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const markdownContainerRef = useRef<HTMLDivElement>(null);

  // Save state to VS Code whenever it changes
  useEffect(() => {
    vscode.setState({
      displayText,
      inputText,
      currentToolsModel,
      currentChatModel,
      currentEmbeddingsModel,
      currentCompletionModel,
      currentEnv: currentEnv,
      currentState,
      view
    });
  }, [displayText, inputText, currentToolsModel, currentChatModel, currentEmbeddingsModel, currentCompletionModel, currentEnv, currentState, view]);

  // Auto-focus the textarea when the component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Simple auto-scroll to bottom when displayText changes
  useEffect(() => {
    if (displayText) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        const markdownContent = document.querySelector('.markdown-content');
        if (markdownContent) {
          markdownContent.scrollTop = markdownContent.scrollHeight;
        }
      });
    }
  }, [displayText]);





  // Filter files based on user input
  const filteredFiles = fileList.filter(file =>
    file.toLowerCase().includes(fileFilter.toLowerCase())
  );

  // Reset selected index when file list or filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [fileList, fileFilter]);

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (showFileSelector && fileListRef.current && filteredFiles.length > 0) {
      const fileItems = fileListRef.current.querySelectorAll('.file-item');
      if (fileItems[selectedIndex]) {
        fileItems[selectedIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [selectedIndex, showFileSelector, filteredFiles.length]);

  useEffect(() => {
    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('Received message from extension:', message);
      switch (message.command) {
        case 'updateText':
          setDisplayText(message.text);
          break;
        case 'clearText':
          setDisplayText('');
          break;
        case 'focusTextarea':
          // Focus the textarea when requested by the extension
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
          break;
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
        case 'updateEnv':
          setCurrentEnv(message.model || noEnvSelected);
          break;
        case 'updateCurrentState':
          setCurrentState(message.text || '');
          break;
        case 'updateFileList':
          setFileList(message.files || []);
          setShowFileSelector(true);
          break;
        case 'updateContextFiles':
          setContextFiles(new Map(message.files || []));
          break;
        case 'updateView':
          setView(message.text || noViewSet);
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Function to focus the textarea (can be called from extension)
  const focusTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };



  // Expose the focus function to the extension
  useEffect(() => {
    // @ts-ignore - Adding to window for extension access
    window.focusTextarea = focusTextarea;
  }, []);

  const handleSendText = () => {
    if (inputText.trim()) {
      // Send text to the extension
      vscode.postMessage({
        command: 'sendText',
        text: inputText
      });
      setInputText('');
      setCurrentState('AI is working...');
    }
  };

  const handleAddSource = () => {
    console.log('@ button clicked - requesting file list');
    // For testing, let's also manually set some test files
    console.log('Current showFileSelector state:', showFileSelector);

    // Request file list from extension
    vscode.postMessage({
      command: 'getFileList'
    });
  };

  const handleConfigureTools = () => {
    // send command configure tools to extension
    vscode.postMessage({
      command: 'configureTools',
      text: inputText
    });
  };

  const handleStopSession = () => {
    // send command configure tools to extension
    setCurrentState('Session stop requested...');
    vscode.postMessage({
      command: 'stopSession',
      text: inputText
    });
  };

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

  const handleAddEnv = () => {
    vscode.postMessage({
      command: 'addEnv'
    });
  };

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

  const handleSelectedModels = () => {
    vscode.postMessage({
      command: 'showSelectedModels'
    });
  };


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

  const handleChatWithAI = () => {
    vscode.postMessage({
      command: 'chatWithAI'
    });
  };


  const handleClearText = () => {
    console.log('New Chat button clicked - clearing text');
    // Clear the display text locally
    setDisplayText('');
    // Also send command to extension to clear text
    vscode.postMessage({
      command: 'clearText'
    });
    console.log('Sent clearText command to extension');
  };

  const handleFileSelect = (fileLongName: string) => {
    // Send the selected file to the extension
    vscode.postMessage({
      command: 'addContextProjectFile',
      fileLongName: fileLongName
    });
    setShowFileSelector(false);
    setFileFilter('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleCancelFileSelect = () => {
    setShowFileSelector(false);
    setFileFilter('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleRemoveContextFile = (fileLongName: string) => {
    vscode.postMessage({
      command: 'removeContextProjectFile',
      fileLongName: fileLongName
    });
  };

  const handleOpenContextFile = (fileLongName: string) => {
    vscode.postMessage({
      command: 'openContextFile',
      fileLongName: fileLongName
    });
  };

  // Handle keyboard navigation in file selector
  const handleFileSelectorKeyDown = (e: React.KeyboardEvent) => {
    if (!showFileSelector || filteredFiles.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredFiles.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredFiles.length > 0) {
          handleFileSelect(filteredFiles[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleCancelFileSelect();
        break;
    }
  };

  // Handle keyboard events in the search input
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showFileSelector || filteredFiles.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        // Focus the file list and set first item as selected
        if (fileListRef.current) {
          fileListRef.current.focus();
          setSelectedIndex(0);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        // Focus the file list and set last item as selected
        if (fileListRef.current) {
          fileListRef.current.focus();
          setSelectedIndex(filteredFiles.length - 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        // If there are files, focus the list and select the first one
        if (filteredFiles.length > 0) {
          if (fileListRef.current) {
            fileListRef.current.focus();
            setSelectedIndex(0);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleCancelFileSelect();
        break;
    }
  };

  return (
    <div>
      {view === noViewSet && (<div className="app">
        {/* Modern Header */}
        <div className="header">
          <div className="header-content">
            {!currentToolsModel.includes(noModelSelected) && (<div className="header-left">
              <button
                onClick={handleClearText}
                className="header-btn secondary"
                title="New Chat"
              >
                New Chat
              </button>

              <button
                onClick={handleConfigureTools}
                className="header-btn secondary"
                title="Select Tools"
              >
                🔧
              </button>
            </div>)}
            <div className="header-actions">
                             {/* Environment Status Line */}
               {!currentToolsModel.includes(noModelSelected) && (<div className="env-status-line" style={{ marginLeft: '20px' }}>
                 {`Env: ${currentEnv}`}
               </div>)}
              
              {currentToolsModel.includes(noModelSelected) && (<div>
                <button
                onClick={handleSelectEnv}
                title={`Select/Start Env (Selected: ${currentEnv})`}
                className="modern-btn secondary"
              >
                Select Env
              </button>
              Select an env (group of LLMs) with tools model to start using Llama Agent.
              </div>)}

              {!currentToolsModel.includes(noModelSelected) && (<button
                onClick={handleStopEnv}
                title={`Deselect the environment and stop the local models`}
                className="modern-btn secondary"
              >
                Deselect Env
              </button>)}
            </div>

          </div>
        </div>

        {/* Main Content */}
        {!currentToolsModel.includes(noModelSelected) && (<div className="content">
          {/* Chat Display Area */}
          {/* Markdown Display Area */}
          {displayText && (
            <div className="markdown-container" ref={markdownContainerRef}>
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Input Section - Moved to bottom */}
          <div className="input-section">
            <div className="input-container">
              {/* Context Files */}
              {contextFiles.size > 0 && (
                <div className="context-chips">
                  {Array.from(contextFiles.entries()).map(([longName, shortName]) => (
                    <div key={longName} className="context-chip">
                      <span
                        className="file-name clickable"
                        onClick={() => handleOpenContextFile(longName)}
                      >
                        {shortName}
                      </span>
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveContextFile(longName)}
                        title={`Remove ${shortName} from context`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Modern Textarea */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask me anything about your code..."
                className="modern-textarea"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.shiftKey) {
                      // Shift+Enter: Allow new line (default behavior)
                      return;
                    } else {
                      // Enter: Send message
                      e.preventDefault();
                      handleSendText();
                    }
                  }
                }}
              />

              {/* Status Bar */}
              <div className="status-bar">
                <div className="status-item">
                  <div className={`status-indicator ${currentState.includes('working') ? 'working' : ''}`}></div>
                  <span>{currentState || 'Ready'}</span>
                </div>
              </div>

              {/* Input Actions */}
              <div className="input-actions">
                <div className="input-buttons">
                  <button
                    onClick={currentState.includes('working') ? handleStopSession : handleSendText}
                    className={`modern-btn ${inputText.trim() === '' ? 'secondary' : ''}`}
                    title={currentState.includes('working') ? "Stop" : "Send"}
                  >
                    {currentState.includes('working') ? '⏹' : '➤'}
                  </button>
                  <button
                    onClick={handleAddSource}
                    className="modern-btn secondary"
                    title="Add file to context"
                  >
                    @
                  </button>
                  
                </div>
              </div>
            </div>
          </div>
        </div>)}

        {/* File Selection Dialog */}
        {showFileSelector && (
          <div className="file-selector-overlay">
            <div className="file-selector-dialog">
              <div className="file-selector-header">
                <h3>Select a file to add to context (Debug: {showFileSelector ? 'Visible' : 'Hidden'})</h3>
                <button onClick={handleCancelFileSelect} className="close-btn">×</button>
              </div>
              <div className="file-selector-search">
                <input
                  type="text"
                  placeholder="Filter files..."
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                />
              </div>
              <div
                ref={fileListRef}
                className="file-selector-list"
                onKeyDown={handleFileSelectorKeyDown}
                tabIndex={0}
              >
                {filteredFiles.length > 0 ? (
                  filteredFiles.map((file, index) => (
                    <div
                      key={index}
                      className={`file-item ${index === selectedIndex ? 'selected' : ''}`}
                      onClick={() => handleFileSelect(file)}
                    >
                      {file}
                    </div>
                  ))
                ) : (
                  <div className="no-files">
                    {fileFilter ? 'No files match your filter' : 'No files available'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>)}
      {/*Local AI Runner Frame */}
      {view === viewAiRunner && (<div className="model-selection-frame">
        <div className="frame-label">Local AI Runner</div>
        <div className="llm-buttons">
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
      </div>)}
      {/* Add Env */}
      {view === viewAddEnv && (<div className="model-selection-frame">
        <div className="frame-label">Select Models And Add Env</div>
        <div className="llm-buttons">
          <button
            onClick={handleSelectToolsModel}
            title={`Select/Start Tools Model (Selected: ${currentToolsModel})`}
            className="modern-btn secondary"
          >
            Tools
          </button>
          <button
            onClick={handleSelectChatModel}
            title={`Select/Start Chat Model (Selected: ${currentChatModel})`}
            className="modern-btn secondary"
          >
            Chat
          </button>
          <button
            onClick={handleSelectEmbModel}
            title={`Select/Start Embs Model (Selected: ${currentEmbeddingsModel})`}
            className="modern-btn secondary"
          >
            Embs
          </button>
          <button
            onClick={handleSelectCompletionModel}
            title={`Select/Start Completion Model (Selected: ${currentCompletionModel})`}
            className="modern-btn secondary"
          >
            Compl
          </button>
          <button
            onClick={handleAddEnv}
            title={`Add Env With The Selected Models`}
            className="modern-btn secondary"
          >
            Add Env
          </button>
        </div>
      </div>)}
    </div>
  );
};

export default App; 