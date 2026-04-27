# ClickBot – Anleitung & Funktionsweise

## Starten

**Doppelklick auf `start.bat`** — fertig. Browser öffnet sich automatisch.

> Das Terminal-Fenster das sich öffnet offen lassen – sobald es geschlossen wird, läuft der Server nicht mehr.

---

## Erster Start (einmalig)

Nur beim allerersten Mal nötig, falls die .bat-Datei die Pakete nicht automatisch installiert:

```bash
pip install -r requirements.txt
playwright install chromium
```

---

## Was ist was – Erklärung der Dateien

```
clickbot/
├── start.bat            ← Doppelklick zum Starten
├── main.py              ← Startet den Server (FastAPI)
├── db.py                ← Datenbank-Logik (SQLite)
├── runner.py            ← Führt Flows aus (Playwright + Retry)
├── flows/
│   └── amazon_flow.py   ← Der eigentliche Klickpfad
├── static/
│   └── index.html       ← Das Dashboard (Web-UI)
├── screenshots/         ← Wird automatisch erstellt, Bilder pro Run
├── clickbot.db          ← Wird automatisch erstellt, alle Logs
└── requirements.txt     ← Python-Pakete
```

---

## Wie funktioniert das System?

### 1. Dashboard (Web-UI)
- Aufrufbar unter `http://localhost:8000`
- Zeigt alle bisherigen Runs mit Status, Dauer und Zeitstempel
- Klick auf einen Run → alle Einzel-Schritte sichtbar
- **"Starten"-Button** → startet einen neuen Run im Hintergrund
- Aktualisiert sich automatisch alle 5 Sekunden

### 2. Automation-Run (Klickpfad)
Ein Run läuft so ab:
1. Browser öffnet sich (sichtbar auf dem Bildschirm)
2. Jeder Schritt wird in die Datenbank geloggt
3. Bei jedem Schritt wird ein Screenshot gespeichert
4. Bei Fehler: bis zu **3 automatische Wiederholungsversuche**
5. Am Ende: Status `success` oder `error`

### 3. Amazon Demo-Flow (Schritte)
| Schritt | Aktion |
|---------|--------|
| 1 | Amazon.de öffnen |
| 2 | Cookie-Banner schließen (falls vorhanden) |
| 3 | Nach "Motoröl 5W-30" suchen |
| 4 | Erstes Produkt anklicken |
| 5 | Preis auslesen und loggen |
| 6 | "In den Warenkorb" klicken |
| 7 | Warenkorb öffnen und bestätigen |
| 8 | **STOP** – kein Kauf wird ausgelöst |

---

## Headless-Modus

Im Dashboard gibt es eine Checkbox **"Headless"**:
- **Aus (Standard):** Browser öffnet sich sichtbar → gut für Demo/Präsentation
- **An:** Browser läuft unsichtbar im Hintergrund → gut für automatischen Betrieb

---

## Einen eigenen Klickpfad hinzufügen

Neue Datei unter `flows/mein_flow.py` anlegen:

```python
def run(page, log):
    log("Schritt 1: Seite öffnen")
    page.goto("https://example.com")

    log("Schritt 2: Formular ausfüllen")
    page.fill("#username", "max.mustermann")

    log("Schritt 3: Absenden")
    page.click("#submit")

    log("Fertig")
```

Dann in `runner.py` registrieren:
```python
from flows import amazon_flow, mein_flow   # ← hinzufügen

FLOWS = {
    "amazon": amazon_flow,
    "mein_flow": mein_flow,                # ← hinzufügen
}
```

Nach Server-Neustart erscheint der neue Flow automatisch im Dashboard.

---

## Fehler-Benachrichtigung via n8n (optional)

In `runner.py` die Variable setzen oder als Umgebungsvariable vor dem Start:

```bash
set N8N_WEBHOOK_URL=https://dein-n8n.de/webhook/clickbot-fehler
```

Bei jedem fehlgeschlagenen Run (nach allen Retries) wird automatisch ein JSON-POST gesendet:
```json
{
  "run_id": 42,
  "flow": "amazon",
  "error": "Fehlermeldung...",
  "timestamp": "2026-04-03T09:15:00"
}
```

---

## Screenshots einsehen

Alle Screenshots liegen unter `clickbot/screenshots/run_{ID}/` — pro Schritt ein Bild, hilfreich zur Fehleranalyse.

---

## Datenbank direkt einsehen (optional)

Die Datei `clickbot.db` ist eine SQLite-Datenbank.
Kostenloser Viewer: [DB Browser for SQLite](https://sqlitebrowser.org/)

Tabellen:
- `runs` – alle gestarteten Automatisierungs-Runs
- `steps` – alle Einzel-Schritte pro Run

---

## Häufige Probleme

| Problem | Lösung |
|---------|--------|
| `http://localhost:8000` nicht erreichbar | `start.bat` neu starten |
| Browser öffnet sich nicht | Headless-Checkbox ausschalten |
| Flow schlägt fehl bei Suchergebnissen | Amazon zeigt möglicherweise CAPTCHA – einmal manuell lösen |
| Port 8000 belegt | Server läuft bereits – altes Terminal schließen, neu starten |
| Pakete fehlen | `pip install -r requirements.txt` im Terminal ausführen |
