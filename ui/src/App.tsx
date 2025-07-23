import React, { useState, useEffect } from 'react';

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
  const [displayText, setDisplayText] = useState<string>('Welcome to Llama VS Code UI!');
  const [inputText, setInputText] = useState<string>('');

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
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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

  const handleClearText = () => {
    vscode.postMessage({
      command: 'clearText'
    });
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Llama AI with tools</h1>
        <div className="button-group">
          <button onClick={handleClearText} className="send-btn">
            New chat
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
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter text to send to the extension..."
              rows={3}
            />
            <div className="button-group">
              <button onClick={handleSendText} className="send-btn">
                Send
              </button>
              <button onClick={handleConfigureTools} className="send-btn">
                Tools
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App; 