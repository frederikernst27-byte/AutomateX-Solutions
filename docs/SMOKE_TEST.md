# Smoke-Test Checkliste

Stand: 2026-04-27

## Basis

- [ ] `public/routenplanung-test.html` oeffnet ohne JavaScript-Fehler.
- [ ] Beispieldaten werden geladen.
- [ ] Datum, Startzeit und Depot sind sichtbar.
- [ ] Karte lädt mit OpenStreetMap.
- [ ] OSRM-Straßenroute erscheint oder Fallback wird angezeigt.

## Route

- [ ] Route planen aktualisiert Distanz, Fahrtzeit und Ankunft.
- [ ] Fahrt starten setzt Status auf "Fahrt läuft".
- [ ] Fahrzeugmarker bewegt sich.
- [ ] Route listet Stopps in Reihenfolge.
- [ ] ETA wird je Stopp angezeigt.

## Live-Replanung

- [ ] Nächsten Termin absagen entfernt Ziel aus Restroute.
- [ ] Eilauftrag hinzufügen ergänzt neuen Stopp.
- [ ] Verkehr +25 Prozent verändert Fahrtzeit/ETA.
- [ ] Bereits erledigte Stopps bleiben erledigt.
- [ ] Ereignislog dokumentiert jede Änderung.

## KI

- [ ] Lokale KI mit Beispielprompt ausführen.
- [ ] Gemini-Key kann eingetragen werden.
- [ ] KI-Antwort wird in Aktionen umgesetzt.
- [ ] Ungültige oder fehlende KI-Konfiguration zeigt Fehler im UI.

## Gmail

- [ ] OAuth Client ID kann gespeichert werden.
- [ ] Gmail verbinden öffnet Google OAuth.
- [ ] Manuelle Prüfung läuft ohne Absturz.
- [ ] Ab Fahrtstart wird Monitoring gesetzt.
- [ ] Absage-Mail löst `cancel_stop` und `replan` aus.

## Deployment

- [ ] Demo ist auf Vercel erreichbar.
- [ ] Vercel-Domain ist in Google OAuth Origins eingetragen.
- [ ] OSM/OSRM/CDN-Ressourcen laden über HTTPS.
- [ ] Mobile Ansicht ist bedienbar.
