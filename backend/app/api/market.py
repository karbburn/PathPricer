"""Market data API endpoints.

GET /market/quote — fetches market data + historical volatility for a ticker.
No numerical logic here; delegates to MarketDataService and volatility engine.
"""

from fastapi import APIRouter, Depends, Query

from ..core.dependencies import get_market_data_service
from ..providers.market_data import MarketDataError, MarketDataService
from ..schemas.pricing import ErrorResponse, MarketQuoteResponse

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
