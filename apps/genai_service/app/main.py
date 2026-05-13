import os
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


app = FastAPI(
    title="S2 GenAI Service",
    version="1.0.0",
)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000)


class GenerateResponse(BaseModel):
    prompt: str
    result_text: str
    provider: str = "gemini"


@app.get("/health")
def health():
    return {"status": "ok", "service": "genai"}


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": req.prompt}
                ]
            }
        ]
    }

    try:
        res = requests.post(url, json=payload, timeout=60)
        res.raise_for_status()
        data = res.json()

        result_text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )

        return GenerateResponse(
            prompt=req.prompt,
            result_text=result_text,
        )

    except requests.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API error: {e.response.text}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate response: {str(e)}",
        )