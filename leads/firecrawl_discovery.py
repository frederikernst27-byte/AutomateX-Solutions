#!/usr/bin/env python3
"""Collect cost-capped German service-business search results with Firecrawl."""

from __future__ import annotations

import argparse
import csv
import json
import os
import time
from datetime import date
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


API_URL = "https://api.firecrawl.dev/v2/search"
CREDIT_URL = "https://api.firecrawl.dev/v2/team/credit-usage"
OUTPUT_DIR = Path(__file__).with_name("firecrawl")

CITIES = [
    "Berlin",
    "Hamburg",
    "München",
    "Köln",
    "Frankfurt am Main",
    "Stuttgart",
    "Düsseldorf",
    "Dortmund",
    "Essen",
    "Leipzig",
    "Bremen",
    "Dresden",
    "Hannover",
    "Nürnberg",
    "Duisburg",
]

SEARCH_GROUPS = [
    "(Sanitärinstallateur OR Heizungsinstallateur OR Kältetechnik)",
    "(Elektriker OR Gebäudetechnik OR Sicherheitstechnik OR Rohrreinigung)",
]

DIRECTORY_DOMAINS = {
    "11880.com",
    "arbeitsagentur.de",
    "ausbildungsmarkt.de",
    "ausbildungsstellen.de",
    "de.indeed.com",
    "de.jooble.org",
    "dasoertliche.de",
    "dastelefonbuch.de",
    "dein-heizungsbauer.de",
    "deine-heizungsmeister.de",
    "elektriker.org",
    "essener-branchenbuch.de",
    "facebook.com",
    "gelbeseiten.de",
    "glassdoor.de",
    "golocal.de",
    "goyellow.de",
    "gewusst-wo.de",
    "handwerker-suche.de",
    "heizungsbau.net",
    "instagram.com",
    "jobs.apleona.com",
    "jobtensor.com",
    "kimeta.de",
    "klimatechniker.net",
    "linkedin.com",
    "meinestadt.de",
    "mapquest.com",
    "my-hammer.de",
    "sanitaer-finden.de",
    "sanitaer.org",
    "stadtbranchenbuch.com",
    "stepstone.de",
    "trustlocal.de",
    "youtube.com",
    "wlw.de",
    "weshoplocal.de",
    "werkenntdenbesten.de",
    "yelp.de",
}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() not in os.environ:
            os.environ[key.strip()] = value.strip().strip("\"'")


def request_json(url: str, token: str, payload: dict | None = None) -> dict:
    request = Request(
        url,
        data=None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="GET" if payload is None else "POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=90) as response:
            return json.load(response)
    except HTTPError as exc:
        raise SystemExit(f"Firecrawl API error {exc.code}: {exc.read().decode('utf-8', errors='replace')}") from exc


def root_domain(url: str) -> str:
    hostname = urlparse(url).hostname or ""
    return hostname.lower().removeprefix("www.")


def query_plan() -> list[tuple[str, str]]:
    return [(city, f"{group} {city}") for city in CITIES for group in SEARCH_GROUPS]


def credit_balance(token: str) -> int:
    response = request_json(CREDIT_URL, token)
    return int(response["data"]["remainingCredits"])


def run(max_credits: int, output_prefix: Path, token: str, dry_run: bool) -> None:
    plan = query_plan()
    expected_credits = len(plan) * 20
    if dry_run:
        print(f"queries={len(plan)}")
        print(f"limit_per_query=100")
        print(f"expected_raw_capacity={len(plan) * 100}")
        print(f"expected_credits_about={expected_credits}")
        return

    remaining = credit_balance(token)
    if remaining < max_credits:
        raise SystemExit(f"Need at least {max_credits} credits for this capped run; only {remaining} remain.")

    raw_rows: list[dict[str, str]] = []
    credits_used = 0
    for index, (city, query) in enumerate(plan, start=1):
        if credits_used >= max_credits:
            print("credit cap reached; stopping before next query")
            break
        response = request_json(
            API_URL,
            token,
            {
                "query": query,
                "limit": 100,
                "country": "DE",
                "location": f"{city}, Deutschland",
                "ignoreInvalidURLs": True,
            },
        )
        used = int(response.get("creditsUsed") or 0)
        credits_used += used
        web_results = response.get("data", {}).get("web", [])
        for item in web_results:
            url = str(item.get("url") or "")
            domain = root_domain(url)
            raw_rows.append(
                {
                    "query": query,
                    "city": city,
                    "title": str(item.get("title") or ""),
                    "description": str(item.get("description") or ""),
                    "url": url,
                    "domain": domain,
                    "is_directory": "yes" if domain in DIRECTORY_DOMAINS else "no",
                }
            )
        print(f"{index}/{len(plan)}: {len(web_results)} results, {used} credits, total {credits_used}")
        time.sleep(0.5)

    output_prefix.parent.mkdir(parents=True, exist_ok=True)
    raw_path = output_prefix.with_name(f"{output_prefix.name}_raw.csv")
    unique_path = output_prefix.with_name(f"{output_prefix.name}_unique_domains.csv")
    fields = ["query", "city", "title", "description", "url", "domain", "is_directory"]
    with raw_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(raw_rows)

    unique: list[dict[str, str]] = []
    seen_domains: set[str] = set()
    for row in raw_rows:
        if not row["domain"] or row["is_directory"] == "yes" or row["domain"] in seen_domains:
            continue
        seen_domains.add(row["domain"])
        unique.append(row)
    with unique_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(unique)

    print(f"credits_used={credits_used}")
    print(f"raw_results={len(raw_rows)}")
    print(f"unique_non_directory_domains={len(unique)}")
    print(f"raw_output={raw_path}")
    print(f"unique_output={unique_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-credits", type=int, default=650)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--output-prefix",
        type=Path,
        default=OUTPUT_DIR / f"automatex_firecrawl_{date.today().isoformat()}_3000",
    )
    return parser.parse_args()


def main() -> None:
    load_dotenv(Path(".env"))
    load_dotenv(Path("leads/.env"))
    args = parse_args()
    token = os.environ.get("FIRECRAWL_API_KEY")
    if not token:
        raise SystemExit("FIRECRAWL_API_KEY must be set in leads/.env.")
    run(args.max_credits, args.output_prefix, token, args.dry_run)


if __name__ == "__main__":
    main()
