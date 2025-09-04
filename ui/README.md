# Llama VSCode UI

This is the React UI for the Llama VSCode extension. The application has been refactored to use separate components for different pages instead of having everything in a single App.tsx file.

## Component Structure

### Main Components

- **App.tsx** - Main application component that handles view switching and global state
- **AgentView.tsx** - Main chat interface with AI agent functionality
- **AIRunnerView.tsx** - Local AI runner interface for model management
- **AddEnvView.tsx** - Environment configuration interface

### Shared Types

- **types/vscode.ts** - Shared VSCode API declarations and utilities

## Architecture

### State Management

The application uses React's useState and useEffect hooks for state management. Global state is persisted to VSCode's extension state and restored on application startup.

### View Switching

The application uses a simple string-based view system:
- `agent` - Default view showing the main chat interface
- `airunner` - Local AI runner interface
- `addenv` - Environment configuration interface

### Component Communication

Components communicate with the VSCode extension through the `vscode.postMessage()` API and receive messages through the `window.addEventListener('message')` event listener.

## Development

### Building

```bash
npm run build
```

### Development Server

```bash
npm start
```

## File Structure

```
ui/src/
├── components/
│   ├── AgentView.tsx
│   ├── AIRunnerView.tsx
│   ├── AddEnvView.tsx
│   └── index.ts
├── types/
│   └── vscode.ts
├── App.tsx
├── index.tsx
├── styles.css
└── index.html
```

## Refactoring Notes

The original App.tsx file contained all the UI logic for three different views. This has been refactored into:

1. **App.tsx** - Now serves as a simple view switcher and state manager
2. **AgentView.tsx** - Contains all the chat interface logic including:
   - File selection dialog
   - Markdown rendering
   - Context file management
   - Input handling
3. **AIRunnerView.tsx** - Contains the local AI runner interface
4. **AddEnvView.tsx** - Contains the environment configuration interface

All functionality has been preserved and the user experience remains exactly the same. 