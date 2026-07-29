"""Historical volatility estimation engine.

Implements close-to-close log-return historical volatility estimator
and trailing window sweeps.
"""

import math
import numpy as np


def historical_volatility(prices: np.ndarray | list[float], window: int = 252) -> float:
    """Calculate annualized historical volatility using close-to-close log returns.

    Formula:
        sigma = sqrt(252) * std(r_i, ddof=1)
        where r_i = ln(P_i / P_{i-1})

    Args:
        prices: Array of closing prices.
        window: Trailing window size in trading days (default 252).

    Returns:
        float: Annualized volatility as a decimal.
    """
    price_arr = np.asarray(prices, dtype=np.float64)
    if len(price_arr) < 2:
        return 0.0

    # Calculate log returns: r_i = ln(P_i / P_{i-1})
    log_returns = np.diff(np.log(price_arr))

    # Slice trailing window
    if len(log_returns) >= window:
        trailing_returns = log_returns[-window:]
    else:
        trailing_returns = log_returns

    if len(trailing_returns) < 2:
        return 0.0

    std_dev = float(np.std(trailing_returns, ddof=1))
    return float(math.sqrt(252.0) * std_dev)


def all_windows_volatility(prices: np.ndarray | list[float]) -> dict[str, float]:
    """Calculate trailing historical volatility across 20d, 60d, 126d, and 252d windows.

    Args:
        prices: Array of closing prices.

    Returns:
        dict[str, float]: Dictionary mapping window labels ('20d', '60d', '126d', '252d')
            to annualized volatility estimates.
    """
    windows = {"20d": 20, "60d": 60, "126d": 126, "252d": 252}
    return {
        label: historical_volatility(prices, window=w) for label, w in windows.items()
    }
