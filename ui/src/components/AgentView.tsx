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
  currentAgent: string;
  currentState: string;
  setCurrentState: (state: string) => void;
  contextFiles: Map<string, string>;
  setContextFiles: (files: Map<string, string>) => void;
  imagePath: string;
  setContextImage: (imgPath: string) => void;
}

const AgentView: React.FC<AgentViewProps> = ({
  displayText,
  setDisplayText,
  inputText,
  setInputText,
  currentToolsModel,
  currentAgent,
  currentState,
  setCurrentState,
  contextFiles,
  setContextFiles,
  imagePath,
  setContextImage
}) => {
  const [showFileSelector, setShowFileSelector] = useState<boolean>(false);
  const [fileList, setFileList] = useState<string[]>([]);
  const [fileFilter, setFileFilter] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Request stats state
  const [lastRequestTokens, setLastRequestTokens] = useState<number>(0);
  const [lastRequestInputTokens, setLastRequestInputTokens] = useState<number>(0);
  const [lastRequestOutputTokens, setLastRequestOutputTokens] = useState<number>(0);
  const [lastRequestCachedTokens, setLastRequestCachedTokens] = useState<number>(0);
  const [lastRequestPrice, setLastRequestPrice] = useState<number>(0);
  const [chatTotalTokens, setChatTotalTokens] = useState<number>(0);
  const [chatInputTokens, setChatInputTokens] = useState<number>(0);
  const [chatOutputTokens, setChatOutputTokens] = useState<number>(0);
  const [chatCachedTokens, setChatCachedTokens] = useState<number>(0);
  const [chatPrice, setChatPrice] = useState<number>(0);

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
          if (message.text) {
            setInputText(message.text);
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
        case 'updateContextImage':
          setContextImage(message.image || "");
          break;
        case 'updateRquestsStats':
          setLastRequestTokens(message.totalTokens || 0);
          setLastRequestInputTokens(message.inputTokens || 0);
          setLastRequestOutputTokens(message.outputTokens || 0);
          setLastRequestCachedTokens(message.cachedTokens || 0);
          setLastRequestPrice(message.price || 0);
          setChatTotalTokens(message.chatTotalTokens || 0);
          setChatInputTokens(message.chatInputTokens || 0);
          setChatOutputTokens(message.chatOutputTokens || 0);
          setChatCachedTokens(message.chatCachedTokens || 0);
          setChatPrice(message.chatPrice || 0);
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setDisplayText, setCurrentState, setContextFiles, setContextImage]);

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
      if (currentState.includes('working')){
        vscode.postMessage({
          command: 'sendInSessionText',
          text: inputText
        });
      } else {
        vscode.postMessage({
          command: 'sendText',
          text: inputText
        });
      }
      setInputText('');
      setCurrentState('AI is working...');
    }
  };

  const handleAddFileSource = () => {
    handleAddSource('getFileList');
  }

  const handleSingleFileDrop = (filePath: string, fileName: string) => {
    console.log('handleSingleFileDrop called with:', { filePath, fileName });
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    
    // Only process text-based files that VS Code can open
    const allowedExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp', 
      '.rs', '.go', '.rb', '.css', '.html', '.json', '.xml', '.md', '.txt', 
      '.sh', '.bat', '.ps1', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
      '.sql', '.graphql', '.vue', '.svelte', '.astro', '.php', '.swift', '.kt',
      '.scala', '.dart', '.lua', '.r', '.m', '.mm', '.zig', '.nim', '.v',
    ];
    
    if (ext && allowedExtensions.includes(ext)) {
      console.log('Adding file to context:', fileName);
      vscode.postMessage({
        command: 'addContextDroppedFile',
        filePath: filePath,
        fileName: fileName
      });
    } else {
      console.warn(`File type "${ext}" is not supported for drag & drop`);
    }
  };

  // Extract a clean file system path + name from a URI string or plain path.
  // Returns null when the value cannot be turned into a usable file path.
  const extractFileInfo = (rawValue: string): { filePath: string; fileName: string } | null => {
    const value = rawValue.trim();
    if (!value) return null;

    let filePath = '';

    if (value.startsWith('file://')) {
      try {
        const url = new URL(value);
        filePath = decodeURIComponent(url.pathname);
        // On Windows a file URI looks like file:///C:/path -> /C:/path, strip the leading slash
        if (/^\/[a-zA-Z]:\//.test(filePath)) {
          filePath = filePath.substring(1);
        }
      } catch (err) {
        console.error('Failed to parse file URI:', value, err);
        return null;
      }
    } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
      // Some other scheme (vscode-remote://, untitled:, etc.) - not a local file we can open.
      console.warn('Skipping non-file URI:', value);
      return null;
    } else {
      // Assume it is already a plain file system path
      filePath = value;
    }

    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
    if (!fileName) return null;

    return { filePath, fileName };
  };

  const handleFilesDrop = (dataTransfer: DataTransfer) => {
    console.log('handleFilesDrop called');
    console.log('dataTransfer.types:', Array.from(dataTransfer.types));
    if (dataTransfer.items) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const it = dataTransfer.items[i];
        console.log(`  item[${i}] kind=${it.kind} type=${it.type}`);
      }
    }

    // Use a Map keyed by file path to avoid adding the same file multiple times
    const droppedFiles = new Map<string, string>();

    const addFromString = (raw: string, source: string) => {
      if (!raw) return;
      const trimmedRaw = raw.trim();

      // VS Code tree drag format: a JSON array of items such as
      // [{"id":"file:///path/to/file","type":"file", ...}]
      if (trimmedRaw.startsWith('[') || trimmedRaw.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmedRaw);
          const entries = Array.isArray(parsed) ? parsed : [parsed];
          let handled = false;
          for (const entry of entries) {
            const candidate = entry?.id ?? entry?.uri ?? entry?.fsPath ?? entry?.path;
            if (typeof candidate === 'string') {
              const info = extractFileInfo(candidate);
              if (info) {
                console.log(`Dropped file from ${source}:`, info);
                droppedFiles.set(info.filePath, info.fileName);
                handled = true;
              }
            }
          }
          if (handled) return;
          // Not a recognized tree payload - fall through to line splitting
        } catch {
          // Not JSON - fall through to line splitting
        }
      }

      // A single payload may contain several URIs separated by newlines
      const parts = raw.split(/\r?\n/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || trimmed.startsWith('#')) continue; // skip comments / blanks
        const info = extractFileInfo(trimmed);
        if (info) {
          console.log(`Dropped file from ${source}:`, info);
          droppedFiles.set(info.filePath, info.fileName);
        }
      }
    };

    // Capture OS file drops synchronously. The DataTransfer object becomes
    // invalid after the drop handler returns, so files must be read now.
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      console.log('Processing files from dataTransfer.files');
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];
        const filePath = (file as any).fullPath || (file as any).path || '';
        if (filePath) droppedFiles.set(filePath, file.name);
      }
    }

    // Synchronous getData fallbacks (text/uri-list, VS Code tree types, text/plain)
    const collectViaGetData = () => {
      const candidateTypes = new Set<string>([
        'text/uri-list',
        'text/plain',
      ]);
      // VS Code tree views expose data under a dynamic
      // application/vnd.code.tree.<viewId> MIME type - include all present.
      for (const type of Array.from(dataTransfer.types)) {
        if (type.startsWith('application/vnd.code.tree.')) {
          candidateTypes.add(type);
        }
      }
      for (const type of candidateTypes) {
        try {
          const data = dataTransfer.getData(type);
          if (data) addFromString(data, `getData(${type})`);
        } catch (err) {
          console.error('getData failed for type', type, err);
        }
      }
    };

    const flush = () => {
      console.log('Total dropped files collected:', droppedFiles.size);
      for (const [filePath, fileName] of droppedFiles.entries()) {
        handleSingleFileDrop(filePath, fileName);
      }
    };

    // VS Code exposes dragged explorer files as string items (text/uri-list
    // and/or a custom application/vnd.code.tree.* type), NOT as file items.
    // getAsString is asynchronous, so gather them and flush once complete.
    const stringItems: DataTransferItem[] = [];
    if (dataTransfer.items) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i];
        if (item.kind === 'string') stringItems.push(item);
      }
    }

    if (stringItems.length === 0) {
      collectViaGetData();
      flush();
      return;
    }

    let pending = stringItems.length;
    const onStringRead = () => {
      pending--;
      if (pending === 0) flush();
    };

    // getData works synchronously during the drop event - do it first.
    collectViaGetData();

    for (const item of stringItems) {
      try {
        item.getAsString((str) => {
          addFromString(str, `item(${item.type})`);
          onStringRead();
        });
      } catch (err) {
        console.error('getAsString failed for item', item.type, err);
        onStringRead();
      }
    }
  };

  const handleAddImage = () => {
    vscode.postMessage({
      command: 'selectImageFile'
    });
  }
  
  const handleSelectToolsModel = () => {
    vscode.postMessage({
      command: 'selectModelWithTools'
    });
  };
  
  const handleSelectAgent = () => {
    vscode.postMessage({
      command: 'selectAgent'
    });
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

  const handleDeleteCurrentChat = () => {
    vscode.postMessage({
      command: 'deleteCurrentChat'
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
      // vscode.postMessage({
      //   command: 'addContextProjectImage',
      //   image: "/home/igardev/Downloads/sofia.jpeg"
      // });
    } else if (inputText.endsWith('/')){
      vscode.postMessage({
        command: 'sendAgentCommand',
        text: inputText + fileLongName.split('|')[0].trim(), 
        agentCommand: fileLongName.split('|')[0].trim()
      });
      setInputText('');
      setCurrentState('AI is working...');
    } else {
      vscode.postMessage({
        command: 'addContextProjectFile',
        fileLongName: fileLongName
      });
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

  const handleRemoveContextImage = (imagePath: string) => {
    vscode.postMessage({
      command: 'removeContextProjectImage',
      image: imagePath
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
    <div
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only clear if we're actually leaving the whole view
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        console.log('=== DROP EVENT TRIGGERED ===');
        const dataTransfer = e.dataTransfer;
        console.log('dataTransfer.files:', dataTransfer.files?.length || 0);
        console.log('dataTransfer.types:', Array.from(dataTransfer.types));

        handleFilesDrop(dataTransfer);
      }}
    >
      {/* Modern Header */}
      <div className="header">
        <div className="header-content">
          {!currentToolsModel.includes('No model selected...') && (
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
                onClick={handleDeleteCurrentChat}
                className="header-btn secondary"
                title="Delete This Chat"
              >
                🗑️
              </button>

              <button
                onClick={handleConfigureTools}
                className="header-btn secondary"
                title="Select Tools"
              >
                🔧
              </button>
              <button
                onClick={handleSelectToolsModel}
                className="header-btn secondary"
                title={`Select Tools Model (Selected: ${currentToolsModel})`}
              >
                Tools Model
              </button>
              <button
                onClick={handleSelectAgent}
                className="header-btn secondary"
                title={`Select Agent (Selected: ${currentAgent})`}
              >
                Agent
              </button>
            </div>
          )}
        </div>
      </div>

              {/* Main Content */}
        {!currentToolsModel.includes('No model selected...') && (
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
            <div 
              className={`input-container ${isDragOver ? 'drag-over' : ''}`}
            >
              {/* Context Files */}
              {contextFiles.size > 0 && (
                <div className="context-chips">
                  {Array.from(contextFiles.entries()).map(([longName, shortName]) => (
                    <div key={longName} className="context-chip">
                      <span
                        className="file-name clickable"
                        onClick={() => handleOpenContextFile(longName)}
                        title={`Show ${shortName}`}
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

              {imagePath && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span className="model-text">{"image: " + imagePath}</span>
                  <button
                    className="modern-btn secondary"
                    onClick={() => handleRemoveContextImage(imagePath)}
                    title="Remove image from context"
                    style={{ padding: '4px 8px', fontSize: '12px', minWidth: 'auto' }}
                  >
                    ×
                  </button>
                </div>
              )}
              {/* Modern Textarea */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask me anything about your code... Press @ to select a file, / for a command. Drag & drop files (hold Shift while dropping)."
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
                {(lastRequestTokens > 0 || chatTotalTokens > 0) && (
                  <div className="status-item" style={{ fontSize: '12px', opacity: 0.8, flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                    {lastRequestTokens > 0 && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span title={`last request: input ${Math.round(lastRequestInputTokens).toLocaleString()} (of them cached ${Math.round(lastRequestCachedTokens).toLocaleString()}) output ${Math.round(lastRequestOutputTokens).toLocaleString()}`}>
                          last request: tokens {Math.round(lastRequestTokens).toLocaleString()}
                        </span>
                        <span title="price works only for openrouter and orcarouter | not finished/stopped requests are not included but are taxed">
                          ${lastRequestPrice.toFixed(8)}
                        </span>
                      </div>
                    )}
                    {chatTotalTokens > 0 && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span title={`chat: input ${Math.round(chatInputTokens).toLocaleString()} (of them cached ${Math.round(chatCachedTokens).toLocaleString()}) output ${Math.round(chatOutputTokens).toLocaleString()}`}>
                          chat: tokens {Math.round(chatTotalTokens).toLocaleString()}
                        </span>
                        <span title="price works only for openrouter and orcarouter | not finished/stopped requests are not included but are taxed">
                          ${chatPrice.toFixed(8)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
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
                  <button
                    onClick={handleAddImage}
                    className="modern-btn secondary"
                    title="Add/replace image to context (.jpg, .png, .webp)"
                    style={{ filter: 'grayscale(100%)' }}
                  >
                    🖼️
                  </button>
                  {currentState.includes('working') && (
                    <button
                    onClick={handleSendText}
                    className={`modern-btn ${inputText.trim() === '' ? 'secondary' : ''}`}
                    title={"Send in current session (between tool calls)"}
                  >
                    {'➤'}
                  </button>
                  )}
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
