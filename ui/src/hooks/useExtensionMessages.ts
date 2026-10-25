import { useEffect, useRef } from 'react';
import { vscode } from '../types/vscode';

export interface RequestStats {
  lastRequestTokens: number;
  lastRequestInputTokens: number;
  lastRequestOutputTokens: number;
  lastRequestCachedTokens: number;
  lastRequestPrice: number;
  chatTotalTokens: number;
  chatInputTokens: number;
  chatOutputTokens: number;
  chatCachedTokens: number;
  chatPrice: number;
}

export const EMPTY_REQUEST_STATS: RequestStats = {
  lastRequestTokens: 0,
  lastRequestInputTokens: 0,
  lastRequestOutputTokens: 0,
  lastRequestCachedTokens: 0,
  lastRequestPrice: 0,
  chatTotalTokens: 0,
  chatInputTokens: 0,
  chatOutputTokens: 0,
  chatCachedTokens: 0,
  chatPrice: 0
};

export interface ExtensionMessageHandlers {
  onUpdateText: (text: string) => void;
  onClearText: () => void;
  onFocusTextarea: (text: string) => void;
  onUpdateCurrentState: (text: string, inProgress: boolean | undefined) => void;
  onUpdateFileList: (files: string[]) => void;
  onUpdateContextFiles: (files: Map<string, string>) => void;
  onUpdateContextImage: (image: string) => void;
  onUpdateRequestStats: (stats: RequestStats) => void;
}

/**
 * Subscribes to the messages posted by the extension (llama-webview-provider.ts)
 * and keeps the handlers in a ref so the listener is registered only once.
 * Returns the `focusTextarea` bridge the extension expects on `window`.
 */
export const useExtensionMessages = (handlers: ExtensionMessageHandlers) => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      const current = handlersRef.current;
      switch (message.command) {
        case 'updateText':
          current.onUpdateText(message.text ?? '');
          break;
        case 'clearText':
          current.onClearText();
          break;
        case 'focusTextarea':
          current.onFocusTextarea(message.text ?? '');
          break;
        case 'updateCurrentState':
          current.onUpdateCurrentState(message.text || '', message.inProgress);
          break;
        case 'updateFileList':
          current.onUpdateFileList(message.files || []);
          break;
        case 'updateContextFiles':
          current.onUpdateContextFiles(new Map(message.files || []));
          break;
        case 'updateContextImage':
          current.onUpdateContextImage(message.image || '');
          break;
        // `updateRquestsStats` is the historical (typo) name; the extension now
        // sends `updateRequestsStats`. Both are accepted for one release.
        case 'updateRequestsStats':
        case 'updateRquestsStats':
          current.onUpdateRequestStats({
            lastRequestTokens: message.totalTokens || 0,
            lastRequestInputTokens: message.inputTokens || 0,
            lastRequestOutputTokens: message.outputTokens || 0,
            lastRequestCachedTokens: message.cachedTokens || 0,
            lastRequestPrice: message.price || 0,
            chatTotalTokens: message.chatTotalTokens || 0,
            chatInputTokens: message.chatInputTokens || 0,
            chatOutputTokens: message.chatOutputTokens || 0,
            chatCachedTokens: message.chatCachedTokens || 0,
            chatPrice: message.chatPrice || 0
          });
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
};

export const postMessageToExtension = (message: any) => {
  vscode.postMessage(message);
};
