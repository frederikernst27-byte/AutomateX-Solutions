# AutomateX Solutions - Projektdokumentation

Stand: 2026-05-28

Diese Dokumentation beschreibt den aktuellen Stand des Repositories `AutomateX-Solutions`: die statische Website, die produktnahe Maps-App, die Gmail-OAuth-Integration, Datenfluesse, Deployment, Prototypen und bekannte technische Risiken.

## 1. Kurzueberblick

AutomateX Solutions besteht aus mehreren Arbeitsbereichen:

- Statische Unternehmenswebsite und Routenplanungsdemo im Root- und `public/`-Bereich.
- Produktnahe Next.js-App `apps/maps` fuer KI-gestuetzte Routenplanung, Excel-Import, Gmail-Analyse und Fahreransicht.
- Dokumentation und Planung unter `docs/`.
- Kunden-/Demo-Prototypen unter `prototypes/`, insbesondere fuer die Scherer-Gruppe.
- Lokale Hilfstools, Beispiele und Assets.

Das zentrale Produktziel ist eine Anwendung fuer Handwerks- und Serviceteams, die Tagesrouten verwaltet, Termine importiert, Routen optimiert und relevante E-Mails automatisch in pruefbare Termin-/Stop-Vorschlaege verwandelt.

## 2. Repository-Struktur

```text
.
|-- README.md
|-- PROJEKTDOKUMENTATION.md
|-- index.html
|-- routenplanung.html
|-- routenplanung-test.html
|-- impressum.html
|-- datenschutz.html
|-- vercel.json
|-- api/
|   `-- route-demo.js
|-- apps/
|   `-- maps/
|-- assets/
|   |-- archives/
|   |-- audio/
|   `-- documents/
|-- docs/
|   |-- ARCHITECTURE.md
|   |-- DATA_MODELS.md
|   |-- GMAIL_OAUTH_SETUP.md
|   |-- PRODUCT_STRATEGY.md
|   |-- SMOKE_TEST.md
|   `-- planning/
|-- examples/
|   `-- tagesliste.csv
|-- prototypes/
|   `-- scherer/
|-- public/
|   |-- index.html
|   |-- routenplanung-test.html
|   |-- impressum.html
|   |-- datenschutz.html
|   `-- assets/
`-- tools/
```

## 3. Arbeitsbereiche

### 3.1 Root und statische Website

Der Root enthaelt statische HTML-Dateien fuer AutomateX Solutions:

- `index.html`: Unternehmens-/Landingpage.
- `routenplanung.html`: Routenplanungsdemo.
- `routenplanung-test.html`: erweiterte Testdemo mit Routing, KI-Interaktion und Gmail-Client-ID-Eingabe.
- `impressum.html`, `datenschutz.html`: rechtliche Seiten.
- `api/route-demo.js`: einfache API-/Demo-Datei fuer Vercel-Umgebungen.

Der deploybare statische Bereich liegt laut `README.md` in `public/`. Die Root-`vercel.json` setzt:

```json
{
  "outputDirectory": "public",
  "cleanUrls": true,
  "trailingSlash": false
}
```

Damit wird fuer die statische Website `public/` als Output-Verzeichnis genutzt.

### 3.2 `apps/maps` - produktnahe Next.js-App

`apps/maps` ist die wichtigste App im Repository. Sie ist eine Next.js-15-Anwendung mit React 19, Supabase, Leaflet, XLSX und serverseitigen API-Routen.

Wichtige Dateien:

- `apps/maps/package.json`: Scripts und Dependencies.
- `apps/maps/app/`: App Router Seiten und API-Routen.
- `apps/maps/components/Map.tsx`: Leaflet-Karte.
- `apps/maps/lib/`: Supabase, Routing, Gmail, KI und Excel-Helfer.
- `apps/maps/middleware.ts`: Auth-Schutz fuer App-Routen.
- `apps/maps/netlify.toml`: Netlify-Build-Konfiguration.
- `apps/maps/vercel.json`: Vercel-Konfiguration fuer Next.js.

Scripts in `apps/maps/package.json`:

```text
npm run dev    -> next dev -p 3001
npm run build  -> next build
npm run start  -> next start -p 3001
npm run lint   -> next lint
```

Hinweis: In der aktuellen lokalen Shell war `npm` nicht verfuegbar, daher konnten Lint/Build nicht lokal ausgefuehrt werden.

## 4. Produktfunktionen in `apps/maps`

### 4.1 Authentifizierung und Mandanten

Die App verwendet Supabase Auth.

Dateien:

- `apps/maps/lib/supabase/client.ts`: Browser-Client.
- `apps/maps/lib/supabase/server.ts`: Server-Client mit Cookie-Handling.
- `apps/maps/middleware.ts`: leitet nicht eingeloggte Nutzer auf `/login` um.
- `apps/maps/app/login/page.tsx`: Login mit E-Mail/Passwort.
- `apps/maps/app/register/page.tsx`: Registrierung, Organisation und Membership.

Registrierungsfluss:

1. Nutzer registriert sich mit E-Mail und Passwort.
2. App erstellt einen Eintrag in `organizations`.
3. App erstellt einen Eintrag in `org_members` mit Rolle `owner`.
4. Nutzer wird zum Dashboard weitergeleitet.

Mandantenbezug erfolgt fast ueberall ueber:

```text
auth user -> org_members.user_id -> org_id -> Datenfilter
```

### 4.2 Dashboard: heutige Stops

Datei: `apps/maps/app/dashboard/page.tsx`

Funktionen:

- Laedt Stops fuer das heutige Datum.
- Filtert nach `org_id`.
- Sortiert nach Prioritaet und Startzeit.
- Erlaubt manuelles Anlegen eines Stops.
- Geokodiert Adresse ueber Nominatim/OpenStreetMap.
- Erlaubt Statuswechsel: `pending`, `in_progress`, `done`, `cancelled`.
- Erlaubt Loeschen eines Stops.

Verwendete Tabelle:

```text
stops
```

Wichtige Spalten laut Code:

```text
id, org_id, name, address, lat, lng, time_from, time_to,
status, notes, priority, scheduled_date
```

### 4.3 Excel-/CSV-Import

Dateien:

- `apps/maps/app/dashboard/import/page.tsx`
- `apps/maps/lib/excel.ts`

Funktionen:

- Import von `.xlsx`, `.xls` und `.csv`.
- Automatische Spaltenerkennung fuer Name, Adresse, Datum, Zeiten, Prioritaet und Notiz.
- Manuelle Spaltenzuordnung.
- Vorschau bis 50 Zeilen.
- Pro Zeile Geocoding und Insert in `stops`.

Mapping-Heuristiken erkennen unter anderem:

- Name: `kunde`, `firma`, `customer`, `client`
- Adresse: `adresse`, `anschrift`, `street`, `strasse`, `straße`
- Datum: `datum`, `date`, `tag`
- Prioritaet: `prio`, `dringend`, `priority`

Beispieldatei:

```text
examples/tagesliste.csv
```

### 4.4 Karte und Routenoptimierung

Dateien:

- `apps/maps/app/dashboard/route/page.tsx`
- `apps/maps/components/Map.tsx`
- `apps/maps/lib/routing.ts`

Funktionen:

- Laedt heutige, nicht abgesagte Stops.
- Zeigt nur Stops mit Koordinaten auf der Karte.
- Optimiert Reihenfolge ueber OSRM Trip API.
- Holt anschliessend eine OSRM-Route und dekodiert die Polyline.
- Zeigt Distanz, Fahrzeit und Reihenfolge.

Externe Dienste:

- Nominatim fuer Geocoding:
  `https://nominatim.openstreetmap.org/search`
- OSRM fuer Optimierung:
  `https://router.project-osrm.org/trip/v1/driving/...`
- OSRM fuer Route:
  `https://router.project-osrm.org/route/v1/driving/...`
- Leaflet/CARTO/OpenStreetMap fuer Kartenkacheln.

Wichtig: Die App nutzt oeffentliche OSRM-/Nominatim-Endpunkte. Fuer produktive Nutzung sollte ein eigener Routingdienst oder ein bezahlter Provider eingeplant werden.

### 4.5 Fahreransicht

Datei: `apps/maps/app/driver/page.tsx`

Funktionen:

- Mobile Fahreransicht mit dunklem Layout.
- Zeigt heutige Stops und Karte.
- Unterstuetzt Statuswechsel:
  - `pending` -> `in_progress`
  - `in_progress` -> `done`
- Enthält Google-Maps-Navigationslinks.
- Nutzt Supabase Realtime auf Tabelle `stops`, um Aenderungen live zu laden.

Realtime-Channel:

```text
driver-stops
```

Aktuell abonniert der Code alle Aenderungen auf `public.stops`; eine zusaetzliche Filterung nach `org_id` waere fuer Skalierung und Datenschutz sinnvoll.

### 4.6 KI-Inbox

Dateien:

- `apps/maps/app/dashboard/inbox/page.tsx`
- `apps/maps/lib/ai.ts`
- `apps/maps/app/api/gmail/sync/route.ts`

Funktionen:

- Zeigt pending Eintraege aus `email_queue`.
- Stellt KI-Extraktion dar: Kunde, Adresse, Datum, Zeit, Prioritaet, Notiz, Begruendung.
- Erlaubt Uebernahme als Stop.
- Erlaubt Ignorieren.

KI-Intent-Werte:

```text
new_appointment
cancellation
reschedule
urgent_request
other
```

OpenRouter wird genutzt, falls `OPENROUTER_API_KEY` gesetzt ist. Modell:

```text
meta-llama/llama-3.3-70b-instruct:free
```

Fallback: einfache Heuristik in `heuristicParse`, wenn kein OpenRouter-Key vorhanden ist oder der KI-Call fehlschlaegt.

## 5. Gmail OAuth und E-Mail-Synchronisierung

### 5.1 Relevante Dateien

```text
apps/maps/lib/gmail.ts
apps/maps/app/api/gmail/auth/route.ts
apps/maps/app/api/gmail/callback/route.ts
apps/maps/app/api/gmail/sync/route.ts
apps/maps/app/dashboard/settings/page.tsx
```

### 5.2 OAuth Start

`/api/gmail/auth`:

1. Prueft Supabase-Login.
2. Holt `org_id` des Nutzers.
3. Kodiert `org_id` und `user_id` als `state`.
4. Redirect zu Google OAuth via `getAuthUrl(state)`.

Aktuelle Scopes in `apps/maps/lib/gmail.ts`:

```text
openid
email
profile
https://www.googleapis.com/auth/gmail.readonly
```

Weitere OAuth-Parameter:

```text
response_type=code
access_type=offline
prompt=consent
include_granted_scopes=true
redirect_uri=${NEXT_PUBLIC_APP_URL}/api/gmail/callback
```

### 5.3 OAuth Callback

`/api/gmail/callback`:

1. Liest `code`, `state` und moeglichen `error`.
2. Dekodiert `state`.
3. Tauscht Code gegen Tokens bei Google.
4. Holt Gmail-Profil (`emailAddress`).
5. Speichert/aktualisiert `gmail_integrations` per `upsert` auf `org_id`.
6. Redirect zu `/dashboard/settings?connected=1`.

Gespeicherte Felder laut Code:

```text
org_id
email_address
refresh_token
access_token
expires_at
```

### 5.4 Gmail Sync

`POST /api/gmail/sync`:

1. Prueft Login und `org_id`.
2. Laedt `gmail_integrations`.
3. Aktualisiert Access Token, wenn abgelaufen.
4. Listet Gmail-Nachrichten mit Query:

```text
newer_than:3d -in:sent -from:no-reply -from:noreply
```

5. Ueberspringt bereits bekannte `gmail_message_id`.
6. Holt volle E-Mail.
7. Extrahiert Subject, From, Date und Body.
8. Analysiert mit KI oder Heuristik.
9. Schreibt in `email_queue`.
10. Markiert relevante E-Mails als `pending`, irrelevante als `ignored`.
11. Aktualisiert `last_synced_at`.

### 5.5 Aktueller OAuth-Fehler: `clawy`

Der Fehler:

```text
Zugriff blockiert: Autorisierungsfehler
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy
Wenn Sie Entwickler von "clawy" sind...
Fehler 400: invalid_request
```

Analyse:

- Im Repository wurde kein relevanter `clawy`-Eintrag gefunden.
- Der Name `clawy` kommt sehr wahrscheinlich aus dem Google Cloud OAuth Consent Screen des tatsaechlich verwendeten OAuth-Projekts.
- Das bedeutet: Die Live-App verwendet vermutlich noch eine alte `GOOGLE_CLIENT_ID`, oder der neue OAuth Client wurde im selben Google Cloud Projekt mit App-Name `clawy` erstellt.

Pruefungen in Google Cloud:

1. In den Fehlerdetails die angezeigte `client_id` ansehen.
2. Diese `client_id` mit der produktiven Hosting-Env-Var `GOOGLE_CLIENT_ID` vergleichen.
3. OAuth Consent Screen im richtigen Google Cloud Projekt oeffnen.
4. App-Name von `clawy` auf `AutomateX Maps` oder `AutomateX Solutions` setzen.
5. Publishing Status auf `Testing` lassen, solange keine Google-Verifizierung erfolgt ist.
6. Test User `frederik.ernst27@gmail.com` eintragen.
7. Gmail API im selben Projekt aktivieren.
8. Redirect URI exakt setzen:

```text
https://maps.automate-x-solutions.de/api/gmail/callback
```

9. Hosting-Env-Vars aktualisieren:

```text
NEXT_PUBLIC_APP_URL=https://maps.automate-x-solutions.de
GOOGLE_CLIENT_ID=<neue Web OAuth Client ID>
GOOGLE_CLIENT_SECRET=<passendes Secret>
```

10. Neu deployen.

Wichtig: Der Gmail-Scope ist sensibel/eingeschraenkt. Eine externe App kann ihn im Testing-Modus nur fuer eingetragene Test User nutzen. Fuer breite Produktion ist Google OAuth App Verification erforderlich.

## 6. Datenmodell

Es gibt keine Supabase-Migrationen im Repository. Das Datenmodell ergibt sich aktuell aus dem Code und `docs/DATA_MODELS.md`.

### 6.1 `organizations`

Wird bei Registrierung angelegt.

Felder laut Code:

```text
id
name
slug
```

### 6.2 `org_members`

Verknuepft Supabase-Nutzer mit Organisationen.

Felder laut Code:

```text
org_id
user_id
role
```

### 6.3 `stops`

Zentrale Tabelle fuer Termine/Stops.

Felder laut Code:

```text
id
org_id
name
address
lat
lng
time_from
time_to
status
notes
priority
scheduled_date
```

Statuswerte im Code:

```text
pending
in_progress
done
cancelled
```

### 6.4 `gmail_integrations`

Speichert OAuth-Tokens pro Organisation.

Felder laut Code:

```text
id
org_id
email_address
refresh_token
access_token
expires_at
last_synced_at
```

`upsert` erfolgt mit `onConflict: "org_id"`, daher sollte `org_id` eindeutig sein.

### 6.5 `email_queue`

Speichert analysierte Gmail-Nachrichten.

Felder laut Code:

```text
id
org_id
gmail_message_id
sender
subject
body_excerpt
received_at
ai_intent
ai_extracted
ai_confidence
status
created_stop_id
```

Statuswerte laut Code:

```text
pending
ignored
created
```

Empfehlung: Fuer `email_queue` sollte eine eindeutige Constraint auf `(org_id, gmail_message_id)` existieren.

## 7. Environment Variablen

### 7.1 `apps/maps`

Erforderlich:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

Optional:

```text
OPENROUTER_API_KEY
```

Lokale Beispiel-/Arbeitsdateien:

```text
apps/maps/.env.local.example
apps/maps/.env.local
```

`.env.local` ist durch `.gitignore` ausgeschlossen und darf nicht committed werden.

### 7.2 Prototypen

`prototypes/scherer/clickbot/runner.py` nutzt optional:

```text
N8N_WEBHOOK_URL
```

## 8. Deployment

### 8.1 Statische Website

Root-`vercel.json`:

- Output: `public`
- Clean URLs aktiviert
- Kein trailing slash

Im `README.md` ist als Production-Alias dokumentiert:

```text
https://automatex-six.vercel.app
```

### 8.2 Maps-App

`apps/maps/vercel.json`:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

`apps/maps/netlify.toml`:

- Build Command: `npm run build`
- Publish: `.next`
- Plugin: `@netlify/plugin-nextjs`
- `SECRETS_SCAN_OMIT_KEYS` fuer `NEXT_PUBLIC_*` Variablen.

Aktuelle Ziel-Domain aus der Gmail-Konfiguration:

```text
https://maps.automate-x-solutions.de
```

### 8.3 GitHub Actions

Workflow:

```text
.github/workflows/deploy.yml
```

Aktionen:

1. Checkout.
2. Vercel CLI installieren.
3. Vercel Environment ziehen.
4. Production Build.
5. Production Deploy.

Trigger:

```text
push auf main
push auf claude/ai-route-optimization-jEt8r
pull_request auf main
```

Secrets:

```text
VERCEL_TOKEN
OPENROUTER_API_KEY
```

Hinweis: Der Workflow arbeitet im Repo-Root. Wenn gezielt `apps/maps` deployed werden soll, muss die Vercel-Projektkonfiguration dazu passen oder der Workflow um ein Working Directory erweitert werden.

## 9. Prototypen

### 9.1 Scherer Clickbot

Pfad:

```text
prototypes/scherer/clickbot
```

Technologien:

- Python
- FastAPI
- Playwright
- SQLite

Zweck:

- Lokales Dashboard fuer Browser-Automationsruns.
- Amazon-Demo-Flow.
- Speicherung von Runs, Steps und Screenshots.
- Optionaler n8n-Webhook bei Fehlern.

Wichtige Dateien:

```text
main.py
runner.py
db.py
flows/amazon_flow.py
static/index.html
requirements.txt
start.bat
```

API-Endpunkte:

```text
POST /api/runs/start
GET  /api/runs
GET  /api/runs/{run_id}
GET  /api/stats
GET  /api/flows
GET  /
```

### 9.2 KI-Automatisierung Agent

Pfad:

```text
prototypes/scherer/KI-Automatisierung
```

Zweck:

- Lokale Weboberflaeche fuer Chat und Audio-Transkription.
- Relay zwischen Browser-UI und lokalem Agenten/CLI.

Wichtige Dateien:

```text
index.html
relay.py
start-automatisierungs-agent.bat
README.md
ANLEITUNG.md
```

Lokale URL laut README:

```text
http://127.0.0.1:18891
```

### 9.3 Claude/OpenClaw Agent-Prototyp

Pfad:

```text
prototypes/scherer/claude-agent
```

Zweck:

- Lokales Chat-/Agenten-Interface.
- Fallback-/Relay-Logik ueber Python.

Wichtige Dateien:

```text
index.html
relay.py
start.bat
```

## 10. Bestehende Dokumentation

Bereits vorhandene Doku:

```text
docs/ARCHITECTURE.md
docs/DATA_MODELS.md
docs/GMAIL_OAUTH_SETUP.md
docs/PRODUCT_STRATEGY.md
docs/SMOKE_TEST.md
docs/planning/TICKET_PLANNER.md
docs/planning/EPIC_EXECUTION_STATUS.md
```

Kurzinhalt:

- `ARCHITECTURE.md`: Demo-Architektur und MVP-Zielbild.
- `DATA_MODELS.md`: fachliche Ziel-Datenmodelle.
- `GMAIL_OAUTH_SETUP.md`: Gmail-OAuth-Setup fuer Demo/Origins.
- `PRODUCT_STRATEGY.md`: Zielsegmente, Nutzenversprechen, Interviewleitfaden.
- `SMOKE_TEST.md`: manuelle Smoke-Test-Checkliste.
- `planning/`: Ticket- und Epic-Planung.

Diese neue Datei fasst den technischen Ist-Stand des gesamten Repositories zusammen und ergaenzt die vorhandenen Spezialdokumente.

## 11. Sicherheit und Datenschutz

Wichtige Punkte:

- Gmail wird nur mit `gmail.readonly` verbunden.
- Client Secret liegt serverseitig in Environment Variablen.
- `NEXT_PUBLIC_*` Variablen duerfen im Frontend sichtbar sein.
- Gmail Access/Refresh Tokens werden aktuell in `gmail_integrations` gespeichert.
- E-Mail-Inhalte werden auf 500 Zeichen `body_excerpt` in `email_queue` gekuerzt.
- KI bekommt bis zu 4000 Zeichen Body fuer Parsing.
- Supabase Row Level Security sollte fuer alle mandantenbezogenen Tabellen aktiv sein.
- Realtime-Abos sollten nach `org_id` oder geeigneten Policies begrenzt sein.

Empfehlungen:

1. Tokens verschluesselt speichern oder ueber Supabase Vault/Provider-spezifische Secret-Mechanismen schuetzen.
2. RLS-Policies fuer `organizations`, `org_members`, `stops`, `gmail_integrations`, `email_queue` pruefen.
3. `email_queue.body_excerpt` und KI-Input datensparsam halten.
4. Logging ohne Tokens und ohne komplette E-Mail-Bodies.
5. Google OAuth Verification einplanen, wenn echte externe Nutzer Gmail verbinden sollen.

## 12. Bekannte technische Risiken

### 12.1 Keine DB-Migrationen im Repo

Es gibt keine versionierten SQL-Migrationen fuer Supabase. Das erschwert reproduzierbare Deployments und neue Umgebungen.

Empfehlung:

- `supabase/migrations` oder ein vergleichbares SQL-Verzeichnis anlegen.
- Tabellen, Indizes, Constraints und RLS-Policies versionieren.

### 12.2 Oeffentliche Routing-/Geocoding-Dienste

Nominatim und OSRM Public API sind fuer Demos gut, aber fuer Produktion nicht belastbar genug.

Empfehlung:

- Rate Limits beachten.
- Provider-Abstraktion einfuehren.
- Produktiv eigenen OSRM-Server oder bezahlten Anbieter verwenden.

### 12.3 Gmail OAuth Verification

Der Scope `gmail.readonly` kann eine Google-Verifizierung erfordern. Im Testing-Modus funktionieren nur eingetragene Test User.

Empfehlung:

- Google Cloud Projekt, Consent Screen und Client ID sauber dokumentieren.
- App-Name korrigieren, falls noch `clawy` angezeigt wird.
- Test User eintragen.
- Fuer Produktion Verification vorbereiten.

### 12.4 Token-Speicherung

Refresh Tokens werden in der Datenbank gespeichert.

Empfehlung:

- Verschluesselung und Zugriffspolicies pruefen.
- Token-Rotation und Disconnect-Flow erweitern.
- Beim Trennen optional Google Token revoken.

### 12.5 Clientseitige Datenbankzugriffe

Viele Seiten greifen direkt vom Client auf Supabase-Tabellen zu. Das ist mit korrekter RLS moeglich, aber ohne RLS riskant.

Empfehlung:

- RLS zwingend aktivieren.
- Kritische Mutationen perspektivisch ueber Server Actions/API-Routen kapseln.

### 12.6 UI-/Code-Qualitaet

In `apps/maps/app/dashboard/layout.tsx` ist ein Button in einem Button verschachtelt. Das ist semantisch unguenstig und kann zu unerwartetem Verhalten fuehren.

Empfehlung:

- Logout-Button-Markup bereinigen.

### 12.7 Build-/Lint-Pruefung lokal nicht erfolgt

In der aktuellen Shell war `npm` nicht verfuegbar. Daher wurde diese Dokumentation ohne lokalen Next.js-Build oder Lint erstellt.

## 13. Betrieb und manuelle Tests

### 13.1 Maps-App lokal starten

Wenn Node/NPM verfuegbar ist:

```bash
cd apps/maps
npm install
npm run dev
```

Danach:

```text
http://localhost:3001
```

### 13.2 Build

```bash
cd apps/maps
npm run build
```

### 13.3 Wichtige manuelle Tests

1. Registrierung anlegen.
2. Login testen.
3. Stop manuell anlegen.
4. Adresse geokodieren lassen.
5. Route optimieren.
6. Fahreransicht oeffnen und Status wechseln.
7. Excel-/CSV-Datei importieren.
8. Gmail verbinden.
9. Gmail synchronisieren.
10. KI-Inbox-Vorschlag uebernehmen.

## 14. Empfohlene naechste Schritte

Prioritaet 1:

- Google Cloud OAuth-Projekt bereinigen: App-Name, Client ID, Test User, Redirect URI und Deployment-Env abgleichen.
- Supabase-Schema und RLS-Policies als Migrationen ins Repo aufnehmen.
- Build/Deploy-Pfad fuer `apps/maps` eindeutig klaeren: Vercel oder Netlify, Root oder Subdirectory.

Prioritaet 2:

- Token-Speicherung haerten.
- Gmail Disconnect um Token-Revoke erweitern.
- Realtime-Subscription nach Organisation absichern.
- Routing/Geocoding-Provider abstrahieren.

Prioritaet 3:

- Smoke Tests automatisieren.
- Import-Fehlerreport verbessern.
- KI-Parsing mit strukturiertem JSON-Schema validieren.
- Audit-Log fuer automatisch vorgeschlagene und uebernommene Aktionen einfuehren.

## 15. Schnelle Fehlerdiagnose

### Gmail zeigt weiterhin `clawy`

Dann verwendet Google nicht den erwarteten Consent-Screen.

Pruefen:

```text
Google Fehlerdetails -> client_id
Hosting Env -> GOOGLE_CLIENT_ID
Google Cloud -> OAuth Consent Screen -> App name
Google Cloud -> APIs & Services -> Credentials -> Redirect URI
```

### `redirect_uri_mismatch`

Pruefen:

```text
NEXT_PUBLIC_APP_URL=https://maps.automate-x-solutions.de
Redirect URI=https://maps.automate-x-solutions.de/api/gmail/callback
OAuth Client Typ=Web application
```

### Gmail Sync meldet `not_connected`

Es gibt keinen `gmail_integrations`-Eintrag fuer die aktuelle `org_id`.

Loesung:

- In `/dashboard/settings` Gmail neu verbinden.

### Gmail Sync meldet `refresh_failed`

Refresh Token ist ungueltig, widerrufen oder gehoert nicht zum aktuellen Client.

Loesung:

- Integration in DB entfernen.
- Gmail-Verbindung neu aufbauen.

### Route zeigt Stops nicht an

Wahrscheinlich fehlen `lat`/`lng`.

Loesung:

- Adresse pruefen.
- Stop neu geokodieren lassen oder Koordinaten manuell korrigieren.

