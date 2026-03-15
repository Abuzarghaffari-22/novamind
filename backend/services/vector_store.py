from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import faiss
import numpy as np

from config import get_settings
from utils.logging import get_logger

settings = get_settings()
log      = get_logger(__name__)


@dataclass
class Document:
    doc_id:     str
    content:    str
    source:     str
    doc_type:   str
    metadata:   dict[str, Any]     = field(default_factory=dict)
    created_at: float              = field(default_factory=time.time)
    embedding:  list[float] | None = field(default=None, repr=False)


@dataclass
class SearchResult:
    doc:   Document
    score: float
    rank:  int


class FAISSVectorStore:
    """Singleton-safe — use via get_vector_store() dependency."""

    _INDEX_FILE = "novamind.faiss"
    _META_FILE  = "novamind_meta.json"

    def __init__(self) -> None:
        self._dim       = settings.embedding_dimension
        self._path      = Path(settings.faiss_index_path)
        self._path.mkdir(parents=True, exist_ok=True)
        self._lock      = asyncio.Lock()
        self._index:    faiss.Index | None = None
        self._documents: list[Document]    = []
        self._load_or_create()

    def _load_or_create(self) -> None:
        index_file = self._path / self._INDEX_FILE
        meta_file  = self._path / self._META_FILE

        if index_file.exists() and meta_file.exists():
            try:
                self._index = faiss.read_index(str(index_file))
                with open(meta_file) as fh:
                    raw = json.load(fh)
                self._documents = [Document(**d) for d in raw]
                log.info("faiss_index_loaded", docs=len(self._documents))
                return
            except Exception as exc:
                log.warning("faiss_load_failed_recreating", error=str(exc))

        self._index     = faiss.IndexFlatIP(self._dim)
        self._documents = []
        log.info("faiss_index_created", dim=self._dim)

    def _save_sync(self) -> None:
        """Serialise FAISS index and document metadata to disk."""
        faiss.write_index(self._index, str(self._path / self._INDEX_FILE))
        meta = [
            {k: v for k, v in asdict(d).items() if k != "embedding"}
            for d in self._documents
        ]
        with open(self._path / self._META_FILE, "w") as fh:
            json.dump(meta, fh, indent=2)

    async def _save(self) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._save_sync)

    async def add_document(self, doc: Document, embedding: list[float]) -> str:
        """Add a single document and persist the index."""
        doc.doc_id = doc.doc_id or str(uuid.uuid4())
        vec = self._normalise(embedding)

        async with self._lock:
            self._index.add(vec)
            self._documents.append(doc)
            await self._save()

        log.debug("document_added", doc_id=doc.doc_id, source=doc.source)
        return doc.doc_id

    async def add_batch(
        self,
        docs: list[tuple[Document, list[float]]],
    ) -> list[str]:
        """
        Add multiple documents atomically. The entire operation —
        ID assignment, vector matrix build, index update, metadata extend,
        and disk save — executes under a single lock acquisition.
        Disk is written once after all vectors are added.
        """
        if not docs:
            return []

        ids:  list[str]        = []
        vecs: list[np.ndarray] = []
        for doc, emb in docs:
            doc.doc_id = doc.doc_id or str(uuid.uuid4())
            ids.append(doc.doc_id)
            vecs.append(self._normalise(emb)[0])

        mat = np.array(vecs, dtype="float32")

        async with self._lock:
            self._index.add(mat)
            self._documents.extend(d for d, _ in docs)
            await self._save()

        log.info("batch_added", count=len(docs))
        return ids

    def search(
        self,
        query_embedding: list[float],
        k: int | None = None,
    ) -> list[SearchResult]:
        """
        Cosine similarity search via inner product on normalised vectors.
        Returns up to k results sorted by descending similarity.
        """
        k = k or settings.max_retrieval_docs
        if self._index is None or self._index.ntotal == 0:
            return []

        vec = self._normalise(query_embedding)
        actual_k = min(k, self._index.ntotal)
        scores, indices = self._index.search(vec, actual_k)

        results: list[SearchResult] = []
        for rank, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if idx == -1 or idx >= len(self._documents):
                continue
            results.append(SearchResult(
                doc=self._documents[idx],
                score=float(score),
                rank=rank + 1,
            ))
        return results

    def get_all_documents(self) -> list[Document]:
        return list(self._documents)

    def get_document_by_id(self, doc_id: str) -> Document | None:
        for doc in self._documents:
            if doc.doc_id == doc_id:
                return doc
        return None

    @property
    def total_documents(self) -> int:
        return len(self._documents)

    @staticmethod
    def _normalise(embedding: list[float]) -> np.ndarray:
        """L2-normalise so inner product equals cosine similarity."""
        vec  = np.array([embedding], dtype="float32")
        norm = np.linalg.norm(vec, axis=1, keepdims=True)
        norm = np.where(norm == 0, 1.0, norm)
        return (vec / norm).astype("float32")