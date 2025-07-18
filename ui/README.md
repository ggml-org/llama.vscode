# Llama VS Code UI

This is a React application that provides a webview interface for the Llama VS Code extension.

## Features

- Text display area for showing content from the extension
- Input field for sending text to the extension
- VS Code theme integration
- Real-time communication with the extension

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Integration with VS Code Extension

The React app communicates with the VS Code extension through the webview API:

- **From UI to Extension**: Use `vscode.postMessage()` to send messages
- **From Extension to UI**: The extension sends messages that are handled by the `useEffect` hook

### Message Types

- `sendText`: Sends text from the UI to the extension
- `clearText`: Requests to clear the display text
- `updateText`: Updates the display text (from extension)
- `clearText`: Clears the display text (from extension)

## Building

The UI is automatically built when you run `npm install` in the root directory due to the `postinstall` script. You can also manually build it by running:

```bash
npm run build-ui
```

## File Structure

```
ui/
├── src/
│   ├── App.tsx          # Main React component
│   ├── index.tsx        # React entry point
│   ├── index.html       # HTML template
│   └── styles.css       # CSS styles
├── dist/                # Built files (generated)
├── package.json         # UI dependencies
├── tsconfig.json        # TypeScript configuration
├── webpack.config.js    # Webpack configuration
└── README.md           # This file
``` 