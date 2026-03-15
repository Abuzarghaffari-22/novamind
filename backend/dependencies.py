from __future__ import annotations

from agents.tools import set_kb_service
from services.knowledge_base import KnowledgeBaseService
from services.nova_embeddings import NovaEmbeddingService
from services.nova_lite import NovaLiteService
from services.session_manager import SessionManager, session_manager
from services.vector_store import FAISSVectorStore
from utils.logging import get_logger

log = get_logger(__name__)

_vector_store: FAISSVectorStore     | None = None
_nova_embed:   NovaEmbeddingService | None = None
_nova_lite:    NovaLiteService      | None = None
_kb_service:   KnowledgeBaseService | None = None


def get_vector_store() -> FAISSVectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = FAISSVectorStore()
        log.info("vector_store_singleton_created", docs=_vector_store.total_documents)
    return _vector_store


def get_nova_embeddings() -> NovaEmbeddingService:
    global _nova_embed
    if _nova_embed is None:
        _nova_embed = NovaEmbeddingService()
        log.info("nova_embeddings_singleton_created")
    return _nova_embed


def get_nova_lite() -> NovaLiteService:
    global _nova_lite
    if _nova_lite is None:
        _nova_lite = NovaLiteService()
        log.info("nova_lite_singleton_created")
    return _nova_lite


def get_kb_service() -> KnowledgeBaseService:
    """
    Returns the KB service wired to the shared vector store, embeddings,
    and Nova Lite instances. Also wires agent tools to the same KB instance.
    """
    global _kb_service
    if _kb_service is None:
        vs   = get_vector_store()
        emb  = get_nova_embeddings()
        nova = get_nova_lite()
        _kb_service = KnowledgeBaseService(vs, emb, nova)
        set_kb_service(_kb_service)
        log.info("kb_service_singleton_created")
    return _kb_service


def get_session_manager() -> SessionManager:
    return session_manager