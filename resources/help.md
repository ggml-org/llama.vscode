## Agent commands

### What are agent commands
There are two types of agent commands:  

#### Prompt commands
Prompt commands send prompt to the agent (no prompt to the agent: false). They are a way to reuse often used prompts. They could be used to describe complex workflows or for simple instructions. If scripts are used, they should return the prompt, which will be sent to the agent. Skills are logically prompt commands and in the future versions they will be considered as agent prompt commands (but not yet).

#### Script commands
Script commands do not send prompt to the agent (no prompt to the agent: true, is script: true). They are actions within llama-vscode and could automate some tasks. For example select models, agents, change settings, etc.. The content of the command is intepreted as a [script](https://github.com/ggml-org/llama.vscode/wiki/Scripts) and is executed. All script files with suffix .lvs in the scripts_folder are considered as agent script commands and are shown on entering "/" in the agent prompt field.

Agent commands are stored in setting agent_commands and llama-vscode menu item "Agent commands..." could be used to manage them.  
The command prompt could contain terminal commands in format !'<terminal_command>' (as in claude code.). The command prompt is preprocessed and the terminal commands are executed and replaced with the the result of the execution. Example: !'pwd' will be replaced with the the current directory.

The prompt field of the command could be a path to a file. Before executing the command, the file is read and the content is used as the prompt field value. The file cold contain a prompt or a script.

### How to use them
Prerequisite for prompt commands: tools model is selected  
You could create agent commands from llama-vscode menu item "Agent commands..."\"Add agent command...". For creating a command with longer prompts you could export an existing command with "Agent commands..."\"Export agent command..." in a .json file, change the name and the prompt in the file and then import the new command with "Agent commands..."\"Import agent command...". 

In agent prompt text area press "/" - the available agent commands will be shown and could be selected. When selected, the command name is replaced with the longer prompt for this command and is sent to the AI model.  
Example:  
1. Select several lines of source code
2. Press Ctrl+Shift+A (or right click and select "llama-vscode: Show Llama Agent") - this will attach the selected lines to the prompt
3. Inside the agent prompt press "/" and select "explain"
The agent will explain the selected code.## Skills

### Overview
Llama-vscode support a simple auto memory for storing persistent data across conversations. The logic is as follows:
- The persistent memory is stored by the agent (when it considers necessary or if the user explicitly asks) in .md files in a project specific auto memory folder (for example /home/<user>/.config/Code/User/workspaceStorage/<project_id>/ggml-org.llama-vscode/auto_memory). (The agent is asked to use descriptive file names)
- On starting a chat with the agent, the list of the .md files names in the auto memory folder is added to the prompt. 
- The agent decides, based on the file name, what auto memory file to read (if any)

### How to use it
1. Make sure the setting auto_memory_enabled is checked (checked by default)
2. Make sure the setting max_auto_memory_files is greater than 0 (10 by default)
3. Start using the agent - it will automatically store the information, which it considers important for the future conversation in auto memory (or the user could explicitly ask something to be saved in auto memory).

Settings:
- auto_memory_enabled: If auto memory is enabled
- max_auto_memory_files: The max number of files to keep in auto memory (this is a hint to the AI not a strict limit)
## Chat with AI about llama-vscode  

### Requred servers
- Tools server

### How to use it 
This is a conversation with the llama-vscode help agent AI about llama-vscode, something like help how to use llama-vscode.
- From llama-vscode menu select "Chat with AI about llama-vscode" -> the agent will be opened
- Enter your question about llama-vscode
The first time it could take longer to answer. The following questions will be answered faster as the help information will be cached.
## Chat with AI  

### Requred servers
- Chat server

### How to use it 
This is a conversation with the local AI. Mainly for asking questions for reference instead of searching with google. It doesn't use the project information and therefore is fast.
- Press Ctrl+; inside an editor (or select from llama.vscode menu Chat with AI) - A chat window will open inside VS Code
- Enter your message and start the chat

![Chat with AI](https://github.com/user-attachments/assets/e068f5cc-fce3-4366-9b8f-1c89e952b411)## Code completion

### Requred servers
- Completion server

### How to use it
Every change in the editor will trigger a completion request to the server.
- Accept with a Tab
- Reject with Esc
- Accept the first line with Shift+Tab
- Acept the next word by Ctrl+right arrow



https://github.com/user-attachments/assets/97bb1418-dcea-4a49-8332-13b2ab4da661



![Code completion](https://private-user-images.githubusercontent.com/1991296/405712196-b19499d9-f50d-49d4-9dff-ff3e8ba23757.gif?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NDY5NDc1NDEsIm5iZiI6MTc0Njk0NzI0MSwicGF0aCI6Ii8xOTkxMjk2LzQwNTcxMjE5Ni1iMTk0OTlkOS1mNTBkLTQ5ZDQtOWRmZi1mZjNlOGJhMjM3NTcuZ2lmP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQVZDT0RZTFNBNTNQUUs0WkElMkYyMDI1MDUxMSUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNTA1MTFUMDcwNzIxWiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9NmZiMmI0NGYzNTkyZGZkMTM5Njk3M2NjZDFhMjFiNTFkMjVkMmY4MGQ5ZDQ2ZDQ0MDgzOWI2YjM5NTY0NzM2OSZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QifQ.P150YJh87_y1pin20aWIuKoPzivmDjZF0iAemQlk_ok)## Copilot Chat Model Provider

### Overview
Llama-vscode could be used as a VS Code copilot chat model provider. With other words llama-vscode could provide models for the copilot. The provided models could be from local models, openrouter.com or other appliation, which serves the tools models for llama-vscode. This way you could automatically download and start locally models by llama.cpp and llama-vscode and use them with Copilot for free.

### How to use it
1. Select/Start tools model from llama-vscode (local or external)  
<img width="485" height="875" alt="copilotSelectToolsModel" src="https://github.com/user-attachments/assets/caa33531-22f4-46dd-b429-7498c45c93e9" />
  
2. In VS Code Copilot show the models list -> Other Models -> Manage Models  
<img width="1404" height="754" alt="CopilotManageModels" src="https://github.com/user-attachments/assets/dc861aa1-db86-46ff-83c1-98c7a435ad06" />
  
3. Make the models (all models available by the application serving the tools model are shown) you want to use visible (click on the left of the model name)  

4. Select the desired model from Copilot and start using it
## Custom eval tool

### Overview
llama-vscode provides to the users the posibility to partially create their own tool. Custom eval tool is a simple one - has one parameters and provideds it to the user javascript function to calculate the result.

### How to use it
Configure the description of the tool, the parameter description and provide a javascript function (one parameter, returns string) to be called when the tool is used.


Settings:
- Tool_custom_tool_eval_description: Description of the tool. This description will be used by the AI to decide if this tool should be used. Example: "Use this tool to check if a number is perfect."
- Tool_custom_eval_tool_property_description: Description of the tool only parameter. This description will be used by the AI to decide what to provide as parameter when using this tool. Example: "a natural number to check if it is perfect or not"
- Tool_custom_eval_tool_code: javascript function with one parameter, which returns string. Could be a path to a file with javascript function. Example: C:\temp\perfectNimber.js



https://github.com/user-attachments/assets/fb12d56f-61e8-409b-b888-0a524167e116


https://github.com/user-attachments/assets/7e928fc3-da14-4834-a414-0f8e23593155## Custom tool

### Overview
llama-vscode provides to the users the possibility to partially create their own tool. Custom tool is a simple one - has not parameters and returns always the same result.

### How to use it
Configure the description of the tool and the returned result, enable the tool and ask the agent questions related to the tool.

Settings:
- Tool_custom_tool_description: Description of the tool. This description will be used by the AI to decide if this tool should be used. Example: "Use this tool for information about llama.cpp and llama serve - how to build it, how to use it, options, etc."
- Custom_tool_source: What should be returned by the tool. Could be a file, a web page. Example: "https://blog.steelph0enix.dev/posts/llama-cpp-guide/" for a web page.


https://github.com/user-attachments/assets/46602f8c-bd45-4794-9f5c-6ebe262c396a


https://github.com/user-attachments/assets/50baa8c3-f426-4901-a443-8882da644800## Deep links

### Overview
Llama-vscode supports deep links. For example, the link [vscode://ggml-org.llama-vscode?view=env](vscode://ggml-org.llama-vscode?view=env) launches VS Code and shows the env view.  
If you use the project parameter with a local folder path in the link, it will open the project. For example, [vscode://ggml-org.llama-vscode?project=~/myproject](vscode://ggml-org.llama-vscode?project=~/myproject) loads the folder ~/myproject in VS Code.  
It works in a similar was as the mailto: links, which open a mail client.


### How to use it
Click the link to have VS Code display the requested view and load the specified project folder.  For security reasosons, some platforms don't allow links different than http:// and https:// (for example github links from markdown). Some browsers don't allow deep links for security reasons. You can also open the link from the command line:

Linux:
```bash
xdg-open "vscode://ggml-org.llama-vscode?view=env"
```
Windows PowerShell:
```bash
Start-Process "vscode://ggml-org.llama-vscode?view=env"
```

Windows comd:
```bash
start "" "vscode://ggml-org.llama-vscode?view=env"
```

Mac:
```bash
open "vscode://ggml-org.llama-vscode?view=env"
```

To create a custom link, start with `vscode://ggml-org.llama-vscode?` and add desired parameters.

#### Parameters:
Available parameters include view, project, prompt (only applicable when used with view=agent) and filter (only applicable when used with the view=settings).

View parameter accepts these values:
- env - displays the env view
- agent - displays the agent view
- edit-agent - displays the agent editor view
- menu - displays the Llama-vscode menu
- chat-with-ai - displays the chat interface (requires a llama.cpp model to be selected for Chat or Tools)
- settings - displays the Llama-vscode settings (if filter is provided, settings will be filtered by the specified value)

Project parameter accepts a local folder path. Example: [vscode://ggml-org.llama-vscode?project=C:/projects/myproject](vscode://ggml-org.llama-vscode?project=C:/projects/myproject). Before opening the project, make sure you know this folder to avoid security issues.

Prompt accepts text vlaue - it will be used as a prompt for the agent. example: [vscode://ggml-org.llama-vscode?view=agent&prompt=Hello](vscode://ggml-org.llama-vscode?view=agent&prompt=Hello). 

Filter parameter accepts a text string. Example: [vscode://ggml-org.llama-vscode?view=settings&filter=timeout](vscode://ggml-org.llama-vscode?view=settings&filter=timeout)

All parameter values (mainly prompt and filter) should be URL encoded (for example the space character should be encoded as %20).## Delete models  

### Overview
Llama-vscode automatically downloads (if not yet done) models (LLMs) from [Huggingface](https://huggingface.co/) if a local model (or env) is selected. The downloaded models are GGUF files. Once downloaded, the models are reused. The LLMs could take a lot of space on your hard disk. For example gpt-oss-20b-GGUF is 12GB.

### How to delete models
All downloaded models are stored in one standard folder:
- Windows: C:\Users\<user_name>\AppData\Local\llama.cpp.
- Mac or Linux: /users/<user_name>/Library/Caches/llama.cpp. 


You could delete the GGUF files from this folder. If they are missing, but are needed by llama-vscode, it will download them automatically again.



## Dialogs

### What are dialogs
The messages to the users are shown in dialog windows. There are two types of dialogs:
- Popup dialogs - the messages are shown in a popup window.
- Dialogs in the editor - the messages are shown in the editor.

The popup dialogs in some OS don't support scrolling, so they are not very good for long messages. The text from the pupup dialogs can't be copied to the clipboard.  

The dialogs in the editor support scrolling, so they are good for long messages. The text from the pupup dialogs can be copied to the clipboard.

### How to use them
llama-vscode uses popup dialogs for short messages and dialogs in the editor for long messages.  
The setting popup_max_chars (default 160) determines the maximum number of characters in the popup dialogs. If the message is longer than this number, it will be shown in a dialog in the editor.


Settings:
- popup_max_chars - determines what message to the user should be shown in a popup dialog (less than this number). If the message is longer, it will be shown in a dialog in the editor.## Edit Agent 

### Overview
Edit agent view is used for adding and editing agents. From there it is also possible to delete and copy an existing agent as a new one. The identifier of an agent is it's name. For now there is no tools model as part of the agent (the currently selected tools model will be used)

<img width="582" height="977" alt="image" src="https://github.com/user-attachments/assets/9a406e7a-09ea-4f04-9054-f709bcdb038a" />


### How to use it 
Edit agent view could be shown in one of the following ways:  
- In the left sidebar click llama-viscode button and after that on the upper part click button Show Edit Agent View (pencip image)
- From llama-vscode menu (Ctrl+Shift+M) select Agents...-> Add agent (or Edit agent or Copy agent)
- From environment view, when an agent is selected, click button Edit - this will show the selected agent in the Edit Agent View

Edit existing agent:  
1. Click Select button and load an agent to be edited.
2. Change the Description and System Instructions fields (if needed)
3. Click Add Tools button and select the tools to be used for by the agent.
4. Click Save button

Add new agent:  
1. Click New button
2. Enter Name, Description and System Instructions for the agent
3. Click Add Tools button and select the tools to be used for by the agent.
4. Click Save button

Copy existing agent as a new one:  
1. Click Copy as New button
2. Edit Name, Description and System Instructions for the agent
3. Click Add Tools button and select the tools to be used for by the agent.
4. Click Save button

Delete agent: 
1. Click Delete button
2. Select an agent to be deleted from the list
3. Confirm the deletion of the agent


## Edit with AI  

### Requred servers
- Chat server

### How to use it  
- Select the source code you want to edit. 
- Right click on it and click on llama.vscode::Edit Selected Text with AI (or use Ctrl+Shift+E)
- Enter the instructions for editing
- Press enter - a diff panel will be shown with the changes on the right window
- press Tab to accept or Esc to discard the changes

https://github.com/user-attachments/assets/887d0b88-717b-4765-b565-d4c54673bde8


![Edit with AI](https://github.com/user-attachments/assets/d7aef6a8-8c29-4278-b91f-9b3031c8cbd5)## Env

### What is env
Env (short for environment) is a group of models, agent and settings. Env makes it easier for the users to prepare the environment for their needs. Selecting an env with a given intent will make sure all needed servers are available. One env could contain up to 4 different models - for completions, chat, embeddings, tools. Env could also contain an agent and settings for enabling/disabling completions, rag and starting last selected env on startup. If the user wants to use only code completions functionality, he/she could select an env with only one model for completions. If the user wants to use all the functionality from llama-vscode, he/she could select an env with full package of models.

### How to use it
Select env for your needs from llama-vscode ui or from llama-vscode menu, "Select/start env...". This will select the models inside an env (and start the corresponding local servers), agent aand set the settings.
Deselect env from llama-vscode ui or from llama-vscode menu, "Deselect/stop env...". This deselect all models and agent (and stops the locally running servers, started by llama-vscode). The settings will not be changed.

There is a page in llama-vscode UI with the current environment details. From there it is possible to change the current environment and also save it (i.e. create a new env)

### Settings
only_one_local_model - if true - on selecting a local model, the other selected local models are deselected/stopped. This is valid for completion, chat and tools models. Embeddings models are small and therefore excuded from the group. By default it is false.

<img width="540" height="996" alt="image" src="https://github.com/user-attachments/assets/b1a78d7a-8602-451a-b304-fc967fb66696" />

## Generate a commit message  

### Requred servers
- Chat server

### How to use it 
In the source control panel just click on the star button (near the commit button).  
This generate a commit message, based on the current changes.   

![Generate a commit message](https://github.com/user-attachments/assets/25f5d1ae-3673-4416-ba52-7615969c1bb3)## Health check

### Overview
Health check for the models is added. It works with llama.cpp server or other servers, which supports endpoint/health REST service. When the health check is enabled, the current state of the selected model is visible in the environment view. The health check is done every 30 seconds (could be changed from setting Health_check_interval_s). It could be triggered also manually by the user by clicking the appropriate button in the environment view (after the selected model name).

### How to use it
1. Enable health check in settings for the appropriate model (e.g. for completion Health_check_compl_enabled)
2. Open environment view and select the completion model (for example)
3. The health check will be monitored periodically and the status will be displayed in the environment view
4. Optionally, the health check can be triggered manually by clicking the appropriate button

Settings:
- Health_check_interval_s: The interval in seconds for the health check
- Health_check_compl_enabled: Enable/disable health check for completion model
- Health_check_chat_enabled: Enable/disable health check for chat model
- Health_check_embs_enabled: Enable/disable health check for embedding model
- Health_check_tools_enabled: Enable/disable health check for tools model

<img width="580" height="779" alt="image" src="https://github.com/user-attachments/assets/dca91333-687e-4856-b187-25df50d17b1c" />

<img width="580" height="779" alt="image" src="https://github.com/user-attachments/assets/bb29e0c8-85b4-4e7a-a3d9-f2d9a1679d3d" />


## Version 0.0.65 is released (05.09.2026)
### What is new
- Move agent view on the left or on the right side of VS Code - click button "..." and select the appropriate action 
- Drag&drop files to the agent. On drop the Shift key should be pressed. 
- Use the editor as an alternative of the agent chat input box. The tendency is to write more prompts than source code. Now you can use a decent editor to prepare the long and structured prompts. Write the prompt in the editor (for example in a .md file) and press Ctrl+Alt+Enter (or use the context menu) to send it directly to the agent. Controlled by settings send_prompt_from_editor_enabled and remove_sent_prompt_from_editor.
- New predefined models (OrcaRouter): DeepSeek V4 Flash 0731, GPT-6 Astra, Claude Fable 5.1


## Version 0.0.64 is released (02.09.2026)
### What is new
- Compact command added (configure the number of last messages to keep with setting Chats_msgs_keep)
- Agents view - information about the last request tokens/price and chat tokens/price
- Chat with AI - new button "Show in browser" - shows the webui in a browser, where the copy buttons work


## Version 0.0.63 is released (19.08.2026)
### What is new
- New tool added - multi_edit_file - does multiple edits in a single file
- New predefined tools model Qwen3.7 Flash (for OpenRouter and OrcaRouter) with 1M context, $0.03/M input $0.13/M output (good price/quality ratio).
- [Warning "Webview not ready yet. Please try again." on startup](https://github.com/ggml-org/llama.vscode/issues/227) is now removed.



## Version 0.0.62 is released (18.08.2026)
### What is new
- Tool edit_file is reimplemented - now it uses simple search/replace and requires the file to be read after the latest modification
- Property only_one_local_model added for ease of use with local models. If true - on selecting a local model, the other selected local models are deselected/stopped. This is valid for completion, chat and tools models. Embeddings models are small and therefore excluded from the group. By default it is false.



## Version 0.0.61 is released (17.08.2026)
### What is new
- Improve edit text with AI and edit multiple files with AI - adding context from .md files is now possible
- Fix losing agent context files on hiding and showing agent view
- Agent Reminders added - for example periodically reminds the agent about the correct format of the edit_file tool input parameter (setting reminder_edit_file_frequency). 
- Default models introduced - if a model is not selected, the default one (if any) is selected automatically


## Version 0.0.60 is released (15.08.2026)
### What is new
- Fix environment auto-start persistence
- Add OrcaRouter as an OpenAI-compatible provider (enables adding models in the same way as from OpenRouter - from the menu)
- Telegram bot new command "//" - shows all agent commands
- Telegram bot - the agent commands are now requested with simple /<command>, not with //<command> anymore, to facilitate the execution of the command inside telegram (just tap on it from the list if it contains only acceptable chars for telegram command)
- Script files (suffix .lvs) from folder of the setting scripts_folder are available as script commands in the agent.


## Version 0.0.59 is released (07.08.2026)
### What is new
- [Scripts](https://github.com/ggml-org/llama.vscode/wiki/Scripts) are introduced - something like macros for llama-vscode. Scripts are written in a simple DSL language, which supports execution of llama-vscode commands for selecting/deselecting models, agent, env, changing settings, executing terminal commands etc. The scripts also support variables, if/else statements and comments. The scripts could be used as a content of the agent commands (agent commands are shown by pressing / in the agent prompt field). The plan is in future the scripts to be used in the hooks (not yet introduced)
- The agent commands, which send prompt to the agent are now visualized with [p] prefix, while those, which execute scripts and do not send prompt are visualized with [s] prefix.
- New setting scripts_folder - the files in this folder with extension .lvs are considered as agent script commands and are shown on entering "/" in the agent prompt field. Those commands do not send prompt to the agent.
- More informative errors in case of problems with code completion.
- Telegram bot - the /chat command for showing the current chat (last xx chars) is available even while the agent is running.


## Version 0.0.58 is released (03.08.2026)
### What is new
- New agent commands were added - disable_completions, enable_completions, disable_rag, enable_rag, select_help_agent, select_tools_model_kimi_k3 (Kimi K3 tools on demand), etc.


## Version 0.0.57 is released (31.07.2026)
### What is new
- Telegram bot - new commands /tools, /addtools, /removetools [More details](https://github.com/ggml-org/llama.vscode/wiki/Telegram-bot)
- Telegram bot - user confirmation of terminal commands, changing or deleting files is now possible from Telegram. [More details](https://github.com/ggml-org/llama.vscode/wiki/Telegram-bot)
- Deep links support added. Now VS Code and and a llama-vscode view could be opened from a link. Example [vscode://ggml-org.llama-vscode?view=agent&prompt=Hello](vscode://ggml-org.llama-vscode?view=agent&prompt=Hello) opens VS Code and llama-vscode agent and writes in the prompt box "Hello". [More details](https://github.com/ggml-org/llama.vscode/wiki/Deep-link)
- Logo changed
- New setting tool_permit_file_delete - allow or deny deletion of files. Now the setting tool_permit_file_changes is only for file changes.
- New setting tools_permission_timeout - The timeout (in seconds) for providing tool execution permission. If not answered within this timeout, the agent will assume a silent answer with No. Default 600 seconds. 


## Version 0.0.56 is released (27.07.2026)
### What is new
- Telegram bot commands extended and simplified. [More details](https://github.com/ggml-org/llama.vscode/wiki/Telegram-bot)
- Agent commands prompt could now include terminal commands in format !'<terminal_command>'. The prompt is preprocessed - the commands are executed and replaced with the result of the execution in the prompt.
- Kimi K3 - dynamically loaded tools (tools on demand) fix - prevent sending the same tool definition several times.


## Version 0.0.55 is released (24.07.2026)
### What is new
- Now you could access your llama-vscode agents from your phone with a Telegram bot. [More details](https://github.com/ggml-org/llama.vscode/wiki/Telegram-bot)


## Version 0.0.54 is released (19.07.2026)
### What is new
- Added predefined kimi k3 tools models for OpenRouter and moonshot.ai
- Implemented dynamically loaded tools (tools on demand) feature for Kimi K3 (works only for moonshot.ai). This optimizes the token usage and reduces the price of using kimi k3. [More details](https://platform.kimi.ai/docs/guide/use-dynamic-tool-loading)
- Added predefined copilot agent (uses system prompt based on VS Code copilot system prompt)


## Version 0.0.53 is released (16.07.2026)
### What is new

- New setting rag_ignore_file for excluding files/folders from RAG indexing
- Fix for showing Chat with AI window inside VS Code
- Fix in agent chat - a failed request to AI doesn't prevent the following requests in the same chat


## Version 0.0.52 is released (13.07.2026)
### What is new

- New tool get_errors for getting file or project errors (prompts reused from copilot)
- New tool rename_symbol for renaming a symbol (variable, function, etc. in the whole project) (prompts reused from copilot)
- Auto memory added: settings auto_memory_enabled (true by default), max_auto_memory_files (10 by default). The agent could store persistent memory across conversations automatically (project specific).


## Version 0.0.51 is released (28.06.2026)
### What is new

- Agent UI is changed - a button is added for sending a prompt during agent loop (entering text and Enter has the same effect)
- If a prompt is sent during the agent loop - the LLM receives it at earliest possible time
- A bug with calling terminal command is fixed



## Version 0.0.50 is released (26.06.2026)
### What is new

- Option for using standard shell script for llama.cpp installation (brew / winget also available)
- Use "llama server" instead of llama-server to start a local server
- Added one predefined local model with Multi Token Prediction: Qwen3.6-27B-GGUF:Q8_0 MTP (LOCAL) (VRAM>20)


## Version 0.0.49 is released (26.06.2026)
### What is new

- User dialogs are now two types - popup dialogs (for short texts) and dialogs in editor (for long texts)
- Setting popup_max_chars (default 160) determines what is the max length of short texts (popup dialogs used for them)
- Automatic installation of llama.cpp on Linux, provided brew package manager is available
- Delete Chat button added in the llama-vscode panel


## Version 0.0.48 is released (01.06.2026)
### What is new

Thanks to @danielrobbins we have the following improvements:

- Fix chat context budgeting and overflow handling  
This is the main fix. The extension now behaves as a modern llama.cpp client that trusts and leverages live runtime information that the server makes available, including actual calls to get real tokenization numbers from the server when possible. Uses the full server API surface, and fails correctly when the budget is wrong.

- Fix empty streamed chat responses after compaction  
This fixes a streaming bug where a valid final response could be dropped and show up as empty.

- Polish empty-response diagnostics UI  
This improves the user-facing error and logging when the provider gets an empty response (clear reason rather than general error)

- Handle reasoning-only empty chat responses  
This handles the case where a reasoning model uses up the whole response budget internally and returns no visible text, causing an error.

- Raise chat output cap to quarter context window  
This removes an overly small fixed output limit and replaces it with a more reasonable cap based on the model’s context size (output cap is 0.25 of context window, which is reasonable as an emergency failsafe.)

- Log per-turn chat token usage  
This adds per-turn token usage logging so it is easier to see what each request and response is actually consuming.

- Fix shared-context model metadata display  
This fixes the context size shown in the VS Code model UI so shared-context llama.cpp models no longer appear to have roughly double their real window size (original PR fixed this to not report 12K context window)


## Version 0.0.47 is released (04.05.2026)
### What is new

- Multiline field for Edit with AI  
- Qwen3.5 models added as predefined (2B, 4B, 9B) - good for tools and chat  
- API Key is used (if needed and provided) on getting list of models on adding OpenAI Compatible model


## Version 0.0.46 is released (29.04.2026)
### What is new

llama.vscode could provide models for VS Code Copilot now:
1. Start tools model from llama-vscode (local or external)  
2. In VS Code Copilot show the models list -> Other Models -> Manage Models  
3. Make the models (all models available by the application serving the tools model are shown) you want to use visible (click on the left of the model name)  
4. Select the desired model from Copilot and start using it

Not needed tools from Copilot could be unchecked to reduce context size if local model is used.



## Version 0.0.45 is released (04.03.2026)
### What is new

- Configurable debounce for inline completion requests - setting debounce_ms. 
llama-vscode will wait debounce_ms after a keystroke before sending a request to the LLM for inline code completion. If in the meantime there is another keystroke, the request for the previous keystroke is cancelled. Useful on low end hardware to avoid triggering code completion on every keystroke.

- Notification "Extension is updated" is shown only on version change, not on every setting change (as was before)


## Version 0.0.44 is released (03.03.2026)
### What is new

- Subagents implemented (with tool delegate_task) - now each agent, which has "Available as Subagent" checked could be used as a subagent

- new agent - Unit Test Writer

- new tool create_agent

- new agent "Agent creator"

- Files SOUL.md and USER.md (if available in the project root) will be added to the context


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

### [Generate commit message](https://github.com/ggml-org/llama.vscode/wiki/Generate-commit-message) 



### [Statusbar](https://github.com/ggml-org/llama.vscode/wiki/Statusbar)

### [Menu](https://github.com/ggml-org/llama.vscode/wiki/Menu)

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
- Show llama-vscode menu by clicking "llama-vscode" in the status bar or by Ctrl+Shift+M, and select 'Install/upgrade llama.cpp' (sometimes restart is needed to adjust the paths to llama serve)
2. Select env (group of models) for your needs from llama-vscode menu.  
- This will download (only the first time) the models and run llama.cpp servers locally (or use external servers endpoints, depends on env)
3. Start using llama-vscode  
- For code completion - just start typing (uses completion model)
- For edit code with AI - select code, right click and select 'llama-vscode Edit Selected Text with AI' (uses chat model, no tools support required)
- For chat with AI (quick questions to (local) AI instead of searching with google) - select 'Chat with AI' from llama.vscode menu (uses chat model, no tools support required, llama.cpp server should run on model endpoint.)
- For agentic coding - select 'Show Llama Agent' from llama.vscode menu (or Ctrl+Shift+A) and start typing your questions or requests (uses tools model and embeddings model for some tools, most intelligence needed, local usage supported, but you could also use external, paid providers for better results)


If you want to use llama-vscode only for code completion - you could disable RAG from llama-vscode menu to avoid indexing files.


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
2. Click "Select Env" button and select env, which supports agent, for your needes. This will download the required models and start llama.cpp servers with them. For the external servers (like OpenRouter)   llama-vscode will ask for api key if needed.  
3. Write your request and send it with Enter or the "Send" button.  
4. During the agent loop you could also send prompt - enter a prompt and press Enter or click the second "Send" button (on the right side)

You could also use the agent only with tools model selected. In this case the tool search_source will use tools instead of chat server and filtering with embeddins server will be skipped.

Optional
- You could add files to the context with the @ button or just by entering "@". 
- You could select a command (predefined prompt) by pressin "/". The commands could be added frim llama-vscdoe menu - Agent commands...
- Activating an agent (Ctrl+Shift+A or from llama-vscodd menu) adds the open file to the agent context
- You could select source code and activate the agent (Ctrl+Shift+A or from llama-vscodd menu) to attach the selected lines to the context
- You could choose the tools to be used from "Select Tools" button (on the right side of "New Chat" button). If you have installed and started MCP Servers in VS Code, their tools will be available for selection too. Don't forget to click the OK button after changing the tool selection.  
- View the selected tools model from the tool tip of the "Tools Model" button and select a new tools model by clicking it.  
- View the selected agent from the tool tip of the "Agent" button and select a new agent by clicking it

Click button "Deselect Env" (vislble if there is a selected env with agent model) to deselect the env and selected models and stop the servers, which were started by llama-vscode. 
Click button "Selected Models" to show details about the selected models



https://github.com/user-attachments/assets/dd9da21a-6f57-477d-a55c-e4ff60b1ecb8




## Use as local AI runner (as LM Studio, Ollama, etc.) 

### Overview
llama-vscode could be used as a local AI runner (as LM Studio, Ollama, etc.) . Models are searched in Huggingface. After a model is selected, llama-vscode automatically downloads it and starts a llama serve with it. With this the user could start chatting with an AI.

### How to use it
1. From llama-vscode menu select "Use as local AI runner" - llama view will be opened with buttons "llama.cpp", "Add", "Select", "Chat".
2. Click "llama.cpp" button to install/upgrade llama.cpp (if not yet done). The installation for Windows (with winget) and Mac (with brew) is automatic. For Linux, the user should do it manually ([download the latest llama.cpp package for Linux](https://github.com/ggml-org/llama.cpp/releases) and add the bin folder to the PATH)
3. Click "Add" button, enter search words to see a list of models from Huggingface, select a model, select quantization. If prefered - accept to start the model immediately. (not needed if the model is already added)
4. Click "Select" button and select a model to run (not needed if the model is already started in the previous step)
5. Click "Chat" button - a web page for chat with AI will be shown in VS Code

Enjoy talking with local AI.




https://github.com/user-attachments/assets/e75e96de-878b-43db-a45b-47cc0c554697

## Manage envs 

### Requred servers
- No servers required

### Overview
Agent is combination of system prompt and tools. If an agent is selected, it will be used by the Llama Agent UI. On slecting and agent, the selected llama-vscode tools are updated.

They have properties: name, description, system prompt, tools. 

Agent could be added/deleted/viewed/selected/deselected/exported/imported

### How to use it 
Select "Agents..." from llama-vscode menu  

- Add agent...
Adds an agent

- Edit agent...
Edits an agent

- Copy agent...
Copies an agent

- Delete agent...  
Deletes an agent

- View agent...
Select an agent from the list to view all the details for this agent

- Select/Start agent...  
Select agent from the list. Only one agent could be selected at a time. If an agent is selected, the selected tools are updated and Llama Agent starts using it.

- Deselect/stop env...
Deselect the currently selected agent. The default agent will be used by Llama Agent

- Export  
An agent could be exported as a .json files. This file could be shared with other users, modified if needed and imported again. Select an agent to export it.

- Import  
An agent could be imported from a .json file - select a file to import it.
## Manage chat models 

### Requred servers
- No servers required

### Overview
Chat models configurations are stored and could be reused. For simplicity the term "chat models" will be used as a synonim for chat models configurations.
Chat models could be for local models (run by llama-vscode) and for externally run servers.
They have properties: name, local start command (llama serve command to start a server with this model locally), ai model (as required by the provider), endpoint, is key required  
 

Chat models configurations could be added/deleted/viewed/selected/deselected/added from huggingface/exported/imported

### How to use it 
Select "Chat models..." from llama-vscode menu  

- Add local model  
Enter the requested properties.  
Name, local start command and endpoint are required  
Use models, which support text completion, usually with "Instruct" in the name (for example i.e. Qwen2.5-Coder-1.5B-Instruct)

- Add external model    
Enter the requested properties.  
Name and endpoint are required.
Use models, which support text completion, usually with "Instruct" in the name.  

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

- Add chat model from OpenAI compatible provider  
Add chat model from OpenAI compatible provider - OpenRouter or custom (for example local/external llama.cpp server).

- Export  
A model could be exported as a .json files. This file could be shared with other users, modified if needed and imported again. Select a model to export it.

- Import  
A model could be imported from a .json file - select a file to import it.## Manage envs 

### Requred servers
- No servers required

### Overview
Chat is a coversation between the user and an AI. Chats are created and added to the history automatically. The history stores the last chats_max_history (setting with default 50) chats.
If a chat is selected, it is loaded in the Llama Agent UI. If a the loaded chat is long, the first request to AI could take long (no cache available on first request)

Chats could be manually deleted/selected/exported/imported

### How to use it 
Select "Chats..." from llama-vscode menu  

- Select chat...  
Selects a chat and loads it in Llama Agent

- Delete chat...  
Deletes a chat

- Export  
A chat could be exported as a .json file. This file could be shared with other users, modified if needed and imported again. Select a chat to export it.

- Import  
A chat could be imported from a .json file - select a file to import it.
## Manage completion models 

### Requred servers
- No servers required

### Overview
Completion models configurations are stored and could be reused. For simplicity the term "completion models" will be used as a synonim for Completion models configurations.
Completion models could be for local models (run by llama-vscode) and for externally run servers.
They have properties: name, local start command (llama serve command to start a server with this model locally), ai model (as required by the provider), endpoint, is key required  
 

Completion models configurations could be added/deleted/viewed/selected/deselected/added from huggingface/exported/imported

### How to use it 
Select "Completion models..." from llama-vscode menu  

- Add local model  
Enter the requested properties.  
Name, local start command and endpoint are required  
Use models, which support FIM (Fill In the Middle), for example Qwen2.5-Coder-1.5B-Q8_0-GGUF  

- Add external model    
Enter the requested properties.  
Name and endpoint are required.  
Use models, which support FIM (Fill In the Middle)  

- Delete models  
Select the model you want to delete from the list and delete it.

- View  
Select a model from the list to view all the details for this model

- Select  
Select a model from the list to select it. If the model is a local one (has a command in local start command) a llama.cpp server with this model will be started. Only one completion model could be selected at a time.

- Deselect  
Deselect the currently selected model. If the model is local, the llama.cpp server will be started.

- Add model from huggingface  
Enter search words to find a model from huggingface. If the model is selected it will be automatically downloaded (if not yet done) and a llama.cpp server will be started with it.

- Add completion model from OpenAI compatible provider  
Add completion model from OpenAI compatible provider - OpenRouter or custom (for example local/external llama.cpp server).

- Export  
A model could be exported as a .json files. This file could be shared with other users, modified if needed and imported again. Select a model to export it.

- Import  
A model could be imported from a .json file - select a file to import it.## Manage embeddings 

### Requred servers
- No servers required

### Overview
Embeddings models configurations are stored and could be reused. For simplicity the term "embeddings models" will be used as a synonim for embeddings models configurations.
Embeddings models could be for local models (run by llama-vscode) and for externally run servers.
They have properties: name, local start command (llama serve command to start a server with this model locally), ai model (as required by the provider), endpoint, is key required  
 

Embeddings models configurations could be added/deleted/viewed/selected/deselected/added from huggingface/exported/imported

### How to use it 
Select "Embeddings models..." from llama-vscode menu  

- Add local model  
Enter the requested properties.  
Name, local start command and endpoint are required.  
Use models, which support embeddings, for example Nomic-Embed-Text-V2-GGUF.

- Add external model    
Enter the requested properties.  
Name and endpoint are required.   
Use models, which support embeddings.

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

- Add embeddings model from OpenAI compatible provider  
Add embeddings model from OpenAI compatible provider - OpenRouter or custom (for example local/external llama.cpp server).

- Export  
A model could be exported as a .json files. This file could be shared with others used, modified if needed and imported again. Select a model to export it.

- Import  
A model could be imported from a .json file - select a file to import it.## Manage envs 

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
Opens a llama-vscode ui page with the current environment details. The button "Save As New Env" creates an env with the currently selected models, actor and settings (i.e. current environment).


- Delete env...  
Select the env you want to delete from the list and delete it.

- View env...
Select an env from the list to view all the details for this env

- Select/Start env...  
Select env from the list. Only one Env could be selected at a time. If an env is selected, the models from this env will be selected as well and the local ones will be started.

- Deselect/stop env...
Deselect the currently selected env. All models from this env will be also deselected and the local ones, started by llama-vscode will be stopped.

- Export  
An env could be exported as a .json files. This file could be shared with other users, modified if needed and imported again. Select an env to export it.

- Import  
An env could be imported from a .json file - select a file to import it.

There is also a menu item "Download/upload envs online", which opens a web page where envs could be downloaded/uploaded

<img width="540" height="996" alt="image" src="https://github.com/user-attachments/assets/b1a78d7a-8602-451a-b304-fc967fb66696" />

https://github.com/user-attachments/assets/3fb864ad-a010-4d19-97d8-fd7c9ce60494


https://github.com/user-attachments/assets/3b8dffcc-bcdc-4981-b181-ffc52fe43075


## Manage tools models 

### Requred servers
- No servers required

### Overview
Tools models configurations are stored and could be reused. For simplicity the term "tools models" will be used as a synonim for tools models configurations.
Tools models could be for local models (run by llama-vscode) and for externally run servers.
They have properties: name, local start command (llama serve command to start a server with this model locally), ai model (as required by the provider), endpoint, is key required  
 

Tools models configurations could be added/deleted/viewed/selected/deselected/added from huggingface/exported/imported

### How to use it 
Select "Tools models..." from llama-vscode menu  

- Add local model  
Enter the requested properties.  
Name, local start command and endpoint are required  
Use models, which support tools usage, for example gpt-oss-20b-GGUF

- Add external model    
Enter the requested properties.  
Name and endpoint are required.  
Use models, which support tools usage

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

- Add tools model from OpenAI compatible provider  
Add tools model from OpenAI compatible provider - OpenRouter or custom (for example local/external llama.cpp server).

- Export  
A model could be exported as a .json files. This file could be shared with other users, modified if needed and imported again. Select a model to export it.

- Import  
A model could be imported from a .json file - select a file to import it.## MCP Support  

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



https://github.com/user-attachments/assets/9895924d-1948-4f3c-b52e-2cce453645c8

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
## More context files

### What are AGENTS.md, SOUL.md, and USER.md
If in the project folder there are files: AGENTS.md, SOUL.md, and USER.md, they are used to provide additional context to the AI model when a request is sent. 
AGENTS.md - instructions related with agents
SOUL.md - instructions related with the "soul" of the agent (how to behave, what values to follow, etc.)
USER.md - information about the user - preferences, additional information, etc.
These files are not mandatory. Ther are added because in some systems are quite popular and probably could be reused from there.

### How to use them
Just add one or more of these files to the project folder.
## Parallel Completions

### Overview
Llama-vscode generates parallel code completions (default 3) if a version of llama.cpp after December, 6, 2025 (commit c42712b) is used. The next completion is shown by pressing Ctrl+], previous completion is shown by pressing Ctrl+[.  
The setting max_parallel_completions determines how many completions are generated.

### How to use it
1. Run the completion model and start coding
2. When a code completion is shown, press Ctrl+] to show the next completion, Ctrl+[ to show the previous completion
3. Alternatively - you could hover over the shown completion and when the toolbar is shown click the arrows to show the other completions.


Settings:
- max_parallel_completions: The max number of parallel completions to generate. Default is 3.

[Screencast from 2026-01-05 15-05-00.webm](https://github.com/user-attachments/assets/41fa92f8-88db-4079-9574-486fb4286c79)

## Rules

### What are rules
Rules are additional user instructions that are added to the system prompt when an agent request is sent to the AI model. They are stored in a file, created by the user in a plain text or markdown format.
As llama-vscode provides the possibility to change the system prompt for the agents, additional instructions can be added to the system prompt and the result will be the same. The difference is that the rules from a file will be added to each agent system prompt on the fly.

### How to use them
The rules are optional. You could use rules file to add instructions to the system prompt - code writing conventions, code formatting, additional information about the project, etc.

There are two ways to configure rules:
- Create a new rules file under name llama-vscode-rules.md in the root of the project.
- In llama-vscode setting Agent_rules enter a path to a rules file. It could be relative to the project root or absolute path. If this is specified, the file llama-vscode-rules.md will be ignored.
## Scripts

### Overview
Llama-vscode supports scripts. Scripts are actions within llama-vscode and could automate some tasks. For example select models, agents, change settings, etc... The scripts are in a simple language (DSL), which supports execution of llama-vscode commands, variables and if/else statements. However, the language is very simple and doesn't support the feature of the modern programming languages. It is just for automating llama-vscode tasks. They are similar to macroses in Excel (or Office applications).

Example script:
```
set maxParallelCompl getSetting max_parallel_completions
if $maxParallelCompl > 3
  setSetting max_parallel_completions 3
endif

if $maxParallelCompl < 1
  setSetting max_parallel_completions 1
endif

return The parallel completions are set in correct range
```

Variables: Use set to set value (no need to define variables). value just a string, number or could be a llama-vscode command (as in the above script). Use $varName to get the value (note the $ prefix). Variables have no types for now. They are represented internally as strings. However, in the if statement, if the values of the both operands are numbers, the comparison is done as a comparison of numbers.

llama-vscode commands: Some examples are getSetting <setting_name>, setSetting <setting_name> <value> setToolsModel <model_name>, setCompletionModel <model_name>, setEnv <env_name>, deselectToolsModel, deselectCompletionModel, runTerminalCommand <command>, etc.

if else endif: As is visible from the example above, there are no brackets, but endif is required. The if condition supports comparison operators (>, <, ==, !=, >=, <=), but just one (and, or, not are not supported).

Comments: The lines starting with // are comments and are ignored during execution.

### How to use it
For example the scripts could be used in agent commands. If the field "is script" of the agent command is true, the content of the prompt field of the agent command is interpreted as a script and is executed. If the prompt contains a path to a file, the content of the file is executed.


Settings:
-  scripts_folder: The folder where the script files are searched by default. All script files with suffix .lvs are considered agent script commands and are shown on entering "/" in the agent prompt field. Those commands do not send prompt to the agent.


## Setup llama.cpp server for Linux 

Make sure you have brew package manager installed (from https://brew.sh/). You could install brew with the command 
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```   
Show llama-vscode menu (Ctrl+Shift+M) and select "Install/upgrade llama.cpp" (if not yet done). After that add/select the models you want to use. 

Alternatively you could do it manually:

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
llama serve -hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF --port 8012 -ub 512 -b 512 --ctx-size 0 --cache-reuse 256
```

With Nvidia GPUs and installed cuda drivers  
- more than 16GB VRAM 
```bash 
`llama serve --fim-qwen-7b-default`  
```
- less than 16GB VRAM  
```bash
`llama serve --fim-qwen-3b-default`  
```
- less than 8GB VRAM  
```bash
`llama serve --fim-qwen-1.5b-default`  
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
`llama serve -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```

With Nvidia GPUs and installed cuda drivers  
- more than 16GB VRAM  
```bash
`llama serve -hf ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```
- less than 16GB VRAM  
```bash
`llama serve -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```
- less than 8GB VRAM  
```bash
`llama serve -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```


### Embeddings server  
*Used for*  
    - Chat with AI with project context  

*LLM type*  
    - Embedding    

*Instructions*  
Same like code completion server, but use embeddings model and a little bit different parameters. 
```bash  
`llama serve -hf ggml-org/Nomic-Embed-Text-V2-GGUF --port 8010 -ub 2048 -b 2048 --ctx-size 2048 --embeddings`  
```
### Setup llama.cpp servers for Mac  

Show llama-vscode menu (Ctrl+Shift+M) and select "Install/upgrade llama.cpp" (if not yet done). After that add/select the models you want to use.   

The instructions below are left for a reference, but now it is possible to do it easier - add a model from the menu and select it.

#### With shellscript:  
Go to https://llama.app/, copy the install command and run it in a shell.

#### With brew. Prerequisites - [Homebrew](https://brew.sh/)

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
`llama serve -hf ggml-org/Qwen2.5-Coder-7B-Q8_0-GGUF:Q8_0 --port 8012 -fa -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256`  
```
- If you have less than 16GB VRAM:  
```bash
`llama serve -hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF:Q8_0 --port 8012 -fa -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256`  
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
`llama serve -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```

With Nvidia GPUs and installed cuda drivers  
- more than 16GB VRAM  
```bash
`llama serve -hf ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```
- less than 16GB VRAM  
```bash
`llama serve -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF --port 8011 -np 2`  
```
- less than 8GB VRAM  
```bash
`llama serve -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF --port 8011 -np 2` 
```

### Embeddings server  
*Used for*  
    - Chat with AI with project context  

*LLM type*  
    - Embedding    

*Instructions*  
Same like code completion server, but use embeddings model and a little bit different parameters.   
```bash
`llama serve -hf ggml-org/Nomic-Embed-Text-V2-GGUF --port 8010 -ub 2048 -b 2048 --ctx-size 2048 --embeddings`  
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
`llama serve.exe --fim-qwen-1.5b-default --port 8012`  
```
With GPUs     
```bash
`llama serve.exe --fim-qwen-1.5b-default --port 8012`  
```  
If you've installed llama.cpp with winget you could skip the .exe suffix and use just llama serve in the commands.  

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
`llama serve.exe -hf qwen2.5-coder-1.5b-instruct-q8_0.gguf --port 8011`  
```

With Nvidia GPUs and installed cuda drivers  
- more than 16GB VRAM  
```bash
`llama serve.exe -hf qwen2.5-coder-7b-instruct-q8_0.gguf --port 8011 -np 2`  
```
- less than 16GB VRAM  
```bash
`llama serve.exe -hf qwen2.5-coder-3b-instruct-q8_0.gguf --port 8011 -np 2`  
```
- less than 8GB VRAM  
```bash
`llama serve.exe -hf qwen2.5-coder-1.5b-instruct-q8_0.gguf --port 8011 -np 2` 
```


### Embeddings server  
*Used for*  
    - Chat with AI with project context  

*LLM type*  
    - Embedding    

*Instructions*  
Same like code completion server, but use embeddings model and a little bit different parameters.   
```bash
`llama serve.exe -hf nomic-embed-text-v2-moe-q8_0.gguf --port 8010 -ub 2048 -b 2048 --ctx-size 2048 --embeddings`  
```
## Skills

### Overview
Llama-vscode support skills (https://agentskills.io/home), which extend the capabilities of the LLM (similar to tools).

### How to use it
1. Set the skills folder in setting skills_folder (if not set, the <project_root>/skills is used)
2. Ask the agent for to do something, which requres a skill (or ask details about the skills)

On sending a user request to the agent, the folder is scanned and the available skills are provided to the LLM. If the LLM decides to use a partiular skill, the skill details are loaded by LLM.  


Settings:
- skills_folder: The folder where the skills are stored
## Statusbar  

### Requred servers
- No servers requred

### How to use it 
- View vscode-state
- View statistics
- Click on "llama-vscode" status bar to show llama-vscode menu



https://github.com/user-attachments/assets/8f0b4575-104f-471c-be3f-f3d5b58aeee1

## Subagents

### What are subagents
Subagents are a way to optimize the user of LLM context. Some tasks are be executed in a separate session and only the final result is added to the context of the original agent session. 
This is implemented with the tool delegate_task. If the delegate_task tool is enabled, the agent could decide to delegate some tasks to subagents. Each agent could be used as a subagent if it's field "Available as Subagent" is checked.

### How to use them
1. Make sure the tool delegate_task is enabled.
2. Make sure the agents you want to use as subagents have the field "Available as Subagent" checked and meaningful description.
3. Write a prompt, for which it is good idea to use the subagent. Alternatively, you could directly ask in the prompt to use the subagent.

The agent "Agent creator" makes it easier to create agents (which could be used as subagents).
## Telegram Bot

### Requred servers
- Tools server
- Embeddings server (if search_source tool is used)

### Overview
You can program from your phone with llama-vscode and Telegram. Part of the agent functionality of llama-vscode could be used from Telegram (i.e. from phone) via a Telegram Bot.  The user creates a Telegram Bot and sets it's token in setting telegram_api_token. After that all messages to this bot are forwarded to the agent in llama-vscode. The AI agent answers are sent to the user in Telegram. For security reasons, only users from a white list (setting telegram_bot_users) are allowed to use the bot. The bot answers, for example to /help command, are provided in the language, which is set in setting "Language". The user could also confirm permission requests for terminal commands, changing and deleting files from Telegram.

### How to use it 
1. Create a Telegram Bot. Creating a bot in Telegram is simple - open bot @BotFather, click Start and execute the command /newbot. There you will see the bot API token.
2. Set the bot API token in setting telegram_api_token
3. Find your user id in Telegram (in Telegram bot @userinofobot send "/start") and add it to setting telegram_bot_users
4. Enable the bot in setting telegram_bot_enabled  

Every message to your Telegram bot (from 1.) will be forwarded to the agent in llama-vscode and the bot will send back the answer.  
Here are the commands (messages, which start with "/"), which the bot can execute (if the message doesn't start with "/", it is sent to the agent) :  
- /env - shows the current tools model and agent
- /models - shows the available models
- /agents - shows the available agents 
- /setmodel n - sets the model to the n-th model. (models numbers are available from command /models)
- /setagent n - sets the agent to the n-th agent. (agents numbers are available from command /agents) 
- /tools - lists all tools with a check for the active ones
- /addtools x,y,z - sets the active tools (x,y,z are the numbers of the tools from /tools command)
- /removetools x,y,z - removes the tools (x,y,z are the numbers of the tools from /tools command)  
- /stop - stops the agent 
- /status - shows the current status of the agent 
- /chat n - gets the last n  characters of the current chat. If n is not specified, the last 1000 characters are returned
- /newchat, /new - stops the current chat and starts a new chat
- /setlang xx - sets the language, which is used by the bot: bg - Bulgarian (Български), cn - Chinese (中文), en - English, fr - French (Français), de - German (Deutsch), ru - Russian (Русский), es - Spanish (Español)
- / - shows available telegram bot commands
- // - shows the available agent commands
- /help - shows help information for using the bot

### Settings:  
- telegram_api_token - Telegram Bot token  
- telegram_bot_users - List of users, which are allowed to use the bot.  
- telegram_bot_enabled - Enable/disable the bot.   
- telegram_chunk_size - The size of the chunks (in chars), which are sent as AI response to Telegram. Each chunk is a separate message.    
- language - The language, on which the bot provides help and other bot specific answers.  
- tools_permission_timeout - The timeout (in seconds) for giving tool execution permission. If not answered within this timeout, the agent will assume a silent answer with No. Default 600 seconds.

<img width="320" height="711" alt="telegram1" src="https://github.com/user-attachments/assets/7ce2b664-24de-40e2-b1ff-fde17287a9d6" />

<img width="320" height="711" alt="telegram2" src="https://github.com/user-attachments/assets/a0f7abdd-7665-4008-b1bb-8b79e3e90eb8" />

<img width="320" height="711" alt="telegram3" src="https://github.com/user-attachments/assets/6d7ee073-2b57-4937-9145-a4427a666ddf" />





## Update todos tool

### Overview
Llama-vscode provides a tool update_todo_list to the agent for planning and tracking the execution of the user request.

### How to use it
Update todos tool is based on Roocode's tool with the same name (the tool description is copied from Roocode). 
If the update_todo_list is enabled (selected), the agent could use it for planning non trivial tasks (user requests). This tools is used for both creating and updating the todo items. The todo items are saved in file <project_root>\.llama-vscode-todos.md. The todo items are updated by the agent to track the execution of the plan. This file is removed after the execution of the current user request is finished. If this file is updated by the user, the change might be taken into account by the agent. The content of the file (together with the inital user request) is sent to the agent periodically (every 5-th iteration by default, but this could be changed from setting plan_review_frequency). The agent could overwrite the user changes in the todo items file before reading it.  
Each time the agent uses the tool, the todo items are shown in the agent chat window. The state of the items tracked with [ ] (not started), [-] (in progres) [x] (finished)
Todo items are not reused between the user requests.

Settings:
- plan_review_frequency: Sets how often the todo items are sent to the agent to remind/review what is the current state of the plan
- tool_update_todo_list_enabled - controls if the tool is enabled

<img width="750" height="922" alt="image" src="https://github.com/user-attachments/assets/a4049df0-17da-4c6d-868f-a6bcbfa5f65c" />

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



