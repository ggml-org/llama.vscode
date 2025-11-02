import React, { useState, useEffect, useRef } from 'react';
import { vscode } from '../types/vscode';

interface AgentEditorProps {
  inputText: string;
  setInputText: (text: string) => void;
  currentAgentModel: string;
  currentAgent: string;
  currentState: string;
  setCurrentState: (state: string) => void;
  contextFiles: Map<string, string>;
  setContextFiles: (files: Map<string, string>) => void;
  agentEditDetails: {name: string, description: string, systemInstruction: string, toolsModel: string}
  setAgentEditDetails:(agentDetails: {name: string, description: string, systemInstruction: string, toolsModel: string}) => void 
}

const AgentEditor: React.FC<AgentEditorProps> = ({
  inputText,
  setInputText,
  currentAgentModel,
  currentAgent,
  currentState,
  setCurrentState,
  contextFiles: agentTools,
  setContextFiles: setTools,
  agentEditDetails,
  setAgentEditDetails
}) => {
  const [showFileSelector, setShowFileSelector] = useState<boolean>(false);
  const [fileList, setFileList] = useState<string[]>([]);
  const [fileFilter, setFileFilter] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Create refs
  const elemSystemPromptRef = useRef<HTMLTextAreaElement>(null);
  const elemDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const elemNameRef = useRef<HTMLTextAreaElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);

  // Auto-focus the textarea when the component mounts
  useEffect(() => {
    if (elemSystemPromptRef.current) {
      elemSystemPromptRef.current.focus();
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
      console.log('Received message from extension:', message);
      switch (message.command) {
        case 'focusTextarea':
          // Focus the textarea when requested by the extension
          if (elemSystemPromptRef.current) {
            elemSystemPromptRef.current.focus();
          }
          break;
        case 'updateCurrentState':
          setCurrentState(message.text || '');
          break;
        case 'updateFileList':
          setFileList(message.files || []);
          setShowFileSelector(true);
          break;
        case 'updateAgentTools':
          setTools(new Map(message.files || []));
          break;
        case 'loadAgent':
          setAgentEditDetails({name: message.name, description: message.description, systemInstruction: message.systemInstruction, toolsModel: message.toolsModel});
          setTools(new Map(message.tools || []));
          currentAgentModel = message.toolsModel;
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setCurrentState, setTools]);

  // Function to focus the textarea (can be called from extension)
  const focusTextarea = () => {
    if (elemSystemPromptRef.current) {
      elemSystemPromptRef.current.focus();
    }
  };

  // Expose the focus function to the extension
  useEffect(() => {
    // @ts-ignore - Adding to window for extension access
    window.focusTextarea = focusTextarea;
  }, []);

  const handlеSaveAgent = () => {
    vscode.postMessage({
      command: 'saveEditAgent',
      name: agentEditDetails.name,
      description: agentEditDetails.description,
      systemInstruction: agentEditDetails.systemInstruction,
      toolsModel: currentAgentModel,
      tools: Array.from(agentTools.keys())
    });
  };

  const handleSelectTools = () => {
    vscode.postMessage({
      command: "configureEditTools",
      tools: Array.from(agentTools.keys())
    });
  }

  const handleDeselectToolsModel = () => {
    vscode.postMessage({
      command: 'deselectAgentModel'
    });
  };
  
  const handleSelectToolsModel = () => {
    vscode.postMessage({
      command: 'selectAgentModel'
    });
  };

  const handleMoreToolsModel = () => {
    vscode.postMessage({
      command: 'moreToolsModel'
    });
  };

  const handleShowToolsModel = () => {
    vscode.postMessage({
      command: 'showToolsModel'
    });
  };
  
  const handleSelectEditAgent = () => {
    vscode.postMessage({
      command: 'selectEditAgent'
    });
  }

  const handleNewAgent = () => {
    vscode.postMessage({
      command: 'addEditAgent',
      name: "",
      description: "",
      systemInstruction: [],
      toolsModel: "",
      tools: []
    });
  }

  const handleCopyAgent = () => {
    vscode.postMessage({
      command: 'copyAsNewAgent'
    });
  }

  const handleDeleteAgent = () => {
    vscode.postMessage({
      command: 'deleteAgent'
    });
  }

  const handleFileSelect = (fileLongName: string) => {
    // Send the selected file to the extension
    setShowFileSelector(false);
    setFileFilter('');
    vscode.postMessage({
        command: 'addEditedAgentTool',
        fileLongName: fileLongName
      });
    
    if (elemSystemPromptRef.current) {
      elemSystemPromptRef.current.focus();
    }    
  };

  const handleCancelFileSelect = () => {
    setShowFileSelector(false);
    setFileFilter('');
    if (elemSystemPromptRef.current) {
      elemSystemPromptRef.current.focus();
    }
  };

  const handleRemoveTool = (fileLongName: string) => {
    vscode.postMessage({
      command: 'removeEditedAgentTool',
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
        {/* Main Content */}
          <div className="content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
           <div className="input-section" style={{ flexShrink: 0 }}>
            <div className="input-container">
              {/* Page Title */}
              <h1 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold' }}>Agent Editor</h1>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                  onClick={handleSelectEditAgent}
                  title={`Select Agent to Edit`}
                  className="modern-btn secondary"
                >
                  Select
                </button>
                <button
                  onClick={handleNewAgent}
                  title={`New Agent`}
                  className="modern-btn secondary"
                >
                  New
                </button>
                <button
                  onClick={handleCopyAgent}
                  title={`Copy Existing Agent as New`}
                  className="modern-btn secondary"
                >
                  Copy as New
                </button>
                <button
                  onClick={handleDeleteAgent}
                  title={`Select and Delete Existing Agent`}
                  className="modern-btn secondary"
                >
                  Delete
                </button>
              </div>
              <span style={{ display: 'block', marginTop: '20px', marginBottom: '10px', fontWeight: 'bold' }}>{'Tools'}</span>
              {/* Tools */}
              {agentTools.size > 0 && (
                <div className="context-chips">
                  {Array.from(agentTools.entries()).map(([toolName, toolDescription]) => (
                    <div key={toolName} className="context-chip">
                      <span
                        className="file-name clickable"
                        onClick={() => handleOpenContextFile(toolName)}
                      >
                        {toolName}
                      </span>
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveTool(toolName)}
                        title={`Remove ${toolName} from context`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              
              <span style={{ display: 'block', marginTop: '20px', marginBottom: '10px', fontWeight: 'bold' }}>{'Name (agent identifier)'}</span>
              {/* Modern Textarea */}
              <textarea
                ref={elemNameRef}
                value={agentEditDetails.name}
                onChange={(e) => setAgentEditDetails({name: e.target.value, description: agentEditDetails.description,  systemInstruction: agentEditDetails.systemInstruction, toolsModel: agentEditDetails.toolsModel})}
                placeholder="Enter agent name."
                className="modern-textarea"
                rows={1}
                style={{ height: 'auto', minHeight: '1.5em', resize: 'none' }}
              />

              <span style={{ display: 'block', marginTop: '20px', marginBottom: '10px', fontWeight: 'bold' }}>{'Descriptoin'}</span>
              {/* Modern Textarea */}
              <textarea
                ref={elemDescriptionRef}
                value={agentEditDetails.description}
                onChange={(e) => setAgentEditDetails({name: agentEditDetails.name, description: e.target.value,  systemInstruction: agentEditDetails.systemInstruction, toolsModel: agentEditDetails.toolsModel})}
                placeholder="Enter agent description."
                className="modern-textarea"
                rows={2}
                style={{ height: 'auto', minHeight: '3em', resize: 'none' }}
              />

              <span style={{ display: 'block', marginTop: '20px', marginBottom: '10px', fontWeight: 'bold' }}>{'System Instruction'}</span>
              {/* Modern Textarea */}
              <textarea
                ref={elemSystemPromptRef}
                value={agentEditDetails.systemInstruction}
                onChange={(e) => setAgentEditDetails({name: agentEditDetails.name, description: agentEditDetails.description,  systemInstruction: e.target.value,  toolsModel: agentEditDetails.toolsModel})}
                placeholder="Enter system instructions for the agent."
                className="modern-textarea"
                rows={10}
                style={{ height: 'auto', minHeight: '15em', resize: 'vertical' }}
              />

             <div className="single-button-frame">
            <div className="frame-label">Agent Model (Optional)</div> 
              {currentAgentModel == "" && (
              <button
              onClick={handleSelectToolsModel}
              title={`Add Default Agent (Tools) Model`}
              className="modern-btn secondary"
            >
              Add
            </button>
            )}
            {
            currentAgentModel && (
              <button
              onClick={handleDeselectToolsModel}
              title={`Remove Agent Model`}
              className="modern-btn secondary"
            >
            Remove
            </button>
            )
            }
            <span className="model-text">{currentAgentModel}</span>
            {
            currentAgentModel === "" && (
            <button
              onClick={handleMoreToolsModel}
              title={`Add/Delete/View/Export/Import Tools Model`}
              className="modern-btn secondary"
            >
              More
            </button>
            )
            }
            {
            currentAgentModel && (
              <button
              onClick={handleShowToolsModel}
              title={`Show Tools Model Details`}
              className="modern-btn secondary"
            >
              ...
            </button>
            )
            }
            </div>

              {/* Input Actions */}
              <div className="input-actions">
                <div className="input-buttons">
                  <button
                    onClick={handleSelectTools}
                    className="modern-btn secondary"
                    title="Add/remove tools to the agent"
                  >
                    Add/Remove Tools
                  </button>
                </div>
                <button
                    onClick={handlеSaveAgent}
                    className={`modern-btn ${inputText.trim() === '' ? 'secondary' : ''}`}
                    title={"Saves the agent changes or creates a new agent if the name does not exit."}
                  >
                    Save
                  </button>
              </div>
            </div>
          </div>
        </div>

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

export default AgentEditor;
