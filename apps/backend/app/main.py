import os
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional


app = FastAPI(
    title="S2 GenAI Service",
    version="1.0.0",
)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000)
    output_type: Optional[str] = Field(
        default=None,
        description="Use 'text' or 'image'. If omitted, image-like prompts are detected automatically.",
    )


class GenerateResponse(BaseModel):
    prompt: str
    result_text: str
    provider: str = "gemini"
    output_type: str
    media_base64: Optional[str] = None
    media_mime_type: Optional[str] = None


def should_generate_image(prompt: str, output_type: Optional[str]) -> bool:
    if output_type:
        return output_type.lower() == "image"

    image_keywords = [
        "generate image",
        "create image",
        "draw",
        "photo of",
        "picture of",
        "image of",
        "illustration of",
        "logo",
        "icon",
        "poster",
    ]

    prompt_lower = prompt.lower()
    return any(keyword in prompt_lower for keyword in image_keywords)


def extract_parts(data: dict):
    try:
        return data["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected Gemini response format: {data}",
        )


@app.get("/health")
def health():
    return {"status": "ok", "service": "genai"}


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")

    image_mode = should_generate_image(req.prompt, req.output_type)

    if image_mode:
        model = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
        generation_config = {
            "responseModalities": ["TEXT", "IMAGE"],
            "responseFormat": {
                "image": {
                    "aspectRatio": "1:1"
                }
            }
        }
    else:
        model = os.getenv("GEMINI_TEXT_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"))
        generation_config = None

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": req.prompt}
                ]
            }
        ]
    }

    if generation_config:
        payload["generationConfig"] = generation_config

    try:
        res = requests.post(url, headers=headers, json=payload, timeout=90)
        res.raise_for_status()
        data = res.json()

        parts = extract_parts(data)

        text_parts = []
        media_base64 = None
        media_mime_type = None

        for part in parts:
            if "text" in part:
                text_parts.append(part["text"])

            inline_data = part.get("inlineData") or part.get("inline_data")
            if inline_data:
                media_base64 = inline_data.get("data")
                media_mime_type = inline_data.get("mimeType") or inline_data.get("mime_type")

        result_text = "\n".join(text_parts).strip()

        if image_mode and not media_base64:
            raise HTTPException(
                status_code=502,
                detail={
                    "message": "Gemini returned no image data.",
                    "hint": "Check that GEMINI_IMAGE_MODEL supports image generation and that your API key has access/quota.",
                    "raw_response": data,
                },
            )

        return GenerateResponse(
            prompt=req.prompt,
            result_text=result_text or "Generated successfully.",
            output_type="image" if image_mode else "text",
            media_base64=media_base64,
            media_mime_type=media_mime_type,
        )

    except requests.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Gemini API error",
                "status_code": e.response.status_code,
                "body": e.response.text,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate response: {str(e)}",
        )