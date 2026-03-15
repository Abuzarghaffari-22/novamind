from __future__ import annotations

import base64
from pathlib import Path
from typing import Generator

from botocore.exceptions import ClientError

from config import get_settings
from utils.aws_client import get_bedrock_runtime, invoke_with_retry
from utils.logging import get_logger

settings = get_settings()
log      = get_logger(__name__)

SUPPORTED_IMAGE_FORMATS: dict[str, str] = {
    "jpg":  "jpeg",
    "jpeg": "jpeg",
    "png":  "png",
    "webp": "webp",
    "gif":  "gif",
}

_SYSTEM_PROMPT = """You are NovaMind — a powerful multimodal AI assistant powered by Amazon Nova.

Capabilities:
- Analyse images with pixel-level detail (objects, text, charts, code, scenes)
- Answer questions using the enterprise knowledge base
- Write, debug, and explain code in any language
- Reason step-by-step on complex problems

Rules:
- For images: be exhaustive. Describe EVERYTHING visible — text, numbers, colours, layout, objects, relationships.
- For code in images: transcribe it exactly, then explain it.
- For charts/graphs: extract all data points, axes, legends, and trends.
- Never hallucinate. If unsure, say so clearly.
- Use markdown formatting for structure.
- Cite knowledge base sources when context is used."""

_IMAGE_ANALYSIS_SYSTEM = """You are an expert computer vision analyst powered by Amazon Nova.

When analysing an image, structure your output as follows:
1. OVERVIEW   — What is this image? (type, subject, context)
2. CONTENT    — Describe everything visible in detail
3. TEXT/DATA  — Extract ALL text, numbers, code, formulas verbatim
4. STRUCTURE  — Layout, composition, spatial relationships
5. INSIGHTS   — Key findings, anomalies, actionable information

Be exhaustive. Miss nothing. Use clear section headers."""


class NovaLiteService:
    """Singleton-safe — use via get_nova_lite() dependency."""

    def __init__(self) -> None:
        self._client   = get_bedrock_runtime()
        self._model_id = settings.nova_lite_model_id

    @staticmethod
    def _resolve_image_bytes(
        image_bytes:  bytes | None,
        image_b64:    str | None,
        image_path:   str | None,
    ) -> tuple[bytes | None, str]:
        """
        Resolve any image source to (raw_bytes, format_string).
        Precedence: image_bytes > image_b64 > image_path.
        Returns (None, "") if no image was provided.
        """
        if image_bytes is not None:
            return image_bytes, ""

        if image_b64:
            try:
                return base64.b64decode(image_b64), ""
            except Exception as exc:
                log.warning("image_b64_decode_failed", error=str(exc))
                return None, ""

        if image_path:
            p = Path(image_path)
            if not p.exists():
                raise FileNotFoundError(f"Image not found: {image_path}")
            with open(image_path, "rb") as fh:
                raw = fh.read()
            fmt = SUPPORTED_IMAGE_FORMATS.get(p.suffix.lower().lstrip("."), "jpeg")
            return raw, fmt

        return None, ""

    def _build_content(
        self,
        text:         str,
        image_bytes:  bytes | None = None,
        image_b64:    str | None   = None,
        image_path:   str | None   = None,
        image_format: str          = "jpeg",
    ) -> list[dict]:
        """
        Build a Bedrock content block list for one user turn.
        Image block is placed before the text block, as required by Nova Lite.
        """
        content: list[dict] = []

        raw, resolved_fmt = self._resolve_image_bytes(
            image_bytes, image_b64, image_path
        )
        fmt = resolved_fmt or SUPPORTED_IMAGE_FORMATS.get(
            image_format.lower(), "jpeg"
        )

        if raw:
            content.append({
                "image": {
                    "format": fmt,
                    "source": {"bytes": raw},
                }
            })

        content.append({"text": text or " "})
        return content

    def _build_messages(
        self,
        user_text:    str,
        history:      list[dict] | None = None,
        image_bytes:  bytes | None = None,
        image_b64:    str | None   = None,
        image_path:   str | None   = None,
        image_format: str          = "jpeg",
    ) -> list[dict]:
        messages: list[dict] = list(history or [])
        content = self._build_content(
            user_text,
            image_bytes=image_bytes,
            image_b64=image_b64,
            image_path=image_path,
            image_format=image_format,
        )
        messages.append({"role": "user", "content": content})
        return messages

    def invoke(
        self,
        user_message:          str,
        conversation_history:  list[dict] | None = None,
        image_bytes:           bytes | None = None,
        image_b64:             str | None   = None,
        image_path:            str | None   = None,
        image_format:          str          = "jpeg",
        system_override:       str | None   = None,
        temperature:           float | None = None,
        max_tokens:            int | None   = None,
    ) -> dict:
        """
        Full (non-streaming) invocation.

        Returns:
            {
                "text":        str,
                "role":        "assistant",
                "usage":       dict,
                "stop_reason": str,
            }
        """
        messages = self._build_messages(
            user_message,
            history=conversation_history,
            image_bytes=image_bytes,
            image_b64=image_b64,
            image_path=image_path,
            image_format=image_format,
        )

        try:
            response = invoke_with_retry(
                self._client,
                modelId=self._model_id,
                system=[{"text": system_override or _SYSTEM_PROMPT}],
                messages=messages,
                inferenceConfig={
                    "maxTokens":   max_tokens or settings.nova_lite_max_tokens,
                    "temperature": temperature if temperature is not None
                                   else settings.nova_lite_temperature,
                    "topP":        settings.nova_lite_top_p,
                },
            )
        except ClientError as exc:
            log.error("nova_lite_invoke_failed",
                      error=str(exc), model=self._model_id)
            raise

        output = response["output"]["message"]
        text   = "".join(
            block["text"] for block in output["content"] if "text" in block
        )
        usage  = response.get("usage", {})

        log.info(
            "nova_lite_invoked",
            input_tokens=usage.get("inputTokens"),
            output_tokens=usage.get("outputTokens"),
            has_image=bool(image_bytes or image_b64 or image_path),
        )

        return {
            "text":        text,
            "role":        "assistant",
            "usage":       usage,
            "stop_reason": response.get("stopReason"),
        }

    def stream(
        self,
        user_message:         str,
        conversation_history: list[dict] | None = None,
        image_bytes:          bytes | None = None,
        image_b64:            str | None   = None,
        image_format:         str          = "jpeg",
        system_override:      str | None   = None,
    ) -> Generator[str, None, None]:
        """
        Streaming invocation — yields text delta strings as they arrive.
        The caller is responsible for accumulating and persisting the full response.
        """
        messages = self._build_messages(
            user_message,
            history=conversation_history,
            image_bytes=image_bytes,
            image_b64=image_b64,
            image_format=image_format,
        )

        try:
            response = self._client.converse_stream(
                modelId=self._model_id,
                system=[{"text": system_override or _SYSTEM_PROMPT}],
                messages=messages,
                inferenceConfig={
                    "maxTokens":   settings.nova_lite_max_tokens,
                    "temperature": settings.nova_lite_temperature,
                    "topP":        settings.nova_lite_top_p,
                },
            )
        except ClientError as exc:
            log.error("nova_lite_stream_failed", error=str(exc))
            raise

        for event in response.get("stream", []):
            if "contentBlockDelta" in event:
                delta = event["contentBlockDelta"].get("delta", {})
                if "text" in delta:
                    yield delta["text"]
            elif "messageStop" in event:
                break

    def analyze_image(
        self,
        image_path:   str | None   = None,
        image_bytes:  bytes | None = None,
        image_b64:    str | None   = None,
        image_format: str          = "jpeg",
        query:        str          = "Analyse this image in complete detail.",
    ) -> str:
        """Dedicated deep image analysis with structured section output."""
        result = self.invoke(
            user_message=query,
            image_bytes=image_bytes,
            image_b64=image_b64,
            image_path=image_path,
            image_format=image_format,
            system_override=_IMAGE_ANALYSIS_SYSTEM,
            temperature=0.2,
            max_tokens=2048,
        )
        return result["text"]