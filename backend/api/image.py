from __future__ import annotations

import base64
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from dependencies import get_nova_lite, get_session_manager
from services.nova_lite import SUPPORTED_IMAGE_FORMATS, NovaLiteService
from services.session_manager import SessionManager
from utils.logging import get_logger

log    = get_logger(__name__)
router = APIRouter(prefix="/api/image", tags=["image"])

_MAX_IMAGE_BYTES = 20 * 1024 * 1024   # 20 MB


class ImageChatRequest(BaseModel):
    session_id:   str  = Field(default_factory=lambda: str(uuid.uuid4()))
    message:      str  = Field(
        default="Analyse this image in detail.", max_length=4_000
    )
    image_b64:    str  = Field(..., description="Base64-encoded image bytes")
    image_format: str  = Field(default="jpeg", description="jpeg|png|webp|gif")
    use_history:  bool = True


class ImageChatResponse(BaseModel):
    answer:       str
    session_id:   str
    image_format: str
    model:        str = "nova-lite"


class AnalyzeResponse(BaseModel):
    filename:     str
    analysis:     str
    image_format: str
    model:        str = "nova-lite"


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_image(
    file:      UploadFile = File(..., description="Image file to analyse"),
    prompt:    str        = Form(
        default=(
            "Analyse this image in complete detail. "
            "Extract all text, describe all elements, and provide actionable insights."
        ),
        description="Analysis prompt",
    ),
    nova_lite: NovaLiteService = Depends(get_nova_lite),
) -> AnalyzeResponse:
    """Stateless single-shot image analysis — no session or history."""
    if not file.filename:
        raise HTTPException(400, "Filename is required")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in SUPPORTED_IMAGE_FORMATS:
        raise HTTPException(
            400,
            f"Unsupported format: .{ext}. "
            f"Supported: {list(SUPPORTED_IMAGE_FORMATS.keys())}",
        )

    image_bytes = await file.read()

    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            413,
            f"Image too large: {len(image_bytes) // (1024 * 1024)} MB. Max 20 MB.",
        )
    if len(image_bytes) < 100:
        raise HTTPException(400, "Image appears to be empty or corrupted.")

    log.info(
        "image_analyze_request",
        filename=file.filename,
        size_kb=len(image_bytes) // 1024,
        format=ext,
    )

    try:
        analysis = nova_lite.analyze_image(
            image_bytes=image_bytes,
            image_format=SUPPORTED_IMAGE_FORMATS[ext],
            query=prompt,
        )
    except Exception as exc:
        log.error("image_analyze_failed", error=str(exc))
        raise HTTPException(500, f"Image analysis failed: {str(exc)}")

    return AnalyzeResponse(
        filename=file.filename,
        analysis=analysis,
        image_format=SUPPORTED_IMAGE_FORMATS[ext],
    )


@router.post("/chat", response_model=ImageChatResponse)
async def image_chat(
    req:         ImageChatRequest,
    nova_lite:   NovaLiteService = Depends(get_nova_lite),
    session_mgr: SessionManager  = Depends(get_session_manager),
) -> ImageChatResponse:
    """Multimodal chat turn with base64 image and text message."""
    try:
        image_bytes = base64.b64decode(req.image_b64)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")

    if len(image_bytes) < 100:
        raise HTTPException(400, "Image data appears empty or corrupted.")
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large. Max 20 MB.")

    fmt = SUPPORTED_IMAGE_FORMATS.get(req.image_format.lower(), "jpeg")

    log.info(
        "image_chat_request",
        session_id=req.session_id,
        size_kb=len(image_bytes) // 1024,
        format=fmt,
    )

    history: list[dict] = []
    if req.use_history:
        session = session_mgr.get_or_create(req.session_id)
        history = session.to_bedrock_messages()

    try:
        result = nova_lite.invoke(
            user_message=req.message,
            conversation_history=history,
            image_bytes=image_bytes,
            image_format=fmt,
        )
    except Exception as exc:
        log.error("image_chat_failed", error=str(exc))
        raise HTTPException(500, f"Image chat failed: {str(exc)}")

    if req.use_history:
        session = session_mgr.get_or_create(req.session_id)
        session.add_user(req.message, image_b64=req.image_b64, image_format=fmt)
        session.add_assistant(result["text"])

    return ImageChatResponse(
        answer=result["text"],
        session_id=req.session_id,
        image_format=fmt,
    )


@router.get("/formats")
async def supported_formats() -> dict:
    """List supported image formats and upload limits."""
    return {
        "formats":     list(SUPPORTED_IMAGE_FORMATS.keys()),
        "max_size_mb": _MAX_IMAGE_BYTES // (1024 * 1024),
    }