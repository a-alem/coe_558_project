import base64
import os
from typing import Optional

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(
    title="S2 GenAI Service",
    version="1.0.0",
    description="GenAI service for text generation, image generation, and media question answering.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.coe558projectkfupm.com",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=4000)
    output_type: Optional[str] = Field(
        default=None,
        description="text, image, or omitted for automatic detection",
    )


class GenerateResponse(BaseModel):
    prompt: str
    result_text: str
    provider: str = "gemini"
    output_type: str
    media_base64: Optional[str] = None
    media_mime_type: Optional[str] = None


class MediaQuestionResponse(BaseModel):
    prompt: str
    filename: str
    mime_type: str
    result_text: str
    provider: str = "gemini"


def get_api_key() -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")
    return api_key


def gemini_generate_content(model: str, payload: dict, timeout: int = 120) -> dict:
    api_key = get_api_key()

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }

    try:
        res = requests.post(url, headers=headers, json=payload, timeout=timeout)
        res.raise_for_status()
        return res.json()

    except requests.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Gemini API error",
                "status_code": e.response.status_code,
                "body": e.response.text,
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to call Gemini API: {str(e)}",
        )


def extract_parts(data: dict) -> list:
    try:
        return data["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Unexpected Gemini response format",
                "raw_response": data,
            },
        )


def parse_text_and_media(data: dict) -> tuple[str, Optional[str], Optional[str]]:
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
            media_mime_type = (
                    inline_data.get("mimeType")
                    or inline_data.get("mime_type")
                    or "image/png"
            )

    result_text = "\n".join(text_parts).strip()

    return result_text, media_base64, media_mime_type


def should_generate_image(prompt: str, output_type: Optional[str]) -> bool:
    if output_type:
        return output_type.lower() == "image"

    prompt_lower = prompt.lower()

    image_keywords = [
        "generate image",
        "create image",
        "draw",
        "photo of",
        "picture of",
        "image of",
        "illustration of",
        "poster",
        "logo",
        "icon",
    ]

    return any(keyword in prompt_lower for keyword in image_keywords)


@app.get("/health")
def health():
    return {"status": "ok", "service": "genai"}


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    image_mode = should_generate_image(req.prompt, req.output_type)

    if image_mode:
        model = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": req.prompt,
                        }
                    ]
                }
            ],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
            },
        }

        data = gemini_generate_content(model=model, payload=payload, timeout=180)
        result_text, media_base64, media_mime_type = parse_text_and_media(data)

        if not media_base64:
            raise HTTPException(
                status_code=502,
                detail={
                    "message": "Gemini returned text but no generated image.",
                    "hint": (
                        "Check that GEMINI_IMAGE_MODEL supports image generation "
                        "and that your API key has access/quota."
                    ),
                    "raw_response": data,
                },
            )

        return GenerateResponse(
            prompt=req.prompt,
            result_text=result_text or "Generated image.",
            output_type="image",
            media_base64=media_base64,
            media_mime_type=media_mime_type or "image/png",
        )

    model = os.getenv("GEMINI_TEXT_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"))

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": req.prompt,
                    }
                ]
            }
        ]
    }

    data = gemini_generate_content(model=model, payload=payload, timeout=90)
    result_text, _, _ = parse_text_and_media(data)

    return GenerateResponse(
        prompt=req.prompt,
        result_text=result_text,
        output_type="text",
    )


@app.post("/media/question", response_model=MediaQuestionResponse)
async def ask_question_about_media(
        prompt: str = Form(...),
        file: UploadFile = File(...),
):
    mime_type = file.content_type or "application/octet-stream"

    allowed_prefixes = [
        "image/",
        "audio/",
        "video/",
    ]

    if not any(mime_type.startswith(prefix) for prefix in allowed_prefixes):
        raise HTTPException(
            status_code=400,
            detail="Only image, audio, or video files are supported.",
        )

    content = await file.read()

    max_size_bytes = 18 * 1024 * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail="File is too large for inline Gemini upload. Use a file below 18 MB.",
        )

    media_base64 = base64.b64encode(content).decode("utf-8")

    model = os.getenv("GEMINI_MULTIMODAL_MODEL", "gemini-2.5-flash")

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": media_base64,
                        }
                    },
                    {
                        "text": prompt,
                    },
                ]
            }
        ]
    }

    data = gemini_generate_content(model=model, payload=payload, timeout=180)
    result_text, _, _ = parse_text_and_media(data)

    return MediaQuestionResponse(
        prompt=prompt,
        filename=file.filename or "uploaded-file",
        mime_type=mime_type,
        result_text=result_text,
    )