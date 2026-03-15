from __future__ import annotations

import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents.orchestrator import agent_registry
from dependencies import get_kb_service, get_nova_lite, get_session_manager
from services.knowledge_base import KnowledgeBaseService
from services.nova_lite import SUPPORTED_IMAGE_FORMATS, NovaLiteService
from services.session_manager import SessionManager
from utils.logging import get_logger

log    = get_logger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message:     str   = Field(..., min_length=1, max_length=8_000)
    session_id:  str   = Field(default_factory=lambda: str(uuid.uuid4()))
    use_rag:     bool  = True
    use_agent:   bool  = False
    use_history: bool  = True
    temperature: float | None = Field(None, ge=0.0, le=1.0)
    image_b64:    str | None = None
    image_format: str        = "jpeg"


class ChatResponse(BaseModel):
    answer:       str
    session_id:   str
    context_used: list[dict] = []
    steps:        list[dict] = []
    model:        str        = "nova-lite"
    has_image:    bool       = False


@router.post("/", response_model=ChatResponse)
async def chat(
    req:         ChatRequest,
    nova_lite:   NovaLiteService      = Depends(get_nova_lite),
    kb:          KnowledgeBaseService = Depends(get_kb_service),
    session_mgr: SessionManager       = Depends(get_session_manager),
) -> ChatResponse:
    """
    Main chat endpoint.
      use_rag=True   — retrieves relevant KB docs before answering
      use_agent=True — uses ReAct agent with tools (text only)
      image_b64      — inline base64 image for multimodal analysis
      use_history    — include conversation history (default True)
    """
    log.info(
        "chat_request",
        session_id=req.session_id,
        rag=req.use_rag,
        agent=req.use_agent,
        has_image=bool(req.image_b64),
    )

    fmt = SUPPORTED_IMAGE_FORMATS.get(req.image_format.lower(), "jpeg")

    if req.use_agent:
        agent  = agent_registry.get_or_create(req.session_id)
        result = agent.invoke(req.message)
        return ChatResponse(
            answer=result["answer"],
            session_id=req.session_id,
            steps=result["steps"],
            model="nova-lite-agent",
        )

    history: list[dict] = []
    if req.use_history:
        session = session_mgr.get_or_create(req.session_id)
        history = session.to_bedrock_messages()

    context_docs:      list[dict] = []
    augmented_message: str        = req.message

    if req.use_rag and not req.image_b64:
        try:
            context_docs = await kb.search(req.message, k=4)
            if context_docs:
                context_text = "\n\n".join(
                    f"[Source: {d['source']} | Score: {d['score']}]\n{d['content']}"
                    for d in context_docs
                )
                augmented_message = (
                    f"Context from knowledge base:\n{context_text}\n\n"
                    f"User question: {req.message}\n\n"
                    "Answer using the context above. Cite sources where relevant. "
                    "If context is insufficient, use your own knowledge."
                )
        except Exception as exc:
            log.warning("rag_failed", error=str(exc))

    try:
        result = nova_lite.invoke(
            user_message=augmented_message,
            conversation_history=history,
            image_b64=req.image_b64,
            image_format=fmt,
            temperature=req.temperature,
        )
    except Exception as exc:
        log.error("nova_lite_failed", error=str(exc))
        raise

    if req.use_history:
        session = session_mgr.get_or_create(req.session_id)
        session.add_user(req.message, image_b64=req.image_b64, image_format=fmt)
        session.add_assistant(result["text"])

    return ChatResponse(
        answer=result["text"],
        session_id=req.session_id,
        context_used=context_docs,
        model="nova-lite",
        has_image=bool(req.image_b64),
    )


@router.post("/stream")
async def chat_stream(
    req:         ChatRequest,
    nova_lite:   NovaLiteService      = Depends(get_nova_lite),
    kb:          KnowledgeBaseService = Depends(get_kb_service),
    session_mgr: SessionManager       = Depends(get_session_manager),
) -> StreamingResponse:
    """SSE streaming chat with history and optional image."""
    fmt = SUPPORTED_IMAGE_FORMATS.get(req.image_format.lower(), "jpeg")

    history: list[dict] = []
    if req.use_history:
        session = session_mgr.get_or_create(req.session_id)
        history = session.to_bedrock_messages()

    augmented_message = req.message
    if req.use_rag and not req.image_b64:
        try:
            context_docs = await kb.search(req.message, k=4)
            if context_docs:
                context_text = "\n\n".join(
                    f"[Source: {d['source']}]\n{d['content']}"
                    for d in context_docs
                )
                augmented_message = (
                    f"Context:\n{context_text}\n\nQuestion: {req.message}"
                )
        except Exception as exc:
            log.warning("rag_stream_failed", error=str(exc))

    full_response: list[str] = []

    async def generate() -> AsyncGenerator[str, None]:
        try:
            for chunk in nova_lite.stream(
                augmented_message,
                conversation_history=history,
                image_b64=req.image_b64,
                image_format=fmt,
            ):
                full_response.append(chunk)
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"

            if req.use_history and full_response:
                session = session_mgr.get_or_create(req.session_id)
                session.add_user(
                    req.message,
                    image_b64=req.image_b64,
                    image_format=fmt if req.image_b64 else None,
                )
                session.add_assistant("".join(full_response))

        except Exception as exc:
            log.error("stream_error", error=str(exc))
            yield f"data: [ERROR] {str(exc)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/clear/{session_id}")
async def clear_session(
    session_id:  str,
    session_mgr: SessionManager = Depends(get_session_manager),
) -> dict:
    """Clear agent memory and session history for the given session."""
    agent_registry.remove(session_id)
    session_mgr.clear(session_id)
    return {"cleared": True, "session_id": session_id}


@router.get("/sessions")
async def session_stats(
    session_mgr: SessionManager = Depends(get_session_manager),
) -> dict:
    return {
        "agent_sessions": agent_registry.active_sessions,
        **session_mgr.stats(),
    }