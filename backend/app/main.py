import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import scheduler
from .db import init_db
from .routers import calendar, chores, meals, recipes, rewards, setup, shopping, tasks, weather
from .ws import manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    manager.set_loop(asyncio.get_running_loop())
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="Family Dashboard", lifespan=lifespan)

for r in (calendar, tasks, chores, shopping, meals, recipes, rewards, setup, weather):
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


# Serve the built frontend (present in the Docker image / after `npm run build`)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        file = STATIC_DIR / path
        if path and file.is_file():
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")
