import aiosqlite
import asyncio
from datetime import datetime

DB_PATH = "clickbot.db"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flow_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                started_at TEXT NOT NULL,
                finished_at TEXT,
                error_message TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                step_name TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT,
                screenshot TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES runs(id)
            )
        """)
        await db.commit()


async def create_run(flow_name: str) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO runs (flow_name, status, started_at) VALUES (?, 'running', ?)",
            (flow_name, datetime.now().isoformat())
        )
        await db.commit()
        return cursor.lastrowid


async def finish_run(run_id: int, status: str, error: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE runs SET status=?, finished_at=?, error_message=? WHERE id=?",
            (status, datetime.now().isoformat(), error, run_id)
        )
        await db.commit()


async def log_step(run_id: int, step_name: str, status: str, message: str = None, screenshot: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO steps (run_id, step_name, status, message, screenshot, timestamp) VALUES (?,?,?,?,?,?)",
            (run_id, step_name, status, message, screenshot, datetime.now().isoformat())
        )
        await db.commit()


async def get_runs(limit: int = 50):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM runs ORDER BY id DESC LIMIT ?", (limit,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_run_detail(run_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM runs WHERE id=?", (run_id,))
        run = await cursor.fetchone()
        if not run:
            return None
        cursor = await db.execute(
            "SELECT * FROM steps WHERE run_id=? ORDER BY id ASC", (run_id,)
        )
        steps = await cursor.fetchall()
        return {"run": dict(run), "steps": [dict(s) for s in steps]}


async def get_stats():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        cursor = await db.execute("SELECT COUNT(*) as total FROM runs")
        total = (await cursor.fetchone())["total"]

        cursor = await db.execute("SELECT COUNT(*) as c FROM runs WHERE status='success'")
        success = (await cursor.fetchone())["c"]

        cursor = await db.execute("SELECT COUNT(*) as c FROM runs WHERE status='error'")
        errors = (await cursor.fetchone())["c"]

        cursor = await db.execute("SELECT COUNT(*) as c FROM runs WHERE status='running'")
        running = (await cursor.fetchone())["c"]

        cursor = await db.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 1")
        last = await cursor.fetchone()

        return {
            "total": total,
            "success": success,
            "errors": errors,
            "running": running,
            "success_rate": round((success / total * 100) if total > 0 else 0, 1),
            "last_run": dict(last) if last else None
        }
