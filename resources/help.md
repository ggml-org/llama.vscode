## Chat with AI with project context 

### Requred servers
- Chat server
- Embeddings server

### How to use it
This is a conversation with the local AI. It uses the project information and therefore is slower than Chat with AI, but could answer questions related to the project.
- Press Ctrl+Shift+; inside an editor (or select from llama.vscode menu Chat with AI with project context) 
- Enter your question
- llama-vscode collects a relevant context information from the project and sends it to the AI together with your question
- Project context information is sent to the AI only if the question is entered with Ctrl+Shift+;. If the question is written directly in the chat window - no new context information is sent to the AI.
- If the AI answers too slowly - close the VS Code chat window and open a new one with Ctrl+Shift+;
- Press Esc if you want to return from the chat to the editor  
  
It is possible to configure rag_* settings to adjust the rag search according to models and hardware ressources


![Chat with AI with project context](https://github.com/user-attachments/assets/d5753717-1d85-4e4e-a093-53b0ed5f51dc)
 
 
## Chat with AI  

### Requred servers
- Chat server

### How to use it 
This is a conversation with the local AI. Mainly for asking questions for reference instead of searching with google. It doesn't use the project information and therefore is fast.
- Press Ctrl+; inside an editor (or select from llama.vscode menu Chat with AI) - A chat window will open inside VS Code
- Enter your message and start the chat
- Press Esc if you want to return from the chat to the editor

![Chat with AI](https://github.com/user-attachments/assets/e068f5cc-fce3-4366-9b8f-1c89e952b411) 
 
## Code completion

### Requred servers
- Completion server

### How to use it
Every change in the editor will trigger a completion request to the server.
- Accept with a Tab
- Reject with Esc
- Accept the first line with Shift+Tab
- Acept the next word by Ctrl+right arrow

![Code completion](https://private-user-images.githubusercontent.com/1991296/405712196-b19499d9-f50d-49d4-9dff-ff3e8ba23757.gif?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NDY5NDc1NDEsIm5iZiI6MTc0Njk0NzI0MSwicGF0aCI6Ii8xOTkxMjk2LzQwNTcxMjE5Ni1iMTk0OTlkOS1mNTBkLTQ5ZDQtOWRmZi1mZjNlOGJhMjM3NTcuZ2lmP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQVZDT0RZTFNBNTNQUUs0WkElMkYyMDI1MDUxMSUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNTA1MTFUMDcwNzIxWiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9NmZiMmI0NGYzNTkyZGZkMTM5Njk3M2NjZDFhMjFiNTFkMjVkMmY4MGQ5ZDQ2ZDQ0MDgzOWI2YjM5NTY0NzM2OSZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QifQ.P150YJh87_y1pin20aWIuKoPzivmDjZF0iAemQlk_ok) 
 
## Edit with AI  

### Requred servers
- Chat server

### How to use it  
- Select the source code you want to edit. 
- Right click on it and click on llama.vscode::Edit Selected Text with AI (or use Ctrl+Shift+E)
- Enter the instructions for editing
- Press enter - a diff panel will be shown with the changes on the right window
- press Tab to accept or Esc to discard the changes

![Edit with AI](https://github.com/user-attachments/assets/d7aef6a8-8c29-4278-b91f-9b3031c8cbd5) 
 
## Generate a commit message  

### Requred servers
- Chat server

### How to use it 
In the source control panel just click on the star button (near the commit button).  
This generate a commit message, based on the current changes.   

![Generate a commit message](https://github.com/user-attachments/assets/25f5d1ae-3673-4416-ba52-7615969c1bb3) 
 
## Setup instructions for llama.cpp server

### [Linux](https://github.com/ggml-org/llama.vscode/wiki/Linux)  
  
### [Mac](https://github.com/ggml-org/llama.vscode/wiki/Mac)  
  
### [Windows](https://github.com/ggml-org/llama.vscode/wiki/Windows)
    
[More details about llama.cpp server](https://github.com/ggerganov/llama.cpp/blob/master/tools/server/)

## Features

### [Code completion](https://github.com/ggml-org/llama.vscode/wiki/Code-completion) 

### [Chat with AI](https://github.com/ggml-org/llama.vscode/wiki/Chat-with-AI) 

### [Chat with AI with project context](https://github.com/ggml-org/llama.vscode/wiki/Chat-with-AI-with-project-context) 

### [Edit with AI](https://github.com/ggml-org/llama.vscode/wiki/Edit-with-AI) 

### [Generate commit message](https://github.com/ggml-org/llama.vscode/wiki/Generate-commit-message) 

### [Statusbar](https://github.com/ggml-org/llama.vscode/wiki/Statusbar)

### [Menu](https://github.com/ggml-org/llama.vscode/wiki/Statusbar)
 
 
## Llama Agent 

### Requred servers
- Tools server
- Chat server (if search_source tool is used)
- Embeddings server (if search_source tool is used)

### How to use it 
Select "Show Llama Agent" from llama-vscode menu or Ctrl+Shift+A

![Chat with AI](https://github.com/user-attachments/assets/e068f5cc-fce3-4366-9b8f-1c89e952b411) 
 
## Manage chat models 

### Requred servers
- No servers required

### How to use it 
Select "Chat models..." from llama-vscode menu

![Chat with AI](https://github.com/user-attachments/assets/e068f5cc-fce3-4366-9b8f-1c89e952b411) 
 
## Manage completion models 

### Requred servers
- No servers required

### How to use it 
Select "Completion models..." from llama-vscode menu

![Chat with AI](https://github.com/user-attachments/assets/e068f5cc-fce3-4366-9b8f-1c89e952b411) 
 
## Manage embeddings 

### Requred servers
- No servers required

### How to use it 
Select "Embeddings models..." from llama-vscode menu

![Chat with AI](https://github.com/user-attachments/assets/e068f5cc-fce3-4366-9b8f-1c89e952b411) 
 
## Manage orchestras 

### Requred servers
- No servers required

### How to use it 
Select "Orchestras..." from llama-vscode menu

![Chat with AI](https://github.com/user-attachments/assets/e068f5cc-fce3-4366-9b8f-1c89e952b411) 
 
## Manage tools models 

### Requred servers
- No servers required

### How to use it 
Select "Tools models..." from llama-vscode menu

![Chat with AI](https://github.com/user-attachments/assets/e068f5cc-fce3-4366-9b8f-1c89e952b411) 
 
## Menu  

### Requred servers
- No servers requred

### How to use it 
*Open llama-vscode menu with*
- Click on "llama-vscode" on the status bar
OR 
- Ctrl+Shift+M

![Menu](https://github.com/user-attachments/assets/84f5f1a9-de6a-46eb-a337-2871a612cb69)
 
 
## Model selection

### What is model selection

### Why is model selection needed

### How to use it 
There are different ways to select a model
- In Llama Agent click the button for selecting a model (completion, chat, embeddings, tools)
- In llama-vscode menu select "Completion models..." (or chat, embeddings, tools)
- Select an orchestra. This will select the models, which are part of the orchestra
 
 
## Orchestra

### What is orchestra

### Why is orchestra needed

### How to use it
 
 
## Statusbar  

### Requred servers
- No servers requred

### How to use it 
- View vscode-state
- View statistics
- Click on "llama-vscode" status bar to show llama-vscode menu

![Statusbar](https://github.com/user-attachments/assets/62562aab-93b5-4334-928f-f2a4efcf8b46)


 
 
## Setup llama.cpp server for Linux 
### Code completion server
*Used for*  
    - code completion

*LLM type*  
    - FIM (fill in the middle)  

*Instructions*  
1. Download the release files for your OS from [llama.cpp releases.](https://github.com/ggerganov/llama.cpp/releases) (or build from source).  
2. Download the LLM model and run llama.cpp server (combined in one command)  

CPU only

```bash
llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF --port 8012 -ub 512 -b 512 --ctx-size 0 --cache-reuse 256
```

With Nvidia GPUs and installed cuda drivers  
- more than 16GB VRAM 
```bash 
`llama-server --fim-qwen-7b-default -ngl 99`  
```
- less than 16GB VRAM  
```bash
`llama-server --fim-qwen-3b-default -ngl 99`  
```
- less than 8GB VRAM  
```bash
`llama-server --fim-qwen-1.5b-default -ngl 99`  
```
If the file is not available (first time) it will be downloaded (this could take some time) and after that llama.cpp server will be started.  
  
  
### Chat server  
*Used for*  
    - Chat with AI  
    - Chat with AI with project context  
    - Edit with AI  
    - Generage commit message  

*LLM type*  
    - Chat Models    

*Instructions*  
Same like code completion server, but use chat model and a little bit different parameters.  

CPU-only:  
```bash
`llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```

With Nvidia GPUs and installed cuda drivers  
- more than 16GB VRAM  
```bash
`llama-server -hf ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```
- less than 16GB VRAM  
```bash
`llama-server -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```
- less than 8GB VRAM  
```bash
`llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```


### Embeddings server  
*Used for*  
    - Chat with AI with project context  

*LLM type*  
    - Embedding    

*Instructions*  
Same like code completion server, but use embeddings model and a little bit different parameters. 
```bash  
`llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF --port 8010 -ub 2048 -b 2048 --ctx-size 2048 --embeddings`  
```
 
 
### Setup llama.cpp servers for Mac  
#### Prerequisites - [Homebrew](https://brew.sh/)

### Code completion server
*Used for*  
    - code completion

*LLM type*  
    - FIM (fill in the middle)  

*Instructions*
1. Install llama.cpp with the command
```bash  
`brew install llama.cpp`  
```
2. Download the LLM model and run llama.cpp server (combined in one command)  
- If you have more than 16GB VRAM:  
```bash
`llama-server -hf ggml-org/Qwen2.5-Coder-7B-Q8_0-GGUF:Q8_0 --port 8012 -ngl 99 -fa -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256`  
```
- If you have less than 16GB VRAM:  
```bash
`llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF:Q8_0 --port 8012 -ngl 99 -fa -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256`  
```
If the file is not available (first time) it will be downloaded (this could take some time) and after that llama.cpp server will be started. 

### Chat server  
*Used for*  
    - Chat with AI  
    - Chat with AI with project context  
    - Edit with AI  
    - Generage commit message  

*LLM type*  
    - Chat Models    

*Instructions*  
Same like code completion server, but use chat model and a little bit different parameters.  

CPU-only:
```bash  
`llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```

With Nvidia GPUs and installed cuda drivers  
- more than 16GB VRAM  
```bash
`llama-server -hf ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```
- less than 16GB VRAM  
```bash
`llama-server -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```
- less than 8GB VRAM  
```bash
`llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF --port 8011 -np 2` 
```

### Embeddings server  
*Used for*  
    - Chat with AI with project context  

*LLM type*  
    - Embedding    

*Instructions*  
Same like code completion server, but use embeddings model and a little bit different parameters.   
```bash
`llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF --port 8010 -ub 2048 -b 2048 --ctx-size 2048 --embeddings`  
```

 
 
### Setup llama.cpp servers for Windows  

### Code completion server
*Used for*  
    - code completion

*LLM type*  
    - FIM (fill in the middle)  

*Instructions*
Download the release files for Windows for llama.cpp from [releases](https://github.com/ggerganov/llama.cpp/releases). For CPU use llama-*-bin-win-cpu-*.zip. For Nvidia: llama-*-bin-win-cuda*-x64.zip and if you don't have cuda drivers installed also cudart-llama-bin-win-cuda*-x64.zip.

3. Run llama.cpp server  
3.1 No GPUs   
```bash
`llama-server.exe --fim-qwen-1.5b-default --port 8012`  
```
3.2 With Nvidia GPUs and installed latest cuda     
```bash
`llama-server.exe --fim-qwen-1.5b-default --port 8012 -ngl 99`  
```
Now you could start using llama-vscode extension.  

[More details about llama.cpp server](https://github.com/ggerganov/llama.cpp/blob/master/tools/server/)

### Chat server  
*Used for*  
    - Chat with AI  
    - Chat with AI with project context  
    - Edit with AI  
    - Generage commit message  

*LLM type*  
    - Chat Models    

*Instructions*  
Same like code completion server, but use chat model and a little bit different parameters.  

CPU-only:  
```bash
`llama-server.exe -hf qwen2.5-coder-1.5b-instruct-q8_0.gguf --port 8011`  
```

With Nvidia GPUs and installed cuda drivers  
- more than 16GB VRAM  
```bash
`llama-server.exe -hf qwen2.5-coder-7b-instruct-q8_0.gguf --port 8011 -np 2 -ngl 99`  
```
- less than 16GB VRAM  
```bash
`llama-server.exe -hf qwen2.5-coder-3b-instruct-q8_0.gguf --port 8011 -np 2 -ngl 99`  
```
- less than 8GB VRAM  
```bash
`llama-server.exe -hf qwen2.5-coder-1.5b-instruct-q8_0.gguf --port 8011 -np 2 -ngl 99` 
```


### Embeddings server  
*Used for*  
    - Chat with AI with project context  

*LLM type*  
    - Embedding    

*Instructions*  
Same like code completion server, but use embeddings model and a little bit different parameters.   
```bash
`llama-server.exe -hf nomic-embed-text-v2-moe-q8_0.gguf --port 8010 -ub 2048 -b 2048 --ctx-size 2048 --embeddings`  
```
 
 
