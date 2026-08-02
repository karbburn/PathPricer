"""Market Data Service provider using yfinance.

Isolates yfinance integration, ticker symbol resolution (US / Indian .NS / FX / CRYPTO),
historical quote extraction, and dividend yield handling.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import math
import threading
import time as _time
import pandas as pd
import yfinance as yf

from ..core.config import settings
from ..engine.volatility import all_windows_volatility

# In-memory TTL cache for market quotes. Key: (symbol, market).
_CACHE_TTL: float = float(settings.market_data_cache_ttl)
_CACHE_MAX: int = 512
_quote_cache: dict[tuple[str, str], tuple[float, "MarketQuote"]] = {}
_fetch_locks: dict[tuple[str, str], threading.Lock] = {}


def _cache_get(key: tuple[str, str]) -> "MarketQuote | None":
    entry = _quote_cache.get(key)
    if entry and (_time.monotonic() - entry[0]) < _CACHE_TTL:
        return entry[1]
    _quote_cache.pop(key, None)
    return None


def _cache_set(key: tuple[str, str], quote: "MarketQuote") -> None:
    if key not in _quote_cache and len(_quote_cache) >= _CACHE_MAX:
        _quote_cache.pop(next(iter(_quote_cache)))
    _quote_cache[key] = (_time.monotonic(), quote)


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
        market: Market region ('US', 'IN', 'FX', 'CRYPTO').
        resolved_symbol: Resolved yfinance ticker symbol (e.g. RELIANCE.NS, EURUSD=X).
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
        """Resolve ticker to standard exchange symbol.

        Args:
            ticker: Stock ticker string (e.g. 'RELIANCE', 'AAPL', 'EURUSD', 'BTC').
            market: Market region ('US', 'IN', 'FX', 'CRYPTO').

        Returns:
            str: Resolved yfinance ticker symbol.
        """
        clean_ticker = ticker.strip().upper()
        clean_market = market.strip().upper()

        if clean_market == "IN" and not clean_ticker.endswith((".NS", ".BO")):
            return f"{clean_ticker}.NS"
        if clean_market == "FX":
            # Forex: EURUSD -> EURUSD=X
            if not clean_ticker.endswith("=X"):
                return f"{clean_ticker}=X"
            return clean_ticker
        if clean_market == "CRYPTO":
            # Crypto: BTC -> BTC-USD
            if not clean_ticker.endswith("-USD"):
                return f"{clean_ticker}-USD"
            return clean_ticker
        return clean_ticker

    def get_quote(self, ticker: str, market: str) -> MarketQuote:
        """Fetch market data quote and historical volatility for a ticker.

        Args:
            ticker: Stock ticker string.
            market: Market region ('US', 'IN', 'FX', 'CRYPTO').

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

        lock = _fetch_locks.setdefault(cache_key, threading.Lock())
        with lock:
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

            currency = str(info.get("currency", "USD" if market.strip().upper() in ("US", "FX", "CRYPTO") else "INR"))
            market_cap_raw = info.get("marketCap") or info.get("market_cap")
            market_cap = float(market_cap_raw) if market_cap_raw is not None else None

            # Dividend yield extraction
            # yfinance reports either a decimal (e.g. 0.03) or a percent (e.g. 3.0).
            # A yield above 100% is impossible, so only percent-scaled values need /100.
            raw_div = info.get("dividendYield")
            if raw_div is not None and not math.isnan(float(raw_div)):
                div_val = float(raw_div)
                if div_val > 1.0:
                    div_val /= 100.0
                dividend_yield = div_val
            else:
                dividend_yield = 0.0
                if market.strip().upper() not in ("FX", "CRYPTO"):
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

    def get_options_chain(self, ticker: str, market: str, expiry: str | None = None) -> dict:
        """Fetch options chain for a ticker. US equities only.

        Args:
            ticker: Stock ticker string.
            market: Must be 'US'.
            expiry: Optional expiry date string (YYYY-MM-DD). If None, returns available expiries.

        Returns:
            dict with 'expiries' list and 'chain' (calls/puts DataFrames as dicts).

        Raises:
            MarketDataError: If market is not US or ticker has no options.
        """
        if market.strip().upper() != "US":
            raise MarketDataError(
                message="Options chains are only available for US-listed equities.",
                ticker=ticker,
                fallback_available=False,
            )

        symbol = self.resolve_symbol(ticker, market)
        ticker_obj = yf.Ticker(symbol)

        try:
            expiries = list(ticker_obj.options)
        except Exception:
            expiries = []

        if not expiries:
            raise MarketDataError(
                message=f"No options data available for '{symbol}'.",
                ticker=symbol,
                fallback_available=False,
            )

        if expiry is None:
            expiry = expiries[0]

        if expiry not in expiries:
            raise MarketDataError(
                message=f"Expiry '{expiry}' not found. Available: {expiries[:5]}...",
                ticker=symbol,
                fallback_available=False,
            )

        try:
            chain = ticker_obj.option_chain(expiry)
        except Exception as exc:
            raise MarketDataError(
                message=f"Options data temporarily unavailable for '{symbol}': {exc}",
                ticker=symbol,
                fallback_available=True,
            ) from exc
        calls = chain.calls.to_dict(orient="records")
        puts = chain.puts.to_dict(orient="records")

        # Clean NaN/inf values from serialisation
        for row in calls + puts:
            for k, v in row.items():
                if isinstance(v, float) and not math.isfinite(v):
                    row[k] = None

        # Single fetch for underlying price (reuse ticker_obj)
        underlying_price = None
        try:
            hist_1d = ticker_obj.history(period="1d")
            if not hist_1d.empty:
                last_close = float(hist_1d["Close"].iloc[-1])
                if math.isfinite(last_close):
                    underlying_price = last_close
        except Exception:
            pass

        return {
            "ticker": ticker,
            "market": market.strip().upper(),
            "resolved_symbol": symbol,
            "underlying_price": underlying_price,
            "expiries": expiries,
            "selected_expiry": expiry,
            "calls": calls,
            "puts": puts,
        }

    def get_history(
        self, ticker: str, market: str, period: str = "1y", interval: str = "1d"
    ) -> dict:
        """Fetch historical OHLCV data for a ticker.

        Args:
            ticker: Stock ticker string.
            market: Market region ('US', 'IN', 'FX', 'CRYPTO').
            period: yfinance period string (1d/5d/1mo/3mo/6mo/1y/2y/5y/ytd/max).
            interval: yfinance interval string (1d/1wk/1mo).

        Returns:
            dict with metadata and list of OHLCV bars.
        """
        VALID_PERIODS = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}
        VALID_INTERVALS = {"1d", "1wk", "1mo"}
        MAX_ROWS = 5000

        if period not in VALID_PERIODS:
            raise MarketDataError(
                message=f"Invalid period '{period}'. Valid: {sorted(VALID_PERIODS)}",
                ticker=ticker,
                fallback_available=False,
            )
        if interval not in VALID_INTERVALS:
            raise MarketDataError(
                message=f"Invalid interval '{interval}'. Valid: {sorted(VALID_INTERVALS)}",
                ticker=ticker,
                fallback_available=False,
            )

        symbol = self.resolve_symbol(ticker, market)
        ticker_obj = yf.Ticker(symbol)

        hist = ticker_obj.history(period=period, interval=interval)
        if hist is None or hist.empty:
            raise MarketDataError(
                message=f"No historical data found for '{symbol}'.",
                ticker=symbol,
                fallback_available=True,
            )

        try:
            info = ticker_obj.info or {}
        except Exception:
            info = {}

        currency = str(info.get("currency", "USD" if market.strip().upper() in ("US", "FX", "CRYPTO") else "INR"))

        hist = hist.dropna(subset=["Open", "High", "Low", "Close"])
        hist = hist.tail(MAX_ROWS)

        bars = []
        for idx, row in hist.iterrows():
            open_val = float(row.get("Open", 0))
            high_val = float(row.get("High", 0))
            low_val = float(row.get("Low", 0))
            close_val = float(row.get("Close", 0))
            vol_raw = row.get("Volume", 0)
            vol_val = int(vol_raw) if pd.notna(vol_raw) and vol_raw == vol_raw else 0

            if not all(math.isfinite(v) for v in [open_val, high_val, low_val, close_val]):
                continue

            bar = {
                "date": idx.strftime("%Y-%m-%d"),
                "open": round(open_val, 6),
                "high": round(high_val, 6),
                "low": round(low_val, 6),
                "close": round(close_val, 6),
                "volume": vol_val,
            }
            bars.append(bar)

        return {
            "ticker": ticker,
            "market": market.strip().upper(),
            "currency": currency,
            "interval": interval,
            "bars": bars,
        }
