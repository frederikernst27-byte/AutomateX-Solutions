# AutomateX Route Platform

Neue, eigenständige Pilot-App für Wartungsbestand, Spezialisten-Zuweisung und dynamische Tagesrouten. Die App unter `apps/maps` bleibt unberührt und verwendet weder deren Datenbank noch deren Komponenten.

## Lokal starten

```bash
cd apps/route-platform
npm install
cp .env.example .env.local
npm run dev
```

Danach:

- Anmeldung: `http://localhost:3010/login`
- Admin nach Anmeldung: `http://localhost:3010/admin`
- Fahrer-PWA nach Anmeldung: `http://localhost:3010/driver`
- Health: `http://localhost:3010/api/health`

Der normale Startzustand ist leer. Es werden weder über den Client, den
In-Memory-Adapter noch `supabase/seed.sql` Beispielkunden, Fahrer, Aufträge,
Routen oder KPI-Werte angelegt. Frühere Browser-Demo-Caches werden ignoriert.

### API-Authentifizierung

Interne APIs akzeptieren keine anonymen Requests mehr. Für die lokale Demo wird
ein kurzlebiges, signiertes Demo-Cookie ausdrücklich ausgestellt:

```bash
curl -i -c /tmp/automatex.cookies \
  -H 'content-type: application/json' \
  -d '{"role":"admin"}' \
  http://localhost:3010/api/auth/demo

curl -b /tmp/automatex.cookies http://localhost:3010/api/state
```

Für einen Fahrer muss zusätzlich eine gültige Demo-ID übergeben werden:
`{"role":"driver","driverId":"drv-anna"}`. Der zurückgegebene
`sessionToken` kann alternativ als `Authorization: Bearer …` oder
`X-AutomateX-Session` verwendet werden. Der Demo-Issuer ist im
Produktionsmodus deaktiviert. Dort wird ausschließlich ein Supabase-Access-
Token akzeptiert; `AUTH_SECRET` bzw. `DEMO_AUTH_SECRET` müssen in geteilten
Entwicklungsumgebungen gesetzt werden.

Ohne externe Schlüssel bleibt der betriebliche Datenbestand leer. Ein lokaler,
signierter Testzugang legt keine Daten an. Synthetische Fixtures werden nur
innerhalb automatisierter Tests geladen.

### Pilot-Preflight und Production-Gate

Alle aktuellen API-Endpunkte nutzen bewusst den flüchtigen, synthetischen
In-Memory-Adapter. Ein normaler Production-Build sperrt diese Endpunkte deshalb
mit `PILOT_BACKEND_BLOCKED`, statt Demo-Daten als persistentes
Mandanten-Backend auszugeben. Den aktuellen Status zeigt `GET /api/health`.

Nur für eine kontrollierte Präsentations-URL kann der Adapter ausdrücklich
freigegeben werden: `NEXT_PUBLIC_DEMO_MODE=true`,
`PILOT_DEMO_BACKEND_ENABLED=true`,
`PILOT_DEMO_ACKNOWLEDGEMENT=SYNTHETIC_DEMO_ONLY` und ein zufälliges, mindestens
32 Zeichen langes `DEMO_AUTH_SECRET`. Dieser Modus bleibt als
`acknowledged-pilot-demo`, `persistent: false` und `productionReady: false`
gekennzeichnet. Echte Kunden- oder Standortdaten dürfen dort nicht importiert
werden.

Nur für isolierte Lasttests lässt sich ein synthetischer NRW-Datensatz manuell erzeugen:

```bash
npm run demo:generate
```

Die CSV wird unter `demo-output/automatex-3000-nrw-adressen.csv` abgelegt und enthält ausschließlich erfundene Kontaktdaten. Jede der 3.000 Adresszeilen hat eine eigene Anschrift, damit der Dublettencheck im Importtest nicht durch künstliche Wiederholungen verfälscht wird.

## Supabase

1. Eigenes Supabase-Projekt in einer EU-Region anlegen.
2. Alle Dateien aus `supabase/migrations/` in Reihenfolge ausführen. `0007_test_drivers.sql` ergänzt Fahrer ohne Login und Einladung; `0009_planning_drafts_and_test_data.sql` ergänzt persistente Entwürfe und sicher löschbare Testdaten.
3. `NEXT_PUBLIC_SUPABASE_*` und `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` setzen.
4. Auth-Einladungen für Admins/Fahrer aktivieren; Kunden nutzen ausschließlich gehashte Portal-Tokens.
5. `SUPABASE_DATA_BACKEND_READY=true` erst setzen, wenn die produktiven Repository-Adapter
   (inklusive Routen, Aufträge, Reports und Audit-Events) gegen dieses Projekt geprüft sind.
   Bis dahin verweigert die API echte Supabase-User mit HTTP 503, statt versehentlich den
   flüchtigen Demo-Speicher auszuliefern.

## Karten & Geocoding (OpenStreetMap)

- Die Live-, Planungs- und Übersichtskarten rendern echte **OpenStreetMap**-Kacheln über Leaflet (`components/live-map.tsx`). Kein API-Key nötig. Stopps und Fahrer werden als Marker dargestellt, Touren als Routenlinien.
- Routengeometrie folgt echten Straßen über den öffentlichen **OSRM**-Router; bei Nichterreichbarkeit fällt die Linie automatisch auf eine direkte Verbindung zurück.
- Adressen aus Import und „Kunde anlegen“ werden serverseitig über **Nominatim** geokodiert (`lib/geocode.ts`, Endpoint `POST /api/geocode`, admin-gated). Die Nominatim-Nutzungsregeln (identifizierender User-Agent, max. 1 Anfrage/Sekunde) werden eingehalten; nicht auflösbare Adressen behalten eine deterministische NRW-Fallback-Position.
- Der Worker-Job `geocode` nutzt denselben Nominatim-Adapter.
- Hinweis zu Fair-Use: Die öffentlichen OSM-Tile-/OSRM-/Nominatim-Server eignen sich für Pilot/Demo. Für Produktion mit Last sollten eigene bzw. gehostete Tiles, ein eigener OSRM-Server und ein eigener Nominatim-Endpoint (oder ein kommerzieller Anbieter) konfiguriert werden.

## VROOM-Routenoptimierung

Automatische Planung wird über einen eigenen VROOM/vroom-express-Dienst
berechnet. Die App erzeugt keine lokale Ersatzroute, wenn der Solver fehlt oder
nicht erreichbar ist. Konfiguration:

```env
VROOM_URL=http://localhost:3000
VROOM_TIMEOUT_MS=30000
VROOM_API_KEY=
```

VROOM erhält pro Planungslauf echte Aufträge als `jobs` und jeden verfügbaren
Fahrer-Tag als `vehicle`. Abgebildet werden:

- Depot und Rückkehr zum Depot
- Fahrer-Skills und benötigte Fachgebiete
- Schichten und Kundenzeitfenster
- Servicezeiten, Prioritäten und Fälligkeiten
- maximale Stopps, Fahrzeit und Routendauer
- feste Termine, Fahrerzuweisungen und Abwesenheiten

Der HTTP-Dienst kann mit dem offiziellen Image
`ghcr.io/vroom-project/vroom-docker:v1.15.0` betrieben werden. Zusätzlich ist
ein eigener OSRM-, Valhalla- oder OpenRouteService-Routingserver erforderlich.
Für echte Kundenstandorte darf nicht der öffentliche VROOM-Demoserver verwendet
werden. Der Dienst gehört in dasselbe private Netz wie die App; bei einem
externen Reverse Proxy kann `VROOM_API_KEY` als Bearer-Token gesetzt werden.

## E-Mail / KI

- Resend wird für echte E-Mails konfiguriert. Ohne Key landen Nachrichten in der Demo-Outbox.
- Text-KI folgt dem OpenAI-kompatiblen `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`-Vertrag; ohne Key werden sichere deterministische Demo-Antworten verwendet.
- Navigation auf dem Fahrergerät nutzt bewusst Google-Maps-URLs (Deep-Link in die Navi-App); dafür ist kein Google-Key erforderlich.

### Gmail-KI-Inbox

1. In Google Cloud die Gmail API aktivieren und einen OAuth-Client vom Typ
   „Webanwendung“ anlegen.
2. Als autorisierte Redirect-URI
   `https://<app-domain>/api/integrations/gmail/callback` eintragen.
3. `supabase/migrations/0004_gmail_inbox.sql` anwenden.
4. `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`,
   `AI_API_KEY` und `AI_MODEL` konfigurieren.
5. Den Worker dauerhaft ausführen (`npm run worker`). Er synchronisiert das
   verbundene Postfach standardmäßig alle fünf Minuten.

Die Integration fordert ausschließlich lesenden Gmail-Zugriff an. Refresh-
Tokens werden vor dem Speichern mit AES-256-GCM verschlüsselt. Neue Inbox-
Nachrichten der letzten konfigurierten Tage werden dedupliziert, von der echten
KI klassifiziert und als Vorschlag gespeichert. Ohne erreichbares Modell wird
keine lokale Ersatzentscheidung erzeugt. Auftragsänderungen erfolgen erst nach
der Bestätigung eines Administrators und werden auditiert.

## Verbleibende Schritte bis Produktion

Diese Punkte brauchen echte Zugangsdaten/Infrastruktur und liegen bewusst außerhalb der App-Logik:

1. **Supabase-Projekt** in EU-Region anlegen, `supabase/migrations/*.sql` einspielen, `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` setzen und die Repository-Adapter gegen das Projekt prüfen, bevor `SUPABASE_DATA_BACKEND_READY=true` gesetzt wird. Bis dahin nutzen die APIs den flüchtigen In-Memory-Adapter.
2. **Auth** produktiv gegen echte Supabase-Access-Token testen (aktuell nur Demo-Cookie außerhalb Produktion).
3. **Resend-Key** + `EMAIL_WEBHOOK_SECRET` setzen, damit E-Mail-Versand und die signierte Eingangs-Webhook-Prüfung aktiv sind (ohne Secret nur unsignierter Demo-Pfad).
4. **AI-Key** (`AI_API_KEY`) für echte KI-Antworten statt Demo-Fallback.
5. Optional für Kartenlast: eigene OSM-Tiles/OSRM/Nominatim (siehe oben).

## Qualität

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Die Pilot-APIs liegen unter `/api/imports`, `/api/plans`, `/api/routes`, `/api/driver`, `/api/portal` und `/api/geocode`. Mutationen unterstützen einen `Idempotency-Key`; manuelle Routenänderungen erwarten zusätzlich eine Versionsnummer und liefern bei Konflikten HTTP 409.
