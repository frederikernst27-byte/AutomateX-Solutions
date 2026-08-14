# Automate X Epic Execution Status

Stand: 2026-04-30

Legende:
- Done: Lokal umgesetzt oder als belastbares Artefakt abgeschlossen
- Partial: Demo/Plan vorhanden, aber MVP-/Produktionsanteil offen
- Blocked: Benötigt externe Konten, Kundendaten, echte Nutzerentscheidung oder Backend-/Produktionsarbeit

## Zusammenfassung

| Epic | Status | Ergebnis |
|---|---|---|
| AX-E01 Markt- und Kundensegmentierung | Partial | Strategie, Zielsegmente, Alternativen und Interviewleitfaden erstellt |
| AX-E02 Termin- und Standortmodell | Partial | Datenmodelle und CSV-Importformat dokumentiert, CSV-Import in Demo ergänzt |
| AX-E03 Routenoptimierung | Partial | Demo plant Route mit Parametern, OSRM/Fallback vorhanden, MVP-Abstraktion dokumentiert |
| AX-E04 Live-Replanung | Done | Absage, Eilauftrag, Verkehr, Fahrtstart und Restroute in Demo umgesetzt |
| AX-E05 Karte und Geodaten | Partial | Leaflet/OpenStreetMap/OSRM umgesetzt, echtes Geocoding noch offen |
| AX-E06 KI-Dispatcher | Partial | Gemini/Local Dispatcher umgesetzt, Backend-Absicherung noch offen |
| AX-E07 Gmail-Schnittstelle | Partial | OAuth-/Polling-Integration in Demo, Setup-Doku erstellt; echter OAuth-Test offen |
| AX-E08 Fahreroberfläche | Partial | Fahrerlogik und nächste Stopps in Demo sichtbar, eigener Fahrer-Screen noch offen |
| AX-E09 Kundenoberfläche | Partial | Konzept dokumentiert, produktive Kundenstatus-Seite noch offen |
| AX-E10 Lernen und Analytics | Partial | Basis-Metriken in Demo, Lernmodell-Konzept dokumentiert |
| AX-E11 Admin, Abo und Betrieb | Partial | Modell-/Architekturplanung vorhanden, Produktfunktionen offen |
| AX-E12 Sicherheit/Datenschutz | Partial | Architektur- und Gmail-Sicherheitsnotizen vorhanden, Backend/DSGVO-Prüfung offen |
| AX-E13 Deployment und Qualität | Partial | Demo-Link ergänzt, Smoke-Test-Doku erstellt, Vercel-Deploy offen |

## Fertige Artefakte

- `routenplanung-test.html`: interaktive Demo mit Karte, OSRM, KI-Dispatcher, Gmail-Schnittstelle, CSV-Import
- `index.html`: Link zur Routing-Demo ergänzt
- `TICKET_PLANNER.md`: großer Backlog mit 13 Epics und 51 Tickets
- `docs/PRODUCT_STRATEGY.md`: UVP, Zielsegmente, Alternativen, Interviewleitfaden
- `docs/DATA_MODELS.md`: Stop/Kunde/Fahrer/Route/Event/KI-Schema/CSV-Modell
- `docs/GMAIL_OAUTH_SETUP.md`: Google Cloud OAuth Setup für Gmail
- `docs/SMOKE_TEST.md`: manuelle QA-Checkliste
- `docs/ARCHITECTURE.md`: Demo- und MVP-Architektur
- `examples/tagesliste.csv`: Beispielimport

## Update 2026-04-30

- `public/routenplanung-test.html` zeigt jetzt Wartezeit, verspaetete Stopps und eine visuelle Late-Markierung je Stopp.
- Fahreransicht ergaenzt: naechster Stopp, ETA, Anfahrt, angekommen, erledigt und Problem.
- Gmail-Matching nutzt Kundenname, Adresse, Stadt und optionale E-Mail-Adresse mit Confidence-Hinweis.
- Automatische Aktionen aus Gmail, Gemini und lokaler KI erzeugen einen Undo-faehigen Snapshot.
- Tagesreport-Export enthaelt Kennzahlen, Stoppliste, Ereignisse und Vergleich zur Startplanung.
- `examples/tagesliste.csv` enthaelt optionale E-Mail-Adressen fuer besseres Termin-Matching.
- `docs/DATA_MODELS.md` dokumentiert Matching-Regeln, Audit-Log und erweiterte Metriken.

Lokal zusaetzlich erledigte Tickets:
- AX-022: Zeitfenster-Verletzungen in Demo sichtbar und aggregiert.
- AX-063: Mail-Termin-Matching mit Confidence und E-Mail-Adresse.
- AX-070: Fahreransicht als eigener Demo-Bereich.
- AX-071: Fahrerstatus-Aktionen fuer unterwegs, angekommen, erledigt und Problem.
- AX-090: Basis-Metriken plus Tagesreport.
- AX-091: Browser-Session-Vergleich zur Startplanung als erster Sales-Vergleich.
- AX-112: Undo-faehige Audit-Snapshots fuer automatische Aktionen.

Weiterhin extern blockiert:
- Vercel-Login/Deployment, Google-Cloud-OAuth-Konfiguration, echte Browser-QA auf Safari/Edge/Geraeten, formale DSGVO-Pruefung, produktives Backend mit Secrets, Datenbank, Billing und echte Pilotkundeninterviews.

## Ticketstatus nach Epic

### AX-E01 - Markt- und Kundensegmentierung

- AX-001 Early-Adopter-Profil: Partial  
  Erledigt: 3 Segmente und Startsegment dokumentiert.  
  Offen: echte Interviews und Validierung.

- AX-002 Interviewleitfaden: Done  
  Erledigt: Interviewleitfaden in `docs/PRODUCT_STRATEGY.md`.

- AX-003 Bestehende Alternativen: Done  
  Erledigt: 8 Alternativen mit Differenzierung dokumentiert.

- AX-004 UVP schärfen: Done  
  Erledigt: Landingpage-, Sales- und messbarer Nutzen-Satz dokumentiert.

### AX-E02 - Termin- und Standortmodell

- AX-010 Termin-Datenmodell: Done  
  Erledigt: Termin-/Stopmodell in `docs/DATA_MODELS.md`.

- AX-011 Kunden-Datenmodell: Done  
  Erledigt: Kundenmodell inkl. Kontaktkanäle und Datenschutzlevel dokumentiert.

- AX-012 Fahrer-Datenmodell: Done  
  Erledigt: Fahrermodell inkl. Depot, Schicht, Skills und Fahrzeug dokumentiert.

- AX-013 Importformat: Done  
  Erledigt: CSV-Beispiel und CSV-Import in Demo ergänzt.

### AX-E03 - Routenoptimierung

- AX-020 Optimierungsziele: Done  
  Erledigt: Modi in Demo vorhanden und fachlich dokumentiert.

- AX-021 Routing-Engine abstrahieren: Partial  
  Erledigt: OSRM und Fallback sind funktional getrennt.  
  Offen: echte Service-/Provider-Abstraktion in modularer Codebasis.

- AX-022 Zeitfenster-Verletzungen: Partial  
  Erledigt: ETA wird berechnet.  
  Offen: visuelle Verspätungsmarkierung und aggregierte Verspätungsmetrik.

- AX-023 Servicezeit berücksichtigen: Done  
  Erledigt: Servicezeit fließt in ETA und Replanung ein.

- AX-024 Rückfahrt Depot: Partial  
  Erledigt: Rückfahrt-Option vorhanden.  
  Offen: UI-Schutz gegen normale Löschung vollständig absichern.

### AX-E04 - Live-Replanung

- AX-030 Fahrtstart: Done  
  Erledigt: Fahrtstart setzt Route, Uhr, Position und Gmail-Monitoring.

- AX-031 Absage während Fahrt: Done  
  Erledigt: `cancelStop` plant Restroute neu.

- AX-032 Eilauftrag während Fahrt: Done  
  Erledigt: Eilauftrag erzeugt neuen Stopp und Live-Replanning.

- AX-033 Verkehrsfaktor live ändern: Done  
  Erledigt: Verkehr +25 Prozent und Parameteränderung beeinflussen ETA.

- AX-034 Erledigte Stopps sperren: Done  
  Erledigt: Toggle und Restroute berücksichtigen erledigte Stopps.

### AX-E05 - Karte und Geodaten

- AX-040 Leaflet/OpenStreetMap: Done  
  Erledigt: echte Karte mit Markern und Fahrzeugposition.

- AX-041 OSRM-Straßenroute: Done  
  Erledigt: OSRM-Straßenroute mit Fallback.

- AX-042 Geocoding ausbauen: Blocked  
  Offen: Providerentscheidung und API-Key/Backend.

- AX-043 Kartenperformance: Blocked  
  Offen: Testdaten mit 50+ Stopps und Browser-QA.

### AX-E06 - KI-Dispatcher

- AX-050 KI-Aktionsschema: Done  
  Erledigt: JSON-Aktionsschema in Code und `docs/DATA_MODELS.md`.

- AX-051 Gemini absichern: Blocked  
  Offen: Backend/Vercel Function und Secret Management.

- AX-052 Lokaler Dispatcher: Done  
  Erledigt: Button "Ohne API testen" und Keyword-Fallback.

- AX-053 KI-Erklärungen: Partial  
  Erledigt: Log zeigt Quelle und Summary.  
  Offen: vollständiges Vorher/Nachher-Audit und Undo.

### AX-E07 - Gmail- und Kommunikationsschnittstelle

- AX-060 Gmail OAuth Setup: Done  
  Erledigt: Setup-Doku erstellt.

- AX-061 Gmail ab Fahrtstart überwachen: Done  
  Erledigt: Polling ab Fahrtstart in Demo.

- AX-062 Absage-Mails erkennen: Done  
  Erledigt: Keyword-Erkennung plus KI-Planung.

- AX-063 Mail einem Termin zuordnen: Partial  
  Erledigt: Matching über Name/Adresse/Stadt.  
  Offen: Confidence, Rückfragezustand, E-Mail-Adresse.

- AX-064 Gesendete Mails berücksichtigen: Done  
  Erledigt: Suchmodus Inbox/Sent/Any vorhanden.

- AX-065 Telefonie vorbereiten: Partial  
  Erledigt: Event-Konzept in Architektur.  
  Offen: Providerauswahl und Transkription.

### AX-E08 - Fahreroberfläche

- AX-070 Fahreransicht: Partial  
  Erledigt: Route, Ziel, ETA und Fahrzeugposition in Demo sichtbar.  
  Offen: eigener mobiler Fahrer-Screen.

- AX-071 Fahrer-Status: Partial  
  Erledigt: Done-Status über Fahrtsimulation.  
  Offen: manuelle Buttons für angekommen/problem.

- AX-072 Offline-Konzept: Partial  
  Erledigt: Architekturhinweis.  
  Offen: lokale Persistenz und Sync.

### AX-E09 - Kundenoberfläche

- AX-080 Kundenstatus-Seite: Blocked  
  Offen: eigener sicherer Link und Datenspeicherung.

- AX-081 Zeitfenster-Vorschläge: Partial  
  Erledigt: Konzept und Datenbasis vorhanden.  
  Offen: Vorschlagslogik und Kundeninteraktion.

- AX-082 Kundenkommunikation: Partial  
  Erledigt: Konzept.  
  Offen: E-Mail/SMS/WhatsApp Versand.

### AX-E10 - Lernen und Analytics

- AX-090 Basis-Metriken: Partial  
  Erledigt: Distanz, Fahrtzeit, ETA, Planänderungen.  
  Offen: Tagesreport und Pünktlichkeit.

- AX-091 Vorher/Nachher Vergleich: Blocked  
  Offen: Persistenz ursprünglicher Route.

- AX-092 Lernmodell-Konzept: Partial  
  Erledigt: Architektur-/Strategienotizen.  
  Offen: historische Daten und Modell.

### AX-E11 - Admin, Abo und Betrieb

- AX-100 Mandantenfähigkeit: Partial  
  Erledigt: Architekturentscheidung dokumentiert.  
  Offen: Auth, Datenbank, Organisationsmodell im Code.

- AX-101 Rollenmodell: Partial  
  Erledigt: Rollen benannt.  
  Offen: Umsetzung.

- AX-102 Abo-Metrik: Blocked  
  Offen: Billing/Stripe oder manuelles Abo-System.

### AX-E12 - Sicherheit, Datenschutz, Compliance

- AX-110 Datenschutz Gmail: Partial  
  Erledigt: Zweckbindung und Minimalprinzip dokumentiert.  
  Offen: formale DSGVO-Prüfung.

- AX-111 Secrets aus Frontend: Blocked  
  Offen: Backend/Vercel Functions.

- AX-112 Audit-Log: Partial  
  Erledigt: Ereignislog vorhanden.  
  Offen: persistenter Audit-Log mit Vorher/Nachher.

### AX-E13 - Deployment und Qualität

- AX-120 Vercel Deployment: Blocked  
  Offen: Vercel Login/Projektlink/Deploy.

- AX-121 Demo-Link Landingpage: Done  
  Erledigt: Navigation und Hero-Link auf `routenplanung-test.html`.

- AX-122 Smoke-Test: Done  
  Erledigt: `docs/SMOKE_TEST.md`.

- AX-123 Browser-Kompatibilität: Blocked  
  Offen: echte Browser-QA auf Chrome/Edge/Safari.

## Nächste harte Blocker

1. Vercel Login und Deploy ausführen.
2. Google OAuth Client ID erstellen und Vercel-Domain als Origin eintragen.
3. Entscheidung: Browser-Demo behalten oder Next.js/Vercel-Functions-MVP starten.
4. Ersten Pilotkunden für Interview und echte Tagesliste gewinnen.
5. Backend für Secrets, Audit-Log und persistente Daten bauen.
