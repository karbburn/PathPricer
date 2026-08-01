"""Heston model calibration to market option prices.

Fits the five Heston parameters (v0, kappa, theta_v, sigma_v, rho) so that
model prices match market option prices as closely as possible.

Approach:
    Minimize the root-mean-square relative price error over all supplied
    option contracts:

        min_{p} sqrt( mean_i ( (V_model(p) - V_mkt) / V_mkt )^2 )

    subject to the model constraints

        v0 > 0, kappa > 0, theta_v > 0, sigma_v > 0, -1 < rho < 1.

    The Feller condition 2 kappa theta_v > sigma_v^2 (which keeps the variance
    process strictly positive) is enforced as a soft penalty rather than a
    hard constraint: the optimizer is free to trade off Feller feasibility
    against fit quality, which avoids infeasible restarts and mirrors how
    practitioners treat Feller as a preference. The fitted parameters are
    reported alongside whether the condition holds.

    A multi-start scheme (default 3 restarts) mitigates the risk of converging
    to a poor local minimum, and a deterministic start based on ATM implied
    vol anchors the first attempt.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize

from .heston import HestonParams, price_european_many

_PARAM_BOUNDS = (
    (1e-6, 1.0),   # v0
    (1e-4, 10.0),  # kappa
    (1e-6, 1.0),   # theta_v
    (1e-4, 2.0),   # sigma_v
    (-0.99, 0.99),  # rho
)


@dataclass(frozen=True)
class CalibrationContract:
    """One option used in calibration."""

    strike: float
    ttm: float
    market_price: float
    option_type: str = "call"


@dataclass(frozen=True)
class CalibrationResult:
    """Fitted Heston parameters and fit quality metrics."""

    params: HestonParams
    rmse: float
    mape: float
    feller_condition_holds: bool
    n_contracts: int
    max_abs_error: float


def _market_prices(contracts: list[CalibrationContract]) -> np.ndarray:
    return np.asarray([c.market_price for c in contracts], dtype=np.float64)


def _model_prices(
    x: np.ndarray, S0: float, r: float, q: float, contracts: list[CalibrationContract]
) -> np.ndarray:
    """Price all contracts under Heston with parameter vector x = (v0, kappa, theta_v, sigma_v, rho).

    Strikes sharing the same expiry are priced in one vectorized call.
    """
    v0, kappa, theta_v, sigma_v, rho = x
    params = HestonParams(v0=float(v0), kappa=float(kappa), theta_v=float(theta_v),
                          sigma_v=float(sigma_v), rho=float(rho))
    out = np.empty(len(contracts))
    # Group indices by unique expiry AND option type to vectorize per-T pricing.
    groups: dict[tuple[float, str], list[int]] = {}
    for i, c in enumerate(contracts):
        groups.setdefault((c.ttm, c.option_type.lower()), []).append(i)
    for (ttm, opt_type), idxs in groups.items():
        ks = np.asarray([contracts[i].strike for i in idxs], dtype=np.float64)
        prices = price_european_many(S0, ks, ttm, r, q, params, opt_type)
        for j, i in enumerate(idxs):
            out[i] = prices[j]
    return out


def _objective(
    x: np.ndarray, S0: float, r: float, q: float, contracts: list[CalibrationContract]
) -> float:
    """Relative RMSE plus a Feller soft penalty."""
    mkt = _market_prices(contracts)
    model = _model_prices(x, S0, r, q, contracts)
    rel_err = (model - mkt) / mkt
    rmse = float(np.sqrt(np.mean(rel_err**2)))

    v0, kappa, theta_v, sigma_v, rho = x
    # Feller: 2 kappa theta_v - sigma_v^2 >= 0. Penalty only when violated.
    feller_gap = 2.0 * kappa * theta_v - sigma_v**2
    penalty = 0.0 if feller_gap >= 0 else 10.0 * feller_gap**2
    return rmse + penalty


def _initial_params(
    contracts: list[CalibrationContract], S0: float, r: float, q: float
) -> np.ndarray:
    """Deterministic seed: v0/theta_v from ATM implied vol, mild default rest."""
    atm_vols = []
    for c in contracts:
        fwd = S0 * math.exp((r - q) * c.ttm)
        moneyness = math.log(c.strike / fwd)
        if abs(moneyness) < 0.05:
            try:
                from .implied_vol import solve_implied_volatility

                res = solve_implied_volatility(
                    S0, c.strike, c.ttm, r, q, c.option_type, c.market_price
                )
                if res.converged and math.isfinite(res.implied_vol):
                    atm_vols.append(res.implied_vol)
            except Exception:
                continue
    if atm_vols:
        vol = sum(atm_vols) / len(atm_vols)
    else:
        vol = 0.3
    return np.array([vol**2, 2.0, vol**2, 0.3, -0.5])


def calibrate_heston(
    contracts: list[CalibrationContract],
    S0: float,
    r: float,
    q: float,
    n_restarts: int = 3,
) -> CalibrationResult:
    """Fit Heston parameters to market option prices.

    Args:
        contracts: observed option prices (strike, ttm, price, type).
        S0: underlying spot price.
        r: risk-free rate (continuous).
        q: continuous dividend yield.
        n_restarts: number of optimizer restarts from spread seeds.

    Returns:
        CalibrationResult with fitted params and fit metrics.

    Raises:
        ValueError: on invalid inputs or if calibration does not converge.
    """
    if S0 <= 0:
        raise ValueError("Spot must be positive.")
    if not contracts:
        raise ValueError("Need at least one calibration contract.")
    if any(c.market_price <= 0 for c in contracts):
        raise ValueError("Market prices must be positive.")
    if any(c.ttm <= 0 for c in contracts):
        raise ValueError("Time to maturity must be positive.")

    base = _initial_params(contracts, S0, r, q)
    seeds = [base]
    for i in range(1, max(1, n_restarts)):
        scale = np.array([1.3, 1.5, 1.3, 1.2, 1.0])
        sign = -1.0 if i % 2 else 1.0
        s = base.copy()
        s[:4] *= (scale[:4] * (0.8 + 0.4 * sign))
        s[4] = min(0.95, max(-0.95, s[4] * (1.0 + 0.25 * sign)))
        seeds.append(np.clip(s, 1e-5, 2.0))

    best = None
    best_fun = math.inf
    for seed in seeds:
        res = minimize(
            _objective, seed, args=(S0, r, q, contracts),
            method="L-BFGS-B", bounds=_PARAM_BOUNDS,
            options={"maxiter": 500, "ftol": 1e-10, "gtol": 1e-6},
        )
        if res.success and res.fun < best_fun:
            best, best_fun = res, res.fun

    if best is None or not np.all(np.isfinite(best.x)):
        raise ValueError("Heston calibration failed to converge.")

    x = best.x
    v0, kappa, theta_v, sigma_v, rho = (float(v) for v in x)
    params = HestonParams(v0=v0, kappa=kappa, theta_v=theta_v, sigma_v=sigma_v, rho=rho)

    model = _model_prices(x, S0, r, q, contracts)
    mkt = _market_prices(contracts)
    rel_err = (model - mkt) / mkt
    rmse = float(np.sqrt(np.mean(rel_err**2)))
    mape = float(np.mean(np.abs(rel_err)) * 100.0)
    max_abs = float(np.max(np.abs(model - mkt)))
    feller_ok = 2.0 * kappa * theta_v >= sigma_v**2

    return CalibrationResult(
        params=params,
        rmse=rmse,
        mape=mape,
        feller_condition_holds=feller_ok,
        n_contracts=len(contracts),
        max_abs_error=max_abs,
    )
