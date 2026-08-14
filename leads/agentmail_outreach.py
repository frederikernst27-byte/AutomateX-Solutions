#!/usr/bin/env python3
"""Prepare and optionally send low-volume AgentMail outreach from a lead CSV."""

from __future__ import annotations

import argparse
import csv
import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from textwrap import dedent


DEFAULT_LEADS = Path(__file__).with_name("automatex_leads_nrw_2026-07-10.csv")
DEFAULT_DRAFTS = Path(__file__).with_name(f"outreach_drafts_{date.today().isoformat()}.csv")
COMPANY_WEBSITE = "https://www.automate-x-solutions.de/"


@dataclass
class Lead:
    company: str
    segment: str
    fit_score: int
    city: str
    website: str
    email: str
    phone: str
    source_url: str


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value


def read_leads(path: Path, only_with_email: bool) -> list[Lead]:
    leads: list[Lead] = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            email = (row.get("generic_email") or "").strip()
            if only_with_email and not email:
                continue
            leads.append(
                Lead(
                    company=(row.get("company") or "").strip(),
                    segment=(row.get("segment") or "").strip(),
                    fit_score=int(row.get("fit_score") or 0),
                    city=(row.get("city") or "").strip(),
                    website=(row.get("website") or "").strip(),
                    email=email,
                    phone=(row.get("phone_public") or "").strip(),
                    source_url=(row.get("source_url") or "").strip(),
                )
            )
    return sorted(leads, key=lambda lead: (-lead.fit_score, lead.company.lower()))


def build_message(lead: Lead, sender_name: str) -> tuple[str, str]:
    subject = f"Kurze Frage zu Tourenplanung im {lead.segment}"
    text = dedent(
        f"""\
        Hallo liebes {lead.company}-Team,

        ich baue mit AutomateX gerade eine kleine Lösung für Service- und Handwerksbetriebe, die Tagesrouten nach Absagen, neuen Terminen oder Stau automatisch neu sortiert.

        Ich suche aktuell kein langes Verkaufsgespräch, sondern 15 Minuten ehrliches Feedback von Betrieben, die regelmäßig Kundendienst- oder Servicetermine koordinieren.

        Zwei Fragen wären für mich besonders spannend:
        1. Wie plant ihr aktuell eure Tagesrouten?
        2. Was passiert bei euch, wenn morgens oder unterwegs ein Termin wegfällt?

        Einen kurzen Einblick mit echten Produktansichten findet ihr hier:
        {COMPANY_WEBSITE}

        Falls das bei euch nicht passt, reicht ein kurzes "nein" völlig.

        Viele Grüße
        {sender_name}
        AutomateX Solutions
        """
    )
    return subject, text


def write_drafts(path: Path, leads: list[Lead], sender_name: str) -> None:
    fields = [
        "company",
        "to",
        "subject",
        "text",
        "segment",
        "fit_score",
        "city",
        "website",
        "phone_public",
        "source_url",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for lead in leads:
            subject, text = build_message(lead, sender_name)
            writer.writerow(
                {
                    "company": lead.company,
                    "to": lead.email,
                    "subject": subject,
                    "text": text,
                    "segment": lead.segment,
                    "fit_score": lead.fit_score,
                    "city": lead.city,
                    "website": lead.website,
                    "phone_public": lead.phone,
                    "source_url": lead.source_url,
                }
            )


def send_with_agentmail(leads: list[Lead], sender_name: str, dry_run: bool) -> None:
    if dry_run:
        return

    api_key = os.environ.get("AGENTMAIL_API_KEY")
    inbox_id = os.environ.get("AGENTMAIL_INBOX_ID")
    if not api_key:
        raise SystemExit("AGENTMAIL_API_KEY must be set before --send.")

    try:
        from agentmail import AgentMail
    except ImportError as exc:
        raise SystemExit("Install the SDK first: python3 -m pip install agentmail python-dotenv") from exc

    client = AgentMail(api_key=api_key)
    if not inbox_id:
        raise SystemExit("AGENTMAIL_INBOX_ID must be set before --send. Use --create-inbox first.")

    for lead in leads:
        if not lead.email:
            print(f"skip no email: {lead.company}")
            continue
        subject, text = build_message(lead, sender_name)
        sent = client.inboxes.messages.send(
            inbox_id=inbox_id,
            to=lead.email,
            subject=subject,
            text=text,
            labels=["automatex-outreach", "lead-interview"],
        )
        print(f"sent {lead.company}: {getattr(sent, 'message_id', 'message sent')}")


def create_agentmail_inbox(username: str, sender_name: str) -> str:
    api_key = os.environ.get("AGENTMAIL_API_KEY")
    if not api_key:
        raise SystemExit("AGENTMAIL_API_KEY must be set before --create-inbox.")

    try:
        from agentmail import AgentMail
        from agentmail.inboxes.types import CreateInboxRequest
    except ImportError as exc:
        raise SystemExit("Install the SDK first: python3 -m pip install agentmail python-dotenv") from exc

    client = AgentMail(api_key=api_key)
    inbox = client.inboxes.create(
        request=CreateInboxRequest(
            username=username,
            display_name=f"{sender_name} - AutomateX Solutions",
            metadata={"project": "automatex", "purpose": "lead-interviews"},
        )
    )
    inbox_id = getattr(inbox, "inbox_id", None) or getattr(inbox, "email", None) or str(inbox)
    print(f"created inbox: {inbox_id}")
    print("Add this to leads/.env:")
    print(f"AGENTMAIL_INBOX_ID={inbox_id}")
    return inbox_id


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--leads", type=Path, default=DEFAULT_LEADS)
    parser.add_argument("--drafts", type=Path, default=DEFAULT_DRAFTS)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--sender-name", default=os.environ.get("OUTREACH_SENDER_NAME", "Frederik"))
    parser.add_argument("--inbox-username", default="automatex-feedback")
    parser.add_argument("--create-inbox", action="store_true", help="Create an AgentMail inbox and print its inbox ID.")
    parser.add_argument("--only-with-email", action="store_true", default=True)
    parser.add_argument("--include-missing-email", action="store_true")
    parser.add_argument("--send", action="store_true", help="Actually send via AgentMail. Default only writes drafts.")
    return parser.parse_args()


def main() -> None:
    load_dotenv(Path(".env"))
    load_dotenv(Path("leads/.env"))
    args = parse_args()

    if args.create_inbox:
        create_agentmail_inbox(args.inbox_username, args.sender_name)
        return

    only_with_email = args.only_with_email and not args.include_missing_email
    leads = read_leads(args.leads, only_with_email=only_with_email)
    if args.limit > 0:
        leads = leads[: args.limit]

    write_drafts(args.drafts, leads, args.sender_name)
    print(f"wrote {len(leads)} draft rows to {args.drafts}")

    if args.send:
        send_with_agentmail(leads, args.sender_name, dry_run=False)
    else:
        print("preview mode only; add --send to send via AgentMail")


if __name__ == "__main__":
    main()
