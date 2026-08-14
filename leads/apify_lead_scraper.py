#!/usr/bin/env python3
"""Prepare, run, and collect a targeted German business scrape on Apify."""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


BASE_URL = "https://api.apify.com/v2"
ACTOR_ID = "pheidias0~google-maps-email-extractor"
PRICE_PER_RESULT_USD = 0.002
OUTPUT_DIR = Path(__file__).with_name("apify")

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
    "Bochum",
    "Wuppertal",
    "Bielefeld",
    "Bonn",
    "Münster",
    "Karlsruhe",
    "Mannheim",
    "Augsburg",
    "Wiesbaden",
    "Gelsenkirchen",
    "Aachen",
    "Mönchengladbach",
    "Braunschweig",
    "Kiel",
    "Magdeburg",
    "Freiburg im Breisgau",
    "Krefeld",
    "Lübeck",
    "Oberhausen",
    "Erfurt",
    "Mainz",
    "Rostock",
    "Kassel",
    "Hagen",
    "Saarbrücken",
    "Hamm",
    "Potsdam",
    "Ludwigshafen am Rhein",
    "Oldenburg",
    "Leverkusen",
    "Osnabrück",
    "Solingen",
    "Heidelberg",
    "Darmstadt",
    "Regensburg",
]

SEGMENTS = [
    "Sanitärinstallateur",
    "Heizungsinstallateur",
    "Elektriker",
    "Gebäudetechnik",
    "Kälte- und Klimatechnik",
    "Rohrreinigung",
    "Brandschutz",
    "Aufzugsservice",
    "Hausmeisterservice",
    "Solartechnik",
    "Schädlingsbekämpfung",
    "Sicherheitstechnik",
]

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
    "verkauf",
    "zentrale",
}

COMPANY_STOPWORDS = {
    "ag",
    "co",
    "gmbh",
    "kg",
    "mbh",
    "meisterbetrieb",
    "service",
    "technik",
    "und",
}

EMAIL_RE = re.compile(r"^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$", re.I)


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


def api_request(path: str, token: str, method: str = "GET", payload: dict | None = None) -> dict | list:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=60) as response:
            return json.load(response)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Apify API error {exc.code}: {body}") from exc


def make_actor_input(target: int) -> tuple[dict, int]:
    queries = [f"{segment} {city}" for city in CITIES for segment in SEGMENTS]
    per_search = min(120, max(5, math.ceil((target * 1.6) / len(queries))))
    actor_input = {
        "searchStringsArray": queries,
        "maxCrawledPlacesPerSearch": per_search,
        "placeMinimumStars": 0,
        "skipClosedPlaces": True,
        "scrapeEmails": True,
        "scrapePhones": True,
        "language": "de",
        "maxConcurrency": 5,
        "zoom": 0,
    }
    return actor_input, len(queries) * per_search


def get_budget(token: str) -> tuple[float, float]:
    response = api_request("/users/me/limits", token)
    data = response["data"]
    limit = float(data["limits"]["maxMonthlyUsageUsd"])
    current = float(data["current"]["monthlyUsageUsd"])
    return limit, max(0.0, limit - current)


def prepare(target: int, output: Path) -> None:
    actor_input, capacity = make_actor_input(target)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(actor_input, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(actor_input['searchStringsArray'])} queries to {output}")
    print(f"configured capacity before deduplication: {capacity} places")
    print(f"base Actor price for {target} results: ${target * PRICE_PER_RESULT_USD:.2f} plus platform usage")


def start(target: int, max_charge: float, token: str) -> None:
    limit, remaining = get_budget(token)
    if remaining < max_charge:
        raise SystemExit(
            f"Apify budget too low: ${remaining:.2f} remaining of ${limit:.2f}; "
            f"this run is capped at ${max_charge:.2f}. Increase the account limit first."
        )

    actor_input, capacity = make_actor_input(target)
    if capacity < target:
        raise SystemExit(f"Query capacity {capacity} is below target {target}.")

    query = urlencode(
        {
            "maxTotalChargeUsd": f"{max_charge:.2f}",
            "maxItems": target,
            "memory": 4096,
            "timeout": 86400,
        }
    )
    response = api_request(f"/actors/{ACTOR_ID}/runs?{query}", token, method="POST", payload=actor_input)
    run = response["data"]
    print(f"run_id={run['id']}")
    print(f"dataset_id={run['defaultDatasetId']}")
    print(f"status={run['status']}")


def clean_email(value: object) -> str:
    if not isinstance(value, str):
        return ""
    email = value.strip().lstrip("='\" ").rstrip("'\" ,;.").lower()
    return email if EMAIL_RE.fullmatch(email) else ""


def normalized_words(value: str) -> set[str]:
    ascii_like = (
        value.lower()
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )
    return {word for word in re.findall(r"[a-z0-9]+", ascii_like) if len(word) >= 3}


def classify_company_email(email: str, company: str) -> str:
    if not email:
        return "missing_or_invalid"
    local = email.split("@", 1)[0]
    local_words = normalized_words(local)
    if local in ROLE_PREFIXES or local_words & ROLE_PREFIXES:
        return "generic_role"
    company_words = normalized_words(company) - COMPANY_STOPWORDS
    if any(len(word) >= 4 and word in local.replace("-", "").replace("_", "") for word in company_words):
        return "company_named"
    return "non_generic_removed"


def fit_score(row: dict, email_status: str) -> int:
    text = f"{row.get('category', '')} {row.get('name', '')}".lower()
    score = 35
    if any(term in text for term in ("heizung", "sanitär", "klima", "gebäude", "elektr", "service")):
        score += 25
    elif any(term in text for term in ("rohr", "brand", "aufzug", "schädl", "sicherheit", "solar")):
        score += 18
    if email_status in {"generic_role", "company_named"}:
        score += 20
    if row.get("phone"):
        score += 8
    if row.get("website"):
        score += 7
    if float(row.get("rating") or 0) >= 4:
        score += 5
    return min(score, 100)


def normalize_rows(rows: list[dict], target: int) -> list[dict]:
    normalized: list[dict] = []
    seen: set[str] = set()
    for row in rows:
        company = str(row.get("name") or "").strip()
        dedupe_key = str(row.get("placeId") or f"{company}|{row.get('zip', '')}").lower()
        if not company or dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        email = clean_email(row.get("email"))
        email_status = classify_company_email(email, company)
        generic_email = email if email_status in {"generic_role", "company_named"} else ""
        normalized.append(
            {
                "company": company,
                "segment": row.get("category") or "",
                "fit_score": fit_score(row, email_status),
                "city": row.get("city") or "",
                "postcode": row.get("zip") or "",
                "address": row.get("address") or "",
                "website": row.get("website") or "",
                "generic_email": generic_email,
                "email_status": email_status,
                "phone_public": row.get("phone") or "",
                "rating": row.get("rating") or "",
                "reviews_count": row.get("reviewsCount") or "",
                "source": "Apify / Google Maps",
                "source_url": row.get("googleMapsUrl") or "",
                "place_id": row.get("placeId") or "",
            }
        )
    normalized.sort(key=lambda item: (-int(item["fit_score"]), item["company"].lower()))
    return normalized[:target]


def collect(run_id: str, target: int, token: str, output: Path) -> None:
    run_response = api_request(f"/actor-runs/{run_id}", token)
    run = run_response["data"]
    if run["status"] not in {"SUCCEEDED", "ABORTED", "FAILED", "TIMED-OUT"}:
        raise SystemExit(f"Run is still {run['status']}: {run.get('statusMessage', '')}")

    dataset_id = run["defaultDatasetId"]
    rows = api_request(f"/datasets/{dataset_id}/items?clean=true&format=json", token)
    if not isinstance(rows, list):
        raise SystemExit("Unexpected Apify dataset response.")
    leads = normalize_rows(rows, target)

    output.parent.mkdir(parents=True, exist_ok=True)
    fields = list(leads[0].keys()) if leads else ["company"]
    with output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(leads)

    contactable = sum(bool(lead.get("generic_email")) for lead in leads)
    print(f"run_status={run['status']}")
    print(f"raw_rows={len(rows)}")
    print(f"deduplicated_leads={len(leads)}")
    print(f"generic_company_emails={contactable}")
    print(f"output={output}")


def wait_for_run(run_id: str, target: int, token: str, output: Path) -> None:
    while True:
        response = api_request(f"/actor-runs/{run_id}?waitForFinish=30", token)
        run = response["data"]
        print(f"{run['status']}: {run.get('statusMessage', '')}")
        if run["status"] in {"SUCCEEDED", "ABORTED", "FAILED", "TIMED-OUT"}:
            collect(run_id, target, token, output)
            return
        time.sleep(5)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare_parser = subparsers.add_parser("prepare")
    prepare_parser.add_argument("--target", type=int, default=10_000)
    prepare_parser.add_argument("--output", type=Path, default=OUTPUT_DIR / "input_10000.json")

    start_parser = subparsers.add_parser("start")
    start_parser.add_argument("--target", type=int, default=10_000)
    start_parser.add_argument("--max-charge", type=float, default=25.0)

    collect_parser = subparsers.add_parser("collect")
    collect_parser.add_argument("--run-id", required=True)
    collect_parser.add_argument("--target", type=int, default=10_000)
    collect_parser.add_argument("--output", type=Path, default=OUTPUT_DIR / "automatex_leads_apify.csv")

    wait_parser = subparsers.add_parser("wait")
    wait_parser.add_argument("--run-id", required=True)
    wait_parser.add_argument("--target", type=int, default=10_000)
    wait_parser.add_argument("--output", type=Path, default=OUTPUT_DIR / "automatex_leads_apify.csv")
    return parser.parse_args()


def main() -> None:
    load_dotenv(Path(".env"))
    load_dotenv(Path("leads/.env"))
    args = parse_args()

    if args.command == "prepare":
        prepare(args.target, args.output)
        return

    token = os.environ.get("APIFY_API_TOKEN")
    if not token:
        raise SystemExit("APIFY_API_TOKEN must be set in leads/.env.")

    if args.command == "start":
        start(args.target, args.max_charge, token)
    elif args.command == "collect":
        collect(args.run_id, args.target, token, args.output)
    else:
        wait_for_run(args.run_id, args.target, token, args.output)


if __name__ == "__main__":
    main()
