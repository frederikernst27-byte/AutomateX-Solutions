"""
KI-Automatisierungs-Agent – lokaler Relay-Server
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional
from pathlib import Path
from urllib.parse import urlparse

HOST = '127.0.0.1'
PORT = 18891
BASE_DIR   = Path(__file__).resolve().parent
INDEX_PATH = BASE_DIR / 'index.html'

OPENCLAW_PS1 = Path(r'C:\nvm4w\nodejs\openclaw.ps1')

# Chat-Verlauf im Speicher
chat_history: list[dict] = []

# Health-Cache (verhindert langsamen subprocess bei jedem Status-Check)
_health_cache: dict = {}
_health_ts: float   = 0.0
HEALTH_TTL = 30.0  # Sekunden


# ── Hilfsfunktionen ───────────────────────────────────────────────────────────

def _ps(cmd_inner: str, timeout: int = 300, extra_env: Optional[dict] = None) -> subprocess.CompletedProcess:
    """Führt einen PowerShell-Befehl aus."""
    full = (
        'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command '
        '"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '
        '[Console]::InputEncoding  = [System.Text.Encoding]::UTF8; '
        f'{cmd_inner}"'
    )
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        full, capture_output=True, text=True, shell=True,
        timeout=timeout, cwd=str(BASE_DIR), encoding='utf-8', errors='replace',
        env=env,
    )


# ── OpenClaw Agent-Aufruf ─────────────────────────────────────────────────────

def run_agent(message: str) -> dict:
    # Nachricht als Umgebungsvariable übergeben → kein Escaping nötig, Sonderzeichen safe
    inner = f"& '{OPENCLAW_PS1}' agent --local --agent main --json -m $env:OC_MSG"
    result = _ps(inner, timeout=300, extra_env={'OC_MSG': message})
    combined = ((result.stderr or '') + '\n' + (result.stdout or '')).strip()

    if result.returncode != 0:
        raise RuntimeError(combined or f'openclaw exit {result.returncode}')

    for marker in ['{\n  "payloads"', '{\r\n  "payloads"', '{"payloads"']:
        idx = combined.find(marker)
        if idx != -1:
            parsed   = json.loads(combined[idx:].strip())
            payloads = parsed.get('payloads', [])
            texts    = [p.get('text', '').strip() for p in payloads if p.get('text')]
            meta     = parsed.get('meta', {}).get('agentMeta', {})
            return {
                'reply':    '\n\n'.join(texts) or '(keine Antwort)',
                'model':    meta.get('model', 'gpt-5.4'),
                'provider': meta.get('provider', 'openai-codex'),
                'usage':    meta.get('usage', {}),
            }

    raise RuntimeError(combined or 'Keine JSON-Antwort von openclaw')


def check_health() -> dict:
    """Schneller Health-Check – nur Datei-Existenz prüfen, kein subprocess."""
    if not OPENCLAW_PS1.exists():
        return {'ok': False, 'error': f'openclaw.ps1 nicht gefunden: {OPENCLAW_PS1}'}
    return {'ok': True}


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
                'historyLength': len(chat_history) // 2,
                'model':         'gpt-5.4',
            }
            if not status['ok']:
                payload['error'] = status.get('error', 'openclaw nicht erreichbar')
            self._json(200 if status['ok'] else 503, payload)
            return

        self._json(404, {'ok': False, 'error': 'Nicht gefunden.'})

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._read_json()

            if path == '/api/chat':
                message = str(body.get('message') or '').strip()
                if not message:
                    self._json(400, {'ok': False, 'error': 'Nachricht darf nicht leer sein.'})
                    return

                # Verlauf für Kontext aufbauen (letzte 5 Runden)
                history_context = ''
                if chat_history:
                    lines = []
                    for m in chat_history[-10:]:
                        prefix = 'User' if m['role'] == 'user' else 'Assistant'
                        lines.append(f"{prefix}: {m['content']}")
                    history_context = '\n'.join(lines) + '\nUser: '

                full_message = history_context + message if history_context else message

                result = run_agent(full_message)
                chat_history.append({'role': 'user',      'content': message})
                chat_history.append({'role': 'assistant', 'content': result['reply']})

                self._json(200, {
                    'ok':            True,
                    'reply':         result['reply'],
                    'historyLength': len(chat_history) // 2,
                })
                return

            if path == '/api/history/clear':
                chat_history.clear()
                self._json(200, {'ok': True})
                return

            self._json(404, {'ok': False, 'error': 'Nicht gefunden.'})

        except Exception as e:
            self._json(500, {'ok': False, 'error': str(e)})

    def log_message(self, *args):
        return


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    status = check_health()
    print(f'KI-Automatisierungs-Agent startet auf http://{HOST}:{PORT}')
    if status['ok']:
        print('  OpenClaw: bereit OK')
        print('  Modell:   gpt-5.4 via OpenAI Codex (OAuth)')
    else:
        print(f'  WARNUNG: {status["error"]}')
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print('  Server laeuft. Strg+C zum Beenden.')
    server.serve_forever()
