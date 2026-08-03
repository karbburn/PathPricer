"""Greeks surface engine: a chosen Greek across strikes x expiries.

Evaluates a single Greek (or price) on a strike x time-to-maturity grid where
each point uses the implied volatility of the fitted market SVI surface — so
the surface reflects the smile/skew, not a flat vol. Strikes span a band
around spot; expiries are the fitted surface slices.

All strikes for one expiry are evaluated in a single vectorized
Black-Scholes call, so the whole grid is a small number of array operations
rather than per-cell Python loops.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import black_scholes
from .vol_surface import SVISurface

VALID_METRICS = {"price", "delta", "gamma", "vega", "theta", "rho"}


@dataclass(frozen=True)
class GreeksSurfaceResult:
    """A metric evaluated on a strike x expiry grid.

    grid[j][i] is the metric at (x_values[i], y_values[j]): strike = x,
    time-to-maturity = y.
    """

    x_values: list[float]      # strikes
    y_values: list[float]      # ttms (one per fitted slice)
    grid: list[list[float]]    # shape (len(y_values), len(x_values))
    metric: str


def compute_greeks_surface(
    surface: SVISurface,
    metric: str,
    num_strikes: int = 25,
    strike_min_pct: float = 0.7,
    strike_max_pct: float = 1.3,
    option_type: str = "call",
) -> GreeksSurfaceResult:
    """Compute a Greek/price across the surface's strike x expiry grid.

    Args:
        surface: Fitted SVISurface (its slices define the expiries and the
            implied vols used to price every grid cell).
        metric: One of price/delta/gamma/vega/theta/rho.
        num_strikes: Grid points along the strike axis.
        strike_min_pct / strike_max_pct: Strike band as a fraction of spot.
        option_type: 'call' or 'put'.

    Returns:
        GreeksSurfaceResult with x_values (strikes), y_values (ttms), and the
        metric grid.

    Raises:
        ValueError: On an invalid metric, empty surface, or bad parameters.
    """
    met = metric.lower()
    if met not in VALID_METRICS:
        raise ValueError(f"Invalid metric: '{metric}'. Must be one of {sorted(VALID_METRICS)}.")
    if not surface.slices:
        raise ValueError("Surface has no fitted slices.")
    if num_strikes < 2:
        raise ValueError("num_strikes must be at least 2.")
    if not (0 < strike_min_pct < strike_max_pct):
        raise ValueError("strike band must satisfy 0 < min_pct < max_pct.")

    strikes = np.linspace(
        surface.spot * strike_min_pct, surface.spot * strike_max_pct, num_strikes
    )
    x_values = [float(s) for s in strikes]
    y_values: list[float] = []

    grid: list[list[float]] = []
    for expiry in surface.slices:
        ttm = expiry.ttm
        y_values.append(ttm)
        forward = surface.spot * np.exp((surface.rate - surface.dividend_yield) * ttm)
        k = np.log(strikes / forward)
        ivs = expiry.params.implied_vol(k, ttm)
        res = black_scholes.price_and_greeks_vectorized(
            surface.spot, strikes, ttm, surface.rate, surface.dividend_yield, ivs, option_type
        )
        grid.append([float(v) for v in getattr(res, met)])

    return GreeksSurfaceResult(
        x_values=x_values,
        y_values=y_values,
        grid=grid,
        metric=met,
    )


def _demo() -> None:
    """Runnable self-check against known Greeks values."""
    from .vol_surface import SVIExpiry, SVIParams

    # Flat 20% vol surface => Greeks match closed-form flat-vol BS.
    surface = SVISurface(
        spot=100.0,
        rate=0.05,
        dividend_yield=0.0,
        slices=[
            SVIExpiry(ttm=0.25, params=SVIParams(a=0.04 * 0.25, b=0.0, rho=0.0, m=0.0, sigma=0.1)),
            SVIExpiry(ttm=1.0, params=SVIParams(a=0.04, b=0.0, rho=0.0, m=0.0, sigma=0.1)),
        ],
    )

    res = compute_greeks_surface(surface, "delta", num_strikes=21)
    assert res.metric == "delta"
    assert len(res.x_values) == 21
    assert len(res.y_values) == 2
    assert len(res.grid) == 2 and len(res.grid[0]) == 21

    # ATM (strike = forward) call delta ~ N(d1) with d1 ~ sigma*sqrt(T)/2 ~ 0.1,
    # so delta ~ 0.54 (0.25y) and 0.58 (1y), far from the flat-vol-at-spot value.
    idx_atm = np.argmin(np.abs(np.array(res.x_values) - 100.0))
    d_short, d_long = res.grid[0][idx_atm], res.grid[1][idx_atm]
    assert 0.50 < d_short < 0.60, f"short delta {d_short} outside 0.50-0.60"
    assert 0.60 < d_long < 0.68, f"long delta {d_long} outside 0.60-0.68"

    # Put delta must be call delta - 1 (put-call parity on deltas).
    res_put = compute_greeks_surface(surface, "delta", num_strikes=21, option_type="put")
    np.testing.assert_allclose(
        np.array(res_put.grid) - np.array(res.grid), -1.0, atol=1e-9
    )

    # Price surface must be non-negative everywhere and increase toward ITM.
    res_price = compute_greeks_surface(surface, "price", num_strikes=21)
    assert all(v >= 0.0 for row in res_price.grid for v in row)
    assert res_price.grid[0][0] > res_price.grid[0][-1]  # low strike (ITM) > high strike (OTM)

    try:
        compute_greeks_surface(surface, "bogus")
        assert False, "invalid metric must raise"
    except ValueError:
        pass

    print("Greeks surface self-checks passed.")


if __name__ == "__main__":
    _demo()
