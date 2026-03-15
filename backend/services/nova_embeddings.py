from __future__ import annotations

import base64
import json
from pathlib import Path

from botocore.exceptions import ClientError

from config import get_settings
from utils.aws_client import get_bedrock_runtime
from utils.logging import get_logger

settings = get_settings()
log      = get_logger(__name__)

_MAX_TEXT_CHARS = 8_000   # Titan Embed Image V1 max input text length


class NovaEmbeddingService:
    """Singleton-safe — use via get_nova_embeddings() dependency."""

    def __init__(self) -> None:
        self._client   = get_bedrock_runtime()
        self._mm_model = settings.nova_embed_model_id

    def embed_text(self, text: str) -> list[float]:
        """Embed a text string. Input is truncated to 8000 chars if longer."""
        if not text or not text.strip():
            raise ValueError("embed_text: input text is empty")
        return self._invoke({"inputText": text[:_MAX_TEXT_CHARS]})

    def embed_image(self, image_path: str) -> list[float]:
        """Embed an image file at the given path."""
        b64 = self._load_image_b64(image_path)
        return self._invoke({"inputImage": b64})

    def embed_image_with_text(
        self,
        image_path: str,
        text:       str,
    ) -> list[float]:
        """
        Joint image + text embedding for improved retrieval quality
        on image documents.
        """
        b64 = self._load_image_b64(image_path)
        return self._invoke({
            "inputImage": b64,
            "inputText":  text[:512],
        })

    def embed_document_chunk(
        self,
        chunk:            str,
        metadata_context: str = "",
    ) -> list[float]:
        """
        Embed a document chunk, optionally prepending metadata context
        such as source filename to improve retrieval precision.
        """
        enriched = (
            f"{metadata_context}\n\n{chunk}".strip()
            if metadata_context else chunk
        )
        return self.embed_text(enriched)

    @staticmethod
    def _load_image_b64(image_path: str) -> str:
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        with open(image_path, "rb") as fh:
            return base64.b64encode(fh.read()).decode()

    def _invoke(self, body: dict) -> list[float]:
        try:
            response = self._client.invoke_model(
                modelId=self._mm_model,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(body),
            )
            result    = json.loads(response["body"].read())
            embedding = result.get("embedding")

            if not embedding:
                raise ValueError(
                    "Titan Embeddings returned empty embedding. "
                    "Check model access in Bedrock console."
                )

            log.debug(
                "embedding_created",
                model=self._mm_model,
                dims=len(embedding),
                has_image="inputImage" in body,
            )
            return embedding

        except ClientError as exc:
            log.error(
                "embedding_failed",
                error_code=exc.response["Error"]["Code"],
                error=str(exc),
            )
            raise