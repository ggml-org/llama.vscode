from fastapi import FastAPI
from pydantic import BaseModel, Field, ConfigDict
from fastapi.middleware.cors import CORSMiddleware
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from transformers import pipeline
from fastapi import HTTPException
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# -----------Request Models-----------

class LLMRequest(BaseModel):
    prompt: str
    model_name: str  # dynamic LLama Model

class SummarizeRequest(BaseModel):
    text: str
    model_name: str  # dynamic Hugging Face summarizer


# -----------Initialize Models-----------

def get_llama_model(model_name: str) -> ChatGroq:
    # Return a ChatGroq instance for the requested LLama model.
    return ChatGroq(
        temperature=0.2,
        model_name=model_name,
        api_key="API_KEY"
    )

def get_hf_model(model_name: str):
    # Return a Hugging Face pipeline for summarization.
    models=[
        "facebook/bart-large-cnn",
        "sshleifer/distilbart-cnn-12-6"
    ]
     
    # If user provides a model, try it first

    if model_name:
        try:
            return pipeline("summarization",model=model_name,device=-1)
        except Exception:
            pass # fallback to the predefined model list


    for model in models:
        try:
            return pipeline("summarization",model=model,device=-1)
        except Exception:
            continue

    raise HTTPException(status_code=500,detail="No summarization model available")

# -----------Endpoints-----------

@app.post("/generate")
def generate_text(req: LLMRequest):
    try:
        llm = get_llm_model(req.model_name)
        response = llm.invoke(req.prompt)
        return {"output": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize")
def summarize_text(req: SummarizeRequest):
    summarizer = get_hf_model(req.model_name)
    try:
        summary = summarizer(req.text, max_length=150, min_length=30, do_sample=False)
        return {"summary": summary[0]["summary_text"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))