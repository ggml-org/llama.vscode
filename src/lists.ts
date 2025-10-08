import { PREDEFINED_LISTS_KEYS, ModelType } from "./constants";

export const PREDEFINED_LISTS = new Map<string, any>([
    [PREDEFINED_LISTS_KEYS.COMPLETIONS, [
            {
              "name": "Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)",
              "localStartCommand": "llama-server --fim-qwen-1.5b-default -ngl 99 --port 8012",
              "endpoint": "http://localhost:8012",
              "aiModel": "",
              "isKeyRequired": false
            },
            {
              "name": "Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)",
              "localStartCommand": "llama-server --fim-qwen-3b-default -ngl 99 --port 8012",
              "endpoint": "http://localhost:8012",
              "aiModel": "",
              "isKeyRequired": false
            },
            {
              "name": "Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)",
              "localStartCommand": "llama-server --fim-qwen-7b-default -ngl 99 --port 8012",
              "endpoint": "http://localhost:8012",
              "aiModel": "",
              "isKeyRequired": false
            },
            {
              "name": "Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)",
              "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256 --port 8012",
              "endpoint": "http://localhost:8012",
              "aiModel": "",
              "isKeyRequired": false
            }
          ]],        
[PREDEFINED_LISTS_KEYS.CHATS, [
            {
              "name": "Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (<= 8GB VRAM)",
              "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
              "endpoint": "http://127.0.0.1:8011"
            },
            {
              "name": "Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF (<= 16GB VRAM)",
              "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
              "endpoint": "http://127.0.0.1:8011"
            },
            {
              "name": "Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF (> 16GB VRAM)",
              "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
              "endpoint": "http://127.0.0.1:8011"
            },
            {
              "name": "Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (CPU Only)",
              "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
              "endpoint": "http://127.0.0.1:8011"
            },
            {
              "name": "gemini qat tools",
              "localStartCommand": "llama-server -m c:\\ai\\gemma-3-4B-it-QAT-Q4_0.gguf --port 8011",
              "endpoint": "http://localhost:8011",
              "aiModel": "",
              "isKeyRequired": false
            },
            {
              "name": "OpenAI gpt-oss 20B",
              "localStartCommand": "llama-server -hf ggml-org/gpt-oss-20b-GGUF -c 0 --jinja --reasoning-format none -np 2 --port 8011",
              "endpoint": "http://localhost:8011",
              "aiModel": "",
              "isKeyRequired": false
            }
          ]],
[PREDEFINED_LISTS_KEYS.EMBEDDINGS,  [
            {
              "name": "Nomic-Embed-Text-V2-GGUF",
              "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
              "endpoint": "http://127.0.0.1:8010"
            }
          ]],
[PREDEFINED_LISTS_KEYS.TOOLS,  [
            {
              "name": "OpenAI gpt-oss 20B (LOCAL) (> 19GB VRAM)",
              "localStartCommand": "llama-server -hf ggml-org/gpt-oss-20b-GGUF -c 0 --jinja --reasoning-format none -np 2 --port 8009",
              "endpoint": "http://localhost:8009",
              "aiModel": "",
              "isKeyRequired": false
            },
            {
              "name": "Z.AI: GLM 4.5 Air (free): GLM 4.5 Air - 128.000 context (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "z-ai/glm-4.5-air:free"
            },
            {
              "name": "Z.AI: GLM 4.5 - 128000 context $0.60/M input tokens $2.20/M output tokens (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "z-ai/glm-4.5"
            },
            {
              "name": "Z.AI: GLM 4.5 Air - 128.000 context $0.20/M input tokens $1.10/M output tokens (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "z-ai/glm-4.5-air"
            },
            {
              "name": "Qwen: Qwen3 235B A22B Thinking 2507 - 262.144 context $0.118/M input tokens $0.118/M output tokens (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "qwen/qwen3-235b-a22b-thinking-2507"
            },
            {
              "name": "Qwen: Qwen3 Coder - 262K context $0.30/M input tokens $1.20/M output tokens (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "qwen/qwen3-coder"
            },
            {
              "name": "Qwen: Qwen3 235B A22B Instruct 2507 - 262K context $0.12/M input tokens $0.59/M output tokens (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "qwen/qwen3-235b-a22b-2507"
            },
            {
              "name": "MoonshotAI: Kimi K2 - 131K context $0.55/M input tokens $2.20/M output tokens (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "moonshotai/kimi-k2"
            },
            {
              "name": "Google: Gemini 2.5 Flash Lite - 1.05M context $0.10/M input tokens $0.40/M output tokens (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "google/gemini-2.5-flash-lite"
            },
            {
              "name": "Google: Gemini 2.5 Flash - 1.05M context $0.30/M input tokens $2.50/M output tokens $1.238/K input imgs (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "google/gemini-2.5-flash"
            },
            {
              "name": "openai/gpt-oss-20b - 131K context, $0,04/M input tokens, $0,16/M output tokens (OpenRouter)",
              "localStartCommand": "",
              "endpoint": "https://openrouter.ai/api",
              "aiModel": "openai/gpt-oss-20b",
              "isKeyRequired": true
            },
            {
              "name": "OpenAI gpt-oss 120B - 131K context, $0,09/M input tokens, $0,45/M output tokens (OpenRouter)",
              "localStartCommand": "",
              "endpoint": "https://openrouter.ai/api",
              "aiModel": "openai/gpt-oss-120b",
              "isKeyRequired": true
            }
          ]],

[PREDEFINED_LISTS_KEYS.ENVS, [
            {
              "name": "Local, full package - min, gpt-oss 20B ( > 24GB VRAM | HD: 16 GB)",
              "description": "Everything local, gpt-oss 20B for agent",
              "completion": {
                "name": "Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)",
                "localStartCommand": "llama-server --fim-qwen-1.5b-default -ngl 99 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (<= 8GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "Nomic-Embed-Text-V2-GGUF",
                "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
                "endpoint": "http://127.0.0.1:8010"
              },
              "tools": {
                "name": "OpenAI gpt-oss 20B",
                "localStartCommand": "llama-server -hf ggml-org/gpt-oss-20b-GGUF -c 0 --jinja --reasoning-format none -np 2 --port 8009",
                "endpoint": "http://localhost:8009",
                "aiModel": "",
                "isKeyRequired": false
              }
            },
            {
              "name": "Local, full package - medium, gpt-oss 20B (> 34 GB VRAM | HD: 20 GB)",
              "description": "Everything local, gpt-oss 20B for agent",
              "completion": {
                "name": "Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)",
                "localStartCommand": "llama-server --fim-qwen-3b-default -ngl 99 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF (<= 16GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "Nomic-Embed-Text-V2-GGUF",
                "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
                "endpoint": "http://127.0.0.1:8010"
              },
              "tools": {
                "name": "OpenAI gpt-oss 20B",
                "localStartCommand": "llama-server -hf ggml-org/gpt-oss-20b-GGUF -c 0 --jinja --reasoning-format none -np 2 --port 8009",
                "endpoint": "http://localhost:8009",
                "aiModel": "",
                "isKeyRequired": false
              }
            },
            {
              "name": "Local, full package - max, gpt-oss 20B (>48GB VRAM | HD: 30 GB)",
              "description": "Everything local, gpt-oss 20B for agent",
              "completion": {
                "name": "Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)",
                "localStartCommand": "llama-server --fim-qwen-7b-default -ngl 99 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF (> 16GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "Nomic-Embed-Text-V2-GGUF",
                "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
                "endpoint": "http://127.0.0.1:8010"
              },
              "tools": {
                "name": "OpenAI gpt-oss 20B",
                "localStartCommand": "llama-server -hf ggml-org/gpt-oss-20b-GGUF -c 0 --jinja --reasoning-format none -np 2 --port 8009",
                "endpoint": "http://localhost:8009",
                "aiModel": "",
                "isKeyRequired": false
              }
            },
            {
              "name": "Local, only completions - CPU (HD: 1.6 GB)",
              "description": "For laptops only with CPU, lightweight model for completion ",
              "completion": {
                "name": "Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "embeddings": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "tools": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              }
            },
            {
              "name": "Local, only completions (<= 8GB VRAM | HD: 1.6 GB) ",
              "description": "Only for code completions model Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)",
              "completion": {
                "name": "Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)",
                "localStartCommand": "llama-server --fim-qwen-1.5b-default -ngl 99 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "embeddings": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "tools": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              }
            },
            {
              "name": "Local, only completions (<= 16GB VRAM | HD: 3,2 GB)",
              "description": "Only for completions, model Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM | HD: 3,2 GB)",
              "completion": {
                "name": "Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)",
                "localStartCommand": "llama-server --fim-qwen-3b-default -ngl 99 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "embeddings": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "tools": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              }
            },
            {
              "name": "Local, only completions (> 16GB VRAM)",
              "description": "Only for code completions, model Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)",
              "completion": {
                "name": "Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM | HD: 8.1 GB)",
                "localStartCommand": "llama-server --fim-qwen-7b-default -ngl 99 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "embeddings": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "tools": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              }
            },
            {
              "name": "Local, only chat & edit (CPU Only | HD: 2.2 GB)",
              "description": "Only for chat with AI, model Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (CPU Only)",
              "completion": {
                "name": "",
                "localStartCommand": ""
              },
              "chat": {
                "name": "Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (CPU Only)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "",
                "localStartCommand": ""
              },
              "tools": {
                "name": "",
                "localStartCommand": ""
              }
            },
            {
              "name": "Local, only chat, chat with project context & edit (<= 16GB VRAM | HD: 4 GB)",
              "description": "Could be used for edit with AI, chat with AI, chat with AI with project context Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF + embeddings model (<= 16GB VRAM)",
              "completion": {
                "name": "",
                "localStartCommand": ""
              },
              "chat": {
                "name": "Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF (<= 16GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
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
            },
            {
              "name": "Local, only chat & edit (<= 8GB VRAM | HD: 1.65)",
              "description": "Only for chat with AI and edit with AI, Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (<= 8GB VRAM)",
              "completion": {
                "name": "",
                "localStartCommand": ""
              },
              "chat": {
                "name": "Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (<= 8GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "",
                "localStartCommand": ""
              },
              "tools": {
                "name": "",
                "localStartCommand": ""
              }
            },
            {
              "name": "Local, only chat, chat with project context & edit (> 16GB VRAM | HD: 8.6 GB)",
              "description": "Good for chat with AI, chat with AI with project context, edit Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF + embeddings model  (> 16GB VRAM)",
              "completion": {
                "name": "",
                "localStartCommand": ""
              },
              "chat": {
                "name": "Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF (> 16GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
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
            },
            {
              "name": "Agent & chat (<= 16GB VRAM | HD: 3.8 GB) (requires OpenRouter API key)",
              "description": "Agent qwen 3 from OpenRouter (requires OpenRouter API key),  chat and edit with small models (<= 16GB VRAM) ",
              "completion": {
                "name": "",
                "localStartCommand": ""
              },
              "chat": {
                "name": "Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF (<= 16GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "Nomic-Embed-Text-V2-GGUF",
                "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
                "endpoint": "http://127.0.0.1:8010"
              },
              "tools": {
                "name": "Qwen: Qwen3 235B A22B Thinking 2507 - 262.144 context $0.118/M input tokens $0.118/M output tokens",
                "endpoint": "https://openrouter.ai/api",
                "isKeyRequired": true,
                "aiModel": "qwen/qwen3-235b-a22b-thinking-2507"
              }
            },
            {
              "name": "Full package - min (<= 16GB VRAM | HD: 4 GB) (requires OpenRouter API key)",
              "description": "The minimal configuration for completions (local), chat (local) and agent (remote - OpenRouter), requires OpenRouter API key for agent",
              "completion": {
                "name": "Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)",
                "localStartCommand": "llama-server --fim-qwen-1.5b-default -ngl 99 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (<= 8GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "Nomic-Embed-Text-V2-GGUF",
                "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
                "endpoint": "http://127.0.0.1:8010"
              },
              "tools": {
                "name": "Qwen: Qwen3 235B A22B Thinking 2507 - 262.144 context $0.118/M input tokens $0.118/M output tokens",
                "endpoint": "https://openrouter.ai/api",
                "isKeyRequired": true,
                "aiModel": "qwen/qwen3-235b-a22b-thinking-2507"
              }
            },
            {
              "name": "Full package - medium (<= 32GB VRAM | HD: 7.1 GB) (requires OpenRouter API key)",
              "description": "Agent qwen 3 from OpenRouter, completions & chat - medium size models, embeddings (<= 32GB VRAM))",
              "completion": {
                "name": "Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)",
                "localStartCommand": "llama-server --fim-qwen-3b-default -ngl 99 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF (<= 16GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-3B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "Nomic-Embed-Text-V2-GGUF",
                "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
                "endpoint": "http://127.0.0.1:8010"
              },
              "tools": {
                "name": "Qwen: Qwen3 235B A22B Thinking 2507 - 262.144 context $0.118/M input tokens $0.118/M output tokens",
                "endpoint": "https://openrouter.ai/api",
                "isKeyRequired": true,
                "aiModel": "qwen/qwen3-235b-a22b-thinking-2507"
              }
            },
            {
              "name": "Full package - max (>32 GB VRAM | HD: 17 GB) (requires OpenRouter API key)",
              "description": "Agent - qwen 3 from OpenRouter (API key required), completions, chat (>32 GB VRAM) ",
              "completion": {
                "name": "Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)",
                "localStartCommand": "llama-server --fim-qwen-7b-default -ngl 99 --port 8012",
                "endpoint": "http://localhost:8012",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF (> 16GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-7B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "Nomic-Embed-Text-V2-GGUF",
                "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
                "endpoint": "http://127.0.0.1:8010"
              },
              "tools": {
                "name": "Qwen: Qwen3 235B A22B Thinking 2507 - 262.144 context $0.118/M input tokens $0.118/M output tokens",
                "endpoint": "https://openrouter.ai/api",
                "isKeyRequired": true,
                "aiModel": "qwen/qwen3-235b-a22b-thinking-2507"
              }
            },
            {
              "name": "OpenAI gpt-oss,  20B agent, chat - ( < 8GB VRAM | HD: 2.2 GB) (requires OpenRouter API key)",
              "description": "agent - Open AI gpt-oss 20GB from OpenRouter (requires API key), chat - small model (< 8GB VRAM)",
              "completion": {
                "name": "",
                "localStartCommand": ""
              },
              "chat": {
                "name": "Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF (<= 8GB VRAM)",
                "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-1.5B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
                "endpoint": "http://127.0.0.1:8011"
              },
              "embeddings": {
                "name": "Nomic-Embed-Text-V2-GGUF",
                "localStartCommand": "llama-server -hf ggml-org/Nomic-Embed-Text-V2-GGUF -ngl 99 -ub 2048 -b 2048 --ctx-size 2048 --embeddings --port 8010",
                "endpoint": "http://127.0.0.1:8010"
              },
              "tools": {
                "name": "openai/gpt-oss-20b",
                "localStartCommand": "",
                "endpoint": "https://openrouter.ai/api",
                "aiModel": "openai/gpt-oss-20b",
                "isKeyRequired": true
              }
            },
            {
              "name": "Empty - no models",
              "description": "For cases when the settings (endpoint*, Launch_*, Api_key*,  Ai_model) are used for configuring which servers to be used by llama-vscode instead of env.",
              "completion": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "chat": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "embeddings": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              },
              "tools": {
                "name": "",
                "localStartCommand": "",
                "endpoint": "",
                "aiModel": "",
                "isKeyRequired": false
              }
            }
          ]],
[PREDEFINED_LISTS_KEYS.AGENTS, [
           {
              "name": "llama-vscode help",
              "description": "This is an agent for helping how to use llama-vscode.",
              "systemInstruction": [
                  "You are an agent for helping the user how to use llama-vscode.",
                  "Use the available tools to get the help documentation for llama-vscode and answer the questions from the user.",
                  "Base your answers on the help documentation from the tools."
              ],
              "tools": [
                  "llama_vscode_help"
              ]
            },
            {
              "name": "default",
              "description": "This is the default agent.",
              "systemInstruction": [
                "You are an agent for software development - please keep going until the user’s query is completely resolved, before ending your turn and yielding back to the user.",
                "Only terminate your turn when you are sure that the problem is solved.",
                "If you are not sure about anything pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.",
                "You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully.",
                "Read the file content or a section of the file before editing a the file.",
                "",
                "# Workflow",
                "",
                "## High-Level Problem Solving Strategy",
                "",
                "1. Understand the problem deeply. Carefully read the issue and think critically about what is required.",
                "2. Investigate the codebase. Explore relevant files, search for key functions, and gather context.",
                "3. Develop a clear, step-by-step plan. Break down the fix into manageable, incremental steps.",
                "4. Implement the fix incrementally. Make small, testable code changes.",
                "5. Debug as needed. Use debugging techniques to isolate and resolve issues.",
                "6. Iterate until the root cause is fixed.",
                "7. Reflect and validate comprehensively.",
                "",
                "Refer to the detailed sections below for more information on each step.",
                "",
                "## 1. Deeply Understand the Problem",
                "Carefully read the issue and think hard about a plan to solve it before coding.",
                "",
                "## 2. Codebase Investigation",
                "- Explore relevant files and directories.",
                "- Search for key functions, classes, or variables related to the issue.",
                "- Read and understand relevant code snippets.",
                "- Identify the root cause of the problem.",
                "- Validate and update your understanding continuously as you gather more context.",
                "",
                "## 3. Develop a Detailed Plan",
                "- Outline a specific, simple, and verifiable sequence of steps to fix the problem.",
                "- Break down the fix into small, incremental changes.",
                "",
                "## 4. Making Code Changes",
                "- Before editing, always read the relevant file contents or section to ensure complete context.",
                "- If a patch is not applied correctly, attempt to reapply it.",
                "- Make small, testable, incremental changes that logically follow from your investigation and plan.",
                "",
                "## 5. Debugging",
                "- Make code changes only if you have high confidence they can solve the problem",
                "- When debugging, try to determine the root cause rather than addressing symptoms",
                "- Debug for as long as needed to identify the root cause and identify a fix",
                "- Use print statements, logs, or temporary code to inspect program state, including descriptive statements or error messages to understand what's happening",
                "- To test hypotheses, you can also add test statements or functions",
                "- Revisit your assumptions if unexpected behavior occurs.",
                "",
                "",
                "## 6. Final Verification",
                "- Confirm the root cause is fixed.",
                "- Review your solution for logic correctness and robustness.",
                "- Iterate until you are extremely confident the fix is complete.",
                "",
                "## 7. Final Reflection",
                "- If there are changed files, build the application to check for errors.",
                "- Reflect carefully on the original intent of the user and the problem statement.",
                "- Think about potential edge cases or scenarios.",
                "- Continue refining until you are confident the fix is robust and comprehensive.",
                ""
              ],
              "tools": [
                "run_terminal_command",
                "search_source",
                "read_file",
                "list_directory",
                "regex_search",
                "delete_file",
                "get_diff",
                "edit_file",
                "ask_user"
              ]
            },
            {
              "name": "Ask",
              "description": "This is an agent for questions about source code without changing it.",
              "systemInstruction": [
                "You are an agent for answering questions about the project and software development in general - please keep going until the user’s query is completely resolved, before ending your turn and yielding back to the user.",
                "Only terminate your turn when you are sure that the question is answered.",
                "If you are not sure about anything pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.",
                "You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully.",
                "Do not change add or remove files in the project. Just review, answer questions and suggest solutions.",
                "",
                "# Workflow",
                "",
                "## High-Level Problem Solving Strategy",
                "",
                "1. Understand the problem deeply. Carefully read the issue and think critically about what is required.",
                "2. Investigate the codebase. Explore relevant files, search for key functions, and gather context.",
                "3. Develop a clear, step-by-step plan. ",
                "7. Reflect and validate comprehensively.",
                "",
                "Refer to the detailed sections below for more information on each step.",
                "",
                "## 1. Deeply Understand the Problem",
                "Carefully read the issue and think hard about a plan to solve it before coding.",
                "",
                "## 2. Codebase Investigation",
                "- Explore relevant files and directories.",
                "- Search for key functions, classes, or variables related to the issue.",
                "- Read and understand relevant code snippets.",
                "- Identify the root cause of the problem.",
                "- Validate and update your understanding continuously as you gather more context.",
                "",
                "## 3. Develop a Detailed Plan",
                "- Outline a specific, simple, and verifiable sequence of steps find and answer or a solution to the problem.",
                "",
                "## 4. Final Verification",
                "- Confirm the user query is answerd.",
                "- Review your solution for logic correctness and robustness.",
                "- Think about potential edge cases or scenarios.",
                "- Iterate until you are extremely confident the answer is complete.",
                ""
              ],
              "tools": [
                "run_terminal_command",
                "search_source",
                "read_file",
                "list_directory",
                "regex_search",
                "get_diff",
                "ask_user"
              ]
            }
          ]],
[PREDEFINED_LISTS_KEYS.AGENT_COMMANDS, [
           {
              "name": "about",
              "description": "Reviews the project and provides information about it.",
              "prompt": [
                  "What is this project about?",
                  "Provide an overview of the project - purpose, architecture, language, etc."
              ],
              "context": [
              ]
            },
            {
              "name": "explain",
              "description": "Explains the attached code/file.",
              "prompt": [
                "Explain the provided source code."
              ],
              "context": [
              ]
            }
          ]],
])