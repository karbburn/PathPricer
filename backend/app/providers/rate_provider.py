"""Risk-free interest rate provider abstraction and implementations.

Implements RiskFreeRateProvider protocol and ManualRateProvider.
"""

from typing import Protocol, runtime_checkable


@runtime_checkable
class RiskFreeRateProvider(Protocol):
    """Protocol defining the interface for risk-free interest rate resolution."""

    def get_rate(self, currency: str, tenor_years: float) -> float:
        """Get annualized risk-free interest rate for currency and tenor.

        Args:
            currency: Currency code (e.g. 'USD', 'INR').
            tenor_years: Option time to expiration in years.

        Returns:
            float: Continuously compounded annualized risk-free rate.
        """
        ...


class ManualRateProvider:
    """Manual risk-free rate provider (v1 implementation).

    Returns a fixed manual rate, ignoring currency and tenor parameters.
    """

    def __init__(self, default_rate: float = 0.05) -> None:
        """Initialize provider with a fixed manual rate.

        Args:
            default_rate: Annualized risk-free rate (default 0.05 = 5%).
        """
        self._manual_rate = float(default_rate)

    def get_rate(self, currency: str, tenor_years: float) -> float:
        """Return configured manual rate regardless of currency or tenor.

        Args:
            currency: Currency code (ignored).
            tenor_years: Tenor in years (ignored).

        Returns:
            float: Fixed manual risk-free rate.
        """
        return self._manual_rate

    def set_rate(self, rate: float) -> None:
        """Update configured manual risk-free rate.

        Args:
            rate: New risk-free rate value.
        """
        self._manual_rate = float(rate)


# Future integration point for BondFactor curve provider:
# class BondFactorCurveProvider(RiskFreeRateProvider):
#     """Resolves rate via BondFactor's fitted Nelson-Siegel-Svensson (NSS) curve for given tenor."""
#     pass
