import base64
import os
from datetime import datetime, timezone
from typing import Optional

import boto3
from bson import ObjectId
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient


app = FastAPI(
    title="S3 Backend Service",
    version="1.0.0",
    description="CRUD backend service for storing GenAI prompts, results, and media references.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.coe558projectkfupm.com",
        "https://coe558projectkfupm.com",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


MONGO_HOST = os.getenv("MONGO_HOST", "mongodb")
MONGO_PORT = int(os.getenv("MONGO_PORT", "27017"))
MONGO_ROOT_USERNAME = os.getenv("MONGO_ROOT_USERNAME")
MONGO_ROOT_PASSWORD = os.getenv("MONGO_ROOT_PASSWORD")

MONGO_DB = os.getenv("MONGO_DB", "coe558")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "genai_results")

S3_BUCKET = os.getenv("S3_BUCKET")
AWS_REGION = os.getenv("AWS_REGION", "me-south-1")


if MONGO_ROOT_USERNAME and MONGO_ROOT_PASSWORD:
    client = MongoClient(
        host=MONGO_HOST,
        port=MONGO_PORT,
        username=MONGO_ROOT_USERNAME,
        password=MONGO_ROOT_PASSWORD,
        authSource="admin",
    )
else:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb:27017")
    client = MongoClient(MONGO_URI)


collection = client[MONGO_DB][MONGO_COLLECTION]
s3 = boto3.client("s3", region_name=AWS_REGION)


class ResultCreate(BaseModel):
    prompt: str = Field(..., min_length=3)
    result_text: str = Field(..., min_length=1)
    provider: str = "gemini"
    media_url: Optional[str] = None


def serialize_doc(doc: dict) -> dict:
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def detect_extension_from_mime_type(mime_type: str) -> str:
    mapping = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "video/mp4": "mp4",
        "video/webm": "webm",
    }

    return mapping.get(mime_type, "bin")


def upload_bytes_to_s3(
        content: bytes,
        filename: str,
        content_type: str,
) -> str:
    if not S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3_BUCKET is not configured")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    safe_filename = filename.replace("/", "-").replace("\\", "-")
    object_key = f"uploads/{timestamp}-{safe_filename}"

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=object_key,
        Body=content,
        ContentType=content_type or "application/octet-stream",
    )

    return f"s3://{S3_BUCKET}/{object_key}"


def parse_data_url(data_url: str) -> tuple[str, bytes]:
    if not data_url.startswith("data:"):
        raise ValueError("Not a data URL")

    header, encoded = data_url.split(",", 1)

    # Example header: data:image/png;base64
    mime_type = header.replace("data:", "").replace(";base64", "")

    return mime_type, base64.b64decode(encoded)

# Health API
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "backend",
        "database": MONGO_DB,
        "collection": MONGO_COLLECTION,
    }


@app.post("/results")
def create_result(req: ResultCreate):
    doc = {
        "prompt": req.prompt,
        "result_text": req.result_text,
        "provider": req.provider,
        "media_url": req.media_url,
        "created_at": now_iso(),
    }

    inserted = collection.insert_one(doc)
    doc["_id"] = inserted.inserted_id

    return serialize_doc(doc)


@app.post("/results/save-generated-media")
def save_generated_media(req: ResultCreate):
    """
    Optional stronger endpoint:
    Accepts a media_url data URL, uploads the decoded media to S3,
    and stores only the S3 reference in MongoDB.

    The current frontend can still use POST /results directly.
    You can switch the frontend later to this endpoint if you want S3-backed generated images.
    """
    media_reference = req.media_url

    if req.media_url and req.media_url.startswith("data:"):
        try:
            mime_type, content = parse_data_url(req.media_url)
            extension = detect_extension_from_mime_type(mime_type)
            filename = f"generated-media.{extension}"

            media_reference = upload_bytes_to_s3(
                content=content,
                filename=filename,
                content_type=mime_type,
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse/upload generated media: {str(e)}",
            )

    doc = {
        "prompt": req.prompt,
        "result_text": req.result_text,
        "provider": req.provider,
        "media_url": media_reference,
        "created_at": now_iso(),
    }

    inserted = collection.insert_one(doc)
    doc["_id"] = inserted.inserted_id

    return serialize_doc(doc)


@app.post("/results/upload")
async def create_result_with_file(
        prompt: str = Form(...),
        result_text: str = Form(...),
        provider: str = Form("gemini"),
        file: UploadFile = File(...),
):
    content = await file.read()

    media_url = upload_bytes_to_s3(
        content=content,
        filename=file.filename or "uploaded-media",
        content_type=file.content_type or "application/octet-stream",
    )

    doc = {
        "prompt": prompt,
        "result_text": result_text,
        "provider": provider,
        "media_url": media_url,
        "created_at": now_iso(),
    }

    inserted = collection.insert_one(doc)
    doc["_id"] = inserted.inserted_id

    return serialize_doc(doc)


@app.get("/results")
def list_results():
    docs = collection.find().sort("created_at", -1)
    return [serialize_doc(doc) for doc in docs]


@app.get("/results/{result_id}")
def get_result(result_id: str):
    if not ObjectId.is_valid(result_id):
        raise HTTPException(status_code=400, detail="Invalid result id")

    doc = collection.find_one({"_id": ObjectId(result_id)})

    if not doc:
        raise HTTPException(status_code=404, detail="Result not found")

    return serialize_doc(doc)


@app.delete("/results/{result_id}")
def delete_result(result_id: str):
    if not ObjectId.is_valid(result_id):
        raise HTTPException(status_code=400, detail="Invalid result id")

    result = collection.delete_one({"_id": ObjectId(result_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Result not found")

    return {
        "deleted": True,
        "id": result_id,
    }