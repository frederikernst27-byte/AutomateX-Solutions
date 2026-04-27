# Gmail OAuth Setup

Stand: 2026-04-27

## Warum OAuth nötig ist

Ein Google API-Key reicht für öffentliche Google APIs. Gmail enthält private Nutzerdaten, deshalb braucht die Web-App OAuth und die Zustimmung des Nutzers.

Benötigter Scope:

```text
https://www.googleapis.com/auth/gmail.readonly
```

Der Scope ist absichtlich nur lesend. Die Demo soll keine Mails senden, löschen oder verändern.

## Google Cloud Schritte

1. Google Cloud Console öffnen.
2. Projekt erstellen oder bestehendes Projekt wählen.
3. Gmail API aktivieren.
4. OAuth Consent Screen konfigurieren.
5. OAuth Client ID erstellen.
6. Anwendungstyp: Web application.
7. Authorized JavaScript origins ergänzen.

Lokale Origins:

```text
http://localhost:8090
http://127.0.0.1:8090
http://localhost:8080
http://127.0.0.1:8080
```

Vercel Origin nach Deployment:

```text
https://<deine-vercel-domain>
```

## Demo-Nutzung

1. `public/routenplanung-test.html` oeffnen.
2. Gmail-Schnittstelle ausklappen.
3. OAuth Client ID eintragen.
4. Gmail verbinden.
5. Fahrt starten.
6. Ab Fahrtstart prüft die Demo neue Mails im gewählten Suchbereich.
7. Erkannte Absage-Mails erzeugen automatisch eine Routenänderung.

## Suchbereiche

- Posteingang + gesendet: `newer_than:1d`
- Nur Posteingang: `in:inbox newer_than:1d`
- Nur gesendet: `in:sent newer_than:1d`

## Sicherheitsnotizen

- OAuth Client ID darf im Frontend stehen.
- Client Secret darf niemals ins Frontend.
- Gemini API-Key ist in der aktuellen Demo nur lokal im Browser gespeichert und darf nicht produktiv genutzt werden.
- Für MVP muss Gemini über ein Backend/Vercel Function laufen.
- Gmail-Inhalte dürfen nur zweckgebunden und minimal verarbeitet werden.
