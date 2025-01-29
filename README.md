# llama.vscode

Local LLM-assisted text completion extension for VS Code

![image](https://github.com/user-attachments/assets/857acc41-0b6c-4899-8f92-3020208a21eb)

---

![llama vscode-swift0](https://github.com/user-attachments/assets/b19499d9-f50d-49d4-9dff-ff3e8ba23757)

## Features

- Auto-suggest on input
- Accept a suggestion with `Tab`
- Accept the first line of a suggestion with `Shift + Tab`
- Accept the next word with `Ctrl/Cmd + Right`
- Toggle the suggestion manually by pressing `Ctrl + L`
- Control max text generation time
- Configure scope of context around the cursor
- Ring context with chunks from open and edited files and yanked text
- [Supports very large contexts even on low-end hardware via smart context reuse](https://github.com/ggerganov/llama.cpp/pull/9787)
- Display performance stats

## Installation

### VS Code extension setup

Install the [llama-vscode](https://marketplace.visualstudio.com/items?itemName=ggml-org.llama-vscode) extension from the VS Code extension marketplace:

![image](https://github.com/user-attachments/assets/a5998b49-49c5-4623-b3a8-7100b72af27e)

Note: also available at [Open VSX](https://open-vsx.org/extension/ggml-org/llama-vscode)

### `llama.cpp` setup

The plugin requires a [llama.cpp](https://github.com/ggerganov/llama.cpp) server instance to be running at the configured endpoint:

<img width="508" alt="image" src="https://github.com/user-attachments/assets/1cc40392-a92c-46df-8a4d-aa762c692ad7" />

#### Mac OS

```bash
brew install llama.cpp
```

#### Any other OS

Either use the [latest binaries](https://github.com/ggerganov/llama.cpp/releases) or [build llama.cpp from source](https://github.com/ggerganov/llama.cpp/blob/master/docs/build.md). For more information how to run the `llama.cpp` server, please refer to the [Wiki](https://github.com/ggml-org/llama.vscode/wiki).

### llama.cpp settings

Here are recommended settings, depending on the amount of VRAM that you have:

- More than 16GB VRAM:

  ```bash
  llama-server \
      -hf ggml-org/Qwen2.5-Coder-7B-Q8_0-GGUF \
      --port 8012 -ngl 99 -fa -ub 1024 -b 1024 \
      --ctx-size 0 --cache-reuse 256
  ```

- Less than 16GB VRAM:

  ```bash
  llama-server \
      -hf ggml-org/Qwen2.5-Coder-3B-Q8_0-GGUF \
      --port 8012 -ngl 99 -fa -ub 1024 -b 1024 \
      --ctx-size 0 --cache-reuse 256
  ```

- Less than 8GB VRAM:

  ```bash
  llama-server \
      -hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF \
      --port 8012 -ngl 99 -fa -ub 1024 -b 1024 \
      --ctx-size 0 --cache-reuse 256
  ```

You can use any other FIM-compatible model that your system can handle. By default, the models downloaded with the `-hf` flag are stored in:

- Mac OS: `~/Library/Caches/llama.cpp/`
- Linux: `~/.cache/llama.cpp`
- Windows: `LOCALAPPDATA`

### Recommended LLMs

The plugin requires FIM-compatible models: [HF collection](https://huggingface.co/collections/ggml-org/llamavim-6720fece33898ac10544ecf9)

## Examples

TODO: add examples


## Implementation details

The extension aims to be very simple and lightweight and at the same time to provide high-quality and performant local FIM completions, even on consumer-grade hardware.

- The initial implementation was done by Ivaylo Gardev [@igardev](https://github.com/igardev) using the [llama.vim](https://github.com/ggml-org/llama.vim) plugin as a reference
- Techincal description: https://github.com/ggerganov/llama.cpp/pull/9787

## Other IDEs

- Vim/Neovim: https://github.com/ggml-org/llama.vim
