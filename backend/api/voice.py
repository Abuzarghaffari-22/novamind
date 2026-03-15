from __future__ import annotations

import asyncio
import base64
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.nova_sonic import sonic_manager

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/voice", tags=["voice"])


async def _safe_send(ws: WebSocket, payload: dict) -> bool:
    try:
        await ws.send_text(json.dumps(payload))
        return True
    except (WebSocketDisconnect, RuntimeError):
        return False


@router.websocket("/ws")
async def voice_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    session = None

    try:
        # 1. Open Nova Sonic session (setup only — no response trigger)
        session = await sonic_manager.create_session()

        # 2. Tell frontend the session ID
        if not await _safe_send(websocket, {
            "type": "session_id", "session_id": session.session_id,
        }):
            return

        log.info("ws_connected session=%s", session.session_id)

        # 3. Signal frontend: session is ready — show orb as "ready"
        #    No send_greeting() here. The greeting was causing HTTP 400
        #    because Nova rejects a response-trigger at open time.
        #    User will press the orb to speak, and Nova responds naturally.
        if not await _safe_send(websocket, {"type": "greeting_start"}):
            return

        log.info("session_ready_for_user session=%s", session.session_id)

        # 4. Run input + output tasks concurrently
        input_task = asyncio.create_task(
            _handle_client_input(websocket, session),
            name=f"vin_{session.session_id[:6]}",
        )
        output_task = asyncio.create_task(
            _handle_model_output(websocket, session),
            name=f"vout_{session.session_id[:6]}",
        )

        done, pending = await asyncio.wait(
            {input_task, output_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        for task in done:
            exc = task.exception()
            if exc and not isinstance(exc, (WebSocketDisconnect, asyncio.CancelledError)):
                log.error("task_error task=%s error=%s", task.get_name(), exc)

    except WebSocketDisconnect:
        log.info("ws_disconnected session=%s",
                 session.session_id if session else "?")
    except Exception as exc:
        log.error("ws_error error=%s", exc)
        await _safe_send(websocket, {"type": "error", "message": str(exc)})
    finally:
        if session:
            await sonic_manager.close_session(session.session_id)
            log.info("ws_closed session=%s", session.session_id)


async def _handle_client_input(websocket: WebSocket, session) -> None:
    state = {"audio_open": False}
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            mtype = msg.get("type")

            if mtype == "audio_chunk":
                try:
                    pcm = base64.b64decode(msg["data"])
                except Exception:
                    continue
                if not state["audio_open"]:
                    await session.start_audio_input()
                    state["audio_open"] = True
                await session.send_audio_chunk(pcm)

            elif mtype == "audio_complete":
                await session.audio_complete()
                state["audio_open"] = False

            elif mtype == "audio_cancel":
                if state["audio_open"]:
                    await session.cancel_audio_input()
                state["audio_open"] = False

            elif mtype == "text_input":
                text = msg.get("text", "").strip()
                if not text:
                    continue
                if state["audio_open"]:
                    await session.audio_complete()
                    state["audio_open"] = False
                try:
                    await session.send_text_turn(text)
                    log.info("text_input session=%s chars=%d",
                             session.session_id, len(text))
                except Exception as exc:
                    log.error("text_input_error error=%s", exc)
                    await _safe_send(websocket, {
                        "type": "error", "message": f"Text input failed: {exc}",
                    })

            elif mtype == "session_end":
                log.info("session_end session=%s", session.session_id)
                break

    except (WebSocketDisconnect, asyncio.CancelledError):
        raise
    except Exception as exc:
        log.error("input_error error=%s", exc)
        raise


async def _handle_model_output(websocket: WebSocket, session) -> None:
    try:
        while True:
            got = False
            async for ev in session.receive_events():
                got = True
                t = ev.get("type")

                if t == "audio_chunk":
                    ok = await _safe_send(websocket, {
                        "type": "audio_chunk",
                        "data": base64.b64encode(ev["data"]).decode(),
                    })
                    if not ok:
                        return

                elif t in ("text_chunk", "user"):
                    ok = await _safe_send(websocket, {
                        "type": "text_chunk",
                        "role": "user" if t == "user" else "assistant",
                        "data": ev["data"],
                    })
                    if not ok:
                        return

                elif t == "turn_complete":
                    if not await _safe_send(websocket, {"type": "turn_complete"}):
                        return

                elif t == "error":
                    await _safe_send(websocket, {
                        "type": "error",
                        "message": ev.get("message", "Model error"),
                    })
                    return

                elif t == "closed":
                    return

            if not got:
                break

    except (WebSocketDisconnect, asyncio.CancelledError):
        raise
    except Exception as exc:
        log.error("output_error error=%s", exc)
        raise


@router.get("/sessions")
async def voice_sessions() -> dict:
    return {
        "active_sessions": sonic_manager.active_count,
        "session_ids": list(sonic_manager._sessions.keys()),
    }