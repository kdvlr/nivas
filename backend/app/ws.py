import asyncio
import json
import logging

from fastapi import WebSocket

log = logging.getLogger(__name__)


class ConnectionManager:
    """Broadcasts refresh hints to connected dashboards."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._latest_payloads: dict[str, str] = {}
        self._last_sent_payloads: dict[str, str] = {}
        self._latest_handles: dict[str, asyncio.TimerHandle] = {}

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)

    async def broadcast(self, scope: str) -> None:
        """scope: calendar | tasks | shopping | meals | recipes | setup"""
        msg = json.dumps({"type": "refresh", "scope": scope})
        await self.broadcast_raw(msg)

    async def broadcast_custom(self, data: dict) -> None:
        msg = json.dumps(data)
        await self.broadcast_raw(msg)

    async def broadcast_raw(self, msg: str) -> None:
        async def send(ws: WebSocket) -> None:
            try:
                await asyncio.wait_for(ws.send_text(msg), timeout=2.0)
            except Exception:
                self.disconnect(ws)

        if self._connections:
            await asyncio.gather(*(send(ws) for ws in list(self._connections)))

    def broadcast_threadsafe(self, scope: str) -> None:
        """For sync scheduler jobs running off the event loop."""
        if self._loop is not None and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(scope), self._loop)

    def broadcast_json(self, data: dict) -> None:
        """Send a typed event from either a request or worker thread."""
        if self._loop is not None and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast_custom(data), self._loop)

    def broadcast_latest_json(self, key: str, data: dict, delay: float = 0.05) -> None:
        """Coalesce high-frequency state updates and retain only the newest payload."""
        if self._loop is None or not self._loop.is_running():
            return
        payload = json.dumps(data, separators=(",", ":"), sort_keys=True)
        self._loop.call_soon_threadsafe(self._queue_latest, key, payload, delay)

    def _queue_latest(self, key: str, payload: str, delay: float) -> None:
        if payload == self._last_sent_payloads.get(key) and key not in self._latest_handles:
            return
        self._latest_payloads[key] = payload
        if key not in self._latest_handles:
            self._latest_handles[key] = self._loop.call_later(
                delay, lambda: asyncio.create_task(self._flush_latest(key))
            )

    async def _flush_latest(self, key: str) -> None:
        self._latest_handles.pop(key, None)
        payload = self._latest_payloads.pop(key, None)
        if payload is None or payload == self._last_sent_payloads.get(key):
            return
        await self.broadcast_raw(payload)
        self._last_sent_payloads[key] = payload


manager = ConnectionManager()
