"""Regenerate the frontend ticker database from Wikipedia and CoinGecko.

Fetches S&P 500 tickers from Wikipedia, Nifty 50 tickers from Wikipedia,
and top crypto coins from CoinGecko, then merges them into the existing
ticker-data.ts file. Existing entries are preserved verbatim (curated
US/IN stocks, ETFs, FX); Wikipedia/CoinGecko is only a source of
new/renamed tickers. The `filterTickers` export is always preserved unchanged.

FX pairs are standardized majors/minors and do not change; they are not fetched.

yfinance validation is skipped on CI (GitHub Actions) where it is rate-limited
and unreliable; the Wikipedia/CoinGecko fetch + MIN_* abort guards are the safety net.

Usage:
    python scripts/update_tickers.py

Requires:
    pip install requests beautifulsoup4
"""

import os
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
TICKER_FILE = FRONTEND_DIR / "lib" / "ticker-data.ts"

SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
NIFTY50_URL = "https://en.wikipedia.org/wiki/NIFTY_50"
COINGECKO_URL = "https://api.coingecko.com/api/v3/coins/markets"

USER_AGENT = "PathPricer-ticker-updater/1.0 (https://github.com/karbburn/PathPricer)"
HEADERS = {"User-Agent": USER_AGENT}

MIN_US = 450
MIN_IN = 40
MIN_CRYPTO = 10

ENTRY_RE = re.compile(
    r'\{\s*ticker:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*market:\s*"([^"]+)"\s*\}'
)


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


def fetch_crypto_coins() -> list[tuple[str, str]]:
    """Fetch top crypto coins by market cap from CoinGecko (free, no key)."""
    resp = requests.get(
        COINGECKO_URL,
        params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": 25, "page": 1},
        headers=HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    coins = resp.json()
    tickers: list[tuple[str, str]] = []
    for coin in coins:
        symbol = (coin.get("symbol") or "").upper()
        name = coin.get("name") or ""
        if symbol and name and re.fullmatch(r"[A-Z0-9]+", symbol):
            tickers.append((symbol, name))
    return tickers


def read_existing_file() -> str:
    """Read the current ticker-data.ts content."""
    if not TICKER_FILE.exists():
        return ""
    return TICKER_FILE.read_text(encoding="utf-8")


ARRAY_MARKER = "export const TICKER_DATABASE: TickerEntry[] = ["


def parse_existing(content: str) -> tuple[str, str, list[str]]:
    """Return (header, footer, database-body-lines) split from the current file.

    The database body is everything between the `[...=` line and the closing
    `];`, preserved verbatim (comments, indentation, blanks).
    """
    start = content.find(ARRAY_MARKER)
    if start == -1:
        return "", "", []
    header = content[:start]
    bracket = start + len(ARRAY_MARKER)
    close = content.find("];", bracket)
    if close == -1:
        return "", "", []

    body = content[bracket:close].splitlines()
    if body and not body[0].strip():
        body = body[1:]
    return header, content[close + 2 :], body


def generate_ticker_data(
    header: str,
    body: list[str],
    us_new: list[tuple[str, str]],
    in_new: list[tuple[str, str]],
    crypto_new: list[tuple[str, str]],
    footer: str,
) -> str:
    """Append missing Wikipedia/CoinGecko tickers to the existing database body."""
    existing_us = {ENTRY_RE.search(e).group(1) for e in body if '"US"' in e}
    existing_in = {ENTRY_RE.search(e).group(1) for e in body if '"IN"' in e}
    existing_crypto = {ENTRY_RE.search(e).group(1) for e in body if '"CRYPTO"' in e}

    added: list[str] = []
    for ticker, name in us_new:
        if ticker not in existing_us:
            safe_name = name.replace('"', '\\"').replace("\n", " ").strip()
            added.append(f'  {{ ticker: "{ticker}", name: "{safe_name}", market: "US" }},')
    for ticker, name in in_new:
        if ticker not in existing_in:
            safe_name = name.replace('"', '\\"').replace("\n", " ").strip()
            added.append(f'  {{ ticker: "{ticker}", name: "{safe_name}", market: "IN" }},')
    for ticker, name in crypto_new:
        if ticker not in existing_crypto:
            safe_name = name.replace('"', '\\"').replace("\n", " ").strip()
            added.append(f'  {{ ticker: "{ticker}", name: "{safe_name}", market: "CRYPTO" }},')

    if added:
        body.extend(["", "  // Newly added from Wikipedia/CoinGecko"])
        body.extend(added)

    return header + ARRAY_MARKER + "\n" + "\n".join(body) + "\n];" + footer


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

    print("Fetching top crypto coins from CoinGecko...")
    crypto = fetch_crypto_coins()
    print(f"  Found {len(crypto)} crypto coins")

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
    if len(crypto) < MIN_CRYPTO:
        print(
            f"Error: too few crypto coins parsed ({len(crypto)} < {MIN_CRYPTO}); "
            "aborting without writing",
            file=sys.stderr,
        )
        sys.exit(1)

    # On CI, yfinance validation is rate-limited/unreliable and not needed:
    # Wikipedia/CoinGecko constituents are trusted and the existing DB is preserved.
    if os.environ.get("CI") != "true":
        try:
            import yfinance as yf
        except ImportError:
            yf = None
        if yf:
            valid_sp500 = [t for t in sp500 if _validate(t[0], "US", yf)]
            valid_nifty = [t for t in nifty50 if _validate(t[0], "IN", yf)]
            valid_crypto = [t for t in crypto if _validate(t[0], "CRYPTO", yf)]
            print(f"  Valid US: {len(valid_sp500)}/{len(sp500)}")
            print(f"  Valid IN: {len(valid_nifty)}/{len(nifty50)}")
            print(f"  Valid CRYPTO: {len(valid_crypto)}/{len(crypto)}")
            if len(valid_sp500) < MIN_US or len(valid_nifty) < MIN_IN or len(valid_crypto) < MIN_CRYPTO:
                print("Error: too few valid tickers after yfinance validation; aborting", file=sys.stderr)
                sys.exit(1)
            sp500, nifty50, crypto = valid_sp500, valid_nifty, valid_crypto

    header, footer, body = parse_existing(existing)

    content = generate_ticker_data(header, body, sp500, nifty50, crypto, footer)

    tmp_path = TICKER_FILE.with_suffix(".ts.tmp")
    tmp_path.write_text(content, encoding="utf-8")
    os.replace(tmp_path, TICKER_FILE)
    print(f"\nWrote {TICKER_FILE} ({len(body)} entries + {len(sp500) + len(nifty50) + len(crypto)} candidates merged)")


def _validate(ticker: str, market: str, yf) -> bool:
    """Check a ticker resolves on yfinance. `fast_info` is empty on failure."""
    symbol = ticker
    if market == "IN" and not ticker.endswith((".NS", ".BO")):
        symbol = f"{ticker}.NS"
    elif market == "CRYPTO" and not ticker.endswith("-USD"):
        symbol = f"{ticker}-USD"
    try:
        t = yf.Ticker(symbol)
        return bool(t.fast_info)
    except Exception:
        return False


if __name__ == "__main__":
    main()
