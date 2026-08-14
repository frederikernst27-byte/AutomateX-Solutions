# AutomateX Solutions

Dieses Repository ist nach Arbeitsbereichen sortiert:

- `apps/website/` - Hauptwebsite (React, TypeScript, Vite, Tailwind v4, Motion); wird deployt
- `public/` - fruehere statische Website; nicht mehr Teil des Deployments
- `assets/` - Dokumente, Audio-Dateien und Archive
- `docs/` - Architektur, Setup, Tests und Planungsunterlagen
- `examples/` - Beispieldaten
- `clients/` - kundenbezogene Arbeitsbereiche; derzeit die Scherer-Gruppe
- `leads/` - Lead-Recherche, Outreach-Entwürfe und Scraper
- `scripts/` - wiederverwendbare Hilfsskripte
- `output/` - erzeugte Ergebnisse, etwa PDF-Bundles
- `archive/legacy-static-site/` - frühere Root-Website, nicht Teil des Deployments
- `tools/` - lokale Benachrichtigungs- und Systemhilfen

## Hauptwebsite (`apps/website`)

```bash
cd apps/website
npm install
npm run dev      # lokaler Dev-Server
npm run build    # Typecheck + Production-Build nach dist/
```

Routen aus der React-App: `/` (Startseite), `/impressum`, `/datenschutz`.

Zusaetzlich liegen in `apps/website/public/` uebernommene Seiten der alten
Website, die als statische Dateien weiter ausgeliefert werden, damit ihre URLs
nicht brechen: `/routenplanung`, `/routenplanung-test`, `/general` und
`/email-postfach`. Ihre internen Links zeigen bereits auf die neuen Routen.

## Deployment

Das Root-`vercel.json` baut und deployt `apps/website`; `public/` wird nicht
mehr ausgeliefert. Build:

```text
installCommand   cd apps/website && npm install
buildCommand     cd apps/website && npm run build
outputDirectory  apps/website/dist
```

Alternativ laesst sich im Vercel-Projekt das Root Directory auf `apps/website`
setzen; dann greift `apps/website/vercel.json` und das Root-`vercel.json` wird
ignoriert. Beide Dateien enthalten dieselben Rewrites.

Live: `https://automatex.vercel.app`. Der frueher dokumentierte Alias
`https://automatex-six.vercel.app` antwortet mit 404.
