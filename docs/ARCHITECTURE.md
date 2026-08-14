# Automate X Architektur

Stand: 2026-04-27

## Aktuelle Demo

Die aktuelle Demo ist eine statische Browser-App:

- Datei: `public/routenplanung-test.html`
- Karte: Leaflet + OpenStreetMap Tiles
- Straßenrouting: OSRM Public API
- Fallback: lokale Luftlinienroute
- KI: Gemini REST API direkt aus Browser oder lokaler Dispatcher
- Gmail: Google Identity Services OAuth + Gmail REST API
- Datenhaltung: Browser-State und localStorage für Keys/Client IDs

## MVP-Zielarchitektur

```text
Browser UI
  -> Vercel/Next.js App
  -> API Routes / Server Functions
      -> Routing Provider
      -> Gemini / LLM Provider
      -> Gmail OAuth Token Handling
      -> Database
```

## Warum Backend nötig ist

Für die Demo ist Browser-only schnell. Für MVP ist es nicht ausreichend:

- API-Keys dürfen nicht im Frontend liegen.
- Gmail-Tokens müssen kontrolliert gespeichert/erneuert werden.
- Audit-Logs brauchen persistente Speicherung.
- Mandantenfähigkeit braucht Auth und Datenbank.
- KI-Aktionen müssen serverseitig validiert werden.

## Routing Provider

Kurzfristig:
- OSRM Public API für Demo
- Lokaler Fallback bei Ausfall

MVP:
- OSRM eigener Server oder bezahlter Routing Provider
- Provider-Abstraktion beibehalten

## KI Provider

Kurzfristig:
- Gemini im Browser nur für Test
- Lokaler Dispatcher als Fallback

MVP:
- Gemini über Vercel Function
- JSON-Schema-Validierung
- Rate Limit
- Audit-Log

## Kommunikation

Kurzfristig:
- Gmail readonly
- Polling ab Fahrtstart

MVP:
- Gmail OAuth serverseitig
- Optional Push Notifications via Gmail watch
- Später Telefonie/Transkription als gleicher Event-Typ

## Datenschutz

Prinzipien:
- Nur notwendige Mailfelder lesen.
- Snippets bevorzugen, Body nur für Klassifikation.
- Keine produktiven Secrets im Browser.
- Jeder automatische Eingriff wird protokolliert.
- Nutzer kann automatische Änderung rückgängig machen.
