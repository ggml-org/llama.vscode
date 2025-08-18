## Chat with AI about llama-vscode  

### Requred servers
- Chat server

### How to use it 
This is a conversation with the local AI about llama-vscode, something like help how to use llama-vscode.
- From llama-vscode menu select "Chat with AI about llama-vscode" -> a window will be opened (the conversation history overlays the actual chat window, but just click on the chat window)
- Enter your question about llama-vscode
The first time it could take longer to answer. The following questions will be answered faster as the input will be cached.
 
 
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
 
## Delete models  

### Overview
Llama-vscode automatically downloads (if not yet done) models (LLMs) from [Huggingface](https://huggingface.co/) if a local model (or env) is selected. The downloaded models are GGUF files. Once downloaded, the models are reused. The LLMs could take a lot of space on your hard disk. For example gpt-oss-20b-GGUF is 12GB.

### How to delete models
All downloaded models are stored in one standard folder:
- Windows: C:\Users\<user_name>\AppData\Local\llama.cpp.
- Mac or Linux: /users/<user_name>/Library/Caches/llama.cpp. 


You could delete the GGUF files from this folder. If they are missing, but are needed by llama-vscode, it will download them automatically again.



 
 
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
 
## Env

### What is env
Env (short for environment) is a group of models. Env makes it easier for the users to prepare the environment for their needs. Selecting an env with a given intent will make sure all needed servers are available. One env could contain up to 4 different models - for completions, chat, embeddings, tools. If the user wants to use only code completions functionality, he/she could select an env with only one model for completions. If the user wants to use wants to use all the functionality from llama-vscode, he/she could select an env with full package of models.

### How to use it
Select env for your needs from llama-vscode menu, "Select/start env..." or from Llama Agent, button "Select Env". This will select the models inside an env (and start the corresponding local servers)
Deselect env fromllama-vscode menu, "Deselect/stop env..." or from Llama Agent, button "Deselect Env". This deselect all models (and stops the locally running servers, started by llama-vscode).

If you want the last selected (used) env to be started automatically on startup, you can enable setting Env_start_last_used. With this setting checked (enabled), on each startup of the project, the last selected env will be started. Last selected env is project specific. You could start automatically different envs for different projects.
 
 
## Generate a commit message  

### Requred servers
- Chat server

### How to use it 
In the source control panel just click on the star button (near the commit button).  
This generate a commit message, based on the current changes.   

![Generate a commit message](https://github.com/user-attachments/assets/25f5d1ae-3673-4416-ba52-7615969c1bb3) 
 
## Version 0.0.16 is released (14.08.2025)
## What is new
* Llama Agent UI improved
* Chat with AI about llama.vscode added (select it from llama-vscode menu)
* Envs (environments) with local usage of gpt-oss 20B (for agent) are added. Please wait several days until llama.cpp delivers a version with a good support for gpt-oss for agent usage (in week 18-24 of August, 2025) and then upgrade llama.cpp (for example from llama-vscode menu).

## Setup instructions for llama.cpp server

### [Linux](https://github.com/ggml-org/llama.vscode/wiki/Linux)  
  
### [Mac](https://github.com/ggml-org/llama.vscode/wiki/Mac)  
  
### [Windows](https://github.com/ggml-org/llama.vscode/wiki/Windows)
    
[More details about llama.cpp server](https://github.com/ggerganov/llama.cpp/blob/master/tools/server/)

## Features

### [Code completion](https://github.com/ggml-org/llama.vscode/wiki/Code-completion) 

### [Edit with AI](https://github.com/ggml-org/llama.vscode/wiki/Edit-with-AI) 

### [Llama agent](https://github.com/ggml-org/llama.vscode/wiki/Llama-agent)

### [Local ai runner](https://github.com/ggml-org/llama.vscode/wiki/Local-ai-runner)

### [Chat with AI about llama vscode](https://github.com/ggml-org/llama.vscode/wiki/Chat-with-AI-about-llama-vscode)

### [Chat with AI](https://github.com/ggml-org/llama.vscode/wiki/Chat-with-AI) 

### [Chat with AI with project context](https://github.com/ggml-org/llama.vscode/wiki/Chat-with-AI-with-project-context) 

### [Generate commit message](https://github.com/ggml-org/llama.vscode/wiki/Generate-commit-message) 



### [Statusbar](https://github.com/ggml-org/llama.vscode/wiki/Statusbar)

### [Menu](https://github.com/ggml-org/llama.vscode/wiki/Statusbar)

### [Env](https://github.com/ggml-org/llama.vscode/wiki/Env)

### [Manage completion models](https://github.com/ggml-org/llama.vscode/wiki/Manage-completion-models)

### [Manage chat models](https://github.com/ggml-org/llama.vscode/wiki/Manage-chat-models)

### [Manage embeddings models](https://github.com/ggml-org/llama.vscode/wiki/Manage-embeddings-models)

### [Manage tools models](https://github.com/ggml-org/llama.vscode/wiki/Manage-tools-models)

### [Manage envs](https://github.com/ggml-org/llama.vscode/wiki/Manage-envs)

### [Model selection](https://github.com/ggml-org/llama.vscode/wiki/Model-selection)

 
 
## How to use llama-vscode  

### Overview
llama-vscode is an extension for code completion, chat with ai and agentic coding, focused on local model usage with llama.cpp.

### How to use it 
1. Install llama.cpp  
- Show llama-vscode menu by clicking "llama-vscode" in the status bar or by Ctrl+Shift+M, and select 'Install/upgrade llama.cpp' (sometimes restart is needed to adjust the paths to llama-server)
2. Select env (group of models) for your needs from llama-vscode menu.  
- This will download (only the first time) the models and run llama.cpp servers locally (or use external servers endpoints, depends on env)
3. Start using llama-vscode  
- For code completion - just start typing (uses completion model)
- For edit code with AI - select code, right click and select 'llama-vscode Edit Selected Text with AI' (uses chat model, no tools support required)
- For chat with AI (quick questions to (local) AI instead of searching with google) - select 'Chat with AI' from llama.vscode menu (uses chat model, no tools support required, llama.cpp server should run on model endpoint.)
- For agentic coding - select 'Show Llama Agent' from llama.vscode menu (or Ctrl+Shift+A) and start typing your questions or requests (uses tools model and embeddings model for some tools, most intelligence needed, local usage supported, but you could also use external, paid providers for better results)


If you want to use llama-vscode only for code completion - you could disable RAG from   llama-vscode menu to avoid indexing files.


If you are an existing user - you could continue using llama-vscode as before.


For more details - select 'View Documentation' from llama-vscode menu

 
 
## Llama Agent 

### Requred servers
- Tools server
- Chat server (if search_source tool is used)
- Embeddings server (if search_source tool is used)

### Overview
Llama agent uses AI and tools to answer questions, change and add files and do everythin eles, which is provided by the tools.  
Llama agent is still in development, but could produce some results with intlligent models with tools support.  
Llama agent doesn't ask for permission for each change of a file. Use VS Code's Source Control view or github to review and rollback (if needed) the changes.  
Llama agent asks for permission for executing terminal command. However, if the setting Tool_permit_some_terminal_commands is enabled, it will stop asking for permissions for some commands, which are considered safe.

### How to use it 
The best wey to prepare the environment for the agent is by selecting an Env (group of models). So, below is the standard workflow:
1. Select "Show Llama Agent" from llama-vscode menu or Ctrl+Shift+A to show Llama Agent. 
2. Click "Select Env" button (visible if there is no selected env) and select env. Only envs, which support agent, will be shown. This will download the required models and start llama.cpp servers with them. For the external servers (like OpenRouter) llama-vscode will ask for api key if needed.
3. Write your request and send it with Enter or the "Send" button.

Optional
- You could add files to the context with the @ button. 
- Activating an agent (Ctrl+Shift+A or from llama-vscodd menu) adds the open file to the agent context
- You could select source code and activate the agent (Ctrl+Shift+A or from llama-vscodd menu) to attach the selected lines to the context
- You could choose the tools to be used from "Select Tools" button (on the right side of "New Chat" button). If you have installed and started MCP Servers in VS Code, their tools will be available for selection too. Don't forget to click the OK button after changing the tool selection.

Click button "Deselect Env" (vislble if there is a selected env with agent model) to deselect the env and selected models and stop the servers, which were started by llama-vscode. 
Click button "Selected Models" to show details about the selected models

https://github.com/user-attachments/assets/72029f04-0ec0-4087-8ec3-316de88092c8




https://github.com/user-attachments/assets/d7da8610-ebca-4d1f-b412-82d58e81a43e



https://github.com/user-attachments/assets/78596474-d8ef-4d29-9b36-59cbc5308116

 
 
## Use as local AI runner (as LM Studio, Ollama, etc.) 

### Overview
llama-vscode could be used as a local AI runner (as LM Studio, Ollama, etc.) . Models are searched in Huggingface. After a model is selected, llama-vscode automatically downloads it and starts a llama-server with it. With this the user could start chatting with an AI.

### How to use it
1. From llama-vscode menu select "Use as local AI runner" - llama view will be opened with buttons "llama.cpp", "Add", "Select", "Chat".
2. Click "llama.cpp" button to install/upgrade llama.cpp (if not yet done). The installation for Windows (with winget) and Mac (with brew) is automatic. For Linux, the user should do it manually ([download the latest llama.cpp package for Linux](https://github.com/ggml-org/llama.cpp/releases) and add the bin folder to the PATH)
3. Click "Add" button, enter search words to see a list of models from Huggingface, select a model, select quantization. If prefered - accept to start the model immediately. (not needed if the model is already added)
4. Click "Select" button and select a model to run (not needed if the model is already started in the previous step)
5. Click "Chat" button - a web page for chat with AI will be shown in VS Code

Enjoy talking with local AI
 
 
## Manage envs 

### Requred servers
- No servers required

### Overview
Agent is a system prompt + default tools. In future a model will be added, but for now the agent will use the selected tools model.

Agent configurations could be added/deleted/viewed/selected/deselected/exported/imported

### How to use it 
Select "Agent..." from llama-vscode menu  

- Add agent...
Shows a message that agent could be added from property agents_list. Will be improved in the future.

- Delete agent...  
Shows a message that agent could be deleted from property agents_list. Will be improved in the future.

- View agent...
Select an agent from the list to view all the details for this agent

- Select/Start agent...  
Select agent from the list. Only one agent could be selected at a time. After the selection, the llama-vscode tools (enabled/disabled)  will be updated accordingly. If an agent is selected, it will be used as default for the agent sessions.

- Deselect/stop agent...
Deselect the currently selected agent. If no agent is selected, the default system prompt will be used.

- Export  
An env could be exported as a .json files. This file could be shared with other users, modified if needed, and imported again. Select an agent to export it.

- Import  
An agent could be imported from a .json file - select a file to import it.
 
 
## Manage chat models 

### Requred servers
- No servers required

### Overview
Chat models configurations are stored and could be reused. For simplicity the term "chat models" will be used as a synonim for chat models configurations.
Chat models could be for local models (run by llama-vscode) and for externally run servers.
They have properties: name, local start command (llama-server command to start a server with this model locally), ai model (as required by the provider), endpoint, is key required  
 

Chat models configurations could be added/deleted/viewed/selected/deselected/added from huggingface/exported/imported

### How to use it 
Select "Chat models..." from llama-vscode menu  

- Add models  
Enter the requested properties.  
For local models name, local start command and endpoint are required  
For external servers name and endpoint are required  

- Delete models  
Select the model you want to delete from the list and delete it.

- View  
Select a model from the list to view all the details for this model

- Selected  
Select a model from the list to select it. If the model is a local one (has a command in local start command) a llama.cpp server with this model will be started. Only one chat model could be selected at a time.

- Deselect  
Deselect the currently selected model. If the model is local, the llama.cpp server will be started.

- Add model from huggingface  
Enter search words to find a model from huggingface. If the model is selected it will be automatically downloaded (if not yet done) and a llama.cpp server will be started with it.

- Export  
A model could be exported as a .json files. This file could be shared with other used, modified if needed and imported again. Select a model to export it.

- Import  
A model could be imported from a .json file - select a file to import it. 
 
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
Use models, which support FIM (Fill In the Middle), for example Qwen2.5-Coder-1.5B-Q8_0-GGUF

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
A model could be exported as a .json files. This file could be shared with other used, modified if needed and imported again. Select a model to export it.

- Import  
A model could be imported from a .json file - select a file to import it. 
 
## Manage embeddings 

### Requred servers
- No servers required

### Overview
Embeddings models configurations are stored and could be reused. For simplicity the term "embeddings models" will be used as a synonim for embeddings models configurations.
Embeddings models could be for local models (run by llama-vscode) and for externally run servers.
They have properties: name, local start command (llama-server command to start a server with this model locally), ai model (as required by the provider), endpoint, is key required  
 

Embeddings models configurations could be added/deleted/viewed/selected/deselected/added from huggingface/exported/imported

### How to use it 
Select "Embeddings models..." from llama-vscode menu  

- Add models  
Enter the requested properties.  
For local models name, local start command and endpoint are required  
For external servers name and endpoint are required  
Use models, which support embeddings, for example Nomic-Embed-Text-V2-GGUF

- Delete models  
Select the model you want to delete from the list and delete it.

- View  
Select a model from the list to view all the details for this model

- Selected  
Select a model from the list to select it. If the model is a local one (has a command in local start command) a llama.cpp server with this model will be started. Only one Embeddings model could be selected at a time.

- Deselect  
Deselect the currently selected model. If the model is local, the llama.cpp server will be started.

- Add model from huggingface  
Enter search words to find a model from huggingface. If the model is selected it will be automatically downloaded (if not yet done) and a llama.cpp server will be started with it.

- Export  
A model could be exported as a .json files. This file could be shared with other used, modified if needed and imported again. Select a model to export it.

- Import  
A model could be imported from a .json file - select a file to import it. 
 
## Manage envs 

### Requred servers
- No servers required

### Overview
Env is a group of models (Env, chat, embeddings, tools)
Env configurations are stored and could be reused. For simplicity the term "Env" will be used as a synonim for environemnt  configurations.  
They have properties: name, description, env, chat, embeddings, tools
 

Env configurations could be added/deleted/viewed/selected/deselected/exported/imported

### How to use it 
Select "Env..." from llama-vscode menu  

- Add Env...
Opens a llama view with buttons for selecting envs.The button "Add Env" creates an env with the currently selected models (i.e. current environment).

- Delete env...  
Select the env you want to delete from the list and delete it.

- View env...
Select an env from the list to view all the details for this env

- Select/Start env...  
Select env from the list. Only one Env could be selected at a time. If an env is selected, the models from this env will be selected as well and the local ones will be started.

- Deselect/stop env...
Deselect the currently selected env. All models from this env will be also deselected and the local ones, started by llama-vscode will be stopped.

- Export  
An env could be exported as a .json files. This file could be shared with other users, modified if needed, and imported again. Select an env to export it.

- Import  
An env could be imported from a .json file - select a file to import it.

There is also a menu item "Download/upload envs online", which opens a web page where envs could be downloaded/uploaded 
 
## Manage tools models 

### Requred servers
- No servers required

### Overview
Tools models configurations are stored and could be reused. For simplicity the term "tools models" will be used as a synonim for tools models configurations.
Tools models could be for local models (run by llama-vscode) and for externally run servers.
They have properties: name, local start command (llama-server command to start a server with this model locally), ai model (as required by the provider), endpoint, is key required  
 

Tools models configurations could be added/deleted/viewed/selected/deselected/added from huggingface/exported/imported

### How to use it 
Select "Tools models..." from llama-vscode menu  

- Add models  
Enter the requested properties.  
For local models name, local start command and endpoint are required  
For external servers name and endpoint are required  
Use models, which support tools usage, for example gpt-oss-20b-GGUF

- Delete models  
Select the model you want to delete from the list and delete it.

- View  
Select a model from the list to view all the details for this model

- Selected  
Select a model from the list to select it. If the model is a local one (has a command in local start command) a llama.cpp server with this model will be started. Only one Tools model could be selected at a time.

- Deselect  
Deselect the currently selected model. If the model is local, the llama.cpp server will be started.

- Add model from huggingface  
Enter search words to find a model from huggingface. If the model is selected it will be automatically downloaded (if not yet done) and a llama.cpp server will be started with it.

- Export  
A model could be export as a .json files. This file could be shared with other used, modified if needed and imported again. Select a model to export it.

- Import  
A model could be imported from a .json file - select a file to import it. 
 
## MCP Support  

### Requred servers
- Tools server

### Overview
llama-vscode could use the the tools from the MCP servers, which are installed in VS Code (part of VS Code's Extensions view). 

### How to use it 
1. Install MCP Server in VS Code 
- Select "Extensions" view from VS Code, 
- Open MCP Servers panel
- Click "Browse MCP Servers" (at the end of the "MCP SERVERS" line)
- Select and install MCP Server
2. Start the installed MCP Server 
- From the context menu of the MCP Server select "Start Server". VS Code should recognize the tools of the MCP Server.
3. Select "Show Llama Agent" from vscode-menu or use Ctrl+Shift+A (if needed select environment with agent/tools support). 
4. Click "Select Tools" from Llama Agent panel and select the tools, which you want to use from your MCP Server


 
 
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
- Select an env. This will select the models, which are part of the env
 
 
## Statusbar  

### Requred servers
- No servers requred

### How to use it 
- View vscode-state
- View statistics
- Click on "llama-vscode" status bar to show llama-vscode menu

![Statusbar](https://github.com/user-attachments/assets/62562aab-93b5-4334-928f-f2a4efcf8b46)


 
 
## Use cases  

### Overview
The use cases below describe how to prepare and use llama-vscode in some specific cases. There are already some configurations for models and env, which could be selected and used directly

### Only completion used, local server started by llama-vscode
- Use the default configuration if it works for you by selecting Env for your case
- If you want to use a different one, here is how to prepare it:
1. Create completion model - select llama-vscode menu -> "Completion models..." -> "Add completion model from Huggingface", find the model in Huggingface and add it.
2. From llama-vscode menu select "Deselect/stop env and models"
3. Create an env, which includes only this model - from llama-vscode menu -> "Env..." -> "Add Env...". A panel will be show with buttons for selecting completion, chat, embeddings and tools models. Click "Compl" button and select the newly added model (the name is hf: model_name_from_huggingface). Test if code completion works well. Click button "Add Env" to save the environment.

### Only completion used, external server
Extarnal server could be also a local one, but is not started by llama-vscode on selecting the model. The completion server should support /infill endpoint, which is currently available only by llama.cpp.
1. Create a new model - select llama-vscode menu -> "Completion models..." -> "Add completion model...". Enter only name and endpoint.
2. From llama-vscode menu select "Deselect/stop env and models"
3. Create an env, which includes only this model - from llama-vscode menu -> "Env..." -> "Add Env...". A panel will be show with buttons for selecting completion, chat, embeddings and tools models. Click "Compl" button and select the newly added model. Test if code completion works well. Click button "Add Env" to save the environment.



 
 
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
 
 
