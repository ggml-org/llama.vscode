# llama.vscode README

This is an extension, which uses llama.cpp server for code complition. It is similar to copilot, but is based on open source models

## Features
If you use GPUs or other fast processors for the llama server - switch the setting llama.vscode.auto to true to get completions while typing.
Press "Ctrl+l" to get a code completion.
Use Tab to accept the suggested completion, Shift+Tab for the first row, Alt+w for the first word.

Uses a unique llama.cpp server caching for faster completions.


## Requirements
A running llama.cpp server is needed. No matter if it is local or remote.
How to make a llama server running:
- Download the release files for your OS from https://github.com/ggerganov/llama.cpp/releases and extract them
- Download file Qwen2.5-Coder-1.5B.Q8_0.gguf from https://huggingface.co/ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF/blob/main/qwen2.5-coder-1.5b-q8_0.gguf and put it in the same folder as the extracted files.
- In the extracted files folder run:

For Windows
llama-server.exe -m Qwen2.5-Coder-1.5B.Q8_0.gguf -c 2048
or if you have Nvidia GPUs and have downloaded latest cuda
llama-server.exe -m Qwen2.5-Coder-1.5B.Q8_0.gguf -c 2048 --n-gpu-layers 99

For Mac and Linux
./server --model Qwen2.5-Coder-1.5B.Q8_0.gguf -c 2048
or for using GPUs (drivers for the GPUs should be available)
./server --model Qwen2.5-Coder-1.5B.Q8_0.gguf -c 2048 --n-gpu-layers 99

If you have better hardware (GPUs) you could use bigger models from https://huggingface.co/ggml-org like qwen2.5-coder-3b-q8_0.gguf , qwen2.5-coder-7b-q8_0.gguf  or qwen2.5-coder-14b-q8_0.gguf .

For more details see https://github.com/ggerganov/llama.cpp.


## Extension Settings

Configure llama.vscode.endpoint for example http://127.0.0.1:8080/ (if llama.cpp server runs on localhost)

## Known Issues

## Release Notes

### 0.0.1

**Enjoy!**
