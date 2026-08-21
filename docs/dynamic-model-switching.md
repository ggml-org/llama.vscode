# Dynamic Model Switching with Remote LLaMA-Swap Server in VS Code

## Overview

This document demonstrates how to dynamically switch between multiple AI models hosted on a **remote LLaMA-swap server** using **VS Code**.  

This approach is useful for developers who:

- Have multiple models available on remote servers.
- Want to choose models dynamically based on **task type, processing speed, or CPU usage**.
- Need a flexible workflow without restarting services or VS Code.

---

## Folder Structure

project/
├── docs/
│ └── dynamic-model-switching.md
├── examples/
│ ├── dynamic_model_switcher.py
│ └── requirements.txt
├── .gitignore


- `docs/` contains this markdown documentation.
- `examples/` contains the Python example code for **dynamic model switching**.
- `.gitignore` excludes local environments, caches, and secret files (`.venv/`, `.env`, `__pycache__/`).

---

## How It Works

1. **Dynamic Model Loading**

   Models can be loaded by **name** at runtime.  
   Example:
   ```python
   from langchain_groq import ChatGroq

   llm = ChatGroq(
       temperature=0.2,
       model_name="llama-3.1-8b-instant",
       api_key="YOUR_API_KEY"
   )

