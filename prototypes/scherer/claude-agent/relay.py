"""
Claude-Agent – lokaler Relay-Server
Leitet Nachrichten direkt an die Claude Code CLI weiter.
Fallback: OpenClaw (GPT-5.4 via OAuth), falls Claude nicht verfügbar.
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

HOST = '127.0.0.1'
PORT = 18892
BASE_DIR   = Path(__file__).resolve().parent
INDEX_PATH = BASE_DIR / 'index.html'

# Workspace-Ordner zu dem Claude Zugriff bekommt
WORKSPACE = Path(r'C:\Users\Frederik\Desktop\Workspace\prototyp scherer')

# Fallback: OpenClaw
OPENCLAW_PS1 = Path(r'C:\nvm4w\nodejs\openclaw.ps1')

# Aktive Session-ID für Gesprächskontext (wird bei /api/history/clear zurückgesetzt)
current_session_id: Optional[str] = None
chat_history: list[dict] = []

# Health-Cache
_health_cache: dict = {}
_health_ts: float   = 0.0
HEALTH_TTL = 30.0


# ── Claude CLI ────────────────────────────────────────────────────────────────

def run_claude(message: str, session_id: Optional[str] = None) -> dict:
    """
    Sendet eine Nachricht an Claude Code CLI (-p Modus).
    Nutzt --resume um den Gesprächskontext zu erhalten.
    Gibt {'reply': str, 'session_id': str, 'provider': 'claude'} zurück.
    """
    system_prompt = (
        "Du bist Ben, ein persoenlicher KI-Assistent. "
        "Erwaehne niemals Claude, Anthropic oder irgendwelche KI-Marken in deinen Antworten. "
        "Nenne dich selbst nur 'Ben' oder 'ich'. "
        "Antworte natuerlich und direkt. Stelle dich wenn noetig als 'Ben' vor. "
        "Erwaehne niemals 'Claude Tab Group', 'Claude' oder aehnliche Markennamen."
    )
    cmd = [
        'claude',
        '-p', message,
        '--output-format', 'json',
        '--permission-mode', 'bypassPermissions',
        '--add-dir', str(WORKSPACE),
        '--model', 'sonnet',
        '--chrome',
        '--append-system-prompt', system_prompt,
    ]
    if session_id:
        cmd += ['--resume', session_id]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        timeout=300,
        cwd=str(WORKSPACE),
    )

    combined = (result.stdout or '').strip()
    if not combined:
        combined = (result.stderr or '').strip()

    if result.returncode != 0:
        raise RuntimeError(combined or f'claude exit {result.returncode}')

    try:
        data = json.loads(combined)
    except json.JSONDecodeError:
        # Manchmal gibt Claude Text statt JSON aus (z.B. bei Warnungen)
        # Versuche JSON am Ende zu finden
        lines = combined.splitlines()
        for i in range(len(lines) - 1, -1, -1):
            try:
                data = json.loads('\n'.join(lines[i:]))
                break
            except json.JSONDecodeError:
                continue
        else:
            raise RuntimeError(combined or 'Keine JSON-Antwort von Claude')

    if data.get('is_error'):
        raise RuntimeError(data.get('result') or 'Claude meldete einen Fehler')

    return {
        'reply':      data.get('result', '(keine Antwort)').strip(),
        'session_id': data.get('session_id', ''),
        'provider':   'claude',
    }


# ── OpenClaw Fallback ─────────────────────────────────────────────────────────

def _ps(cmd_inner: str, timeout: int = 300) -> subprocess.CompletedProcess:
    full = (
        'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command '
        f'"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '
        f'[Console]::InputEncoding  = [System.Text.Encoding]::UTF8; '
        f'{cmd_inner}"'
    )
    return subprocess.run(
        full, capture_output=True, text=True, shell=True,
        timeout=timeout, cwd=str(BASE_DIR), encoding='utf-8', errors='replace'
    )


def _escape_ps(s: str) -> str:
    return s.replace('`', '``').replace('"', '`"').replace('$', '`$').replace("'", "''")


def run_openclaw(message: str) -> dict:
    """Fallback: Sendet Nachricht an OpenClaw (GPT-5.4)."""
    escaped = _escape_ps(message)
    inner   = f"& '{OPENCLAW_PS1}' agent --local --agent main --json -m '{escaped}'"
    result  = _ps(inner, timeout=300)
    combined = ((result.stderr or '') + '\n' + (result.stdout or '')).strip()

    if result.returncode != 0:
        raise RuntimeError(combined or f'openclaw exit {result.returncode}')

    for marker in ['{\n  "payloads"', '{\r\n  "payloads"', '{"payloads"']:
        idx = combined.find(marker)
        if idx != -1:
            parsed   = json.loads(combined[idx:].strip())
            payloads = parsed.get('payloads', [])
            texts    = [p.get('text', '').strip() for p in payloads if p.get('text')]
            return {
                'reply':    '\n\n'.join(texts) or '(keine Antwort)',
                'provider': 'openclaw-fallback',
            }

    raise RuntimeError(combined or 'Keine JSON-Antwort von openclaw')


# ── Health Check ──────────────────────────────────────────────────────────────

def check_health() -> dict:
    global _health_cache, _health_ts
    now = time.monotonic()
    if _health_cache and (now - _health_ts) < HEALTH_TTL:
        return _health_cache

    # Claude verfügbar?
    try:
        r = subprocess.run(
            ['claude', '--version'],
            capture_output=True, text=True, timeout=10
        )
        version = (r.stdout or r.stderr or '').strip()
        _health_cache = {'ok': True, 'version': version, 'provider': 'claude'}
        _health_ts = now
        return _health_cache
    except Exception:
        pass

    # Fallback: OpenClaw
    if OPENCLAW_PS1.exists():
        _health_cache = {'ok': True, 'provider': 'openclaw-fallback', 'version': 'OpenClaw'}
        _health_ts = now
        return _health_cache

    _health_cache = {'ok': False, 'error': 'Weder Claude CLI noch OpenClaw gefunden.'}
    _health_ts = now
    return _health_cache


# ── HTTP Handler ──────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def _html(self, html: str):
        body = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        n = int(self.headers.get('Content-Length', '0') or '0')
        return json.loads(self.rfile.read(n) if n else b'{}')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ('/', '/index.html'):
            self._html(INDEX_PATH.read_text(encoding='utf-8'))
            return
        if path == '/api/health':
            status = check_health()
            payload = {
                'ok':            status['ok'],
                'provider':      status.get('provider', ''),
                'historyLength': len(chat_history) // 2,
            }
            if not status['ok']:
                payload['error'] = status.get('error', '')
            self._json(200 if status['ok'] else 503, payload)
            return
        self._json(404, {'ok': False, 'error': 'Nicht gefunden.'})

    def do_POST(self):
        global current_session_id
        path = urlparse(self.path).path
        try:
            body = self._read_json()

            if path == '/api/chat':
                message = str(body.get('message') or '').strip()
                if not message:
                    self._json(400, {'ok': False, 'error': 'Nachricht darf nicht leer sein.'})
                    return

                provider_used = 'claude'
                try:
                    result = run_claude(message, session_id=current_session_id)
                    if result.get('session_id'):
                        current_session_id = result['session_id']
                except Exception as claude_err:
                    # Fallback auf OpenClaw
                    if not OPENCLAW_PS1.exists():
                        raise claude_err
                    try:
                        result = run_openclaw(message)
                        provider_used = 'openclaw-fallback'
                        current_session_id = None  # kein Session-Tracking im Fallback
                    except Exception as oc_err:
                        raise RuntimeError(
                            f'Claude: {claude_err}\nOpenClaw: {oc_err}'
                        )

                chat_history.append({'role': 'user',      'content': message})
                chat_history.append({'role': 'assistant', 'content': result['reply']})

                self._json(200, {
                    'ok':            True,
                    'reply':         result['reply'],
                    'provider':      provider_used,
                    'historyLength': len(chat_history) // 2,
                })
                return

            if path == '/api/history/clear':
                chat_history.clear()
                current_session_id = None
                self._json(200, {'ok': True})
                return

            self._json(404, {'ok': False, 'error': 'Nicht gefunden.'})
        except Exception as e:
            self._json(500, {'ok': False, 'error': str(e)})

    def log_message(self, *args):
        return


if __name__ == '__main__':
    status = check_health()
    print(f'Claude-Agent startet auf http://{HOST}:{PORT}')
    if status['ok']:
        print(f'  Provider: {status["provider"]} ✓')
        if status.get("version"):
            print(f'  Version:  {status["version"]}')
    else:
        print(f'  WARNUNG: {status["error"]}')
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'  Server läuft. Strg+C zum Beenden.')
    server.serve_forever()
