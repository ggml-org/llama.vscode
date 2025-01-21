# llama.vscode

Local LLM-assisted text completion extension for VS Code

<img width="541" alt="image" src="https://github.com/user-attachments/assets/a28ec497-8b0a-440f-86dc-ed02f1f9a339" />

---

TODO: gif

## Features

- Auto-suggest on cursor movement
- Toggle the suggestion manually by pressing `Ctrl+L`
- Accept a suggestion with `Tab`
- Accept the first line of a suggestion with `Shift+Tab`
- Accept the next word with `Ctrl + Right Arrow`
- Control max text generation time
- Configure scope of context around the cursor
- Ring context with chunks from open and edited files and yanked text
- [Supports very large contexts even on low-end hardware via smart context reuse](https://github.com/ggerganov/llama.cpp/pull/9787)
- Display performance stats

## Installation

### VS Code extension setup

Install the [llama-vscode](vscode:extension/ggml-org.llama-vscode) extension from the VS Code extension marketplace:

![image](https://github.com/user-attachments/assets/a5998b49-49c5-4623-b3a8-7100b72af27e)

### llama.cpp setup

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
      --port 8012 -ngl 99 -fa -ub 1024 -b 1024 -dt 0.1 \
      --ctx-size 0 --cache-reuse 256
  ```

- Less than 16GB VRAM:

  ```bash
  llama-server \
      -hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF \
      --port 8012 -ngl 99 -fa -ub 1024 -b 1024 -dt 0.1 \
      --ctx-size 0 --cache-reuse 256
  ```

### Recommended LLMs

The plugin requires FIM-compatible models: [HF collection](https://huggingface.co/collections/ggml-org/llamavim-6720fece33898ac10544ecf9)

## Examples

TODO: add examples


## Implementation details

The extension aims to be very simple and lightweight and at the same time to provide high-quality and performant local FIM completions, even on consumer-grade hardware.

- The initial implementation was done by Ivaylo Gardev [@igardev](https://github.com/igardev) using the [llama.vim](https://github.com/ggml-org/llama.vim) plugin as a reference
- Initial implementation and techincal description: https://github.com/ggerganov/llama.cpp/pull/9787
