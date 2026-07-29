"""Unit tests for Risk-Free Rate Provider protocol and dependency injection."""

from backend.app.core.dependencies import get_rate_provider
from backend.app.providers.rate_provider import ManualRateProvider, RiskFreeRateProvider


def test_manual_rate_provider_protocol_conformance():
    """Verify ManualRateProvider conforms to RiskFreeRateProvider protocol."""
    provider: RiskFreeRateProvider = ManualRateProvider(default_rate=0.045)
    assert isinstance(provider, RiskFreeRateProvider)

    # Rate is returned regardless of currency or tenor
    assert provider.get_rate("USD", 1.0) == 0.045
    assert provider.get_rate("INR", 0.5) == 0.045
    assert provider.get_rate("EUR", 10.0) == 0.045


def test_manual_rate_provider_set_rate():
    """Verify set_rate updates returned rate."""
    provider = ManualRateProvider(default_rate=0.05)
    assert provider.get_rate("USD", 1.0) == 0.05

    provider.set_rate(0.065)
    assert provider.get_rate("USD", 1.0) == 0.065


def test_dependency_get_rate_provider():
    """Verify core/dependencies.py get_rate_provider returns RiskFreeRateProvider."""
    provider = get_rate_provider()
    assert isinstance(provider, RiskFreeRateProvider)
    assert provider.get_rate("USD", 1.0) == 0.05
