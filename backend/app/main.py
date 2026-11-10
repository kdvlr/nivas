import os
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import httpx
from starlette.background import BackgroundTask
from starlette.requests import Request
from starlette.responses import StreamingResponse

from . import scheduler
from .db import init_db
from .routers import calendar, chores, recipes, rewards, setup, shopping, tasks, weather, photos, ytmusic, kids_daily, timer
from .services.player_engine import player_engine
from .services.local_music import local_music_service
from .ws import manager
from .config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

STATIC_DIR = get_settings().static_dir or Path(
    os.getenv(
        "STATIC_DIR",
        str(Path(__file__).resolve().parent.parent / "static"),
    )
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    manager.set_loop(asyncio.get_running_loop())
    scheduler.start()
    player_engine.start()
    local_music_service.start_background_scan(only_if_empty=True)
    yield
    global _scrypted_client
    if _scrypted_client and not _scrypted_client.is_closed:
        await _scrypted_client.aclose()
    player_engine.stop()
    scheduler.stop()


app = FastAPI(title="Family Dashboard", lifespan=lifespan)

for r in (calendar, tasks, chores, shopping, recipes, rewards, setup, weather, photos, ytmusic, kids_daily, timer):
    app.include_router(r.router)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keepalive pings from the client
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.get("/api/health")
def health():
    return {"ok": True}


# Mount photos directory statically
PHOTOS_DIR = get_settings().photos_dir
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/photos/media", StaticFiles(directory=PHOTOS_DIR), name="photos_media")

# --- Scrypted NVR Local Proxy (bypasses cross-origin iframe security in kiosk webviews) ---
_scrypted_client: httpx.AsyncClient | None = None


def get_scrypted_client() -> httpx.AsyncClient:
    global _scrypted_client
    if _scrypted_client is None or _scrypted_client.is_closed:
        _scrypted_client = httpx.AsyncClient(timeout=60.0)
    return _scrypted_client


@app.api_route("/api/scrypted/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"])
async def proxy_scrypted(path: str, request: Request):
    client = get_scrypted_client()
    base = get_settings().ha_scrypted_base.rstrip("/")
    url = f"{base}/{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length", "connection")
    }

    body = await request.body()
    req = client.build_request(
        method=request.method,
        url=url,
        headers=headers,
        content=body if body else None,
    )
    resp = await client.send(req, stream=True)

    resp_headers = {
        k: v for k, v in resp.headers.items()
        if k.lower() not in ("content-length", "content-encoding", "transfer-encoding", "x-frame-options")
    }
    resp_headers["Content-Security-Policy"] = "frame-ancestors *"

    return StreamingResponse(
        resp.aiter_bytes(),
        status_code=resp.status_code,
        headers=resp_headers,
        background=BackgroundTask(resp.aclose),
    )

# Serve the built frontend (present in the Docker image / after `npm run build`)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # index.html points at content-hashed bundles, so it must never be cached:
    # a kiosk WebView that pins a stale copy keeps loading the old JS forever
    # and every deploy looks like it did nothing.
    INDEX_HEADERS = {"Cache-Control": "no-cache, no-store, must-revalidate"}

    @app.api_route("/{path:path}", methods=["GET", "HEAD"])
    def spa(path: str):
        file = STATIC_DIR / path
        # Keep the lookup inside STATIC_DIR — "path" is attacker-controlled and
        # ".." would otherwise escape the static root.
        contained = False
        try:
            contained = file.resolve().is_relative_to(STATIC_DIR.resolve())
        except (OSError, ValueError):
            contained = False
        if path and contained and file.is_file() and file.name != "index.html":
            if file.name == "sw.js":
                return FileResponse(
                    file,
                    media_type="text/javascript; charset=utf-8",
                    headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
                )
            if file.name == "manifest.json":
                return FileResponse(
                    file,
                    media_type="application/manifest+json",
                    headers={"Cache-Control": "public, max-age=3600"},
                )
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html", headers=INDEX_HEADERS)
