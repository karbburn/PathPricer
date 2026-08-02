"""Self-check for update_tickers merge logic (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.update_tickers import ENTRY_RE, _validate, generate_ticker_data, parse_existing

FIXTURE = """/**
 * Header
 */
export const TICKER_DATABASE: TickerEntry[] = [
  // US Stocks & ETFs
  { ticker: "AAPL", name: "APPLE INC.", market: "US" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF", market: "US" },

  // Indian Stocks
  { ticker: "RELIANCE", name: "Reliance", market: "IN" },

  // Forex
  { ticker: "EURUSD", name: "EUR/USD", market: "FX" },

  // Crypto
  { ticker: "BTC", name: "Bitcoin", market: "CRYPTO" },
];
export function filterTickers() { return 1; }
"""


def test_merge_preserves_existing_and_adds_new():
    header, footer, body = parse_existing(FIXTURE)
    assert "export function filterTickers()" in footer
    assert header.strip() == "/**\n * Header\n */"

    us_new = [("AAPL", "Apple Inc."), ("MSFT", "Microsoft Corp")]
    in_new = [("RELIANCE", "Reliance Ind"), ("TCS", "Tata Consultancy")]
    crypto_new = [("BTC", "Bitcoin"), ("ETH", "Ethereum")]
    out = generate_ticker_data(header, body, us_new, in_new, crypto_new, footer)

    assert out.count('market: "US"') == 3  # AAPL + SPY + MSFT
    assert out.count('market: "IN"') == 2  # RELIANCE + TCS
    assert out.count('market: "CRYPTO"') == 2  # BTC + ETH
    assert out.count('market: "FX"') == 1  # EURUSD preserved
    assert "SPY" in out
    assert "MSFT" in out
    assert "TCS" in out
    assert "ETH" in out
    assert "EURUSD" in out
    assert "export function filterTickers()" in out
    # Idempotent: re-parsing output and merging same candidates adds nothing
    _, footer2, body2 = parse_existing(out)
    out2 = generate_ticker_data(header, body2, us_new, in_new, crypto_new, footer2)
    assert out2 == out


def test_crypto_and_fx_preserved():
    """CRYPTO and FX entries survive merge without being duplicated."""
    header, footer, body = parse_existing(FIXTURE)
    out = generate_ticker_data(header, body, [], [], [], footer)
    assert 'market: "CRYPTO"' in out
    assert 'market: "FX"' in out
    assert "BTC" in out
    assert "EURUSD" in out


def test_regex_matches_entry():
    m = ENTRY_RE.search('  { ticker: "A", name: "Agilent", market: "US" },')
    assert m and m.group(1) == "A" and m.group(3) == "US"


def test_validate_resolves_market_symbols():
    """yfinance symbol resolution: IN gets .NS, CRYPTO gets -USD, US untouched."""
    seen = []

    class FakeYf:
        def Ticker(self, symbol):
            seen.append(symbol)
            return type("T", (), {"fast_info": True})()

    yf = FakeYf()
    assert _validate("BTC", "CRYPTO", yf) and seen[-1] == "BTC-USD"
    assert _validate("BTC-USD", "CRYPTO", yf) and seen[-1] == "BTC-USD"
    assert _validate("RELIANCE", "IN", yf) and seen[-1] == "RELIANCE.NS"
    assert _validate("AAPL", "US", yf) and seen[-1] == "AAPL"


if __name__ == "__main__":
    test_merge_preserves_existing_and_adds_new()
    test_crypto_and_fx_preserved()
    test_regex_matches_entry()
    test_validate_resolves_market_symbols()
    print("update_tickers self-check OK")
