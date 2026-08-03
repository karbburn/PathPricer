"""Market data API endpoints.

GET /market/quote    — fetches market data + historical volatility for a ticker.
GET /market/options  — fetches options chain (US equities only).
GET /market/history  — fetches historical OHLCV data.
"""

from fastapi import APIRouter, Depends, Query

from ..core.config import DAYS_PER_YEAR
from ..core.dependencies import get_market_data_service
from ..engine.implied_rate import extract_implied_rate
from ..providers.market_data import MarketDataError, MarketDataService
from ..schemas.pricing import (
    ErrorResponse,
    HistoryResponse,
    ImpliedParityRequest,
    ImpliedRateResponse,
    MarketQuoteResponse,
    OptionsChainResponse,
)

router = APIRouter(prefix="/market", tags=["market"])


def _atm_parity_pair(
    chain: dict, spot: float, expiry: str
) -> tuple[float, float, float, float] | None:
    """Find the ATM call/put mid prices sharing the nearest strike to spot.

    Returns (strike, call_mid, put_mid, ttm) or None if no usable pair.
    """
    from datetime import date, datetime

    calls = chain.get("calls") or []
    puts = chain.get("puts") or []
    if not calls or not puts:
        return None

    call_by_strike: dict[float, float] = {}
    put_by_strike: dict[float, float] = {}
    for c in calls:
        s = c.get("strike")
        if not isinstance(s, float):
            continue
        bid, ask = c.get("bid"), c.get("ask")
        if isinstance(bid, float) and isinstance(ask, float) and ask >= bid:
            call_by_strike[s] = 0.5 * (bid + ask)
        elif isinstance(c.get("lastPrice"), float):
            call_by_strike[s] = c["lastPrice"]
    for p in puts:
        s = p.get("strike")
        if not isinstance(s, float):
            continue
        bid, ask = p.get("bid"), p.get("ask")
        if isinstance(bid, float) and isinstance(ask, float) and ask >= bid:
            put_by_strike[s] = 0.5 * (bid + ask)
        elif isinstance(p.get("lastPrice"), float):
            put_by_strike[s] = p["lastPrice"]

    shared = sorted(set(call_by_strike) & set(put_by_strike), key=lambda s: abs(s - spot))
    if not shared:
        return None

    exp_date = datetime.strptime(expiry, "%Y-%m-%d").date()
    ttm = max((exp_date - date.today()).days / DAYS_PER_YEAR, 1e-4)
    strike = shared[0]
    return strike, call_by_strike[strike], put_by_strike[strike], ttm


@router.get(
    "/quote",
    response_model=MarketQuoteResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_market_quote(
    ticker: str = Query(..., description="Stock ticker symbol"),
    market: str = Query(..., description="Market region (US, IN, FX, CRYPTO)"),
    market_data: MarketDataService = Depends(get_market_data_service),
) -> MarketQuoteResponse | ErrorResponse:
    """Fetch current market data and historical volatility for a ticker."""
    from fastapi.responses import JSONResponse

    try:
        quote = market_data.get_quote(ticker, market)
    except MarketDataError as err:
        return JSONResponse(
            status_code=404,
            content=ErrorResponse(
                error="ticker_not_found",
                message=err.message,
                fallback_available=err.fallback_available,
            ).model_dump(),
        )

    return MarketQuoteResponse(
        ticker=quote.ticker,
        market=quote.market,
        resolved_symbol=quote.resolved_symbol,
        spot_price=quote.spot_price,
        daily_return=quote.daily_return,
        historical_volatility=quote.historical_volatility,
        dividend_yield=quote.dividend_yield,
        market_cap=quote.market_cap,
        currency=quote.currency,
        last_updated=quote.last_updated,
        data_warnings=quote.data_warnings,
    )


@router.post(
    "/implied-rate",
    response_model=ImpliedRateResponse,
    responses={404: {"model": ErrorResponse}},
)
def compute_implied_rate(
    req: ImpliedParityRequest,
    market_data: MarketDataService = Depends(get_market_data_service),
) -> ImpliedRateResponse | ErrorResponse:
    """Extract the risk-free rate implied by an ATM call/put parity pair.

    A rate far from the reference flags inconsistent quotes (stale mids,
    crossed markets, mis-priced dividends) — a data-quality probe.
    """
    from fastapi.responses import JSONResponse

    try:
        quote = market_data.get_quote(req.ticker, req.market)
        chain = market_data.get_options_chain(req.ticker, req.market)
    except MarketDataError as err:
        return JSONResponse(
            status_code=404,
            content=ErrorResponse(
                error="options_not_available",
                message=err.message,
                fallback_available=err.fallback_available,
            ).model_dump(),
        )

    expiry = req.expiry_date or chain.get("selected_expiry")
    if expiry is None or expiry not in (chain.get("expiries") or []):
        expiry = (chain.get("expiries") or [None])[0]
    if expiry is None:
        return JSONResponse(
            status_code=404,
            content=ErrorResponse(
                error="options_not_available",
                message="No option expiries found for ticker.",
                fallback_available=False,
            ).model_dump(),
        )

    spot = req.spot_override if req.spot_override and req.spot_override > 0 else quote.spot_price
    q = req.dividend_yield if req.dividend_yield is not None else 0.0
    pair = _atm_parity_pair(chain, spot, expiry)
    if pair is None:
        return JSONResponse(
            status_code=404,
            content=ErrorResponse(
                error="options_not_available",
                message="No matched call/put quotes found at a shared strike.",
                fallback_available=False,
            ).model_dump(),
        )

    strike, call_mid, put_mid, ttm = pair
    warnings: list[str] = []
    try:
        implied_rate = extract_implied_rate(call_mid, put_mid, spot, strike, ttm, q)
    except ValueError as err:
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                error="parity_inconsistent",
                message=str(err),
                fallback_available=False,
            ).model_dump(),
        )

    reference_rate = req.risk_free_rate
    return ImpliedRateResponse(
        ticker=req.ticker.upper(),
        market=req.market.upper(),
        resolved_symbol=chain.get("resolved_symbol") or req.ticker.upper(),
        spot=spot,
        strike=strike,
        ttm=ttm,
        call_price=call_mid,
        put_price=put_mid,
        implied_rate=implied_rate,
        reference_rate=reference_rate,
        divergence=implied_rate - reference_rate,
        warnings=warnings,
    )


@router.get(
    "/options",
    response_model=OptionsChainResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_options_chain(
    ticker: str = Query(..., description="Stock ticker symbol"),
    market: str = Query("US", description="Market region (US only)"),
    expiry: str | None = Query(None, description="Expiry date (YYYY-MM-DD). Defaults to nearest."),
    market_data: MarketDataService = Depends(get_market_data_service),
) -> OptionsChainResponse | ErrorResponse:
    """Fetch options chain for a US-listed equity."""
    from fastapi.responses import JSONResponse

    try:
        chain = market_data.get_options_chain(ticker, market, expiry)
    except MarketDataError as err:
        return JSONResponse(
            status_code=404,
            content=ErrorResponse(
                error="options_not_available",
                message=err.message,
                fallback_available=err.fallback_available,
            ).model_dump(),
        )

    return OptionsChainResponse(
        ticker=chain["ticker"],
        market=chain["market"],
        resolved_symbol=chain["resolved_symbol"],
        underlying_price=chain["underlying_price"],
        expiries=chain["expiries"],
        selected_expiry=chain["selected_expiry"],
        calls=chain["calls"],
        puts=chain["puts"],
    )


@router.get(
    "/history",
    response_model=HistoryResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_market_history(
    ticker: str = Query(..., description="Stock ticker symbol"),
    market: str = Query(..., description="Market region (US, IN, FX, CRYPTO)"),
    period: str = Query("1y", description="History period (1d/5d/1mo/3mo/6mo/1y/2y/5y/ytd/max)"),
    interval: str = Query("1d", description="Bar interval (1d/1wk/1mo)"),
    market_data: MarketDataService = Depends(get_market_data_service),
) -> HistoryResponse | ErrorResponse:
    """Fetch historical OHLCV data for a ticker."""
    from fastapi.responses import JSONResponse

    try:
        result = market_data.get_history(ticker, market, period, interval)
    except MarketDataError as err:
        return JSONResponse(
            status_code=404,
            content=ErrorResponse(
                error="history_not_available",
                message=err.message,
                fallback_available=err.fallback_available,
            ).model_dump(),
        )

    return HistoryResponse(
        ticker=result["ticker"],
        market=result["market"],
        currency=result["currency"],
        interval=result["interval"],
        bars=result["bars"],
    )
