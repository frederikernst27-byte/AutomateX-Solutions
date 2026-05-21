import asyncio
import sys

# Windows benötigt ProactorEventLoop damit Playwright Subprozesse starten kann
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import db
import runner


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    yield


app = FastAPI(title="ClickBot Dashboard API", lifespan=lifespan)


# ── API Endpunkte ─────────────────────────────────────────────────────────────

class StartRunRequest(BaseModel):
    flow: str = "amazon"
    headless: bool = False


@app.post("/api/runs/start")
async def start_run(body: StartRunRequest):
    """Startet einen neuen Automation-Run."""
    if body.flow not in runner.FLOWS:
        raise HTTPException(status_code=400, detail=f"Unbekannter Flow: {body.flow}. Verfügbar: {list(runner.FLOWS.keys())}")
    run_id = await runner.start_run(body.flow, body.headless)
    return {"run_id": run_id, "status": "started"}


@app.get("/api/runs")
async def get_runs():
    """Gibt die letzten 50 Runs zurück."""
    return await db.get_runs(limit=50)


@app.get("/api/runs/{run_id}")
async def get_run(run_id: int):
    """Gibt Details + Steps eines einzelnen Runs zurück."""
    detail = await db.get_run_detail(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Run nicht gefunden")
    return detail


@app.get("/api/stats")
async def get_stats():
    """Gibt Statistiken für das Dashboard zurück."""
    return await db.get_stats()


@app.get("/api/flows")
async def list_flows():
    """Gibt verfügbare Flows zurück."""
    return {"flows": list(runner.FLOWS.keys())}


# ── Static Files (Dashboard) ──────────────────────────────────────────────────

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def dashboard():
    return FileResponse("static/index.html")


# ── Direktstart ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
