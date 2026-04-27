# Automatisierungs AI Agent

Lokale Weboberfläche, die Nachrichten direkt an deinen laufenden lokalen Agenten weiterleitet und zusätzlich Audio transkribieren kann.

## Start

1. `start-automatisierungs-agent.bat` doppelklicken
2. Browser öffnet sich automatisch
3. Nachricht im Chat eingeben oder Audio-Datei transkribieren

## Dateien

- `index.html` – Oberfläche für Chat + Transkription
- `relay.py` – lokaler Python-Relay zwischen Weboberfläche, OpenClaw-CLI und Transkriptions-Skript
- `start-automatisierungs-agent.bat` – startet den Relay und öffnet die Oberfläche

## Technisch

- UI läuft lokal auf `http://127.0.0.1:18891`
- Chat läuft über `openclaw agent --local --agent main --json`
- Transkription läuft über `C:\Users\Frederik\.openclaw\workspace\transcribe_voice.py`
- Keine Gateway-HTTP-Tokens im Browser nötig

## Hinweis

Wenn die Transkription meckert, fehlt lokal wahrscheinlich noch ein funktionierendes Whisper-Modell oder ffmpeg-Unterstützung dafür.
