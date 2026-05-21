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
https://automatex-six.vercel.app
https://automatex-frederikernst27-bytes-projects.vercel.app
```

Falls eine eigene Domain genutzt wird, muss sie ebenfalls exakt eingetragen werden, zum Beispiel:

```text
https://automate-x-solutions.de
```

Wichtig: Bei Google Identity Services wird fuer diese Demo die Origin verwendet, nicht der komplette Seitenpfad. Also ohne `/routenplanung-test.html` und ohne Slash am Ende eintragen.

## Fehler 400: redirect_uri_mismatch

Dieser Fehler bedeutet, dass die aktuelle Website-Origin nicht zum OAuth Client passt.

Checkliste:

1. In Google Cloud Console das richtige Projekt oeffnen.
2. APIs & Services -> Credentials -> OAuth 2.0 Client IDs.
3. Client-Typ muss `Web application` sein.
4. Unter `Authorized JavaScript origins` die aktuelle Origin exakt eintragen.
5. Fuer die Live-Demo mindestens eintragen:

```text
https://automatex-six.vercel.app
```

6. Speichern und 1-5 Minuten warten.
7. Demo neu laden und Gmail erneut verbinden.

Wenn weiterhin `redirect_uri_mismatch` erscheint, in den Google-Fehlerdetails die angezeigte `redirect_uri` kopieren und die Origin davon ebenfalls im OAuth Client erlauben.

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
