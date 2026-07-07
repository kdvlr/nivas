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
        for ws in list(self._connections):
            try:
                await ws.send_text(msg)
            except Exception:
                self.disconnect(ws)

    def broadcast_threadsafe(self, scope: str) -> None:
        """For sync scheduler jobs running off the event loop."""
        if self._loop is not None and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(scope), self._loop)


manager = ConnectionManager()
