import os
from datetime import datetime, timezone
from typing import Optional

import boto3
from bson import ObjectId
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from pymongo import MongoClient


app = FastAPI(
    title="S3 Backend Service",
    version="1.0.0",
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://root:password@mongodb:27017")
MONGO_DB = os.getenv("MONGO_DB", "coe558")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "genai_results")
S3_BUCKET = os.getenv("S3_BUCKET")

client = MongoClient(MONGO_URI)
collection = client[MONGO_DB][MONGO_COLLECTION]

s3 = boto3.client("s3")


class ResultCreate(BaseModel):
    prompt: str = Field(..., min_length=3)
    result_text: str = Field(..., min_length=1)
    provider: str = "gemini"
    media_url: Optional[str] = None


def serialize_doc(doc):
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc

# Health API
@app.get("/health")
def health():
    return {"status": "ok", "service": "backend"}

# GENAI APIs
@app.post("/results")
def create_result(req: ResultCreate):
    doc = {
        "prompt": req.prompt,
        "result_text": req.result_text,
        "provider": req.provider,
        "media_url": req.media_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
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
    if not S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3_BUCKET is not configured")

    object_key = f"uploads/{datetime.now(timezone.utc).timestamp()}-{file.filename}"

    content = await file.read()

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=object_key,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )

    media_url = f"s3://{S3_BUCKET}/{object_key}"

    doc = {
        "prompt": prompt,
        "result_text": result_text,
        "provider": provider,
        "media_url": media_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
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

    return {"deleted": True, "id": result_id}