"""Genera el PDF del brochure comercial desde el HTML.

Uso:
    python generate_brochure_pdf.py

Salida:
    docs/brochure_tareo.pdf

Requiere: playwright (ya instalado en el entorno).
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

DOCS_DIR = Path(__file__).parent
HTML_PATH = DOCS_DIR / "brochure_tareo.html"
PDF_PATH = DOCS_DIR / "brochure_tareo.pdf"


def main() -> None:
    if not HTML_PATH.exists():
        raise SystemExit(f"No se encontró {HTML_PATH}")

    print(f"-> Renderizando {HTML_PATH.name}...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            # file:// URL para que Chromium lea el HTML local
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
