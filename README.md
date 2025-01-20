# llama.vscode README

This is an extension, which uses llama.cpp server for code complition. It is similar to copilot, but is based on open source models

## Features
Uses a unique llama.cpp server caching for faster completions.


Use Tab to accept the suggested completion, Shift+Tab for the first row, Alt+w for the first word.
if you don't get a suggestion (but seems logical to have one) - go to the next line or go back (Backspace) and probably you will get one.

If it works too slowly - switch the setting llama.vscode.auto to falseandn use "Ctrl+l" to get a code completion.


## Requirements
A running llama.cpp server is needed. No matter if it is local or remote.  

How to make a llama server running:  
Download file qwen2.5-coder-1.5b-q8_0.gguf from https://huggingface.co/ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF/blob/main/qwen2.5-coder-1.5b-q8_0.gguf 

For Windows
Download the release files for Windows from https://github.com/ggerganov/llama.cpp/releases and extract them.  
In the extracted files folder put the model qwen2.5-coder-1.5b-q8_0.gguf and run:
llama-server.exe -m qwen2.5-coder-1.5b-q8_0.gguf -c 2048  
or if you have Nvidia GPUs and have downloaded latest cuda  
llama-server.exe -m qwen2.5-coder-1.5b-q8_0.gguf -c 2048 --n-gpu-layers 99 -fa  

For Mac
brew install llama.cpp
llama-server --model qwen2.5-coder-1.5b-q8_0.gguf -c 2048 -fa

For Linux
Download the release files for your OS from https://github.com/ggerganov/llama.cpp/releases and extract them.
In the extracted files folder put the model qwen2.5-coder-1.5b-q8_0.gguf and run:
./server --model qwen2.5-coder-1.5b-q8_0.gguf -c 2048
or for using GPUs (drivers for the GPUs should be available)
./server --model qwen2.5-coder-1.5b-q8_0.gguf -c 2048 --n-gpu-layers 99 -fa

If you have better hardware (GPUs) you could use bigger models from https://huggingface.co/ggml-org like qwen2.5-coder-3b-q8_0.gguf , qwen2.5-coder-7b-q8_0.gguf  or qwen2.5-coder-14b-q8_0.gguf .

For more details on running llama server see https://github.com/ggerganov/llama.cpp/tree/master/examples/server .


## Extension Settings

Configure llama.vscode.endpoint for example http://127.0.0.1:8080/ (if llama.cpp server runs on localhost)

You could choose a language for the messages in the status bar from the settings.

## Known Issues

## Release Notes

### 0.0.1

**Enjoy!**
