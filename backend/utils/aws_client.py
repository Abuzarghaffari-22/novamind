from __future__ import annotations

import time
from functools import lru_cache
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from utils.logging import get_logger

log = get_logger(__name__)

_BOTO_CONFIG = Config(
    max_pool_connections=25,
    retries={"max_attempts": 0},
    read_timeout=120,
    connect_timeout=10,
)

_RETRYABLE_CODES = frozenset({
    "ThrottlingException",
    "ServiceUnavailableException",
    "TooManyRequestsException",
    "RequestLimitExceeded",
})


@lru_cache(maxsize=1)
def _get_session() -> boto3.Session:
    """
    One Session per process — thread-safe with a shared connection pool.
    Credentials resolved in order: explicit env vars, then the default chain.
    """
    from config import get_settings
    settings = get_settings()

    kwargs: dict[str, Any] = {"region_name": settings.aws_region}
    if settings.aws_access_key_id:
        kwargs["aws_access_key_id"]     = settings.aws_access_key_id
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    if settings.aws_session_token:
        kwargs["aws_session_token"] = settings.aws_session_token

    return boto3.Session(**kwargs)


@lru_cache(maxsize=1)
def get_bedrock_runtime():
    """Cached Bedrock Runtime client sharing the process-level connection pool."""
    client = _get_session().client(
        "bedrock-runtime",
        config=_BOTO_CONFIG,
    )
    log.info("bedrock_runtime_client_created")
    return client


@lru_cache(maxsize=1)
def get_bedrock_control():
    """Cached Bedrock control-plane client."""
    return _get_session().client("bedrock", config=_BOTO_CONFIG)


def invoke_with_retry(
    client,
    max_attempts: int = 3,
    base_delay: float = 1.0,
    **kwargs: Any,
) -> dict:
    """
    Call client.converse(**kwargs) with exponential-backoff retry on
    throttling and service-unavailable errors.

    Args:
        client:       Bedrock Runtime boto3 client.
        max_attempts: Total attempts before re-raising.
        base_delay:   Initial wait in seconds (doubles each attempt).
        **kwargs:     Arguments forwarded to client.converse().

    Returns:
        Raw Bedrock Converse API response dict.

    Raises:
        ClientError: Re-raised after all attempts exhausted.
    """
    last_exc: ClientError | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            return client.converse(**kwargs)

        except ClientError as exc:
            code = exc.response["Error"]["Code"]

            if code not in _RETRYABLE_CODES:
                raise

            last_exc = exc
            wait = base_delay * (2 ** (attempt - 1))
            log.warning(
                "bedrock_throttled_retrying",
                attempt=attempt,
                max_attempts=max_attempts,
                wait_seconds=wait,
                error_code=code,
            )
            time.sleep(wait)

    raise last_exc  # type: ignore[misc]