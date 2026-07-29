"""Unit tests for historical volatility estimation (backend/app/engine/volatility.py)."""

import math
import numpy as np
import pytest
from backend.app.engine import volatility


def test_historical_volatility_flat_prices():
    """Flat prices have 0 volatility."""
    prices = [100.0] * 50
    assert volatility.historical_volatility(prices) == 0.0


def test_historical_volatility_known_synthetic_series():
    """Verify log-return standard deviation annualized with sqrt(252)."""
    # Create prices with known log returns
    np.random.seed(42)
    daily_vol = 0.01  # 1% daily std
    returns = np.random.normal(0, daily_vol, 252)
    prices = 100.0 * np.exp(np.cumsum(returns))
    prices = np.insert(prices, 0, 100.0)

    vol = volatility.historical_volatility(prices, window=252)
    expected_vol = math.sqrt(252.0) * float(np.std(returns, ddof=1))
    assert vol == pytest.approx(expected_vol, abs=1e-6)


def test_all_windows_volatility_structure():
    """Verify all_windows_volatility returns dict with 20d, 60d, 126d, 252d keys."""
    prices = [100.0 + i * 0.1 for i in range(300)]
    vols = volatility.all_windows_volatility(prices)

    assert set(vols.keys()) == {"20d", "60d", "126d", "252d"}
    assert all(v > 0 for v in vols.values())
