"""Regenerate the frontend ticker database from Wikipedia constituent lists.

Fetches S&P 500 tickers from Wikipedia and Nifty 50 tickers from Wikipedia,
validates them with yfinance, and writes an updated ticker-data.ts file.

Preserves existing FX, CRYPTO, and curated entries already in the file.
The `filterTickers` export is always preserved unchanged.

Usage:
    python scripts/update_tickers.py

Requires:
    pip install yfinance requests beautifulsoup4
"""

import os
import re
import sys
import time
from pathlib import Path

import requests
import yfinance as yf
from bs4 import BeautifulSoup

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
TICKER_FILE = FRONTEND_DIR / "lib" / "ticker-data.ts"

SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
NIFTY50_URL = "https://en.wikipedia.org/wiki/NIFTY_50"

USER_AGENT = "PathPricer-ticker-updater/1.0 (https://github.com/karbburn/PathPricer)"
HEADERS = {"User-Agent": USER_AGENT}

MIN_US = 450
MIN_IN = 40


def fetch_sp500_tickers() -> list[tuple[str, str]]:
    """Fetch S&P 500 tickers and company names from Wikipedia."""
    resp = requests.get(SP500_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", id="constituents")
    if not table:
        return []

    tickers: list[tuple[str, str]] = []
    for tr in table.select("tbody tr"):
        cells = tr.find_all("td")
        if len(cells) < 2:
            continue
        ticker = cells[0].get_text(" ", strip=True)
        name = cells[1].get_text(" ", strip=True)
        if re.fullmatch(r"[A-Z][A-Z0-9.\-]*", ticker) and name:
            tickers.append((ticker, name))
    return tickers


def fetch_nifty50_tickers() -> list[tuple[str, str]]:
    """Fetch Nifty 50 tickers and company names from Wikipedia."""
    resp = requests.get(NIFTY50_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", {"class": "wikitable"})
    if not table:
        return []

    tickers: list[tuple[str, str]] = []
    for tr in table.select("tbody tr"):
        cells = tr.find_all("td")
        if len(cells) < 2:
            continue
        ticker = cells[1].get_text(" ", strip=True)
        name = cells[0].get_text(" ", strip=True)
        if re.fullmatch(r"[A-Z]+", ticker) and name:
            tickers.append((ticker, name))
    return tickers


def validate_ticker(ticker: str, market: str) -> bool:
    """Check if a ticker exists on yfinance. Returns True if valid."""
    symbol = ticker
    if market == "IN" and not ticker.endswith((".NS", ".BO")):
        symbol = f"{ticker}.NS"

    for attempt in range(3):
        try:
            t = yf.Ticker(symbol)
            h = t.fast_info
            return h is not None
        except Exception:
            if attempt < 2:
                time.sleep(1.0 * (attempt + 1))
    return False


def read_existing_file() -> str:
    """Read the current ticker-data.ts content."""
    if not TICKER_FILE.exists():
        return ""
    return TICKER_FILE.read_text(encoding="utf-8")


def preserve_fx_crypto_entries(content: str) -> list[str]:
    """Extract FX, CRYPTO, and curated entries from the existing file."""
    entries: list[str] = []
    in_array = False
    for line in content.splitlines():
        stripped = line.strip()
        if "TICKER_DATABASE" in line and "[" in line:
            in_array = True
            continue
        if in_array and stripped == "];":
            break
        if in_array and "market:" in stripped:
            if '"FX"' in stripped or '"CRYPTO"' in stripped:
                entries.append(stripped)
    return entries


def preserve_filter_tickers(content: str) -> str | None:
    """Extract the filterTickers function verbatim."""
    idx = content.find("export function filterTickers(")
    if idx == -1:
        return None
    return content[idx:]


def generate_ticker_data(
    us_tickers: list[tuple[str, str]],
    in_tickers: list[tuple[str, str]],
    fx_crypto: list[str],
    filter_fn: str,
) -> str:
    """Generate the ticker-data.ts file content."""
    lines = [
        "/**",
        " * Shared Ticker Database & Autocomplete Utilities.",
        " */",
        "",
        'import { MarketRegion } from "./types";',
        "",
        "export interface TickerEntry {",
        "  ticker: string;",
        "  name: string;",
        "  market: MarketRegion;",
        "}",
        "",
        "export const TICKER_DATABASE: TickerEntry[] = [",
    ]

    for ticker, name in us_tickers:
        safe_name = name.replace('"', '\\"').replace("\n", " ").strip()
        lines.append(f'  {{ ticker: "{ticker}", name: "{safe_name}", market: "US" }},')

    lines.append("")

    for ticker, name in in_tickers:
        safe_name = name.replace('"', '\\"').replace("\n", " ").strip()
        lines.append(f'  {{ ticker: "{ticker}", name: "{safe_name}", market: "IN" }},')

    if fx_crypto:
        lines.append("")
        for entry in fx_crypto:
            lines.append(f"  {entry}")

    lines.append("];")
    lines.append("")

    if filter_fn:
        lines.append("")
        lines.append(filter_fn)
        lines.append("")

    return "\n".join(lines)


def main() -> None:
    existing = read_existing_file()
    if not existing:
        print(f"Error: {TICKER_FILE} not found", file=sys.stderr)
        sys.exit(1)

    print("Fetching S&P 500 tickers...")
    sp500 = fetch_sp500_tickers()
    print(f"  Found {len(sp500)} S&P 500 tickers")

    print("Fetching Nifty 50 tickers...")
    nifty50 = fetch_nifty50_tickers()
    print(f"  Found {len(nifty50)} Nifty 50 tickers")

    if len(sp500) < MIN_US:
        print(
            f"Error: too few S&P 500 tickers parsed ({len(sp500)} < {MIN_US}); "
            "aborting without writing",
            file=sys.stderr,
        )
        sys.exit(1)
    if len(nifty50) < MIN_IN:
        print(
            f"Error: too few Nifty 50 tickers parsed ({len(nifty50)} < {MIN_IN}); "
            "aborting without writing",
            file=sys.stderr,
        )
        sys.exit(1)

    print("Validating US tickers with yfinance (may take a few minutes)...")
    valid_us: list[tuple[str, str]] = []
    for i, (ticker, name) in enumerate(sp500):
        if i % 50 == 0 and i > 0:
            print(f"  Validated {i}/{len(sp500)} US tickers...")
        if validate_ticker(ticker, "US"):
            valid_us.append((ticker, name))

    print("Validating IN tickers with yfinance...")
    valid_in: list[tuple[str, str]] = []
    for i, (ticker, name) in enumerate(nifty50):
        if i % 10 == 0 and i > 0:
            print(f"  Validated {i}/{len(nifty50)} IN tickers...")
        if validate_ticker(ticker, "IN"):
            valid_in.append((ticker, name))

    print(f"  Valid US: {len(valid_us)}/{len(sp500)}")
    print(f"  Valid IN: {len(valid_in)}/{len(nifty50)}")

    if len(valid_us) < MIN_US:
        print(
            f"Error: too few valid US tickers ({len(valid_us)} < {MIN_US}); "
            "aborting without writing",
            file=sys.stderr,
        )
        sys.exit(1)
    if len(valid_in) < MIN_IN:
        print(
            f"Error: too few valid IN tickers ({len(valid_in)} < {MIN_IN}); "
            "aborting without writing",
            file=sys.stderr,
        )
        sys.exit(1)

    fx_crypto = preserve_fx_crypto_entries(existing)
    filter_fn = preserve_filter_tickers(existing)

    content = generate_ticker_data(valid_us, valid_in, fx_crypto, filter_fn)

    tmp_path = TICKER_FILE.with_suffix(".ts.tmp")
    tmp_path.write_text(content, encoding="utf-8")
    os.replace(tmp_path, TICKER_FILE)
    print(f"\nWrote {TICKER_FILE} ({len(valid_us)} US + {len(valid_in)} IN + {len(fx_crypto)} FX/CRYPTO)")


if __name__ == "__main__":
    main()
