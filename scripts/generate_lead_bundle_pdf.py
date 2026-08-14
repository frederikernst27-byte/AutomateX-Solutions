#!/usr/bin/env python3
"""Create a printable bundle of all local lead tables and outreach drafts."""

from __future__ import annotations

import csv
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import urlparse

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / f"automatex_leads_outreach_bundle_{date.today().isoformat()}.pdf"
SOURCES = {
    "NRW-Leads (OpenStreetMap/Nominatim)": ROOT / "leads" / "automatex_leads_nrw_2026-07-10.csv",
    "Apify-Testleads (Essen)": ROOT / "leads" / "apify" / "sample_essen_2026-07-10.csv",
    "Outreach-Entwürfe": ROOT / "leads" / "outreach_drafts_2026-07-10.csv",
    "Beispiel-Tagesliste": ROOT / "examples" / "tagesliste.csv",
}

NAVY = colors.HexColor("#142A3D")
TEAL = colors.HexColor("#087E8B")
INK = colors.HexColor("#1D2935")
MUTED = colors.HexColor("#607080")
LIGHT = colors.HexColor("#EAF1F4")
PALE = colors.HexColor("#F7FAFB")
LINE = colors.HexColor("#C8D4DA")


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def display_name(url: str) -> str:
    host = urlparse(url).netloc.removeprefix("www.")
    return host or url


def on_page(canvas, doc) -> None:
    canvas.saveState()
    width, height = landscape(A4)
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, 10 * mm, width - doc.rightMargin, 10 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 6 * mm, "AutomateX Solutions - Lead- und Outreach-Bundle")
    canvas.drawRightString(width - doc.rightMargin, 6 * mm, f"Seite {doc.page}")
    canvas.restoreState()


def paragraph(text: object, style: ParagraphStyle) -> Paragraph:
    value = str(text or "-")
    return Paragraph(escape(value).replace("\n", "<br/>"), style)


def table(data: list[list[object]], widths: list[float], header: bool = False) -> Table:
    rendered = [[cell if isinstance(cell, Paragraph) else paragraph(cell, STYLES["cell"]) for cell in row] for row in data]
    result = Table(rendered, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        )
    result.setStyle(TableStyle(commands))
    return result


def section_title(title: str, subtitle: str | None = None) -> list[object]:
    items: list[object] = [Paragraph(title, STYLES["h1"])]
    if subtitle:
        items.append(Paragraph(subtitle, STYLES["subtitle"]))
    items.append(Spacer(1, 4 * mm))
    return items


def overview_table(
    rows: list[dict[str, str]],
    columns: list[tuple[str, str]],
    limit: int | None = None,
    fractions: list[float] | None = None,
) -> Table:
    shown = rows if limit is None else rows[:limit]
    data: list[list[object]] = [[Paragraph(label, STYLES["header"]) for label, _ in columns]]
    for row in shown:
        cells: list[object] = []
        for _, key in columns:
            value = row.get(key, "")
            if key in {"website", "source_url"} and value:
                value = display_name(value)
            cells.append(paragraph(value, STYLES["cell"]))
        data.append(cells)
    available = landscape(A4)[0] - 24 * mm
    default_fractions = [0.24, 0.15, 0.06, 0.10, 0.15, 0.13, 0.17][: len(columns)]
    widths = [available * fraction for fraction in (fractions or default_fractions)]
    return table(data, widths, header=True)


def record_cards(rows: list[dict[str, str]], section: str, fields: list[tuple[str, str]]) -> list[object]:
    story: list[object] = []
    story.extend(section_title(f"Vollständige Datensätze: {section}", f"{len(rows)} Einträge - alle CSV-Spalten enthalten"))
    for index, row in enumerate(rows, start=1):
        title_value = row.get("company") or row.get("name") or f"Eintrag {index}"
        card_data: list[list[object]] = [[Paragraph(f"{index:02d}. {escape(title_value)}", STYLES["card_title"]), "", "", ""]]
        for offset in range(0, len(fields), 2):
            left_label, left_key = fields[offset]
            left_value = row.get(left_key, "")
            right_label, right_key = fields[offset + 1] if offset + 1 < len(fields) else ("", "")
            right_value = row.get(right_key, "")
            card_data.append(
                [
                    paragraph(left_label, STYLES["label"]),
                    paragraph(left_value, STYLES["value"]),
                    paragraph(right_label, STYLES["label"]),
                    paragraph(right_value, STYLES["value"]),
                ]
            )
        card = Table(card_data, colWidths=[25 * mm, 103 * mm, 25 * mm, 103 * mm], hAlign="LEFT")
        card.setStyle(
            TableStyle(
                [
                    ("SPAN", (0, 0), (-1, 0)),
                    ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
                    ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("BACKGROUND", (0, 1), (0, -1), PALE),
                    ("BACKGROUND", (2, 1), (2, -1), PALE),
                ]
            )
        )
        story.append(KeepTogether([card, Spacer(1, 4 * mm)]))
    return story


styles = getSampleStyleSheet()
STYLES = {
    "cover": ParagraphStyle("cover", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=30, leading=35, textColor=NAVY, alignment=TA_LEFT),
    "cover_sub": ParagraphStyle("cover_sub", parent=styles["Normal"], fontSize=14, leading=20, textColor=TEAL),
    "h1": ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=NAVY, spaceAfter=2),
    "subtitle": ParagraphStyle("subtitle", parent=styles["Normal"], fontSize=9.5, leading=13, textColor=MUTED),
    "header": ParagraphStyle("header", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.2, leading=8.5, textColor=colors.white),
    "cell": ParagraphStyle("cell", parent=styles["Normal"], fontSize=6.8, leading=8.2, textColor=INK, wordWrap="CJK"),
    "label": ParagraphStyle("label", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=6.7, leading=8.2, textColor=MUTED),
    "value": ParagraphStyle("value", parent=styles["Normal"], fontSize=6.7, leading=8.2, textColor=INK, wordWrap="CJK"),
    "card_title": ParagraphStyle("card_title", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=10.5, textColor=NAVY),
    "email_subject": ParagraphStyle("email_subject", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=NAVY),
    "email_meta": ParagraphStyle("email_meta", parent=styles["Normal"], fontSize=8.5, leading=11, textColor=MUTED),
    "email_body": ParagraphStyle("email_body", parent=styles["Normal"], fontSize=9.3, leading=14, textColor=INK),
}


def main() -> None:
    data = {name: read_csv(path) for name, path in SOURCES.items()}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=14 * mm,
        bottomMargin=15 * mm,
        title="AutomateX Lead- und Outreach-Bundle",
        author="AutomateX Solutions",
    )
    story: list[object] = []

    story.extend([Spacer(1, 38 * mm), Paragraph("AutomateX Solutions", STYLES["cover"]), Spacer(1, 4 * mm), Paragraph("Lead-Listen, Datenquellen und Outreach-Entwürfe", STYLES["cover_sub"]), Spacer(1, 15 * mm)])
    summary_data = [
        [Paragraph("Inhalt", STYLES["header"]), Paragraph("Einträge", STYLES["header"]), Paragraph("Quelle", STYLES["header"])],
        ["NRW-Leads", str(len(data["NRW-Leads (OpenStreetMap/Nominatim)"])), "OpenStreetMap / Nominatim"],
        ["Apify-Testleads", str(len(data["Apify-Testleads (Essen)"])), "Google Maps / Website-Kontakte"],
        ["Outreach-Entwürfe", str(len(data["Outreach-Entwürfe"])), "AgentMail-Vorlage"],
        ["Beispiel-Tagesliste", str(len(data["Beispiel-Tagesliste"])), "CSV-Quelle"],
    ]
    story.append(table(summary_data, [90 * mm, 35 * mm, 120 * mm], header=True))
    story.extend([Spacer(1, 8 * mm), Paragraph(f"Erstellt am {date.today().isoformat()}. Dieses Dokument fasst alle aktuell vorhandenen Tabellen und Outreach-Texte zusammen. Es versendet keine Nachrichten.", STYLES["subtitle"]), PageBreak()])

    daily_rows = data["Beispiel-Tagesliste"]
    story.extend(section_title("Beispiel-Tagesliste", f"{len(daily_rows)} Einträge aus examples/tagesliste.csv"))
    daily_columns = [("Name", "name"), ("Adresse", "address"), ("Start", "windowStart"), ("Ende", "windowEnd"), ("Service", "service"), ("Priorität", "priority")]
    daily_data = [[Paragraph(label, STYLES["header"]) for label, _ in daily_columns]] + [[paragraph(row.get(key, ""), STYLES["cell"]) for _, key in daily_columns] for row in daily_rows]
    story.append(table(daily_data, [75 * mm, 75 * mm, 30 * mm, 30 * mm, 33 * mm, 25 * mm], header=True))
    story.append(PageBreak())

    nrw_rows = data["NRW-Leads (OpenStreetMap/Nominatim)"]
    story.extend(section_title("NRW-Leads", f"{len(nrw_rows)} öffentlich ermittelte Firmenkontakte"))
    story.append(overview_table(nrw_rows, [("Firma", "company"), ("Segment", "segment"), ("Fit", "fit_score"), ("Ort", "city"), ("E-Mail", "generic_email"), ("Telefon", "phone_public"), ("Website", "website")]))
    story.append(PageBreak())
    story.extend(record_cards(nrw_rows, "NRW-Leads", [("Firma", "company"), ("Segment", "segment"), ("Fit-Score", "fit_score"), ("Ort", "city"), ("PLZ", "postcode"), ("Straße", "street"), ("Website", "website"), ("Allgemeine E-Mail", "generic_email"), ("Öffentliches Telefon", "phone_public"), ("Quelle", "source"), ("Quell-URL", "source_url"), ("Fit-Begründung", "fit_reason"), ("Nächster Schritt", "next_step")]))
    story.append(PageBreak())

    apify_rows = data["Apify-Testleads (Essen)"]
    story.extend(section_title("Apify-Testleads aus Essen", f"{len(apify_rows)} öffentlich gefundene Firmenkontakte"))
    story.append(overview_table(apify_rows, [("Firma", "company"), ("Segment", "segment"), ("Fit", "fit_score"), ("Ort", "city"), ("E-Mail", "generic_email"), ("Telefon", "phone_public"), ("Website", "website")]))
    story.append(PageBreak())
    story.extend(record_cards(apify_rows, "Apify-Testleads", [("Firma", "company"), ("Segment", "segment"), ("Fit-Score", "fit_score"), ("Ort", "city"), ("PLZ", "postcode"), ("Adresse", "address"), ("Website", "website"), ("Allgemeine E-Mail", "generic_email"), ("E-Mail-Status", "email_status"), ("Öffentliches Telefon", "phone_public"), ("Bewertung", "rating"), ("Anzahl Bewertungen", "reviews_count"), ("Quelle", "source"), ("Quell-URL", "source_url"), ("Place-ID", "place_id")]))
    story.append(PageBreak())

    outreach_rows = data["Outreach-Entwürfe"]
    story.extend(section_title("Outreach-Entwürfe", f"{len(outreach_rows)} vorbereitete Nachrichten - nicht erneut versendet"))
    story.append(
        overview_table(
            outreach_rows,
            [("Firma", "company"), ("Empfänger", "to"), ("Betreff", "subject"), ("Segment", "segment"), ("Fit", "fit_score"), ("Ort", "city"), ("Website", "website")],
            fractions=[0.20, 0.17, 0.20, 0.17, 0.06, 0.09, 0.11],
        )
    )
    story.append(PageBreak())
    for index, row in enumerate(outreach_rows, start=1):
        story.extend(section_title(f"Outreach {index}: {row.get('company', '')}"))
        story.append(Paragraph(f"An: {escape(row.get('to', ''))}<br/>Betreff: {escape(row.get('subject', ''))}", STYLES["email_meta"]))
        story.append(Spacer(1, 5 * mm))
        story.append(Paragraph(escape(row.get("text", "")).replace("\n", "<br/>"), STYLES["email_body"]))
        story.append(Spacer(1, 8 * mm))
        meta = [["Segment", row.get("segment", ""), "Fit-Score", row.get("fit_score", "")], ["Ort", row.get("city", ""), "Website", display_name(row.get("website", ""))], ["Telefon", row.get("phone_public", ""), "Quelle", row.get("source_url", "")]]
        story.append(table(meta, [28 * mm, 100 * mm, 28 * mm, 100 * mm]))
        if index < len(outreach_rows):
            story.append(PageBreak())

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(OUTPUT)


if __name__ == "__main__":
    main()
