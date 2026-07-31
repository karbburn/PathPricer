"""Market data API endpoints.

GET /market/quote    — fetches market data + historical volatility for a ticker.
GET /market/options  — fetches options chain (US equities only).
GET /market/history  — fetches historical OHLCV data.
"""

from fastapi import APIRouter, Depends, Query

from ..core.dependencies import get_market_data_service
from ..providers.market_data import MarketDataError, MarketDataService
from ..schemas.pricing import (
    ErrorResponse,
    HistoryResponse,
    MarketQuoteResponse,
    OptionsChainResponse,
)

router = APIRouter(prefix="/market", tags=["market"])


@router.get(
    "/quote",
    response_model=MarketQuoteResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_market_quote(
    ticker: str = Query(..., description="Stock ticker symbol"),
    market: str = Query(..., description="Market region (US or IN)"),
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
