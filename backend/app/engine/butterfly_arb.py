"""Butterfly (strike) arbitrage check for fitted SVI volatility slices.

A volatility surface admits a butterfly arbitrage in strike whenever the
call price is not convex in strike — equivalently, whenever the risk-neutral
density implied by the surface is negative somewhere:

    f(K) = e^{rT} d2C/dK2 >= 0   for all K

On a discrete strike grid this is checked as C(K-d) - 2C(K) + C(K+d) >= 0
for equally spaced strikes. This closes the known limitation noted in
vol_surface.py: "butterfly-arb violations in strike are not detected".

Use:
    check_surface_butterfly_arb(surface) -> list[ButterflySliceResult]

Each slice is evaluated on an equal-strike-spacing grid spanning the fitted
moneyness range; the minimum butterfly value and its strike are reported so a
badge can show exactly where the violation sits.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import black_scholes
from .vol_surface import SVISurface


@dataclass(frozen=True)
class ButterflySliceResult:
    """Butterfly-arbitrage check for one expiry slice."""

    ttm: float
    arb_free: bool
    min_butterfly: float     # min C(K-d) - 2C(K) + C(K+d) across the grid
    worst_strike: float      # strike of the minimum butterfly value
    grid_min_strike: float   # strike grid extent used for the check
    grid_max_strike: float


def _check_slice(
    surface: SVISurface,
    slice_idx: int,
    n_points: int,
    k_half_range: float,
    tol: float,
) -> ButterflySliceResult:
    """Evaluate the butterfly condition on one SVI slice."""
    slice_ = surface.slices[slice_idx]
    ttm = slice_.ttm
    forward = surface.spot * np.exp((surface.rate - surface.dividend_yield) * ttm)

    # Butterfly spread pricing requires EQUALLY-SPACED strikes in strike space,
    # so build the grid in K, then convert to log-moneyness for the SVI slice.
    strikes = np.linspace(forward * np.exp(-k_half_range), forward * np.exp(k_half_range), n_points)
    k_grid = np.log(strikes / forward)
    ivs = slice_.params.implied_vol(k_grid, ttm)

    calls = black_scholes.price_vectorized(
        surface.spot, strikes, ttm, surface.rate, surface.dividend_yield, ivs, "call"
    )
    # C(K-d) - 2C(K) + C(K+d); must be >= 0 at every interior point.
    butterflies = calls[:-2] - 2.0 * calls[1:-1] + calls[2:]
    idx_min = int(np.argmin(butterflies))
    min_butterfly = float(butterflies[idx_min])
    # Interior grid index i (1..n-2) maps to strike index i (calls[i] = K).
    worst_strike = float(strikes[idx_min + 1])

    return ButterflySliceResult(
        ttm=ttm,
        arb_free=min_butterfly >= -tol,
        min_butterfly=min_butterfly,
        worst_strike=worst_strike,
        grid_min_strike=float(strikes[0]),
        grid_max_strike=float(strikes[-1]),
    )


def check_surface_butterfly_arb(
    surface: SVISurface,
    n_points: int = 201,
    k_half_range: float = 2.0,
    tol: float | None = None,
) -> list[ButterflySliceResult]:
    """Check every slice of a fitted SVI surface for butterfly arbitrage.

    Args:
        surface: Fitted SVISurface (already calendar-arbitrage free).
        n_points: Number of strikes per slice on the equally-spaced grid.
        k_half_range: Grid spans log-moneyness [-k_half_range, +k_half_range].
        tol: A butterfly value below -tol is a violation. Defaults to a
             relative tolerance scaled by spot (1e-8 * spot) to stay robust to
             floating-point noise on high-priced underlyings.

    Returns:
        One ButterflySliceResult per surface slice, in slice order.

    Raises:
        ValueError: If the surface has no slices.
    """
    if not surface.slices:
        raise ValueError("Surface has no fitted slices.")
    if n_points < 3:
        raise ValueError("n_points must be at least 3.")
    if k_half_range <= 0:
        raise ValueError("k_half_range must be positive.")
    if tol is None:
        tol = 1e-8 * surface.spot
    return [
        _check_slice(surface, i, n_points, k_half_range, tol)
        for i in range(len(surface.slices))
    ]


def _demo() -> None:
    """Runnable self-check: a well-behaved slice is arb-free, a skewed one isn't."""
    from .vol_surface import SVIExpiry, SVIParams

    def surface_with(params: SVIParams, ttm: float = 1.0) -> SVISurface:
        return SVISurface(
            spot=100.0,
            rate=0.03,
            dividend_yield=0.0,
            slices=[SVIExpiry(ttm=ttm, params=params)],
        )

    flat = SVIParams(a=0.04, b=0.0, rho=0.0, m=0.0, sigma=0.1)
    res = check_surface_butterfly_arb(surface_with(flat))
    assert res[0].arb_free, "flat total variance must be butterfly-arb free"

    # Steep asymmetric smile: large b with rho pushed toward -1 produces a
    # negative-density region (call price non-convex) on one wing.
    skew = SVIParams(a=0.02, b=3.0, rho=-0.95, m=0.0, sigma=0.05)
    res_skew = check_surface_butterfly_arb(surface_with(skew))
    assert not res_skew[0].arb_free, "steep SVI smile must show butterfly arb"

    print("Butterfly arb self-checks passed.")


if __name__ == "__main__":
    _demo()
