from __future__ import annotations

import os
import time
import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from services.nova_sonic import sonic_manager
from utils.logging import configure_logging, get_logger

os.makedirs("./data/uploads",     exist_ok=True)
os.makedirs("./data/faiss_index", exist_ok=True)

settings = get_settings()
configure_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "novamind_starting",
        version=settings.app_version,
        environment=settings.environment,
        region=settings.aws_region,
    )

    try:
        from services.vector_store import FAISSVectorStore
        _vs = FAISSVectorStore()
        log.info("faiss_warmup_complete", total_docs=_vs.total_documents)
    except Exception as exc:
        log.warning("faiss_warmup_failed", error=str(exc))

    yield

    log.info("novamind_shutting_down")
    await sonic_manager.destroy_all()
    log.info("novamind_shutdown_complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title="NovaMind API",
        description=(
            "Enterprise multimodal AI — text, image, video, voice. "
            "Powered by Amazon Nova on AWS Bedrock."
        ),
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_middleware(request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        start      = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            log.error("unhandled_exception", error=str(exc), path=request.url.path)
            return JSONResponse({"error": "Internal server error"}, status_code=500)
        duration = (time.perf_counter() - start) * 1000
        log.info(
            "http_request",
            id=request_id,
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            ms=round(duration, 1),
        )
        response.headers["X-Request-ID"]    = request_id
        response.headers["X-Response-Time"] = f"{duration:.1f}ms"
        return response

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse({"error": str(exc)}, status_code=400)

    @app.exception_handler(FileNotFoundError)
    async def not_found_handler(request: Request, exc: FileNotFoundError):
        return JSONResponse({"error": str(exc)}, status_code=404)

    from api.chat      import router as chat_router
    from api.documents import router as docs_router
    from api.image     import router as image_router
    from api.video     import router as video_router
    from api.voice     import router as voice_router

    app.include_router(chat_router)
    app.include_router(voice_router)
    app.include_router(docs_router)
    app.include_router(image_router)
    app.include_router(video_router)

    logging.getLogger("awscrt").setLevel(logging.CRITICAL)
    logging.getLogger("awscrt.http").setLevel(logging.CRITICAL)

    @app.get("/health", tags=["system"])
    async def health():
        return {
            "status":      "healthy",
            "version":     settings.app_version,
            "environment": settings.environment,
        }

    @app.get("/", tags=["system"])
    async def root():
        return {
            "app":     "NovaMind",
            "version": settings.app_version,
            "endpoints": {
                "chat":       "/api/chat/",
                "stream":     "/api/chat/stream",
                "image":      "/api/image/analyze",
                "image_chat": "/api/image/chat",
                "video":      "/api/video/analyze",
                "documents":  "/api/documents/upload",
                "voice":      "ws://<host>/api/voice/ws",
                "docs":       "/docs",
                "health":     "/health",
            },
            "models": {
                "reasoning":  settings.nova_lite_model_id,
                "video":      settings.nova_pro_model_id,
                "voice":      settings.nova_sonic_model_id,
                "embeddings": settings.nova_embed_model_id,
            },
        }

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        access_log=False,
    )