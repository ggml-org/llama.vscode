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
Llama Agent is still in development, but could produce some results with intlligent models with tools support.

The best wey to prepare the environment for the agent is by selecting and Orchestra (group of models). So, below is the standard workflow:
1. Select "Show Llama Agent" from llama-vscode menu or Ctrl+Shift+A to show Llama Agent. 
2. Click "Orhestra" button and select orchestra, which supports agent, for your needes. This will download the required models and start llama.cpp servers with them. For the external servers (like OpenRouter) llama-vscode will ask for api key if needed.
3. Write your request and send it with Enter or the Send button.

Optional
- You could add files to the context with the @ button. 
- You could select source code and activate the agent (Ctrl+Shift+A) to attache the selected lines to the contxt
- You could choose the tools to be used from "Select Tools" button (on the right side of "New Chat" button). If you have installed and started MCP Servers in VS Code, their tools will be available for selection too. Don't forget to click the OK button after changing the tool selection.

Click button "Stop Orchestra" to stop the servers.
Click button "Selected Models" to show details about the selected models 
 
## Use as local AI runner (as LM Studio, Ollama, etc.) 

### Overview
llama-vscode could be used as a local AI runner (as LM Studio, Ollama, etc.) . Models are searched in Huggingface. After a model is selected, llama-vscode automatically downloads it and starts a llama-server with it. With this the user could start chatting with an AI.

### How to use it
1. Show Llama Agent panel (Ctrl+Shift+A or from llama-vscode menu) and see the "Chat With AI" frame.
2. Click "llama.cpp" button to install llama.cpp (if not yet done). The installation for Windows (with winget) and Mac (with brew) is automatic. For Linux, the user should do it manually ([download the latest llama.cpp package for Linux](https://github.com/ggml-org/llama.cpp/releases) and add the bin folder to the PATH)
3. Click "Add" button, enter search words to see a list of models from Huggingface, select a model, select quantization. If prefered - accept to start the model immediately. (not needed if the model is already added)
4. Click "Select" button and select a model to run (not needed if the model is already started in the previous step)
5. Click "Chat" button - a web page for chat with AI will be shown in VS Code

Enjoy talking with local AI.
 
 
## Manage chat models 

### Requred servers
- No servers required

### How to use it 
See manage completion models. The functionality is the same. 
 
## Manage completion models 

### Requred servers
- No servers required

### Overview
Completion models configurations are stored and could be reused. For simplicity the term "completion models" will be used as a synonim for Completion models configurations.
Completion models could be for local models (run by llama-vscode) and for externally run servers.
They have properties: name, local start command (llama-server command to start a server with this model locally), ai model (as required by the provider), endpoint, is key required  
 

Completion models configurations could be added/deleted/viewed/selected/deselected/added from huggingface/exported/imported

### How to use it 
Select "Completion models..." from llama-vscode menu  

- Add models  
Enter the requested properties.  
For local models name, local start command and endpoint are required  
For external servers name and endpoint are required  

- Delete models  
Select the model you want to delete from the list and delete it.

- View  
Select a model from the list to view all the details for this model

- Selected  
Select a model from the list to select it. If the model is a local one (has a command in local start command) a llama.cpp server with this model will be started. Only one completion model could be selected at a time.

- Deselect  
Deselect the currently selected model. If the model is local, the llama.cpp server will be started.

- Add model from huggingface  
Enter search words to find a model from huggingface. If the model is selected it will be automatically downloaded (if not yet done) and a llama.cpp server will be started with it.

- Export  
A model could be export as a .json files. This file could be shared with other used, modified if needed and imported again. Select a model to export it.

- Import  
A model could be imported from a .json file - select a file to import it. 
 
## Manage embeddings 

### Requred servers
- No servers required

### How to use it 
See manage completion models. The functionality is the same. 
 
## Manage orchestras 

### Requred servers
- No servers required

### How to use it 
Orchestra is a group of models (completion, chat, embeddings, tools)

See manage completion models for more details. The functionality is similar.
The differences are:   
no add model from Huggingface  
adding an orchestra is adding and orchestra with the currently selected models  
selecting an orchestra deselects all models and selects the models inside the orchestra  
deselecting an orchestra deselects/stops all currently selected models 
menu item "Download/upload orchestras online", which opens a web page where orchestras could be downloaded/uploaded 
 
## Manage tools models 

### Requred servers
- No servers required

### How to use it 
See manage completion models. The functionality is the same. 
 
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
At a given time only one model could be selected (no model selected is also possible). If a model is selected, llama-vscode assumes this model is available at the endpoint for this model. If the model is local, the selection of a model starts a llama.cpp server with it.

### Why is model selection needed
This way is more clear what models for what will be used.

### How to use it 
There are different ways to select a model
- In Llama Agent click the button for selecting a model (completion, chat, embeddings, tools)
- In llama-vscode menu select "Completion models..." (or chat, embeddings, tools)
- Select an orchestra. This will select the models, which are part of the orchestra
 
 
## Orchestra

### What is orchestra
Orchestra is a group of models. The concept was introduced to make it easier for the users to prepare the environment for their needs. Selecting an orchestra with a given intent will make sure all needed servers are available.

### How to use it
Select orchestra from "Orchestra" button of the Llama Agent or from llama-vscode menu. This will select the models inside an orchestra (and start the corresponding local servers)
Deselect orchestra from "Stop Orchestra" button of the Llama Agent or from llama-vscode menu. This deselect all models (and stop the locally running servers)
 
 
## Statusbar  

### Requred servers
- No servers requred

### How to use it 
- View vscode-state
- View statistics
- Click on "llama-vscode" status bar to show llama-vscode menu

![Statusbar](https://github.com/user-attachments/assets/62562aab-93b5-4334-928f-f2a4efcf8b46)


 
 
## Setup llama.cpp server for Linux 

1. Download the release files for your OS from [llama.cpp releases.](https://github.com/ggerganov/llama.cpp/releases) (or build from source).  
2. Add the bin folder to PATH, so that it is globally available

The configurations below are left for a reference, but now it is possible to do it easier - add a model from the menu and select it.

### Code completion server
*Used for*  
    - code completion

*LLM type*  
    - FIM (fill in the middle)  

*Instructions*  

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

Show llama-vscode menu (Ctrl+Shift+M) and select "Install/upgrade llama.cpp" (if not yet done). After that add/select the models you want to use.   

The instructions below are left for a reference, but now it is possible to do it easier - add a model from the menu and select it.

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

Show llama-vscode menu (Ctrl+Shift+M) and select "Install/upgrade llama.cpp" (if not yet done). After that add/select the models you want to use.   

The instructions below are left for a reference, but now it is possible to do it easier - add a model from the menu and select it.

### Code completion server
*Used for*  
    - code completion

*LLM type*  
    - FIM (fill in the middle)  

*Instructions*
#### Install llama.cpp
```bash
`winget install llama.cpp`
```
OR  
  
Download the release files for Windows for llama.cpp from [releases](https://github.com/ggerganov/llama.cpp/releases). For CPU use llama-*-bin-win-cpu-*.zip. For Nvidia: llama-*-bin-win-cuda*-x64.zip and if you don't have cuda drivers installed also cudart-llama-bin-win-cuda*-x64.zip.

#### Run llama.cpp server  
No GPUs   
```bash
`llama-server.exe --fim-qwen-1.5b-default --port 8012`  
```
With GPUs     
```bash
`llama-server.exe --fim-qwen-1.5b-default --port 8012 -ngl 99`  
```  
If you've installed llama.cpp with winget you could skip the .exe suffix and use just llama-server in the commands.  

Now you could start using llama-vscode extension for code completion.  

[More details about llama.cpp server](https://github.com/ggerganov/llama.cpp/blob/master/tools/server/)

### Chat server  
*Used for*  
    - Chat with AI  
    - Chat with AI with project context  
    - Edit with AI  
    - Generate commit message  

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
 
 
