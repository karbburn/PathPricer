"""FastAPI dependency injection utilities.

Provides single swap points for service injection (rate provider, market data service).
"""

from ..providers.market_data import MarketDataService
from ..providers.rate_provider import ManualRateProvider, RiskFreeRateProvider


def get_rate_provider() -> RiskFreeRateProvider:
    """Dependency injection provider returning a RiskFreeRateProvider instance.

    Single integration point for swapping rate providers (e.g., Manual vs BondFactor).

    Returns:
        RiskFreeRateProvider: Provider implementing RiskFreeRateProvider protocol.
    """
    return ManualRateProvider()


def get_market_data_service() -> MarketDataService:
    """Dependency injection provider returning MarketDataService instance.

    Returns:
        MarketDataService: Singleton instance of MarketDataService.
    """
    return MarketDataService()
