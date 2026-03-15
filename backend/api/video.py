from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from config import get_settings
from utils.aws_client import get_bedrock_runtime
from utils.logging import get_logger

log      = get_logger(__name__)
router   = APIRouter(prefix="/api/video", tags=["video"])
settings = get_settings()

SUPPORTED_FORMATS: dict[str, str] = {
    "mp4":  "video/mp4",
    "mov":  "video/quicktime",
    "avi":  "video/x-msvideo",
    "mkv":  "video/x-matroska",
    "webm": "video/webm",
    "flv":  "video/x-flv",
    "wmv":  "video/x-ms-wmv",
    "3gp":  "video/3gpp",
}

MAX_BYTES = 25 * 1024 * 1024   # 25 MB — Bedrock inline limit

DEFAULT_PROMPT = (
    "Provide a comprehensive analysis of this video. "
    "Describe: (1) what is happening overall, (2) key scenes and activities, "
    "(3) notable objects or people visible, and (4) any important information conveyed. "
    "Be specific and detailed."
)


class VideoAnalyzeResponse(BaseModel):
    filename:     str
    analysis:     str
    video_format: str
    file_size_mb: float
    model:        str
    prompt_used:  str


def _resolve_format(filename: str, content_type: Optional[str] = None) -> str:
    """
    Determine the video format from file extension.
    Falls back to content-type MIME matching if extension is absent.
    Raises HTTP 415 for unsupported types.
    """
    ext = ""
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()

    if ext in SUPPORTED_FORMATS:
        return ext

    if content_type:
        for fmt, mime in SUPPORTED_FORMATS.items():
            if mime == content_type:
                return fmt

    raise HTTPException(
        status_code=415,
        detail=(
            f"Unsupported video format '{ext or content_type}'. "
            f"Supported: {', '.join(SUPPORTED_FORMATS)}"
        ),
    )


def _call_nova(
    video_bytes:  bytes,
    video_format: str,
    prompt:       str,
    model_id:     str,
) -> str:
    """
    Send video bytes to Amazon Nova via Bedrock Converse API.

    Nova Pro samples frames automatically (1 fps up to 960 frames).
    The video source uses "bytes" for inline payloads ≤ 25 MB.
    For larger files use "s3Location" with a presigned S3 URI.
    """
    client = get_bedrock_runtime()

    response = client.converse(
        modelId=model_id,
        messages=[{
            "role": "user",
            "content": [
                {
                    "video": {
                        "format": video_format,
                        "source": {
                            "bytes": video_bytes,
                        },
                    },
                },
                {
                    "text": prompt,
                },
            ],
        }],
        inferenceConfig={
            "maxTokens":   2048,
            "temperature": 0.3,
            "topP":        0.9,
        },
    )

    content = response.get("output", {}).get("message", {}).get("content", [])
    for block in content:
        if isinstance(block, dict) and "text" in block:
            return block["text"]

    raise ValueError("Nova returned no text content in response")


@router.post("/analyze", response_model=VideoAnalyzeResponse)
async def analyze_video(
    file:   UploadFile = File(...),
    prompt: str        = Form(default=DEFAULT_PROMPT),
) -> VideoAnalyzeResponse:
    """
    Analyze a video file using Amazon Nova Pro.

    Accepts any supported video format up to 25 MB.
    Nova Pro samples frames automatically and returns a detailed analysis.
    Falls back to Nova Lite if Pro is unavailable or encounters an error.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    video_format = _resolve_format(file.filename, file.content_type)

    video_bytes = await file.read()
    file_size   = len(video_bytes)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Video file is empty.")

    if file_size > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Video too large ({file_size / (1024*1024):.1f} MB). "
                f"Maximum allowed is {MAX_BYTES // (1024*1024)} MB. "
                f"For larger files use S3 URI."
            ),
        )

    log.info(
        "video_analyze_start",
        filename=file.filename,
        format=video_format,
        size_mb=round(file_size / (1024 * 1024), 2),
        model=settings.nova_pro_model_id,
    )

    model_used = settings.nova_pro_model_id
    try:
        analysis = _call_nova(video_bytes, video_format, prompt, model_used)

    except HTTPException:
        raise

    except Exception as exc:
        log.warning(
            "video_pro_failed_trying_lite",
            error=str(exc),
            filename=file.filename,
            pro_model=model_used,
        )
        model_used = settings.nova_lite_model_id
        try:
            analysis = _call_nova(video_bytes, video_format, prompt, model_used)
        except Exception as exc2:
            log.error("video_analyze_failed", error=str(exc2), filename=file.filename)
            raise HTTPException(
                status_code=500,
                detail=f"Video analysis failed: {str(exc2)}",
            )

    log.info(
        "video_analyze_complete",
        filename=file.filename,
        model=model_used,
        response_chars=len(analysis),
    )

    return VideoAnalyzeResponse(
        filename=file.filename,
        analysis=analysis,
        video_format=video_format,
        file_size_mb=round(file_size / (1024 * 1024), 2),
        model=model_used.split("/")[-1],
        prompt_used=prompt,
    )


@router.get("/formats")
async def video_formats() -> dict:
    """Return supported video formats, limits, and model info."""
    return {
        "formats":     list(SUPPORTED_FORMATS.keys()),
        "max_size_mb": MAX_BYTES // (1024 * 1024),
        "model":       settings.nova_pro_model_id,
        "fallback":    settings.nova_lite_model_id,
        "notes": [
            "Videos ≤ 16 min are sampled at 1 fps (max 960 frames).",
            "Longer videos are sampled at a reduced rate to stay within 960 frames.",
            "Files larger than 25 MB are rejected — use S3 URI for larger videos.",
            "Nova Pro is used by default; Nova Lite is used as fallback.",
        ],
    }