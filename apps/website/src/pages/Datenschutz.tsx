import { site } from "../data/site";
import { LegalLayout, LegalSection } from "./LegalLayout";

export function Datenschutz() {
  return (
    <LegalLayout title="Datenschutz">
      <LegalSection title="1. Verantwortlicher">
        <p>
          {site.owner} — {site.name}
          <br />
          {site.street}, {site.city}
          <br />
          E-Mail:{" "}
          <a className="text-[#0a1b33] underline underline-offset-2" href={`mailto:${site.email}`}>
            {site.email}
          </a>
          <br />
          Telefon: {site.phone}
        </p>
      </LegalSection>

      <LegalSection title="2. Hosting und Server-Logfiles">
        <p>
          Diese Website wird über Vercel Inc. gehostet. Beim Aufruf der Seiten werden
          technisch notwendige Zugriffsdaten verarbeitet: IP-Adresse, Datum und Uhrzeit der
          Anfrage, angefragte URL, Referrer-URL, Browsertyp und -version sowie Betriebssystem.
          Die Verarbeitung erfolgt zur sicheren und stabilen Bereitstellung der Website auf
          Grundlage von Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="3. Cookies und Analyse">
        <p>
          Diese Website setzt keine Cookies zu Analyse- oder Marketingzwecken und bindet
          keine Tracking-Dienste ein. Es findet keine Profilbildung statt.
        </p>
      </LegalSection>

      <LegalSection title="4. Google Fonts">
        <p>
          Zur einheitlichen Darstellung der Schriftarten werden Schriften von Google Fonts
          (Google Ireland Limited) geladen. Dabei wird eine Verbindung zu Servern von Google
          aufgebaut und Ihre IP-Adresse an Google übermittelt. Eine Übermittlung in
          Drittländer kann nicht ausgeschlossen werden. Rechtsgrundlage ist unser
          berechtigtes Interesse an einer einheitlichen Darstellung gemäß
          Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="5. Externe Medien und Grafiken">
        <p>
          Auf der Startseite werden ein Hintergrundvideo über ein Content-Delivery-Network
          (Amazon CloudFront) sowie Hersteller-Logos über den Dienst svgl.app geladen. Beim
          Laden dieser Inhalte wird Ihre IP-Adresse an die jeweiligen Anbieter übermittelt.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="6. Kontaktaufnahme">
        <p>
          Wenn Sie uns per E-Mail, Telefon oder über LinkedIn kontaktieren, verarbeiten wir
          Ihre Angaben ausschließlich zur Bearbeitung Ihrer Anfrage sowie für den Fall von
          Anschlussfragen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
          (vorvertragliche Maßnahmen) beziehungsweise Art. 6 Abs. 1 lit. f DSGVO. Die Daten
          werden gelöscht, sobald sie für den Zweck nicht mehr erforderlich sind und keine
          gesetzlichen Aufbewahrungsfristen entgegenstehen.
        </p>
      </LegalSection>

      <LegalSection title="7. Links zu externen Diensten">
        <p>
          Diese Website enthält Links zu externen Angeboten, unter anderem zu LinkedIn
          (LinkedIn Ireland Unlimited Company) und zu den Websites der von uns eingesetzten
          Werkzeuge. Beim Anklicken gelten die Datenschutzbestimmungen des jeweiligen
          Anbieters. Eine Datenübertragung findet erst statt, wenn Sie den Link aktiv
          anklicken.
        </p>
      </LegalSection>

      <LegalSection title="8. Ihre Rechte">
        <p>
          Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO),
          Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO),
          Datenübertragbarkeit (Art. 20 DSGVO) sowie das Recht auf Widerspruch
          (Art. 21 DSGVO). Zur Ausübung genügt eine Nachricht an{" "}
          <a className="text-[#0a1b33] underline underline-offset-2" href={`mailto:${site.email}`}>
            {site.email}
          </a>
          .
        </p>
        <p>
          Ihnen steht zudem ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu.
          Zuständig ist die Landesbeauftragte für Datenschutz und Informationsfreiheit
          Nordrhein-Westfalen.
        </p>
      </LegalSection>

      <LegalSection title="9. Stand">
        <p>Stand dieser Datenschutzerklärung: August 2026.</p>
      </LegalSection>
    </LegalLayout>
  );
}
