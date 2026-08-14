# AutomateX Lead-Recherche

Stand: 2026-07-10

## Datei

- `automatex_leads_nrw_2026-07-10.csv`
- `agentmail_outreach.py`
- `.env.example`

## Zielprofil

Erste oeffentliche B2B-Stichprobe fuer AutomateX:

- Handwerks- und Serviceteams
- Schwerpunkt NRW
- Segmente: SHK, Elektroservice, Gebaeudetechnik/Wartung, Fenster-/Tuerenservice
- Potenzieller Bedarf: Tagesrouten, Kundendiensttermine, Absagen, dynamische Replanung

## Quellen und Nutzung

Die erste Liste basiert auf oeffentlichen OpenStreetMap-Daten ueber Nominatim.

- Quelle: OpenStreetMap/Nominatim
- Attribution: Data © OpenStreetMap contributors
- Lizenzhinweis: OSM-Daten stehen unter ODbL.
- Nutzungsregel der oeffentlichen Nominatim-Instanz: maximal 1 Request pro Sekunde, mit identifizierendem User-Agent.

## Spalten

- `company`: Firmenname
- `segment`: grobe Einordnung
- `fit_score`: priorisierte Einschaetzung von 0 bis 100
- `city`, `postcode`, `street`: Standortdaten aus OSM
- `website`: oeffentlich hinterlegte Website
- `generic_email`: nur generische Adressen wie info@ oder kontakt@, wenn oeffentlich hinterlegt
- `phone_public`: oeffentlich hinterlegte Telefonnummer
- `source_url`: OSM-Objekt zur Nachpruefung
- `fit_reason`: warum der Lead zu AutomateX passen koennte
- `next_step`: empfohlene manuelle Validierung

## Compliance-Notiz

Vor Outreach bitte Website, Unternehmensgroesse, Team-/Fuhrpark-Hinweise und passende Ansprechpartner manuell validieren. Fuer Kaltakquise in Deutschland sollten DSGVO/UWG beachtet werden; generische Kontaktdaten sind kein Freifahrtschein fuer Massenmailing.

## AgentMail-Outreach

Das Script `agentmail_outreach.py` erstellt standardmaessig nur eine Draft-CSV und sendet nichts.

Setup:

```bash
python3 -m pip install agentmail python-dotenv
cp leads/.env.example leads/.env
```

Danach `leads/.env` lokal mit `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID` und `OUTREACH_SENDER_NAME` fuellen. Die Datei ist durch `.gitignore` abgedeckt und sollte nicht committed werden.

AgentMail-Inbox ohne eigene Domain erstellen:

```bash
python3 leads/agentmail_outreach.py --create-inbox --inbox-username automatex-feedback
```

Die ausgegebene `AGENTMAIL_INBOX_ID` danach in `leads/.env` eintragen.

Preview:

```bash
python3 leads/agentmail_outreach.py --limit 5
```

Echter Versand:

```bash
python3 leads/agentmail_outreach.py --limit 5 --send
```

## Apify Lead-Scraping

Der Apify-Workflow sucht gezielt nach deutschen Handwerks- und Servicebetrieben,
dedupliziert per Google-Maps-Place-ID und exportiert nur Rollen- oder klar
firmenbezogene E-Mail-Adressen. Private bzw. nicht eindeutig generische Adressen
werden nicht in `generic_email` uebernommen.

10.000er-Eingabe vorbereiten:

```bash
python3 leads/apify_lead_scraper.py prepare --target 10000
```

Nach Erhoehung des Apify-Monatslimits den Lauf kostenbegrenzt starten:

```bash
python3 leads/apify_lead_scraper.py start --target 10000 --max-charge 25
```

Anschliessend die ausgegebene Run-ID einsammeln:

```bash
python3 leads/apify_lead_scraper.py wait --run-id RUN_ID --target 10000
```

## Firecrawl Discovery

`firecrawl_discovery.py` sammelt rohe Suchtreffer aus deutschen Staedten und
schreibt sowohl die komplette Trefferliste als auch eindeutige Nicht-Verzeichnis-
Domains. Es verschickt keine E-Mails und ruft keine Kontaktseiten ab.

```bash
python3 leads/firecrawl_discovery.py --max-credits 650
```

Empfohlen: zuerst nur 5 bis 10 sehr passende Kontakte pro Tag, Antworten manuell pruefen und erst dann Volumen langsam erhoehen.
