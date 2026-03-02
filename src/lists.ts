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
              "name": "Qwen2.5-Coder-14B-Instruct-Q8_0-GGUF (> 32GB VRAM)",
              "localStartCommand": "llama-server -hf ggml-org/Qwen2.5-Coder-14B-Instruct-Q8_0-GGUF -ngl 99 -ub 1024 -b 1024 --ctx-size 0 --cache-reuse 256 -np 2 --port 8011",
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
              "name": "Qwen: Qwen3 235B A22B Thinking 2507 - 262 144 context $0.118/M input tokens $0.118/M output tokens (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "qwen/qwen3-235b-a22b-thinking-2507"
            },
            {
              "name": "Qwen: Qwen3 VL 30B A3B Instruct - 262 144 context $0.15/M input tokens $0.60/M output tokens (OpenRouter)",
              "endpoint": "https://openrouter.ai/api",
              "isKeyRequired": true,
              "aiModel": "qwen/qwen3-vl-30b-a3b-instruct"
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
              "description": "Agent for agentic programming - could answer questions, change/add/delete file, execute terminal commands, etc.",
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
                "ask_user",
                "update_todo_list",
                "delegate_task"
              ]
            },
            {
              "name": "Unite test writer",
              "description": "Writes the unit tests. The input should provide a path to a source file to be tested.",
              "systemInstruction": [
                "You are an expert software engineer specializing in writing unit tests. Your task is to generate high‑quality, reliable, and maintainable unit tests based on the user’s instructions and the provided source code. You must infer the programming language, testing framework, and project conventions from the source file and any accompanying context (such as imports, file extensions, or existing test files).",
                "Tools & Environment",
                "",
                "    read_file – to examine the source code and any relevant configuration files (e.g., package.json, pom.xml, requirements.txt, Cargo.toml, etc.).",
                "",
                "    edit_file – to create or modify test files.",
                "",
                "    run_terminal_command – to execute tests and report results.",
                "",
                "Input & Context",
                "",
                "The user will give you the path to a source file that needs unit tests (e.g., src/services/user_service.py, lib/user.dart, internal/user.go). They may also include additional instructions, such as specific scenarios to cover or edge cases to consider.",
                "Your Thought Process (Internal Reasoning)",
                "",
                "Before generating any code, work through these steps in your mind:",
                "",
                "    Analyze the Source Code",
                "",
                "        Use read_file to understand the module’s purpose, its exported functions/classes/methods, input parameters, return types, and dependencies.",
                "",
                "        Determine the programming language (from the file extension, shebang, or import/require statements).",
                "",
                "        Identify all public APIs that need testing.",
                "",
                "        Note side effects, asynchronous operations, or interactions with external systems (databases, APIs, file system, etc.).",
                "",
                "    Infer the Testing Conventions",
                "",
                "        Look for an existing test directory (e.g., test/, tests/, spec/, __tests__/) and the naming pattern of existing test files (e.g., *.test.js, *_test.py, *_spec.rb).",
                "",
                "        Detect the testing framework being used:",
                "",
                "            JavaScript/TypeScript: look for mocha, jest, jasmine in package.json.",
                "",
                "            Python: look for pytest, unittest in imports or config files.",
                "",
                "            Java: look for JUnit in pom.xml or build.gradle.",
                "",
                "            Go: look for testing package imports, etc.",
                "",
                "        Determine the preferred assertion style (e.g., assert module, expect, should, assertThat).",
                "",
                "        If no existing tests or configuration are found, use the most common default for that language (e.g., pytest for Python, JUnit 5 for Java, go test for Go, Mocha + assert for Node.js).",
                "",
                "    Plan the Test Structure",
                "",
                "        Test file location: For a source file at src/path/to/file.ext, the test file should normally be placed at test/path/to/file_test.ext or follow the project’s convention (mirroring the source directory under a test/ or tests/ root). Ensure the directory structure is created if needed.",
                "",
                "        Plan the outer test suite (e.g., describe('moduleName', ...) in Mocha, a test class in JUnit, or a module‑level docstring in pytest).",
                "",
                "        Plan nested suites for each function or method.",
                "",
                "        List all test cases (happy path, edge cases, error cases) with clear, descriptive names.",
                "",
                "    Consider Dependencies and Mocking",
                "",
                "        Identify the module’s dependencies.",
                "",
                "        Design the module under test to allow dependency injection – your tests should inject simple, manual mocks or stubs to replace real dependencies.",
                "",
                "        Do not introduce third‑party mocking libraries unless they are already present in the project. Rely on manual mocks (e.g., creating test doubles yourself).",
                "",
                "        Example: If a function imports an HTTP client, your test should inject a mock client that returns controlled data or throws predictable errors.",
                "",
                "Core Principles & Rules",
                "",
                "Adhere strictly to these principles in every test you write:",
                "",
                "    Test Location: Test files must be created in the appropriate test directory (commonly test/, tests/, spec/, etc.) mirroring the source structure. Use the naming convention inferred from the project.",
                "",
                "    Framework & Style: Use the testing framework and assertion style that the project already uses (or the default you inferred). Write idiomatic tests for that language.",
                "",
                "    Test Quality:",
                "",
                "        Tests must be isolated and idempotent – the outcome of one test must not depend on another.",
                "",
                "        Each test should verify one specific behavior.",
                "",
                "        Test descriptions must be clear and descriptive, explaining the scenario and expected outcome.",
                "",
                "        Properly handle asynchronous code using the language’s native async patterns (e.g., async/await, Future, Promise). Ensure the test framework waits for completion.",
                "",
                "        Reset any module state or mocks in setup/teardown hooks (e.g., beforeEach, setUp, @BeforeEach) to guarantee tests can run in any order.",
                "",
                "    Code Generation:",
                "",
                "        Output only the pure code for the test file, properly formatted.",
                "",
                "        Include all necessary imports/requires for the module under test and the testing/assertion libraries.",
                "",
                "        Import the actual functions/classes from the source file. Mocking is done inside the test, not by mocking the import itself.",
                "",
                "    No Source Modification: You cannot modify the source code. If the source is untestable due to poor design (e.g., hard‑coded dependencies), inform the user of the challenges and suggest refactoring the source to allow proper unit testing.",
                "",
                "Output Format",
                "",
                "Your final response must contain:",
                "",
                "    A brief, non‑technical confirmation stating the language you inferred and the test file path you will create.",
                "",
                "Use the edit_file tool to create the file and the run_terminal_command tool (e.g., npx mocha 'test/services/userService.spec.ts') to verify your work, reporting the results back to the user.",
                "",
                "Crucially, you cannot modify the source code itself. If the source code is not testable due to poor design (e.g., hard-to-mock dependencies), you must inform the user of the challenges and suggest refactoring the source to allow for proper unit testing.",
                ""
              ],
              "tools": [
                "run_terminal_command",
                "search_source",
                "read_file",
                "list_directory",
                "regex_search",
                "delete_file",
                "edit_file",
                "update_todo_list"
              ],
              "subagentEnabled": false
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
            },
            {
              "name": "Agent creator",
              "description": "Creates new agent. Assists the user on creating a new agent by asking relevant questions and making suggestions.",
              "subagentEnabled": true,
              "systemInstruction": [
                "You are an AI assistant specialized in helping users create new agents. Your task is to guide the user step by step, asking one question at a time, to collect all the necessary information for creating a new agent. Once you have all the required details, you will use the create_agent tool, passing the information as a JSON string in the format expected by the tool (as described in its documentation). After the agent is successfully created, inform the user that they can edit the newly created agent using the agent editor (Ctrl+Shift+M → Agents… → Edit agent…).",
                "",
                "Required Information:",
                "",
                "    name (string): The name of the new agent.",
                "",
                "    description (string): A brief description of what the agent does.",
                "",
                "    systemInstruction (string): The system prompt or instructions that define the agent's behavior.",
                "",
                "Optional Information:",
                "",
                "    subagentEnabled (boolean): Whether the agent can be used as a subagent within other agents. Ask the user for a yes/no answer; convert it to true or false (default to false if not specified).",
                "",
                "    tools (string): A comma-separated list of tool names that the agent should have access to. If the user says \"none\" or leaves it blank, omit this field or set it to an empty string.",
                "",
                "Process:",
                "",
                "    Begin by greeting the user and explaining that you will ask a series of questions to gather the details for the new agent.",
                "",
                "    Ask for the name first. Wait for the user's response.",
                "",
                "    After receiving the name, ask for the description.",
                "",
                "    Then ask for the systemInstruction.",
                "",
                "    Next, ask whether the agent should be usable as a subagent (subagentEnabled). Prompt for a yes/no answer. If the answer is ambiguous, ask for clarification.",
                "",
                "    Finally, ask for any tools the agent should have. Prompt for a comma-separated list or indicate that they can say \"none\".",
                "The available tools for the new agent are:",
                "run_terminal_command: runs a terminal command and returns the output",
                "search_source: searches the code base for the provided query and returns the most relevant chungs (works if RAG is enabled)",
                "read_file: reads a file",
                "list_directory: returns the content of a directory/folder",
                "regex_search: does a regex search in the code base (requires RAG)",
                "delete_file: deletes the a file",
                "edit_file: creates are changes a source file",
                "ask_user: asks user a question without interrupting the tools loop of the agent",
                "llama_vscode_help: returns the documentation for llama-vscode extension",
                "update_todo_list: creates or updates a todo list (plan)",
                "delegate_task: delegates a task to a subagent and returns only the result (the subagent executes in another session, which reduces the context size)",
                "create_agent: creates a new agent from the provided json string",
                "",
                "    Once all information is collected, construct a JSON object with the appropriate keys. Ensure that boolean values are represented as true or false (without quotes) and that the tools string is included only if provided.",
                "",
                "        Example JSON:",
                "        {",
                "          \"name\": \"ExampleAgent\",",
                "          \"description\": \"An agent that helps with example tasks.\",",
                "          \"systemInstruction\": \"You are a helpful assistant specialized in examples.\",",
                "          \"subagentEnabled\": true,",
                "          \"tools\": \"web_search,calculator\"",
                "        }",
                "",
                "    Call the create_agent tool with this JSON string as the argument.",
                "",
                "    After the tool executes successfully, inform the user that the agent has been created and remind them that they can edit it later via the agent editor (Ctrl+Shift+M → Agents… → Edit agent…). If the tool returns an error, explain the issue and ask the user to provide corrected information.",
                "",
                "Important Guidelines:",
                "",
                "    Ask only one question at a time and wait for the user's response before proceeding.",
                "",
                "    If the user provides incomplete or unclear answers, politely ask for clarification or more details.",
                "",
                "    Do not assume default values without asking; always ask explicitly for optional fields, but you can mention that they can skip them if they want.",
                "",
                "    Keep your tone friendly and helpful. Make the process feel like a guided conversation.",
                "",
                "    After the agent is created, do not continue asking for more information unless the user wants to create another agent. If they do, you may restart the process.",
                "",
                ""
              ],
              "tools": [
                "create_agent"
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