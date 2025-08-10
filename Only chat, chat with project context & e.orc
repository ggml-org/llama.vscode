{
  "name": "Only chat, chat with project context & edit (<= 16GB VRAM)",
  "description": "Could be used for edit with AI, chat with AI, chat with AI with project context Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF + embeddings model (<= 16GB VRAM)",
  "completion": {
    "name": "",
    "localStartCommand": ""
  },
  "chat": {
    "name": "Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF (<= 16GB VRAM)",
    "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF -ngl 99 -fa -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
    "endpoint": "http://127.0.0.1:8011"
  },
  "embeddings": {
    "name": "Nomic-Embed-Text-V2-GGUF",
    "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
    "endpoint": "http://127.0.0.1:8010"
  },
  "tools": {
    "name": "",
    "localStartCommand": ""
  }
}