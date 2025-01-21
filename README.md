# llama.vscode

Local LLM-assisted text completion extension for VS Code

TODO: image

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

TODO: write instructions

### llama.cpp setup

The plugin requires a [llama.cpp](https://github.com/ggerganov/llama.cpp) server instance to be running at configured endpoint:

TODO: add image to the config

#### Mac OS

```bash
brew install llama.cpp
```

#### Any other OS

Either [build from source](https://github.com/ggerganov/llama.cpp/blob/master/docs/build.md) or use the latest binaries: https://github.com/ggerganov/llama.cpp/releases

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

- The initial implementation was done by Ivaylo Gardev @igardev
- Initial implementation and techincal description: https://github.com/ggerganov/llama.cpp/pull/9787

