from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from config import get_settings
from dependencies import get_kb_service
from services.knowledge_base import KnowledgeBaseService
from utils.logging import get_logger

settings = get_settings()
log      = get_logger(__name__)
router   = APIRouter(prefix="/api/documents", tags=["documents"])


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2_000)
    k:     int = Field(default=5, ge=1, le=20)


class UploadResponse(BaseModel):
    success:  bool
    filename: str
    chunks:   int
    doc_type: str
    message:  str


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    kb:   KnowledgeBaseService = Depends(get_kb_service),
) -> UploadResponse:
    """
    Upload and ingest a document. Supports: PDF, TXT, MD, PNG, JPG, JPEG, WEBP.
    """
    if not file.filename:
        raise HTTPException(400, "Filename is required")

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            400,
            f"Unsupported file type: .{ext}. "
            f"Allowed: {settings.allowed_extensions}",
        )

    content  = await file.read()
    size_mb  = len(content) / (1024 * 1024)

    if size_mb > settings.max_upload_size_mb:
        raise HTTPException(
            413,
            f"File too large: {size_mb:.1f} MB. "
            f"Max: {settings.max_upload_size_mb} MB",
        )

    log.info("upload_received", filename=file.filename, size_mb=round(size_mb, 2))

    try:
        result = await kb.ingest_file(content, file.filename)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        log.error("ingestion_failed", filename=file.filename, error=str(exc))
        raise HTTPException(500, f"Ingestion failed: {str(exc)}")

    return UploadResponse(
        success=True,
        filename=file.filename,
        chunks=result.get("chunks", 1),
        doc_type=result.get("doc_type", "unknown"),
        message=(
            f"Successfully ingested {result.get('chunks', 1)} chunk(s) "
            f"from {file.filename}"
        ),
    )


@router.post("/search")
async def search_documents(
    req: SearchRequest,
    kb:  KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    """Semantic search over all ingested documents."""
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty")
    try:
        results = await kb.search(req.query, k=req.k)
        return {"query": req.query, "results": results, "count": len(results)}
    except Exception as exc:
        log.error("search_failed", error=str(exc))
        raise HTTPException(500, str(exc))


@router.get("/stats")
async def kb_stats(
    kb: KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    """Return knowledge base statistics."""
    return kb.get_stats()


@router.get("/")
async def list_documents(
    kb: KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    """List all ingested documents grouped by source file."""
    docs        = kb._vs.get_all_documents()
    by_source:  dict[str, dict] = {}

    for doc in docs:
        if doc.source not in by_source:
            by_source[doc.source] = {
                "source":      doc.source,
                "doc_type":    doc.doc_type,
                "chunk_count": 0,
                "created_at":  doc.created_at,
            }
        by_source[doc.source]["chunk_count"] += 1

    return {
        "documents":    list(by_source.values()),
        "total_chunks": len(docs),
    }