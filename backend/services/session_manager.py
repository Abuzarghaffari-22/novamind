from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any

from utils.logging import get_logger

log = get_logger(__name__)

MAX_SESSIONS        = 100
MAX_TURNS_PER_PAIR  = 20
MAX_IMAGE_BYTES     = 5 * 1024 * 1024  


@dataclass
class Turn:
    role:         str
    text:         str
    image_b64:    str | None = None
    image_format: str | None = None
    timestamp:    float      = field(default_factory=time.time)


class Session:
    """One conversation session."""

    def __init__(self, session_id: str) -> None:
        self.session_id  = session_id
        self.turns:      list[Turn] = []
        self.created_at  = time.time()
        self.last_active = time.time()

    def add_user(
        self,
        text:         str,
        image_b64:    str | None = None,
        image_format: str | None = None,
    ) -> None:
        self.turns.append(Turn(
            role="user",
            text=text,
            image_b64=image_b64,
            image_format=image_format,
        ))
        self._trim()
        self.last_active = time.time()

    def add_assistant(self, text: str) -> None:
        self.turns.append(Turn(role="assistant", text=text))
        self._trim()
        self.last_active = time.time()

    def to_bedrock_messages(self) -> list[dict[str, Any]]:
        """
        Convert history to Bedrock Converse message format.
        Images are decoded from base64 and embedded as raw bytes.
        Images only appear on user turns (Bedrock requirement).
        """
        import base64
        messages: list[dict] = []

        for turn in self.turns:
            content: list[dict] = []

            if turn.role == "user" and turn.image_b64:
                img_bytes = base64.b64decode(turn.image_b64)
                content.append({
                    "image": {
                        "format": turn.image_format or "jpeg",
                        "source": {"bytes": img_bytes},
                    }
                })

            content.append({"text": turn.text or " "})
            messages.append({"role": turn.role, "content": content})

        return messages

    def clear(self) -> None:
        """Wipe history but keep the session alive."""
        self.turns.clear()

    def _trim(self) -> None:
        max_turns = MAX_TURNS_PER_PAIR * 2
        if len(self.turns) > max_turns:
            self.turns = self.turns[-max_turns:]

    @property
    def turn_count(self) -> int:
        return sum(1 for t in self.turns if t.role == "user")


class SessionManager:
    """Async-safe in-memory session store with LRU eviction."""

    def __init__(self) -> None:
        self._sessions: OrderedDict[str, Session] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get_or_create_async(self, session_id: str) -> Session:
        """Async-safe version for use in async endpoints."""
        async with self._lock:
            return self._get_or_create_inner(session_id)

    def get_or_create(self, session_id: str) -> Session:
        """Sync version for non-concurrent code paths."""
        return self._get_or_create_inner(session_id)

    def _get_or_create_inner(self, session_id: str) -> Session:
        if session_id in self._sessions:
            self._sessions.move_to_end(session_id)
            return self._sessions[session_id]

     
        if len(self._sessions) >= MAX_SESSIONS:
            evicted_id, _ = self._sessions.popitem(last=False)
            log.warning("session_evicted", evicted=evicted_id)

        session = Session(session_id)
        self._sessions[session_id] = session
        log.debug("session_created", session_id=session_id)
        return session

    def get(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    async def remove_async(self, session_id: str) -> None:
        async with self._lock:
            self._sessions.pop(session_id, None)
        log.debug("session_removed", session_id=session_id)

    def remove(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        log.debug("session_removed", session_id=session_id)

    def clear(self, session_id: str) -> None:
        """Clear history for a session without removing it."""
        session = self._sessions.get(session_id)
        if session:
            session.clear()
            log.debug("session_history_cleared", session_id=session_id)

    @property
    def active_count(self) -> int:
        return len(self._sessions)

    def stats(self) -> dict:
        return {
            "active_sessions": self.active_count,
            "sessions": [
                {
                    "session_id":   sid,
                    "turns":        s.turn_count,
                    "idle_seconds": round(time.time() - s.last_active, 1),
                }
                for sid, s in self._sessions.items()
            ],
        }


session_manager = SessionManager()