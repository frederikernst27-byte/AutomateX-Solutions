import { site } from "../data/site";
import { LegalLayout, LegalSection } from "./LegalLayout";

export function Impressum() {
  return (
    <LegalLayout title="Impressum">
      <LegalSection title="Angaben gemäß § 5 DDG">
        <p>
          <strong className="font-semibold text-[#0a1b33]">{site.owner}</strong>
          <br />
          {site.name}
          <br />
          {site.street}
          <br />
          {site.city}
          <br />
          {site.country}
        </p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>
          E-Mail:{" "}
          <a className="text-[#0a1b33] underline underline-offset-2" href={`mailto:${site.email}`}>
            {site.email}
          </a>
          <br />
          Telefon:{" "}
          <a className="text-[#0a1b33] underline underline-offset-2" href={site.phoneHref}>
            {site.phone}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Umsatzsteuer">
        <p>
          Es besteht keine Umsatzsteuer-Identifikationsnummer. Als Kleinunternehmer im Sinne
          von § 19 UStG wird keine Umsatzsteuer ausgewiesen.
        </p>
      </LegalSection>

      <LegalSection title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p>
          {site.owner}
          <br />
          {site.street}
          <br />
          {site.city}
        </p>
      </LegalSection>

      <LegalSection title="Streitbeilegung">
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit.
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </LegalSection>

      <LegalSection title="Haftung für Inhalte und Links">
        <p>
          Die Inhalte dieser Seiten wurden mit Sorgfalt erstellt. Für die Richtigkeit,
          Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr
          übernehmen. Für die Inhalte verlinkter externer Seiten ist stets der jeweilige
          Anbieter verantwortlich; zum Zeitpunkt der Verlinkung waren keine
          Rechtsverstöße erkennbar.
        </p>
      </LegalSection>

      <LegalSection title="Marken und Logos Dritter">
        <p>
          Auf dieser Website werden Namen und Logos von Software-Herstellern und Plattformen
          gezeigt, mit deren Produkten wir arbeiten. Alle Marken- und Bildrechte liegen bei
          den jeweiligen Inhabern. Die Darstellung dient ausschließlich der Beschreibung der
          eingesetzten Werkzeuge und begründet keine Partnerschaft oder Empfehlung durch die
          genannten Unternehmen.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
