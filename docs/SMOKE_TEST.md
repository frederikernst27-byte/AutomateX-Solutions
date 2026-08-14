# Smoke-Test Checkliste

Stand: 2026-04-30

## Basis

- [ ] `public/routenplanung-test.html` oeffnet ohne JavaScript-Fehler.
- [ ] Beispieldaten werden geladen.
- [ ] Datum, Startzeit und Depot sind sichtbar.
- [ ] Karte laedt mit OpenStreetMap.
- [ ] OSRM-Strassenroute erscheint oder Fallback wird angezeigt.

## Route

- [ ] Route planen aktualisiert Distanz, Fahrtzeit und Ankunft.
- [ ] Fahrt starten setzt Status auf "Fahrt laeuft".
- [ ] Fahrzeugmarker bewegt sich.
- [ ] Route listet Stopps in Reihenfolge.
- [ ] ETA wird je Stopp angezeigt.
- [ ] Wartezeit und verspaetete Stopps werden in den Metriken angezeigt.
- [ ] Verspaetete Stopps sind in der Liste sichtbar markiert.

## Live-Replanung

- [ ] Naechsten Termin absagen entfernt Ziel aus Restroute.
- [ ] Eilauftrag hinzufuegen ergaenzt neuen Stopp.
- [ ] Verkehr +25 Prozent veraendert Fahrtzeit/ETA.
- [ ] Bereits erledigte Stopps bleiben erledigt.
- [ ] Ereignislog dokumentiert jede Aenderung.

## Fahrer und Audit

- [ ] Fahreransicht zeigt naechsten Stopp, Adresse und ETA.
- [ ] Anfahrt starten schreibt einen Logeintrag.
- [ ] Angekommen schreibt einen Logeintrag.
- [ ] Erledigt setzt den Stopp auf done und plant weiter.
- [ ] Problem markiert den Stopp als delayed und bewertet die Route neu.
- [ ] Letzte automatische KI-/Gmail-Aktion kann rueckgaengig gemacht werden.
- [ ] Tagesreport kann exportiert werden.

## KI

- [ ] Lokale KI mit Beispielprompt ausfuehren.
- [ ] Gemini-Key kann eingetragen werden.
- [ ] KI-Antwort wird in Aktionen umgesetzt.
- [ ] Ungueltige oder fehlende KI-Konfiguration zeigt Fehler im UI.

## Gmail

- [ ] OAuth Client ID kann gespeichert werden.
- [ ] Gmail verbinden oeffnet Google OAuth.
- [ ] Manuelle Pruefung laeuft ohne Absturz.
- [ ] Ab Fahrtstart wird Monitoring gesetzt.
- [ ] Absage-Mail loest `cancel_stop` und `replan` aus.
- [ ] Gmail-Matching-Log zeigt bei Absage eine Confidence oder Unsicherheitsmeldung.

## Deployment

- [ ] Demo ist auf Vercel erreichbar.
- [ ] Vercel-Domain ist in Google OAuth Origins eingetragen.
- [ ] OSM/OSRM/CDN-Ressourcen laden ueber HTTPS.
- [ ] Mobile Ansicht ist bedienbar.
