# llama.vscode

llama.vscode is a code completion plugin and uses local (or remote) llama.cpp server. It is similar to copilot code completion, but is based on open source models and no code/no data leaves your computer (or llama.cpp server host).    
  
Uses a unique llama.cpp server caching for faster completions.


## How to use it
A running llama.cpp server is needed. No matter if it is local or remote (see below for instructions how to run it).  

Just continue writing code and sometimes you will get a suggestion for complion.

Use following shortcuts:  
Tab - accept the suggested completion  
Shift+Tab - accept the first row of the completion  
Ctrl+Right Arrow - accept the first word.  
Ctrl+l - trigger completion manually
  
if you don't get a suggestion (but seems logical to have one) - go to the next line or go back (Backspace) and probably you will get one.  
  
If it works too slowly - switch the setting llama.vscode.auto to false and use "Ctrl+l" to get a code completion.  
Sometimes the IntelliSense completion hides the llama.vscode completion - press Escape and you will see it.  
  
Yes, llama.vscode is with less features and with lower quality than copilot but still you get the most important benefit of AI for programmers and you have your freedom back.

## How to run llama.cpp server
  
For Linux  
Download the release files for your OS from https://github.com/ggerganov/llama.cpp/releases (or build from source).  
No GPUs:  
llama-server --hf-repo ggml-org/Qwen2.5-Coder-7B-Q8_0-GGUF --hf-file qwen2.5-coder-7b-q8_0.gguf --port 8012 -c 2048 -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256  
With Nvidia GPUs and downloaded latest cuda  
More than 16GB VRAM:  
llama-server --hf-repo ggml-org/Qwen2.5-Coder-7B-Q8_0-GGUF --hf-file qwen2.5-coder-7b-q8_0.gguf --port 8012 -ngl 99 -fa -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256  
Less than 16GB VRAM:  
llama-server --hf-repo ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF --hf-file qwen2.5-coder-1.5b-q8_0.gguf --port 8012 -ngl 99 -fa -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256   
  
For Mac  
brew install llama.cpp  
More than 16GB VRAM:  
llama-server --hf-repo ggml-org/Qwen2.5-Coder-7B-Q8_0-GGUF --hf-file qwen2.5-coder-7b-q8_0.gguf --port 8012 -ngl 99 -fa -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256  
Less than 16GB VRAM:  
llama-server --hf-repo ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF --hf-file qwen2.5-coder-1.5b-q8_0.gguf --port 8012 -ngl 99 -fa -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256  
  
For Windows  
Download file qwen2.5-coder-1.5b-q8_0.gguf from https://huggingface.co/ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF/blob/main/qwen2.5-coder-1.5b-q8_0.gguf  
Download the release files for Windows from https://github.com/ggerganov/llama.cpp/releases and extract them.  
In the extracted files folder put the model qwen2.5-coder-1.5b-q8_0.gguf and run:  
llama-server.exe -m qwen2.5-coder-1.5b-q8_0.gguf --port 8012 -c 2048 -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256  
or if you have Nvidia GPUs and have downloaded latest cuda  
llama-server.exe -m qwen2.5-coder-1.5b-q8_0.gguf --port 8012 -c 2048 --n-gpu-layers 99 -fa -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256  
  
If you have better hardware (GPUs) you could use bigger models from https://huggingface.co/ggml-org like qwen2.5-coder-3b-q8_0.gguf , qwen2.5-coder-7b-q8_0.gguf  or qwen2.5-coder-14b-q8_0.gguf. Any FIM-compatible model, supported by llama.cpp, could be used.  

For more details on running llama server see https://github.com/ggerganov/llama.cpp/tree/master/examples/server .


## Some Extension Settings

llama.vscode.endpoint - The llama.cpp server endpoint to be used by the extension, for example http://127.0.0.1:8012/ (default)   
  
llama.vscode.auto - If code completion should be trggered automatically (true) or only by pressing Ctrl+l.  

llama.vscode.show_info - show extra info about the inference (false - disabled, true - show extra info in the status line)  
  
llama.vscode.language - You could choose a language (for now 7 languages) for the messages in the status bar.  
  
llama.vscode.api_key - llama.cpp server api key (optional)  
  

## Known Issues

## Release Notes

### 0.0.1

**Enjoy!**
