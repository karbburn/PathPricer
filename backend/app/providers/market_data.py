"""Market Data Service provider using yfinance.

Isolates yfinance integration, ticker symbol resolution (US / Indian .NS),
historical quote extraction, and dividend yield handling.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import math
import time
import yfinance as yf

from ..engine.volatility import all_windows_volatility

# In-memory TTL cache for market quotes. Key: (symbol, market).
# ponytail: global dict, fine for single-process Render free tier.
_CACHE_TTL: float = 300.0  # 5 minutes
_quote_cache: dict[tuple[str, str], tuple[float, "MarketQuote"]] = {}


def _cache_get(key: tuple[str, str]) -> "MarketQuote | None":
    entry = _quote_cache.get(key)
    if entry and (time.time() - entry[0]) < _CACHE_TTL:
        return entry[1]
    if entry:
        del _quote_cache[key]
    return None


def _cache_set(key: tuple[str, str], quote: "MarketQuote") -> None:
    _quote_cache[key] = (time.time(), quote)


class MarketDataError(Exception):
    """Exception raised when market data fetch or ticker resolution fails.

    Attributes:
        message: Explanation of the error.
        ticker: Ticker symbol that failed.
        fallback_available: Always True, signaling frontend manual entry availability.
    """

    def __init__(self, message: str, ticker: str, fallback_available: bool = True) -> None:
        super().__init__(message)
        self.message = message
        self.ticker = ticker
        self.fallback_available = fallback_available


@dataclass
class MarketQuote:
    """Dataclass holding resolved market data snapshot and historical volatility.

    Attributes:
        ticker: Original ticker input.
        market: Market region ('US' or 'IN').
        resolved_symbol: Resolved yfinance ticker symbol (e.g. RELIANCE.NS).
        spot_price: Latest closing price.
        daily_return: Latest 1-day percentage return.
        historical_volatility: Trailing volatility estimates (20d, 60d, 126d, 252d).
        dividend_yield: Annualized dividend yield as decimal.
        market_cap: Total market capitalization if available.
        currency: Quote currency (e.g. 'USD', 'INR').
        last_updated: ISO 8601 timestamp string.
        data_warnings: List of data quality warnings (e.g. defaulted dividend yield).
    """

    ticker: str
    market: str
    resolved_symbol: str
    spot_price: float
    daily_return: float
    historical_volatility: dict[str, float]
    dividend_yield: float
    market_cap: float | None
    currency: str
    last_updated: str
    data_warnings: list[str] = field(default_factory=list)


class MarketDataService:
    """Service handling ticker resolution and yfinance market data extraction."""

    def resolve_symbol(self, ticker: str, market: str) -> str:
        """Resolve ticker to standard exchange symbol (e.g., append .NS for Indian tickers).

        Args:
            ticker: Stock ticker string (e.g. 'RELIANCE', 'AAPL').
            market: Market region ('US' or 'IN').

        Returns:
            str: Resolved yfinance ticker symbol.
        """
        clean_ticker = ticker.strip().upper()
        clean_market = market.strip().upper()

        if clean_market == "IN" and not clean_ticker.endswith((".NS", ".BO")):
            return f"{clean_ticker}.NS"
        return clean_ticker

    def get_quote(self, ticker: str, market: str) -> MarketQuote:
        """Fetch market data quote and historical volatility for a ticker.

        Args:
            ticker: Stock ticker string.
            market: Market region ('US' or 'IN').

        Returns:
            MarketQuote: Populated market data quote object.

        Raises:
            MarketDataError: If ticker is invalid, not found, or yfinance returns no data.
        """
        symbol = self.resolve_symbol(ticker, market)
        cache_key = (symbol, market.strip().upper())

        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        data_warnings: list[str] = []

        ticker_obj = yf.Ticker(symbol)
        hist = None

        # Attempt 1: Ticker.history(period="1y")
        try:
            hist = ticker_obj.history(period="1y")
        except Exception:
            hist = None

        # Attempt 2: Fallback to yf.download if history() returned empty or failed
        if hist is None or hist.empty or "Close" not in hist or len(hist["Close"].dropna()) == 0:
            try:
                hist_dl = yf.download(symbol, period="1y", progress=False)
                if hist_dl is not None and not hist_dl.empty:
                    # Handle MultiIndex columns from yf.download
                    if hasattr(hist_dl.columns, "levels") and len(hist_dl.columns.levels) > 1:
                        if symbol in hist_dl.columns.levels[1]:
                            hist = hist_dl.xs(symbol, level=1, axis=1)
                        else:
                            hist = hist_dl.droplevel(1, axis=1)
                    else:
                        hist = hist_dl
            except Exception:
                pass

        # Attempt 3: Fallback to period="6m" if 1y returned empty
        if hist is None or hist.empty or "Close" not in hist or len(hist["Close"].dropna()) == 0:
            try:
                hist = ticker_obj.history(period="6m")
            except Exception:
                pass

        if hist is None or hist.empty or "Close" not in hist or len(hist["Close"].dropna()) == 0:
            raise MarketDataError(
                message=f"Symbol '{symbol}' not found or no historical market data returned.",
                ticker=symbol,
                fallback_available=True,
            )

        close_prices = hist["Close"].dropna().to_numpy()
        if len(close_prices) == 0:
            raise MarketDataError(
                message=f"No valid closing prices found for symbol '{symbol}'.",
                ticker=symbol,
                fallback_available=True,
            )

        spot_price = float(close_prices[-1])
        daily_return = float((close_prices[-1] / close_prices[-2]) - 1.0) if len(close_prices) >= 2 else 0.0

        # Calculate historical volatility windows (20d, 60d, 126d, 252d)
        hist_vol = all_windows_volatility(close_prices)

        # Extract info metadata
        try:
            info = ticker_obj.info or {}
        except Exception:
            info = {}

        currency = str(info.get("currency", "USD" if market.strip().upper() == "US" else "INR"))
        market_cap_raw = info.get("marketCap") or info.get("market_cap")
        market_cap = float(market_cap_raw) if market_cap_raw is not None else None

        # Dividend yield extraction
        raw_div = info.get("dividendYield")
        if raw_div is not None and not math.isnan(float(raw_div)):
            div_val = float(raw_div)
            if div_val > 0.20:
                div_val /= 100.0
            dividend_yield = div_val
        else:
            dividend_yield = 0.0
            data_warnings.append("Dividend yield data unavailable for ticker; defaulted to 0.0.")

        last_updated = datetime.now(timezone.utc).isoformat()

        quote = MarketQuote(
            ticker=ticker,
            market=market.strip().upper(),
            resolved_symbol=symbol,
            spot_price=spot_price,
            daily_return=daily_return,
            historical_volatility=hist_vol,
            dividend_yield=dividend_yield,
            market_cap=market_cap,
            currency=currency,
            last_updated=last_updated,
            data_warnings=data_warnings,
        )
        _cache_set(cache_key, quote)
        return quote
