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

  // Create a ref for the textarea to enable auto-focus
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Save state to VS Code whenever it changes
  useEffect(() => {
    vscode.setState({
      displayText,
      inputText
    });
  }, [displayText, inputText]);

  // Auto-focus the textarea when the component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

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
    }
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
              <button onClick={handleConfigureTools} className="send-btn">
                Tools
              </button>
              
              <button onClick={handleSelectModel} className="send-btn">
                Select Model
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App; 