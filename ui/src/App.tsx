import React, { useState, useEffect, useRef } from 'react';

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

interface AppProps {}

const App: React.FC<AppProps> = () => {
  // Initialize state from VS Code's persisted state or defaults
  const initialState = vscode.getState() || {};
  const [displayText, setDisplayText] = useState<string>(
    initialState.displayText || ''
  );
  const [inputText, setInputText] = useState<string>(
    initialState.inputText || ''
  );
  const [currentToolsModel, setCurrentToolsModel] = useState<string>(
    initialState.currentToolsModel || 'No model selected'
  );
  const [currentChatModel, setCurrentChatModel] = useState<string>(
    initialState.currentChatModel || 'No model selected'
  );
  const [currentEmbeddingsModel, setCurrentEmbeddingsModel] = useState<string>(
    initialState.currentEmbeddingsModel || 'No model selected'
  );
  const [currentCompletionModel, setCurrentCompletionModel] = useState<string>(
    initialState.currentCompletionModel || 'No model selected'
  );
  const [currentOrchestra, setCurrentOrchestra] = useState<string>(
    initialState.currentOrchestra || 'No orchestra selected'
  );
  const [currentState, setCurrentState] = useState<string>(
    initialState.currentState || ''
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

  // Save state to VS Code whenever it changes
  useEffect(() => {
    vscode.setState({
      displayText,
      inputText,
      currentToolsModel,
      currentChatModel,
      currentEmbeddingsModel,
      currentCompletionModel,
      currentOrchestra: currentOrchestra,
      currentState
    });
  }, [displayText, inputText, currentToolsModel, currentChatModel, currentEmbeddingsModel, currentCompletionModel, currentOrchestra, currentState]);

  // Auto-focus the textarea when the component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-scroll to bottom when displayText changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
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
          setCurrentToolsModel(message.model || 'No model selected');
          break;
        case 'updateChatModel':
          setCurrentChatModel(message.model || 'No model selected');
          break;
        case 'updateEmbeddingsModel':
          setCurrentEmbeddingsModel(message.model || 'No model selected');
          break;
        case 'updateCompletionModel':
          setCurrentCompletionModel(message.model || 'No model selected');
          break;
        case 'updateOrchestra':
          setCurrentOrchestra(message.model || 'No orchestra selected');
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

  const handleSelectOrchestra = () => {
    vscode.postMessage({
      command: 'selectOrchestra'
    });
  };

  const handleStopOrchestra = () => {
    vscode.postMessage({
      command: 'stopOrchestra'
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
    vscode.postMessage({
      command: 'clearText'
    });
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
    <div className="app">
      {/* Modern Header */}
      <div className="header">
        <div className="header-content">
          <div className="header-left">
            <button 
                  onClick={handleSelectOrchestra} 
                  title={`Select/Start Orchestra (Selected: ${currentOrchestra})`}
                  className="modern-btn secondary"
                >
                  Orchestra
                </button>
                <button 
                  onClick={handleClearText} 
                  className="header-btn secondary"
                  title="New Chat"
                >
                  New Chat
                </button>
                <button 
                  onClick={handleStopOrchestra} 
                  title="Deselect/Stop orchestra and all models"
                  className="modern-btn secondary"
                >
                  Stop Orchestra
                </button>
                <button 
                  onClick={handleSelectedModels} 
                  title="Show Selected Models"
                  className="modern-btn secondary"
                >
                  Selected Models
                </button>
                
            <button 
              onClick={handleConfigureTools} 
              className="header-btn secondary"
              title="Select Tools"
            >
              🔧
            </button>
          </div>
          <div className="header-actions">

            
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="content">
        {/* Chat Display Area */}
        <div className="chat-container" ref={chatContainerRef}>
          {displayText ? (
            <div className="chat-message assistant">
              {displayText}
            </div>
          ) : (
            <div className="chat-message assistant">
              No messages yet. Start a conversation by typing below.
            </div>
          )}
        </div>
        
        {/* Input Section */}
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
                            {/* LLM Model Selection Buttons */}
            <div className="model-selection-frame">
              <div className="frame-label">Select Model</div>
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
              </div>
            </div>
              </div>
            </div>
            
            
            


            {/* Chat With AI Frame */}
            <div className="model-selection-frame">
              <div className="frame-label">Chat With AI</div>
              <div className="llm-buttons">
                <button 
                  onClick={handleInstallLlamacpp} 
                  className="modern-btn secondary"
                  title= "Install/Upgrade llama.cpp"
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
          </div>
        </div>
      </div>
      
      {/* File Selection Dialog */}
      {showFileSelector && (
        <div className="file-selector-overlay">
          <div className="file-selector-dialog">
            <div className="file-selector-header">
              <h3>Select a file to add to context</h3>
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
    </div>
  );
};

export default App; 