"""
Runner: Startet Playwright-Flows in einem Thread (sync API).
So umgeht man das Windows asyncio-Subprocess-Problem in Python 3.9.
"""

import asyncio
import os
import sqlite3
import traceback
import threading
from datetime import datetime

from playwright.sync_api import sync_playwright

from flows import amazon_flow

MAX_RETRIES = 3
N8N_WEBHOOK_URL = os.environ.get("N8N_WEBHOOK_URL", "")

DB_PATH = "clickbot.db"

FLOWS = {
    "amazon": amazon_flow,
}

active_runs: dict = {}


# ── Sync DB-Logging (für den Thread) ─────────────────────────────────────────

def _sync_log_step(run_id: int, step_name: str, status: str, message: str = None, screenshot: str = None):
    con = sqlite3.connect(DB_PATH)
    con.execute(
        "INSERT INTO steps (run_id, step_name, status, message, screenshot, timestamp) VALUES (?,?,?,?,?,?)",
        (run_id, step_name, status, message, screenshot, datetime.now().isoformat())
    )
    con.commit()
    con.close()


def _sync_finish_run(run_id: int, status: str, error: str = None):
    con = sqlite3.connect(DB_PATH)
    con.execute(
        "UPDATE runs SET status=?, finished_at=?, error_message=? WHERE id=?",
        (status, datetime.now().isoformat(), error or "", run_id)
    )
    con.commit()
    con.close()


# ── Playwright-Thread ─────────────────────────────────────────────────────────

def _thread_run(flow_name: str, run_id: int, headless: bool):
    flow = FLOWS.get(flow_name)
    if not flow:
        _sync_finish_run(run_id, "error", f"Unbekannter Flow: {flow_name}")
        return

    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if attempt > 1:
                _sync_log_step(run_id, f"Retry #{attempt}", "warning",
                               f"Neuer Versuch nach Fehler: {last_error}")
                import time
                time.sleep(3)

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=headless)
                context = browser.new_context(viewport={"width": 1280, "height": 800})
                page = context.new_page()

                screenshots_dir = f"screenshots/run_{run_id}"
                os.makedirs(screenshots_dir, exist_ok=True)

                def step_log(name: str, status: str = "ok", message: str = None):
                    screenshot_path = None
                    try:
                        fname = f"{name.replace(' ', '_')}_{datetime.now().strftime('%H%M%S')}.png"
                        screenshot_path = f"{screenshots_dir}/{fname}"
                        page.screenshot(path=screenshot_path)
                    except Exception:
                        pass
                    _sync_log_step(run_id, name, status, message, screenshot_path)

                # Flow aufrufen (sync)
                flow.run(page, step_log)
                browser.close()

            _sync_finish_run(run_id, "success")
            return

        except Exception as e:
            last_error = str(e)
            tb = traceback.format_exc()
            _sync_log_step(run_id, "Fehler", "error", f"{last_error}\n{tb}")
            try:
                browser.close()
            except Exception:
                pass

    _sync_finish_run(run_id, "error", last_error)
    _notify_error(run_id, flow_name, last_error)


def _notify_error(run_id: int, flow_name: str, error: str):
    if not N8N_WEBHOOK_URL:
        return
    try:
        import urllib.request, json
        data = json.dumps({
            "run_id": run_id,
            "flow": flow_name,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }).encode()
        req = urllib.request.Request(N8N_WEBHOOK_URL, data=data,
                                     headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


# ── Öffentliche API ───────────────────────────────────────────────────────────

async def start_run(flow_name: str, headless: bool = False) -> int:
    """Startet einen neuen Run in einem separaten Thread. Gibt die Run-ID zurück."""
    import db
    run_id = await db.create_run(flow_name)

    t = threading.Thread(
        target=_thread_run,
        args=(flow_name, run_id, headless),
        daemon=True
    )
    active_runs[run_id] = t
    t.start()
    return run_id
