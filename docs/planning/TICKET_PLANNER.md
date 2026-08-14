# Automate X Ticket Planner

Stand: 2026-04-27  
Basis: Lean-Canvas/PowerPoint, `Skript 1.md`, aktuelle Demo `routenplanung-test.html`

Umsetzungsstand: siehe `EPIC_EXECUTION_STATUS.md`.

## Produktziel

Automate X wird eine KI-gestützte Routen- und Terminplanungsplattform für Unternehmen mit vielen Außendienst-, Service- oder Handwerksterminen pro Tag. Die Plattform plant Tagesrouten, reagiert live auf Absagen, Stau und neue Termine, liest relevante Kommunikation aus E-Mails aus und schlägt Kunden automatisch sinnvolle Zeitfenster vor.

## Zielgruppe

Primär:
- Handwerksunternehmen mit mehreren täglichen Kundenterminen
- Service- und Wartungsteams
- Dispositionsteams, bei denen aktuell eine erfahrene Person Routen manuell plant

Sekundär:
- Fahrer / Monteure
- Endkunden, die bessere und kleinere Zeitfenster erwarten
- Geschäftsführung, die Auslastung, Fahrtzeit und Kundenzufriedenheit verbessern will

## MVP-Scope

MVP muss beweisen:
- Termine können mit Standort, Zeitfenster, Priorität und Servicezeit geplant werden.
- Route wird sichtbar auf einer echten Karte angezeigt.
- Während einer gestarteten Fahrt kann ein Termin abgesagt oder hinzugefügt werden.
- Die verbleibende Route wird dynamisch neu berechnet.
- Gmail-Mails können ab Fahrtstart überwacht werden.
- Eine Absage-Mail kann automatisch eine Routenänderung auslösen.
- KI kann natürliche Befehle in konkrete Dispatch-Aktionen übersetzen.

Nicht im MVP:
- Vollständige Telefonie-Integration
- Multi-Team-Optimierung über viele Fahrer
- Abrechnung und Vertragsverwaltung
- Native Apps
- Eigene Routing-Engine

## Meilensteine

### M0 - Demo stabilisieren
Ziel: Die aktuelle Testversion ist zuverlässig vorführbar.

### M1 - MVP für Pilotkunden
Ziel: Ein Unternehmen kann echte Tagesdaten importieren und einen Fahrer live disponieren.

### M2 - Pilotbetrieb
Ziel: Erste echte Touren werden gemessen: Fahrtzeit, Absagen, Zeitfensterqualität, Kundenzufriedenheit.

### M3 - Produktisierung
Ziel: Mehrere Kunden, mehrere Fahrer, sichere Datenhaltung, Monitoring, Rollen und Abrechnung.

## Epic Übersicht

| Epic | Titel | Ziel | Priorität |
|---|---|---|---|
| AX-E01 | Markt- und Kundensegmentierung | Richtige Nische und Early Adopters validieren | P0 |
| AX-E02 | Termin- und Standortmodell | Sauberes Datenmodell für Termine, Kunden, Fahrer | P0 |
| AX-E03 | Routenoptimierung | Tagesroute mit Parametern berechnen | P0 |
| AX-E04 | Live-Replanung | Route während gestarteter Fahrt dynamisch ändern | P0 |
| AX-E05 | Karte und Geodaten | Echte Kartenansicht, Geocoding, Straßenroute | P0 |
| AX-E06 | KI-Dispatcher | Sprache, E-Mail und Ereignisse in Aktionen übersetzen | P0 |
| AX-E07 | Gmail- und Kommunikationsschnittstelle | Absagen aus Kommunikation erkennen | P0 |
| AX-E08 | Fahreroberfläche | Klare nächste Aktion für Fahrer | P1 |
| AX-E09 | Kundenoberfläche | Kunden informieren und Zeitfenster vorschlagen | P1 |
| AX-E10 | Lernen und Analytics | Effizienz messen und System verbessern | P1 |
| AX-E11 | Admin, Abo und Betrieb | Mandanten, Nutzer, Abos, Einstellungen | P2 |
| AX-E12 | Sicherheit, Datenschutz, Compliance | DSGVO-taugliche Verarbeitung | P0 |
| AX-E13 | Deployment und Qualität | Stabile Vercel-Demo und Testabdeckung | P0 |

## AX-E01 - Markt- und Kundensegmentierung

### AX-001: Early-Adopter-Profil definieren
Priorität: P0  
Phase: M0  
Beschreibung: Definiere, welche Kundengruppe zuerst angesprochen wird.

Akzeptanzkriterien:
- Es gibt 3 konkrete Zielsegmente.
- Jedes Segment hat Pain Points, Tagesvolumen, Entscheidungsrolle und Zahlungsbereitschaft.
- Ein Segment wird als Startsegment ausgewählt.

### AX-002: Interviewleitfaden für Handwerksbetriebe
Priorität: P0  
Phase: M0  
Beschreibung: Gesprächsleitfaden für Kundeninterviews erstellen.

Akzeptanzkriterien:
- Fragen zu aktueller Planung, Absagen, Stau, Zeitfenstern und Tools sind enthalten.
- Fragen vermeiden Suggestivformulierungen.
- Ergebnis kann direkt in Lean Canvas zurückgespielt werden.

### AX-003: Bestehende Alternativen erfassen
Priorität: P0  
Phase: M0  
Beschreibung: Manuelle Dispo, Excel, Google Maps, Kalender, Branchensoftware vergleichen.

Akzeptanzkriterien:
- Mindestens 8 Alternativen dokumentiert.
- Pro Alternative: Vorteil, Nachteil, Preismodell, Wechselbarriere.
- Klare Differenzierung für Automate X formuliert.

### AX-004: Unique Value Proposition schärfen
Priorität: P0  
Phase: M0  
Beschreibung: Die im Canvas leere UVP konkretisieren.

Akzeptanzkriterien:
- Ein Satz für Landingpage-Hero.
- Ein Satz für Sales-Gespräch.
- Ein messbarer Nutzen wird genannt.

## AX-E02 - Termin- und Standortmodell

### AX-010: Termin-Datenmodell definieren
Priorität: P0  
Phase: M0  
Beschreibung: Einheitliches Modell für Stopps, Servicezeit, Zeitfenster, Priorität und Status.

Akzeptanzkriterien:
- Felder für `id`, `customer`, `address`, `lat`, `lng`, `windowStart`, `windowEnd`, `serviceMinutes`, `priority`, `status` sind definiert.
- Statuswerte sind dokumentiert: active, done, cancelled, delayed, rescheduled.
- Modell passt zur bestehenden Demo.

### AX-011: Kunden-Datenmodell definieren
Priorität: P1  
Phase: M1  
Beschreibung: Kundendaten von Termindaten trennen.

Akzeptanzkriterien:
- Kunde kann mehrere Termine haben.
- Kontaktkanäle Email und Telefon sind vorgesehen.
- Datenschutzrelevante Felder sind markiert.

### AX-012: Fahrer-Datenmodell definieren
Priorität: P1  
Phase: M1  
Beschreibung: Fahrer mit Arbeitszeiten, Start-/Enddepot und Kapazität abbilden.

Akzeptanzkriterien:
- Fahrer hat Depot, Schichtzeit, Skills und Fahrzeugprofil.
- Modell unterstützt später mehrere Fahrer.
- Aktuelle Demo kann einen Default-Fahrer daraus ableiten.

### AX-013: Importformat für Tagesliste
Priorität: P1  
Phase: M1  
Beschreibung: CSV/Excel-Import für echte Termine vorbereiten.

Akzeptanzkriterien:
- Beispiel-CSV liegt vor.
- Validierungsfehler werden verständlich angezeigt.
- Import erzeugt Stopps in der Routenplanung.

## AX-E03 - Routenoptimierung

### AX-020: Optimierungsziele finalisieren
Priorität: P0  
Phase: M0  
Beschreibung: Bestehende Modi aus Demo fachlich definieren.

Akzeptanzkriterien:
- Modi: ausgewogen, schnellste Route, kürzeste Strecke, Priorität zuerst, Zeitfenster schützen.
- Jeder Modus hat eine klare Bewertungsformel.
- UI-Texte erklären den Unterschied kurz.

### AX-021: Routing-Engine abstrahieren
Priorität: P0  
Phase: M1  
Beschreibung: Lokale Haversine/Greedy-Logik und OSRM-Straßenroute hinter Service-Schicht kapseln.

Akzeptanzkriterien:
- Es gibt eine Routing-Service-Funktion mit austauschbarem Provider.
- UI kennt nicht die Details von OSRM.
- Fallback auf Luftlinie bleibt erhalten.

### AX-022: Zeitfenster-Verletzungen berechnen
Priorität: P0  
Phase: M1  
Beschreibung: Verspätung, Wartezeit und Zeitfensterbruch je Stopp anzeigen.

Akzeptanzkriterien:
- Jeder Stopp zeigt ETA.
- Verspätete Stopps werden visuell markiert.
- Kennzahlen aggregieren Wartezeit und Verspätung.

### AX-023: Servicezeit in Route korrekt berücksichtigen
Priorität: P0  
Phase: M1  
Beschreibung: Servicezeit muss in ETA und Folgetermine einfließen.

Akzeptanzkriterien:
- ETA nach einem Stopp enthält Servicezeit.
- Änderung der Servicezeit löst Replanung aus.
- Testfall mit 3 Stopps ist dokumentiert.

### AX-024: Rückfahrt zum Depot verbessern
Priorität: P2  
Phase: M1  
Beschreibung: Rückfahrt optional mit eigener ETA und Distanz anzeigen.

Akzeptanzkriterien:
- Rückfahrt erscheint klar getrennt von Kundenterminen.
- Metriken enthalten Rückfahrt nur bei aktivierter Option.
- UI verhindert Löschen der Rückfahrt als normaler Stopp.

## AX-E04 - Live-Replanung

### AX-030: Fahrtstart als Systemereignis modellieren
Priorität: P0  
Phase: M0  
Beschreibung: Route wird ab Startzeit überwacht und aktuelle Fahrzeugposition wird Quelle der Restplanung.

Akzeptanzkriterien:
- Startzeit wird eingefroren.
- Monitoring-Startzeit wird gesetzt.
- Restroute startet an aktueller Fahrzeugposition.

### AX-031: Absage während Fahrt verarbeiten
Priorität: P0  
Phase: M0  
Beschreibung: Wird ein aktiver Stopp abgesagt, wird er aus der Restroute entfernt.

Akzeptanzkriterien:
- Aktueller Zielstopp kann abgesagt werden.
- Nächster sinnvoller Stopp wird neu gewählt.
- Ereignis erscheint im Log.

### AX-032: Eilauftrag während Fahrt einfügen
Priorität: P0  
Phase: M0  
Beschreibung: Neuer Termin kann während laufender Fahrt eingefügt werden.

Akzeptanzkriterien:
- Neuer Stopp bekommt Priorität, Zeitfenster und Servicezeit.
- Route wird ab aktueller Position neu geplant.
- Karte zeigt aktualisierte Straßenroute.

### AX-033: Stau- oder Verkehrsfaktor live ändern
Priorität: P0  
Phase: M0  
Beschreibung: Änderung des Verkehrsfaktors beeinflusst Fahrtzeit und ETA.

Akzeptanzkriterien:
- Verkehr +25 Prozent ändert Metriken sichtbar.
- Route wird neu bewertet.
- Log dokumentiert Änderung.

### AX-034: Bereits erledigte Stopps sperren
Priorität: P1  
Phase: M1  
Beschreibung: Erledigte Termine dürfen nicht durch Replanung wieder offen werden.

Akzeptanzkriterien:
- Toggle funktioniert.
- Erledigte Stopps bleiben im Verlauf sichtbar.
- Restroute enthält nur offene Stopps.

## AX-E05 - Karte und Geodaten

### AX-040: Leaflet/OpenStreetMap stabilisieren
Priorität: P0  
Phase: M0  
Beschreibung: Kartenansicht muss zuverlässig laden und Marker korrekt anzeigen.

Akzeptanzkriterien:
- Depot, Stopps und Fahrzeugposition werden als Marker angezeigt.
- Karte passt Bounds bei Vorplanung an.
- Fahrzeug wird während Fahrt nachgeführt.

### AX-041: OSRM-Straßenroute als Provider
Priorität: P0  
Phase: M0  
Beschreibung: Route wird über OSRM auf Straßen berechnet.

Akzeptanzkriterien:
- OSRM-Route wird als Linie angezeigt.
- Fallback auf Luftlinie bei Fehler.
- Routingstatus zeigt aktiv/Fallback/Fehler.

### AX-042: Geocoding ausbauen
Priorität: P1  
Phase: M1  
Beschreibung: Aktuelle Demo nutzt lokale Heuristik. Für MVP wird echtes Geocoding benötigt.

Akzeptanzkriterien:
- Adressen werden über Provider geocodiert.
- Unklare Treffer werden bestätigt.
- Koordinaten werden gespeichert.

### AX-043: Karten-Performance prüfen
Priorität: P2  
Phase: M2  
Beschreibung: Performance bei 50+ Stopps prüfen.

Akzeptanzkriterien:
- 50 Stopps bleiben bedienbar.
- Replanning dauert unter 2 Sekunden für Tagesroute.
- Marker bleiben unterscheidbar.

## AX-E06 - KI-Dispatcher

### AX-050: KI-Aktionsschema finalisieren
Priorität: P0  
Phase: M0  
Beschreibung: Standardisiertes JSON-Schema für KI-Aktionen definieren.

Akzeptanzkriterien:
- Aktionen: add_stop, cancel_stop, restore_stop, set_priority, set_parameter, start_drive, pause_drive, reset_drive, replan.
- Ungültige Aktionen werden ignoriert und geloggt.
- Schema ist in Code und Dokumentation gleich.

### AX-051: Gemini-Integration absichern
Priorität: P0  
Phase: M1  
Beschreibung: Gemini API-Key aktuell im Browser. Für MVP sicherere Backend-Proxy-Lösung planen.

Akzeptanzkriterien:
- Kein produktiver API-Key im Frontend.
- Backend-Endpoint validiert Eingaben.
- Rate Limits und Fehler werden angezeigt.

### AX-052: Lokalen Dispatcher als Fallback behalten
Priorität: P1  
Phase: M1  
Beschreibung: Wenn KI nicht erreichbar ist, soll einfache Absage-/Eilauftrag-Erkennung weiter funktionieren.

Akzeptanzkriterien:
- Schlüsselwörter lösen lokale Aktionen aus.
- Nutzer sieht klar, ob KI oder lokaler Dispatcher genutzt wurde.
- Keine Route blockiert wegen KI-Ausfall.

### AX-053: KI-Erklärungen im Ereignislog verbessern
Priorität: P1  
Phase: M1  
Beschreibung: Log soll erklären, warum die KI eine Aktion ausgeführt hat.

Akzeptanzkriterien:
- Jede KI-Aktion hat Grund und Quelle.
- Nutzer kann Änderung nachvollziehen.
- Fehlerhafte Zuordnung kann manuell rückgängig gemacht werden.

## AX-E07 - Gmail- und Kommunikationsschnittstelle

### AX-060: Gmail OAuth Setup dokumentieren
Priorität: P0  
Phase: M0  
Beschreibung: Anleitung für Google Cloud OAuth Client ID und Gmail API.

Akzeptanzkriterien:
- Schritte für Google Cloud Console sind dokumentiert.
- Benötigte Redirect/Origin-URLs für lokale Demo und Vercel stehen drin.
- Scope `gmail.readonly` ist begründet.

### AX-061: Gmail ab Fahrtstart überwachen
Priorität: P0  
Phase: M0  
Beschreibung: Ab Fahrtstart werden neue Mails geprüft.

Akzeptanzkriterien:
- Monitoring-Startzeit ist Fahrtstart.
- Bereits bekannte Mails werden nicht doppelt verarbeitet.
- Intervall ist einstellbar.

### AX-062: Absage-Mails erkennen
Priorität: P0  
Phase: M0  
Beschreibung: Betreff, Snippet und Body werden auf Absage-Signale geprüft.

Akzeptanzkriterien:
- Wörter wie Absage, storniert, fällt aus, kann nicht stattfinden werden erkannt.
- Erkennung funktioniert für Inbox und Sent je nach Suchbereich.
- Treffer erzeugt KI-Plan oder lokalen Plan.

### AX-063: Mail einem Termin zuordnen
Priorität: P0  
Phase: M1  
Beschreibung: Mail muss möglichst korrekt dem passenden Termin zugeordnet werden.

Akzeptanzkriterien:
- Matching über Kundenname, Adresse, Stadt, E-Mail-Adresse.
- Unsicheres Matching wird als Rückfrage markiert.
- Falsche Zuordnung kann rückgängig gemacht werden.

### AX-064: Gesendete Mails berücksichtigen
Priorität: P1  
Phase: M1  
Beschreibung: Wenn Mitarbeiter selbst eine Absage oder Verschiebung senden, soll das System ebenfalls reagieren.

Akzeptanzkriterien:
- Suchmodus "Posteingang + gesendet" funktioniert.
- Sent-Mails werden nicht doppelt verarbeitet.
- Log zeigt Quelle Inbox/Sent.

### AX-065: Telefonie-Integration vorbereiten
Priorität: P2  
Phase: M2  
Beschreibung: Aus dem Skript: E-Mails und Anrufe sollen live überwacht werden. Telefonie erst vorbereiten.

Akzeptanzkriterien:
- Anforderungen an Call-Transcription Provider dokumentiert.
- Event-Schema ist identisch zu Gmail.
- Datenschutzprüfung ist vorgesehen.

## AX-E08 - Fahreroberfläche

### AX-070: Fahreransicht als eigener Screen
Priorität: P1  
Phase: M1  
Beschreibung: Fahrer braucht fokussierte Ansicht mit nächstem Termin.

Akzeptanzkriterien:
- Nächster Stopp, Adresse, ETA, Kontakt und Hinweise sichtbar.
- Erledigt/Problem/Anfahrt starten Aktionen vorhanden.
- UI funktioniert mobil.

### AX-071: Fahrer-Status zurückmelden
Priorität: P1  
Phase: M1  
Beschreibung: Fahrer kann Statusänderungen senden.

Akzeptanzkriterien:
- Status: unterwegs, angekommen, erledigt, Problem.
- Status löst Replanung oder Kundeninfo aus.
- Ereignislog wird aktualisiert.

### AX-072: Offline-/Schlechte-Verbindung-Konzept
Priorität: P2  
Phase: M2  
Beschreibung: Fahrer-App muss bei schlechter Verbindung robust bleiben.

Akzeptanzkriterien:
- Letzte Route bleibt lokal sichtbar.
- Statusänderungen werden nachgesendet.
- Nutzer erkennt Verbindungszustand.

## AX-E09 - Kundenoberfläche

### AX-080: Kundenstatus-Seite
Priorität: P1  
Phase: M1  
Beschreibung: Kunde sieht aktuelles Zeitfenster und Status.

Akzeptanzkriterien:
- Keine Anmeldung nötig, sicherer Link.
- Zeigt Zeitfenster, Status und Kontaktoption.
- Änderungen werden verständlich formuliert.

### AX-081: Automatische Zeitfenster-Vorschläge
Priorität: P1  
Phase: M2  
Beschreibung: KI schlägt freie Slots passend zur Tagesroute vor.

Akzeptanzkriterien:
- Vorschläge berücksichtigen bestehende Termine.
- Vorschläge berücksichtigen Fahrtzeit.
- Kunde kann Slot annehmen oder ablehnen.

### AX-082: Kundenkommunikation bei Absage/Replanung
Priorität: P1  
Phase: M2  
Beschreibung: Kunden werden bei geänderter ETA informiert.

Akzeptanzkriterien:
- Nachrichtenvorlagen für E-Mail/SMS/WhatsApp vorbereitet.
- Kommunikation kann manuell freigegeben werden.
- Historie wird gespeichert.

## AX-E10 - Lernen und Analytics

### AX-090: Basis-Metriken messen
Priorität: P0  
Phase: M1  
Beschreibung: Aus Canvas: Anzahl Abos plus operative Metriken erfassen.

Akzeptanzkriterien:
- Metriken: aktive Abos, Fahrtzeit, Wartezeit, abgesagte Termine, Replanings, Pünktlichkeit.
- Tagesreport kann exportiert werden.
- Demo zeigt mindestens 4 Kennzahlen.

### AX-091: Routenvergleich vorher/nachher
Priorität: P1  
Phase: M2  
Beschreibung: Zeigen, wie viel Replanung spart.

Akzeptanzkriterien:
- Ursprüngliche Route bleibt als Vergleich gespeichert.
- Nach Absage wird Differenz in km/min angezeigt.
- Ergebnis ist für Sales nutzbar.

### AX-092: Lernmodell-Konzept
Priorität: P2  
Phase: M2  
Beschreibung: Aus Skript: System lernt, welche Routen langfristig effizient sind.

Akzeptanzkriterien:
- Lernsignale sind definiert.
- Keine personenbezogenen Daten ohne Zweckbindung.
- Erstes Konzept für historische Verkehrsvorhersage liegt vor.

## AX-E11 - Admin, Abo und Betrieb

### AX-100: Mandantenfähigkeit planen
Priorität: P2  
Phase: M2  
Beschreibung: Mehrere Kundenunternehmen sauber trennen.

Akzeptanzkriterien:
- Datenmodell enthält Organisation.
- Nutzer gehören zu Organisationen.
- Rechte sind pro Organisation getrennt.

### AX-101: Rollenmodell
Priorität: P2  
Phase: M2  
Beschreibung: Disponent, Fahrer, Admin, Kunde unterscheiden.

Akzeptanzkriterien:
- Rollen und Rechte dokumentiert.
- UI zeigt nur passende Aktionen.
- API-Konzept berücksichtigt Rollen.

### AX-102: Abo-Metrik abbilden
Priorität: P2  
Phase: M3  
Beschreibung: Canvas-Metrik "Anzahl Abos" produktseitig tracken.

Akzeptanzkriterien:
- Abo-Status je Organisation.
- Trial/Paid/Cancelled Status.
- Dashboard für aktive Abos.

## AX-E12 - Sicherheit, Datenschutz, Compliance

### AX-110: Datenschutzkonzept für Gmail
Priorität: P0  
Phase: M1  
Beschreibung: Gmail-Mails können personenbezogene Daten enthalten.

Akzeptanzkriterien:
- Zweck der Verarbeitung ist dokumentiert.
- Nur erforderliche Mailteile werden verarbeitet.
- Lösch- und Deaktivierungslogik ist vorgesehen.

### AX-111: Secrets aus Frontend entfernen
Priorität: P0  
Phase: M1  
Beschreibung: API-Keys im Browser sind nur für Demo akzeptabel.

Akzeptanzkriterien:
- Gemini-Key liegt serverseitig.
- OAuth Client ID darf öffentlich bleiben, Secret nicht.
- Vercel Environment Variables sind vorbereitet.

### AX-112: Audit-Log für automatische Änderungen
Priorität: P0  
Phase: M1  
Beschreibung: Jede automatische Routenänderung muss nachvollziehbar sein.

Akzeptanzkriterien:
- Quelle: User, KI, Gmail, System.
- Vorher/Nachher wird gespeichert.
- Rückgängig-Funktion ist geplant.

## AX-E13 - Deployment und Qualität

### AX-120: Vercel Deployment vorbereiten
Priorität: P0  
Phase: M0  
Beschreibung: Statische Demo auf Vercel veröffentlichen.

Akzeptanzkriterien:
- Projekt ist mit Vercel verknüpft.
- `routenplanung-test.html` ist erreichbar.
- Vercel-Domain ist als OAuth-Origin dokumentiert.

### AX-121: Demo-Link auf Landingpage ergänzen
Priorität: P1  
Phase: M0  
Beschreibung: Bestehende AutomateX-Seite soll zur Routing-Demo führen.

Akzeptanzkriterien:
- Navigation oder CTA zur Demo.
- Kein Bruch im bestehenden Design.
- Link funktioniert lokal und auf Vercel.

### AX-122: Smoke-Test-Checkliste
Priorität: P0  
Phase: M0  
Beschreibung: Manuelle QA für Demo.

Akzeptanzkriterien:
- Route planen.
- Fahrt starten.
- Eilauftrag hinzufügen.
- Absage aus UI auslösen.
- KI lokal testen.
- Gmail verbinden und manuell prüfen.
- Karte lädt mit OSM/OSRM oder Fallback.

### AX-123: Browser-Kompatibilität
Priorität: P1  
Phase: M1  
Beschreibung: Chrome, Edge, Safari mobile testen.

Akzeptanzkriterien:
- Layout mobil nutzbar.
- OAuth-Popup funktioniert.
- Karte und Replanning funktionieren.

## Sprint-Vorschlag

### Sprint 1 - Demo vorführbar
- AX-004 UVP schärfen
- AX-020 Optimierungsziele finalisieren
- AX-030 Fahrtstart als Systemereignis
- AX-031 Absage während Fahrt
- AX-040 Leaflet/OpenStreetMap stabilisieren
- AX-050 KI-Aktionsschema finalisieren
- AX-060 Gmail OAuth Setup dokumentieren
- AX-120 Vercel Deployment vorbereiten
- AX-122 Smoke-Test-Checkliste

### Sprint 2 - MVP-Daten und Pilotfähigkeit
- AX-010 Termin-Datenmodell
- AX-013 Importformat
- AX-021 Routing-Engine abstrahieren
- AX-022 Zeitfenster-Verletzungen
- AX-023 Servicezeit korrekt berücksichtigen
- AX-063 Mail einem Termin zuordnen
- AX-070 Fahreransicht
- AX-090 Basis-Metriken
- AX-110 Datenschutzkonzept
- AX-112 Audit-Log

### Sprint 3 - Kundennutzen sichtbar machen
- AX-080 Kundenstatus-Seite
- AX-081 Zeitfenster-Vorschläge
- AX-082 Kundenkommunikation
- AX-091 Routenvergleich vorher/nachher
- AX-052 Lokaler Dispatcher
- AX-053 KI-Erklärungen
- AX-064 Gesendete Mails berücksichtigen

## Definition of Done

Ein Ticket ist fertig, wenn:
- Funktion ist in der Demo oder im MVP sichtbar nutzbar.
- Akzeptanzkriterien sind erfüllt.
- Fehlerfälle sind behandelt.
- Ereignislog oder UI zeigt automatische Entscheidungen nachvollziehbar.
- Keine API-Keys oder Secrets sind hardcoded.
- Manuelle Smoke-Tests wurden durchgeführt.

## Größte technische Risiken

1. Gmail-Zugriff benötigt OAuth und korrekte Google-Cloud-Konfiguration.
2. KI kann falsche Termine absagen, wenn Matching unsicher ist.
3. OSRM Public API ist für Demo gut, aber nicht für produktive Last garantiert.
4. Browser-only Demo ist nicht ausreichend sicher für produktive API-Keys.
5. Multi-Fahrer-Optimierung ist deutlich komplexer als Ein-Fahrer-Tagesroute.

## Entscheidungspunkte

- Startsegment: Handwerk, Wartung/Service oder Logistik?
- Erster echter Pilotkunde?
- Soll Gmail zuerst reichen oder müssen Telefon/WhatsApp schnell dazu?
- Backend: Vercel Functions, Next.js App oder separates API?
- Routing Provider: OSRM Public, eigener OSRM Server, Google Routes API oder Mapbox?
