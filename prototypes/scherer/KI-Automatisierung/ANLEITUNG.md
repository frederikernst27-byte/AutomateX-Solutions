# KI-Automatisierungs-Agent – Anleitung

## Starten

**Doppelklick auf `start-automatisierungs-agent.bat`** — fertig. Browser öffnet sich automatisch.

> Das Terminal-Fenster das sich öffnet offen lassen – sobald es geschlossen wird, läuft der Server nicht mehr.

---

## Was ist das?

Ein lokales Web-Dashboard das direkt mit **GPT-5.4** über deinen OpenAI-Account verbunden ist.

- **Kein API-Key nötig** — läuft über deinen bestehenden OAuth-Login in OpenClaw
- **Browser-Steuerung** möglich — der Agent kann Webseiten öffnen, klicken, Screenshots machen
- **Transkription** — Audio-Dateien lokal in Text umwandeln (Whisper, läuft offline)
- **Verlauf** — Gesprächskontext bleibt über mehrere Nachrichten erhalten

---

## Dateien

```
KI-Automatisierung/
├── start-automatisierungs-agent.bat   ← Doppelklick zum Starten
├── relay.py                           ← Lokaler Server (Brücke zu OpenClaw)
├── index.html                         ← Dashboard (Web-UI)
└── ANLEITUNG.md                       ← Diese Datei
```

---

## Technischer Aufbau

```
Browser (http://127.0.0.1:18891)
        ↕
relay.py  (lokaler Python-Server)
        ↕
openclaw.ps1  (OpenClaw CLI)
        ↕
OpenAI Codex  (GPT-5.4 via OAuth)
        ↕  (mit Browser-Tool)
Chromium  (gesteuert durch den Agenten)
```

---

## Voraussetzungen

- **OpenClaw** installiert und eingeloggt (bereits vorhanden)
- **Python** installiert (bereits vorhanden)
- Pakete: `openai`, `openai-whisper` — werden automatisch installiert

---

## Browser-Steuerung

Der Agent hat Zugriff auf ein Browser-Tool und kann damit:
- Webseiten öffnen und navigieren
- Auf Elemente klicken, Formulare ausfüllen
- Screenshots machen
- Text von Seiten auslesen

**Beispiel-Befehle im Chat:**
- *"Öffne amazon.de und suche nach Motoröl"*
- *"Mach einen Screenshot von der aktuellen Seite"*
- *"Geh auf die erste Produktseite und lies den Preis aus"*

---

## Transkription

Im Dashboard rechts:
1. Audio-Datei auswählen (mp3, wav, m4a, etc.)
2. Modell wählen (`base` reicht für Deutsch)
3. Klick auf **"Transkribieren"**
4. Text erscheint unten — kopieren oder direkt **"An Chat senden"**

Beim ersten Aufruf lädt Whisper das Modell (~75 MB) herunter. Danach läuft alles offline.

---

## Häufige Probleme

| Problem | Lösung |
|---------|--------|
| `http://127.0.0.1:18891` nicht erreichbar | `.bat`-Datei neu starten |
| Status rot "Relay offline" | Server-Terminal noch offen? Sonst `.bat` neu starten |
| Browser-Tool nicht verfügbar | `openclaw gateway restart` im Terminal ausführen |
| Transkription schlägt fehl | ffmpeg installieren: `winget install ffmpeg` |
| OpenClaw nicht gefunden | Pfad prüfen: `C:\nvm4w\nodejs\openclaw.ps1` muss existieren |
