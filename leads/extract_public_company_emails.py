#!/usr/bin/env python3
"""Extract public generic company emails from a list of company websites."""

from __future__ import annotations

import argparse
import csv
import html
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "leads" / "firecrawl" / "automatex_firecrawl_2026-07-10_3000_company_domains.csv"
DEFAULT_OUTPUT = ROOT / "leads" / "firecrawl" / "automatex_firecrawl_2026-07-10_public_generic_emails.csv"
EMAIL_RE = re.compile(r"[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
ROLE_PREFIXES = {
    "anfrage",
    "buero",
    "disposition",
    "hallo",
    "heizung",
    "info",
    "kontakt",
    "kundendienst",
    "mail",
    "office",
    "service",
    "team",
    "technik",
    "verkauf",
    "zentrale",
}
CONTACT_TERMS = ("kontakt", "contact", "impressum", "imprint", "ueber-uns", "uber-uns", "about")
USER_AGENT = "AutomateXResearch/1.0 (+https://www.automate-x-solutions.de/)"
WRITE_LOCK = threading.Lock()


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        for key, value in attrs:
            if key.lower() == "href" and value:
                self.links.append(value)


def clean_email(value: str) -> str:
    return html.unescape(value).strip(" <>.,;:'\"()[]{}\n\t").lower()


def is_generic_email(email: str) -> bool:
    local = email.split("@", 1)[0].lower()
    parts = re.split(r"[._+\-]", local)
    return local in ROLE_PREFIXES or bool(set(parts) & ROLE_PREFIXES)


def fetch(url: str) -> tuple[str, str]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(request, timeout=8) as response:
        content_type = response.headers.get_content_type()
        if content_type not in {"text/html", "application/xhtml+xml"}:
            return "", response.geturl()
        body = response.read(1_500_000).decode(response.headers.get_content_charset() or "utf-8", errors="replace")
        return body, response.geturl()


def contact_pages(homepage: str, content: str) -> list[str]:
    collector = LinkCollector()
    collector.feed(content)
    hostname = urlparse(homepage).hostname
    pages: list[str] = []
    for href in collector.links:
        absolute = urljoin(homepage, href)
        parsed = urlparse(absolute)
        if parsed.scheme not in {"http", "https"} or parsed.hostname != hostname:
            continue
        normalized = absolute.split("#", 1)[0]
        if any(term in normalized.lower() for term in CONTACT_TERMS) and normalized not in pages:
            pages.append(normalized)
        if len(pages) == 2:
            break
    return pages


def extract_generic_emails(content: str) -> list[str]:
    emails = {clean_email(match.group(0)) for match in EMAIL_RE.finditer(html.unescape(content))}
    return sorted(email for email in emails if EMAIL_RE.fullmatch(email) and is_generic_email(email))


def process(row: dict[str, str]) -> dict[str, str]:
    original_url = row.get("url", "")
    result = {
        "company_candidate": row.get("title", ""),
        "city": row.get("city", ""),
        "query": row.get("query", ""),
        "website": original_url,
        "domain": row.get("domain", ""),
        "generic_email": "",
        "scanned_urls": "",
        "status": "",
    }
    if not original_url:
        result["status"] = "missing_url"
        return result

    scanned: list[str] = []
    try:
        homepage_content, homepage_url = fetch(original_url)
        scanned.append(homepage_url)
        emails = set(extract_generic_emails(homepage_content))
        for page in contact_pages(homepage_url, homepage_content):
            try:
                content, resolved_url = fetch(page)
                scanned.append(resolved_url)
                emails.update(extract_generic_emails(content))
            except Exception:
                continue
        result["generic_email"] = "; ".join(sorted(emails))
        result["status"] = "found" if emails else "no_generic_email"
    except Exception as exc:
        result["status"] = f"fetch_error:{type(exc).__name__}"
    result["scanned_urls"] = " | ".join(scanned)
    return result


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def completed_domains(path: Path) -> set[str]:
    if not path.exists():
        return set()
    with path.open(encoding="utf-8", newline="") as file:
        return {row.get("domain", "") for row in csv.DictReader(file) if row.get("domain")}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = read_rows(args.input)
    done = completed_domains(args.output)
    pending = [row for row in rows if row.get("domain") not in done]
    if args.limit > 0:
        pending = pending[: args.limit]

    fields = ["company_candidate", "city", "query", "website", "domain", "generic_email", "scanned_urls", "status"]
    new_file = not args.output.exists()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("a", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        if new_file:
            writer.writeheader()
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = [executor.submit(process, row) for row in pending]
            for index, future in enumerate(as_completed(futures), start=1):
                result = future.result()
                with WRITE_LOCK:
                    writer.writerow(result)
                    file.flush()
                print(f"{index}/{len(pending)} {result['domain']} {result['status']}", flush=True)


if __name__ == "__main__":
    main()
