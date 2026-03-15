from __future__ import annotations

import os
import re
import uuid
from pathlib import Path
from typing import Any

import aiofiles

from config import get_settings
from services.nova_embeddings import NovaEmbeddingService
from services.nova_lite import NovaLiteService
from services.vector_store import Document, FAISSVectorStore
from utils.logging import get_logger

settings = get_settings()
log      = get_logger(__name__)


def _get_pdf_reader():
    try:
        from PyPDF2 import PdfReader
        return PdfReader
    except ImportError:
        raise ImportError(
            "PyPDF2 is required for PDF ingestion. "
            "Run: pip install PyPDF2"
        )


CHUNK_SIZE    = 512   # approximate tokens
CHUNK_OVERLAP = 64    # approximate tokens

_IMAGE_DESCRIPTION_PROMPT = (
    "Provide a comprehensive description of this image. "
    "Include all visible text, objects, charts, data, colours, and spatial "
    "relationships. Be thorough — this description will be used for semantic search."
)


class KnowledgeBaseService:
    """Singleton-safe — use via get_kb_service() dependency."""

    def __init__(
        self,
        vector_store:  FAISSVectorStore,
        embedding_svc: NovaEmbeddingService,
        nova_lite:     NovaLiteService,
    ) -> None:
        self._vs    = vector_store
        self._embed = embedding_svc
        self._nova  = nova_lite
        os.makedirs(settings.upload_dir, exist_ok=True)

    async def ingest_file(
        self,
        file_bytes: bytes,
        filename:   str,
    ) -> dict[str, Any]:
        """
        Full ingestion pipeline for one uploaded file.

        Returns:
            {"chunks": int, "source": str, "doc_type": str, ...}
        """
        ext = Path(filename).suffix.lower().lstrip(".")
        if ext not in settings.allowed_extensions:
            raise ValueError(
                f"Unsupported file type: .{ext}. "
                f"Allowed: {settings.allowed_extensions}"
            )

        file_id   = str(uuid.uuid4())
        save_path = Path(settings.upload_dir) / f"{file_id}_{filename}"
        async with aiofiles.open(save_path, "wb") as fh:
            await fh.write(file_bytes)

        log.info("file_saved", filename=filename, path=str(save_path))

        if ext in ("png", "jpg", "jpeg", "webp"):
            return await self._ingest_image(str(save_path), filename, file_id)
        elif ext == "pdf":
            return await self._ingest_pdf(str(save_path), filename, file_id)
        else:
            return await self._ingest_text(str(save_path), filename, file_id)

    async def search(self, query: str, k: int = 5) -> list[dict]:
        """Semantic search over the knowledge base. Returns ranked results with scores."""
        query_emb = self._embed.embed_text(query)
        results   = self._vs.search(query_emb, k=k)
        return [
            {
                "doc_id":   r.doc.doc_id,
                "content":  r.doc.content,
                "source":   r.doc.source,
                "doc_type": r.doc.doc_type,
                "score":    round(r.score, 4),
                "rank":     r.rank,
                "metadata": r.doc.metadata,
            }
            for r in results
        ]

    def get_stats(self) -> dict:
        docs      = self._vs.get_all_documents()
        by_type:   dict[str, int] = {}
        by_source: dict[str, int] = {}
        for d in docs:
            by_type[d.doc_type]  = by_type.get(d.doc_type, 0)  + 1
            by_source[d.source]  = by_source.get(d.source, 0) + 1
        return {
            "total_chunks":    len(docs),
            "unique_sources":  len(by_source),
            "by_type":         by_type,
            "sources":         list(by_source.keys()),
        }

    async def _ingest_text(
        self, path: str, filename: str, file_id: str
    ) -> dict:
        async with aiofiles.open(path, encoding="utf-8", errors="replace") as fh:
            text = await fh.read()
        chunks = self._chunk_text(text)
        return await self._embed_and_store_chunks(
            chunks, filename, "text", {"file_id": file_id}
        )

    async def _ingest_pdf(
        self, path: str, filename: str, file_id: str
    ) -> dict:
        PdfReader = _get_pdf_reader()
        reader    = PdfReader(path)
        full_text = "\n\n".join(
            f"[Page {i + 1}]\n{page.extract_text() or ''}"
            for i, page in enumerate(reader.pages)
        )
        chunks = self._chunk_text(full_text)
        return await self._embed_and_store_chunks(
            chunks, filename, "pdf",
            {"file_id": file_id, "page_count": len(reader.pages)}
        )

    async def _ingest_image(
        self, path: str, filename: str, file_id: str
    ) -> dict:
        description = self._nova.analyze_image(
            image_path=path,
            query=_IMAGE_DESCRIPTION_PROMPT,
        )
        embedding = self._embed.embed_image_with_text(path, description[:512])

        doc = Document(
            doc_id    = str(uuid.uuid4()),
            content   = description,
            source    = filename,
            doc_type  = "image",
            metadata  = {"file_id": file_id, "image_path": path},
        )

        await self._vs.add_document(doc, embedding)

        log.info("image_ingested", filename=filename, desc_len=len(description))
        return {"chunks": 1, "source": filename, "doc_type": "image"}

    @staticmethod
    def _chunk_text(text: str) -> list[str]:
        """
        Token-approximate chunking with sentence-boundary alignment.
        1 token ~ 4 characters (English average).
        """
        chars_per_chunk = CHUNK_SIZE    * 4
        overlap_chars   = CHUNK_OVERLAP * 4

        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if not text:
            return []
        if len(text) <= chars_per_chunk:
            return [text]

        chunks: list[str] = []
        start = 0

        while start < len(text):
            end = min(start + chars_per_chunk, len(text))

            if end < len(text):
                last_period = text.rfind(". ", start, end)
                if last_period != -1 and last_period > start + chars_per_chunk // 2:
                    end = last_period + 1

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - overlap_chars

        return chunks

    async def _embed_and_store_chunks(
        self,
        chunks:    list[str],
        source:    str,
        doc_type:  str,
        metadata:  dict,
    ) -> dict:
        """Embed each chunk and add all to the vector store in one atomic batch."""
        batch: list[tuple[Document, list[float]]] = []

        for i, chunk in enumerate(chunks):
            embedding = self._embed.embed_document_chunk(
                chunk,
                metadata_context=f"Source: {source}",
            )
            doc = Document(
                doc_id   = str(uuid.uuid4()),
                content  = chunk,
                source   = source,
                doc_type = doc_type,
                metadata = {
                    **metadata,
                    "chunk_index":  i,
                    "total_chunks": len(chunks),
                },
            )
            batch.append((doc, embedding))

        doc_ids = await self._vs.add_batch(batch)

        log.info("chunks_ingested", source=source, count=len(chunks))
        return {
            "chunks":   len(chunks),
            "doc_ids":  doc_ids,
            "source":   source,
            "doc_type": doc_type,
        }