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

  // Save state to VS Code whenever it changes
  useEffect(() => {
    vscode.setState({
      displayText,
      inputText,
      currentToolsModel,
      currentState
    });
  }, [displayText, inputText, currentToolsModel, currentState]);

  // Auto-focus the textarea when the component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

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

  const handleSelectModel = () => {
    vscode.postMessage({
      command: 'selectModelWithTools'
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
      <div className="header">
        <div className="button-group">
          <button onClick={handleClearText} className="send-btn">
            New chat
          </button>
          <button onClick={handleStopSession} className="send-btn">
                Stop Session
          </button>
          <button onClick={handleConfigureTools} className="send-btn">
            Tools
          </button>
          <button onClick={handleSelectModel} className="send-btn">
            Select Model
          </button>
        </div>
      </div>
      
      <div className="content">
        <div className="text-display">
          <div className="text-area">
            {displayText || 'No text to display'}
          </div>
        </div>
        
        <div className="input-section">
          <h3>Ask AI:</h3>
          {contextFiles.size > 0 && (
            <div className="context-files">
              {Array.from(contextFiles.entries()).map(([longName, shortName]) => (
                <div
                  key={longName}
                  className="context-file-chip"
                  title={longName}
                >
                  <span 
                    className="file-name clickable"
                    onClick={() => handleOpenContextFile(longName)}
                  >
                    {shortName}
                  </span>
                  <button
                    className="remove-file-btn"
                    onClick={() => handleRemoveContextFile(longName)}
                    title={`Remove ${shortName} from context`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="input-group">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter text to send to the AI..."
              rows={3}
            />
            <div className="button-group">
              <button onClick={handleSendText} className="send-btn">
                Ask
              </button>
              <button onClick={handleAddSource} className="send-btn" title="Add file to the context">
                @
              </button>
            </div>
            <div className="model-info">
              <span>Current Tools Model: {currentToolsModel}</span>
            </div>
            <div className="model-info">
              <span> {currentState}</span>
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