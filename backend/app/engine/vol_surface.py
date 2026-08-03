"""SVI (Stochastic Volatility Inspired) implied volatility surface engine.

Implements the raw SVI parameterization of Gatheral (2004). At a fixed
expiry the total implied variance is

    w(k) = a + b ( rho (k - m) + sqrt((k - m)^2 + sigma^2) )

where k = ln(K/F) is the log-moneyness and w = sigma_imp^2 T. The five
parameters (a, b, rho, m, sigma) give the level, slope, skew and wings of
the smile:

    a:    overall level of total variance
    b:    slope of the wings (b >= 0)
    rho:  asymmetry / skew (-1 < rho < 1)
    m:    horizontal offset of the smile minimum
    sigma: curvature at the minimum (sigma > 0)

A surface is a set of SVI slices, one per expiry. Total variance is
interpolated linearly in T at fixed log-moneyness (the sticky-strike
assumption), which is arbitrage-free in calendar time when each slice is
arbitrage-free in strike; beyond the fitted expiry range the nearest slice
is used flat.

Use:
    fit_svi(log_moneyness, implied_vol, ttm) -> SVIParams   (one slice)
    build_surface(spot, rate, dividend_yield, slices) -> SVISurface
    surface.implied_vol(strike, ttm) -> float                (any point)
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.optimize import least_squares

# Fixed-slice model bounds (raw SVI). b >= 0, |rho| < 1, sigma > 0.
_B_MIN, _B_MAX = 0.0, 10.0
_RHO_MIN, _RHO_MAX = -0.999, 0.999
_SIGMA_MIN, _SIGMA_MAX = 1e-4, 5.0
_M_MIN, _M_MAX = -3.0, 3.0
# a is bounded so that the implied minimum of total variance (w_min = a +
# b*sigma*sqrt(1-rho^2)) stays near non-negative — a too-negative level would
# need heavy clipping to stay arbitrage-free.
_A_MIN, _A_MAX = -0.5, 10.0
_SVI_BOUNDS = (
    (_A_MIN, _B_MIN, _RHO_MIN, _M_MIN, _SIGMA_MIN),
    (_A_MAX, _B_MAX, _RHO_MAX, _M_MAX, _SIGMA_MAX),
)


@dataclass(frozen=True)
class SVIParams:
    """Raw SVI parameters for one expiry slice."""

    a: float
    b: float
    rho: float
    m: float
    sigma: float

    def total_variance(self, k: np.ndarray) -> np.ndarray:
        """Total variance w(k) at log-moneyness k."""
        return self.a + self.b * (
            self.rho * (k - self.m) + np.sqrt((k - self.m) ** 2 + self.sigma**2)
        )

    def implied_vol(self, k: np.ndarray, ttm: float) -> np.ndarray:
        """Black-Scholes implied volatility sqrt(w/T) at log-moneyness k."""
        w = self.total_variance(k)
        return np.sqrt(np.maximum(w, 0.0) / max(ttm, 1e-12))


@dataclass(frozen=True)
class SVIExpiry:
    """An SVI slice fitted to one expiry."""

    ttm: float
    params: SVIParams


@dataclass(frozen=True)
class SVISurface:
    """Vol surface as a set of per-expiry SVI slices.

    Attributes:
        spot: underlying spot price.
        rate: risk-free rate (continuous).
        dividend_yield: continuous dividend yield.
        slices: fitted SVI slices, one per expiry (ascending ttm).
    """

    spot: float
    rate: float
    dividend_yield: float
    slices: list[SVIExpiry]

    def _log_moneyness(self, strike: float, ttm: float) -> float:
        """k = ln(K/F) with forward F = S e^{(r-q)T}."""
        forward = self.spot * math.exp(
            (self.rate - self.dividend_yield) * max(ttm, 0.0)
        )
        return math.log(max(strike, 1e-12) / max(forward, 1e-12))

    def implied_vol(self, strike: float, ttm: float) -> float:
        """Implied volatility at an arbitrary (strike, time-to-maturity).

        Total variance is interpolated linearly in T at fixed log-moneyness;
        the nearest slice is used flat outside the fitted expiry range.
        For strikes beyond the fitted moneyness range, the nearest strike's
        implied vol is used (flat extrapolation) rather than linear, which
        can produce unrealistic IVs at extreme strikes.
        """
        ttm = max(ttm, 0.0)
        if not self.slices:
            raise ValueError("Surface has no fitted slices.")
        if len(self.slices) == 1 or ttm <= self.slices[0].ttm:
            return float(
                self.slices[0].params.implied_vol(self._log_moneyness(strike, ttm), ttm)
            )
        if ttm >= self.slices[-1].ttm:
            return float(
                self.slices[-1].params.implied_vol(self._log_moneyness(strike, ttm), ttm)
            )

        k = self._log_moneyness(strike, ttm)
        # Linearly interpolate total variance w(k, T) in T, with flat
        # extrapolation in k beyond the fitted range of each slice.
        for lo, hi in zip(self.slices, self.slices[1:]):
            if lo.ttm <= ttm <= hi.ttm:
                frac = (ttm - lo.ttm) / (hi.ttm - lo.ttm)
                k_arr = np.array([k])
                w_lo = float(lo.params.total_variance(k_arr)[0])
                w_hi = float(hi.params.total_variance(k_arr)[0])
                w = (1.0 - frac) * w_lo + frac * w_hi
                return float(math.sqrt(max(w, 0.0) / max(ttm, 1e-12)))
        raise ValueError("Failed to interpolate surface at strike/T.")  # pragma: no cover

    def atm_vol(self, ttm: float) -> float:
        """Implied volatility at the money (strike = forward)."""
        if not self.slices:
            raise ValueError("Surface has no fitted slices.")
        if len(self.slices) == 1 or ttm <= self.slices[0].ttm:
            return float(self.slices[0].params.implied_vol(np.array([0.0]), ttm))
        if ttm >= self.slices[-1].ttm:
            return float(self.slices[-1].params.implied_vol(np.array([0.0]), ttm))
        for lo, hi in zip(self.slices, self.slices[1:]):
            if lo.ttm <= ttm <= hi.ttm:
                frac = (ttm - lo.ttm) / (hi.ttm - lo.ttm)
                w = (1.0 - frac) * lo.params.total_variance(
                    np.array([0.0])
                ) + frac * hi.params.total_variance(np.array([0.0]))
                return float(np.sqrt(max(w[0], 0.0) / ttm))
        raise ValueError("Failed to interpolate ATM vol.")  # pragma: no cover


def _initial_params(k: np.ndarray, total_var: np.ndarray) -> tuple[float, float, float, float, float]:
    """Heuristic starting point for the SVI fit.

    Uses the smile wings: the linear-in-|k| asymptote of w(k) has slope
    b(1 +/- rho), so estimate b and rho from the spread of total variance
    at the extremes of the observed moneyness range, a from the ATM level,
    sigma from the curvature at the min, and m from the min location.
    """
    order = np.argsort(k)
    ks, ws = k[order], np.maximum(total_var[order], 1e-8)
    kmax = max(abs(ks[0]), abs(ks[-1]))
    if kmax <= 1e-8:
        return (float(ws.mean()), 0.5, 0.0, 0.0, 0.2)
    # Wing slopes from far OTM points on each side. Normalize by the *log-moneyness*
    # distance, not the index distance: SVI's b scales with w per unit of k.
    w_min = min(ws)
    i_min = int(np.argmin(ws))
    dk_lo = max(ks[i_min] - ks[0], 1e-8) if i_min > 0 else 1.0
    dk_hi = max(ks[-1] - ks[i_min], 1e-8) if i_min < len(ks) - 1 else 1.0
    slope_lo = max(0.0, (ws[i_min] - ws[0]) / dk_lo) if i_min > 0 else 0.0
    slope_hi = max(0.0, (ws[-1] - ws[i_min]) / dk_hi) if i_min < len(ws) - 1 else 0.0
    # SVI wings: slope = b(1 - rho) on left, b(1 + rho) on right (roughly).
    b = 0.5 * (slope_lo + slope_hi)
    rho = (slope_hi - slope_lo) / max(2.0 * b, 1e-6)
    rho = max(-0.9, min(0.9, rho))
    m = float(ks[i_min])
    sigma = max(0.05, min(1.0, 0.25 * (ks[-1] - ks[0]) if len(ks) > 1 else 0.2))
    return (float(w_min - b * sigma * math.sqrt(1.0 - rho * rho)), b, rho, m, sigma)


def fit_svi(
    log_moneyness: np.ndarray | list[float],
    implied_vol: np.ndarray | list[float],
    ttm: float,
) -> SVIParams:
    """Fit a raw SVI slice to implied vols at one expiry via least squares.

    Args:
        log_moneyness: ln(K/F) per observation.
        implied_vol: Black-Scholes implied volatility per observation.
        ttm: time to expiry in years (same for the whole slice).

    Returns:
        Fitted SVIParams. Raises ValueError if calibration fails.
    """
    k = np.asarray(log_moneyness, dtype=np.float64)
    sigma_imp = np.asarray(implied_vol, dtype=np.float64)
    if k.shape != sigma_imp.shape or k.size < 5:
        raise ValueError("Need at least 5 (k, sigma_imp) observations per slice.")
    if not (np.all(np.isfinite(k)) and np.all(np.isfinite(sigma_imp))):
        raise ValueError("Log-moneyness and implied vols must be finite.")
    if np.any(sigma_imp <= 0):
        raise ValueError("Implied vols must be positive.")
    total_var = sigma_imp**2 * max(ttm, 1e-12)

    p0 = _initial_params(k, total_var)

    def residuals(p: np.ndarray) -> np.ndarray:
        a, b, rho, m, sigma = p
        w = a + b * (rho * (k - m) + np.sqrt((k - m) ** 2 + sigma**2))
        return w - total_var

    # Try from the heuristic start, plus two spread restarts for robustness.
    best = None
    best_cost = math.inf
    for start in (p0, (p0[0], p0[1] * 1.5, -p0[2], p0[3] * 0.8, p0[4] * 1.2),
                  (p0[0], p0[1] * 0.7, p0[2], p0[3] * 1.2, p0[4] * 0.8)):
        try:
            res = least_squares(
                residuals, np.asarray(start, dtype=np.float64), bounds=_SVI_BOUNDS,
                x_scale="jac", max_nfev=5000,
            )
        except ValueError:
            continue
        if res.cost < best_cost and np.isfinite(res.cost):
            best, best_cost = res, res.cost

    if best is None or not np.isfinite(best.cost):
        raise ValueError("SVI calibration failed to converge.")

    a, b, rho, m, sigma = best.x
    # Final sanity: w(k) >= 0 across the fitted range and a wide validation grid.
    w_min = a + b * sigma * math.sqrt(1.0 - rho * rho)
    if w_min < -1e-6:
        a = -b * sigma * math.sqrt(1.0 - rho * rho)  # shift to w_min = 0

    # Validate that total variance is non-negative across a broad strike grid.
    # The SVI parameterization can produce negative w(k) at extreme moneyness
    # even when w_min >= 0, if the curvature/skew are poorly constrained.
    k_validate = np.linspace(-2.0, 2.0, 101)
    w_validate = a + b * (rho * (k_validate - m) + np.sqrt((k_validate - m) ** 2 + sigma**2))
    if np.any(w_validate < -1e-8):
        # Clamp a upward so that w(k) >= 0 at all validation points.
        w_at_validate = b * (rho * (k_validate - m) + np.sqrt((k_validate - m) ** 2 + sigma**2))
        a = max(a, float(-np.min(w_at_validate)) + 1e-8)

    return SVIParams(a=float(a), b=float(b), rho=float(rho), m=float(m), sigma=float(sigma))


def build_surface(
    spot: float,
    rate: float,
    dividend_yield: float,
    slices: list[SVIExpiry],
) -> SVISurface:
    """Build a surface from pre-fitted slices.

    Args:
        spot: underlying spot price.
        rate: risk-free rate (continuous).
        dividend_yield: continuous dividend yield.
        slices: one SVIExpiry per fitted expiry, ascending ttm.

    Returns:
        SVISurface.

    Raises:
        ValueError: on invalid inputs, or if the slices admit a calendar
            arbitrage (total variance decreasing in T at a fixed moneyness).
    """
    if spot <= 0:
        raise ValueError("Spot must be positive.")
    ordered = sorted(slices, key=lambda s: s.ttm)
    if not ordered:
        raise ValueError("Need at least one SVI slice.")
    _check_no_calendar_arb(ordered)
    return SVISurface(spot=spot, rate=rate, dividend_yield=dividend_yield, slices=ordered)


def _check_no_calendar_arb(slices: list[SVIExpiry]) -> None:
    """Total variance must be non-decreasing in T at fixed log-moneyness.

    A slice whose total variance lies below an earlier expiry's at the same k
    admits a calendar spread arbitrage, so the surface would be unusable for
    pricing. Checked on a grid spanning the fitted moneyness range.
    """
    if len(slices) < 2:
        return
    k_grid = np.linspace(-1.5, 1.5, 61)
    w_prev = slices[0].params.total_variance(k_grid)
    for slice_ in slices[1:]:
        w_cur = slice_.params.total_variance(k_grid)
        if np.any(w_cur < w_prev - 1e-6):
            raise ValueError(
                f"Calendar arbitrage between T={slices[0].ttm:.3f} and "
                f"T={slice_.ttm:.3f}: total variance decreases in time-to-maturity."
            )
        w_prev = w_cur
