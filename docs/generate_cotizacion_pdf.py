"""Genera el PDF de la cotización comercial desde el HTML."""
from pathlib import Path

from playwright.sync_api import sync_playwright

DOCS_DIR = Path(__file__).parent
HTML_PATH = DOCS_DIR / "cotizacion_tareo.html"
PDF_PATH = DOCS_DIR / "cotizacion_tareo.pdf"


def main() -> None:
    if not HTML_PATH.exists():
        raise SystemExit(f"No se encontro {HTML_PATH}")

    print(f"-> Renderizando {HTML_PATH.name}...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.goto(HTML_PATH.absolute().as_uri(), wait_until="networkidle")
            page.pdf(
                path=str(PDF_PATH),
                format="A4",
                print_background=True,
                margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                prefer_css_page_size=True,
            )
        finally:
            browser.close()

    size_kb = PDF_PATH.stat().st_size / 1024
    print(f"[OK] PDF generado: {PDF_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
