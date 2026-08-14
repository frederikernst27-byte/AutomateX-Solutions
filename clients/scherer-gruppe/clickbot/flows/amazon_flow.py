"""
Amazon Demo-Flow (synchron, läuft im Thread via sync_playwright)
Klickt sich durch Amazon bis zum Warenkorb – KEIN finaler Kauf.
Suchbegriff: Motoröl 5W-30 (passt zum Automobil-Kontext Scherer)
"""

SEARCH_TERM = "Motoröl 5W-30"


def run(page, log):
    # ── Schritt 1: Amazon öffnen ──────────────────────────────────────────────
    log("Amazon öffnen")
    page.goto("https://www.amazon.de", wait_until="domcontentloaded", timeout=30000)

    # Cookie-Banner wegklicken falls vorhanden
    for selector in ["#sp-cc-accept", "[data-cel-widget='sp-cc'] button", "button[id*='accept']"]:
        try:
            page.click(selector, timeout=3000)
            log("Cookie-Banner geschlossen")
            break
        except Exception:
            pass

    # ── Schritt 2: Produkt suchen ─────────────────────────────────────────────
    log(f"Suche nach '{SEARCH_TERM}'")
    for sel in ["#twotabsearchtextbox", "input[name='field-keywords']"]:
        try:
            page.locator(sel).wait_for(state="visible", timeout=5000)
            page.fill(sel, SEARCH_TERM)
            page.keyboard.press("Enter")
            break
        except Exception:
            continue

    page.wait_for_load_state("domcontentloaded", timeout=20000)
    # Kurz warten bis JS-gerenderte Ergebnisse sichtbar sind
    page.wait_for_timeout(2000)

    # Bot-/CAPTCHA-Check
    content = page.content()
    if "robot" in page.url.lower() or "Type the characters" in content:
        raise Exception("Amazon zeigt CAPTCHA – bitte manuell lösen und erneut starten")

    # ── Schritt 3: Erstes Suchergebnis klicken ────────────────────────────────
    log("Wähle erstes Suchergebnis")

    # Produkt-Links auf Amazon enthalten immer /dp/{ASIN}/ – sehr zuverlässiger Selektor
    try:
        page.wait_for_selector("a[href*='/dp/']", state="visible", timeout=12000)
    except Exception:
        raise Exception("Keine Produkt-Links (/dp/) auf der Seite gefunden")

    clicked = False
    items = page.locator("a[href*='/dp/']")
    count = items.count()
    for i in range(min(count, 15)):
        try:
            item = items.nth(i)
            if not item.is_visible():
                continue
            title = item.inner_text(timeout=2000).strip()
            if title and len(title) > 8 and "erfahre mehr" not in title.lower():
                item.click()
                clicked = True
                log(f"Produkt geöffnet: {title[:60]}")
                break
        except Exception:
            continue

    if not clicked:
        raise Exception("Kein passendes Produkt in den Suchergebnissen gefunden")

    page.wait_for_load_state("domcontentloaded", timeout=20000)
    page.wait_for_timeout(1500)

    # ── Schritt 4: Preis prüfen ───────────────────────────────────────────────
    log("Prüfe Produktseite")
    for sel in [".a-price .a-offscreen", "#priceblock_ourprice",
                ".a-price-whole", "#price_inside_buybox", "#corePrice_feature_div .a-offscreen"]:
        try:
            price = page.locator(sel).first.inner_text(timeout=4000)
            if price.strip():
                log(f"Preis erkannt: {price.strip()}")
                break
        except Exception:
            continue
    else:
        log("Preis nicht gefunden – weiter", "warning")

    # ── Schritt 5: In den Warenkorb ───────────────────────────────────────────
    log("Lege in Warenkorb")
    cart_selectors = [
        "#add-to-cart-button",
        "input[name='submit.add-to-cart']",
        "[name='submit.add-to-cart']",
        "button:has-text('In den Einkaufswagen')",
        "button:has-text('In den Warenkorb')",
        "[data-feature-name='addToCart'] input",
        "[data-feature-name='addToCart'] button",
    ]
    added = False
    for sel in cart_selectors:
        try:
            page.wait_for_selector(sel, state="visible", timeout=6000)
            page.click(sel)
            added = True
            break
        except Exception:
            continue

    if not added:
        raise Exception("'In den Warenkorb' Button nicht gefunden")

    page.wait_for_load_state("domcontentloaded", timeout=20000)

    # Pop-up wegklicken
    for sel in ["#attachSiNoCoverage", 'button[aria-label="Schließen"]',
                "#siNoCoverage", ".a-button-close"]:
        try:
            page.click(sel, timeout=2000)
        except Exception:
            pass

    log("Produkt im Warenkorb")

    # ── Schritt 6: Warenkorb öffnen ───────────────────────────────────────────
    log("Öffne Warenkorb")
    page.goto("https://www.amazon.de/gp/cart/view.html",
              wait_until="domcontentloaded", timeout=20000)
    page.wait_for_timeout(1500)

    for sel in [".sc-list-item", "[data-name='Active Items']", ".a-box-group"]:
        try:
            page.locator(sel).first.wait_for(state="visible", timeout=6000)
            log("Warenkorb bestätigt – Artikel vorhanden")
            break
        except Exception:
            continue
    else:
        log("Warenkorb geöffnet (Artikel-Check nicht eindeutig)", "warning")

    # ── STOP: Kein Kauf ───────────────────────────────────────────────────────
    log("Demo-Endpunkt erreicht (kein Kauf ausgelöst)")
