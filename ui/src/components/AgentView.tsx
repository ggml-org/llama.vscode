import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { vscode } from '../types/vscode';

interface AgentViewProps {
  displayText: string;
  setDisplayText: (text: string) => void;
  inputText: string;
  setInputText: (text: string) => void;
  currentToolsModel: string;
  currentEnv: string;
  currentState: string;
  setCurrentState: (state: string) => void;
  contextFiles: Map<string, string>;
  setContextFiles: (files: Map<string, string>) => void;
}

const AgentView: React.FC<AgentViewProps> = ({
  displayText,
  setDisplayText,
  inputText,
  setInputText,
  currentToolsModel,
  currentEnv,
  currentState,
  setCurrentState,
  contextFiles,
  setContextFiles
}) => {
  const [showFileSelector, setShowFileSelector] = useState<boolean>(false);
  const [fileList, setFileList] = useState<string[]>([]);
  const [fileFilter, setFileFilter] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Create refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
  const markdownContainerRef = useRef<HTMLDivElement>(null);

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
  }, [setDisplayText, setCurrentState, setContextFiles]);

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

  const handleAddFileSource = () => {
    handleAddSource('getFileList');
  }

  const handleAddSource = (command: string) => {
    // Request file list from extension
    vscode.postMessage({
      command: command
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

  const handleClearText = () => {
    // Clear the display text locally
    setDisplayText('');
    // Also send command to extension to clear text
    vscode.postMessage({
      command: 'clearText'
    });
  };

  const handleChatsHistory = () => {
    vscode.postMessage({
      command: 'showChatsHistory'
    });
  };

  const handleFileSelect = (fileLongName: string) => {
    // Send the selected file to the extension
    setShowFileSelector(false);
    setFileFilter('');
    if (inputText.endsWith('@')){
      setInputText(inputText + fileLongName.split('|')[0].trim()); 
      vscode.postMessage({
        command: 'addContextProjectFile',
        fileLongName: fileLongName
      });
    } else if (inputText.endsWith('/')){
      vscode.postMessage({
        command: 'sendAgentCommand',
        text: inputText + fileLongName.split('|')[0].trim(), 
        agentCommand: fileLongName.split('|')[0].trim()
      });
      setInputText('');
      setCurrentState('AI is working...');
    }
    
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Modern Header */}
      <div className="header">
        <div className="header-content">
          {!currentToolsModel.includes('No model selected') && (
            <div className="header-left">
              <button
                onClick={handleClearText}
                className="header-btn secondary"
                title="New Chat"
              >
                New Chat
              </button>
              <button
                onClick={handleChatsHistory}
                className="header-btn secondary"
                title="View Chats History And Load Old Chats"
              >
                Chats History
              </button>

              <button
                onClick={handleConfigureTools}
                className="header-btn secondary"
                title="Select Tools"
              >
                🔧
              </button>
            </div>
          )}
          <div className="header-actions">
            {/* Environment Status Line */}
            {!currentToolsModel.includes('No model selected') && (
              <div className="env-status-line" style={{ marginLeft: '20px' }}>
                {`Env: ${currentEnv}`}
              </div>
            )}
          </div>
        </div>
      </div>

              {/* Main Content */}
        {!currentToolsModel.includes('No model selected') && (
          <div className="content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
           {/* Chat Display Area */}
           {/* Markdown Display Area */}
           {displayText && (
             <div className="markdown-container" ref={markdownContainerRef} style={{ flex: 1, minHeight: 0, maxHeight: '50vh' }}>
               <div className="markdown-content" style={{ height: '100%', overflowY: 'auto' }}>
                 <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
               </div>
             </div>
           )}

           {/* Input Section - Moved to bottom */}
           <div className="input-section" style={{ flexShrink: 0 }}>
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
                  } else if (e.key === '@' || (e.key === '2' && e.shiftKey)) {
                    handleAddSource('getFileList');
                  } else if (e.key === '/') {
                    handleAddSource("getAgentCommands");
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
                    onClick={handleAddFileSource}
                    className="modern-btn secondary"
                    title="Add file to context"
                  >
                    @
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Selection Dialog */}
      {showFileSelector && (
        <div className="file-selector-overlay">
          <div className="file-selector-dialog">
            <div className="file-selector-header">
              <h3>Select an item to add to context</h3>
              <button onClick={handleCancelFileSelect} className="close-btn">×</button>
            </div>
            <div className="file-selector-search">
              <input
                type="text"
                placeholder="Filter ..."
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

export default AgentView;
