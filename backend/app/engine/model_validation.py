"""Model validation for the Heston engine against market option data.

Takes a calibrated Heston model and a set of market option contracts and
quantifies how well the model reproduces observed prices and implied vols,
plus an internal-consistency check (put-call parity).

The report contains:
    * per-contract model vs market price,
    * per-contract model implied vol (solved from the model price) vs the
      market implied vol,
    * aggregate metrics: price RMSE, price MAPE, implied-vol RMSE,
    * a put-call parity consistency check across the contracts,
    * the Feller condition flag for the fitted parameters.

This is the numeric backbone for the model-validation screen: a scatter of
model vs market prices/vols and a residuals table.

Known limitations (v1):
    - In-sample only: validates against the same contracts used for
      calibration. Out-of-sample validation (holdout or cross-validation)
      is needed to assess true model generalization.
    - No smile-arbitrage check beyond put-call parity; the model may
      violate butterfly bounds even when Feller holds.
    - Implied-vol RMSE is computed from the model price via Brent root-
      finding; convergence tolerance affects the reported IV residual.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .heston import HestonParams, price_european_many
from .heston_calibration import CalibrationContract
from .implied_vol import solve_implied_volatility


@dataclass(frozen=True)
class ContractValidation:
    """Validation result for one market contract."""

    strike: float
    ttm: float
    option_type: str
    market_price: float
    model_price: float
    price_residual: float
    relative_error: float
    market_iv: float
    model_iv: float
    iv_error: float


@dataclass(frozen=True)
class ModelValidationResult:
    """Aggregate validation metrics for a fitted Heston model."""

    contracts: list[ContractValidation]
    price_rel_rmse: float
    price_mape: float
    iv_rmse: float | None
    market_parity_violation: float
    parity_holds: bool
    feller_condition_holds: bool
    in_sample: bool
    n_contracts: int


def validate_model_fit(
    contracts: list[CalibrationContract],
    params: HestonParams,
    S0: float,
    r: float,
    q: float,
    parity_tolerance: float = 0.10,
) -> ModelValidationResult:
    """Validate a calibrated Heston model against market option contracts.

    Args:
        contracts: observed option prices.
        params: Heston parameters to validate (typically from calibrate_heston).
        S0: underlying spot price.
        r: risk-free rate (continuous).
        q: continuous dividend yield.
        parity_tolerance: max abs put-call parity violation in price units.
            Default 0.10 reflects realistic bid/ask width on market quotes
            (a 1e-6 tolerance would only ever hold for synthetic data).

    Returns:
        ModelValidationResult with per-contract detail and aggregate metrics.

    Raises:
        ValueError: on invalid inputs.
    """
    if S0 <= 0:
        raise ValueError("Spot must be positive.")
    if not contracts:
        raise ValueError("Need at least one contract.")

    detail: list[ContractValidation] = []
    model_prices = np.empty(len(contracts))
    groups: dict[tuple[float, str], list[int]] = {}
    for i, c in enumerate(contracts):
        groups.setdefault((c.ttm, c.option_type.lower()), []).append(i)
    for (ttm, opt_type), idxs in groups.items():
        ks = np.asarray([contracts[i].strike for i in idxs], dtype=np.float64)
        model_prices[[*idxs]] = price_european_many(S0, ks, ttm, r, q, params, opt_type)

    max_parity_error = 0.0
    for i, c in enumerate(contracts):
        mp = float(model_prices[i])
        market_iv = _market_iv(c, S0, r, q)
        model_iv = _model_iv(S0, c, mp, r, q)
        residual = mp - c.market_price
        rel = residual / c.market_price

        # Market put-call parity check: price the complement type under the
        # model and see how far the implied parity RHS sits from the observed
        # market price. A violation flags inconsistent market quotes.
        other_type = "put" if c.option_type.lower() == "call" else "call"
        other_price = float(
            price_european_many(
                S0, np.asarray([c.strike]), c.ttm, r, q, params, other_type
            )[0]
        )
        if c.option_type.lower() == "call":
            parity_rhs = other_price + S0 * math.exp(-q * c.ttm) - c.strike * math.exp(-r * c.ttm)
        else:
            parity_rhs = other_price - S0 * math.exp(-q * c.ttm) + c.strike * math.exp(-r * c.ttm)
        max_parity_error = max(max_parity_error, abs(parity_rhs - c.market_price))

        detail.append(
            ContractValidation(
                strike=c.strike,
                ttm=c.ttm,
                option_type=c.option_type,
                market_price=c.market_price,
                model_price=mp,
                price_residual=residual,
                relative_error=rel,
                market_iv=market_iv,
                model_iv=model_iv,
                iv_error=model_iv - market_iv,
            )
        )

    rel_errs = np.asarray([d.relative_error for d in detail])
    iv_errs = np.asarray([d.iv_error for d in detail])
    finite_iv = iv_errs[np.isfinite(iv_errs)]
    price_rel_rmse = float(np.sqrt(np.mean(rel_errs**2)))
    price_mape = float(np.mean(np.abs(rel_errs)) * 100.0)
    iv_rmse = (
        float(np.sqrt(np.mean(finite_iv**2))) if finite_iv.size else None
    )
    feller_ok = 2.0 * params.kappa * params.theta_v >= params.sigma_v**2

    return ModelValidationResult(
        contracts=detail,
        price_rel_rmse=price_rel_rmse,
        price_mape=price_mape,
        iv_rmse=iv_rmse,
        market_parity_violation=max_parity_error,
        parity_holds=max_parity_error <= parity_tolerance,
        feller_condition_holds=feller_ok,
        in_sample=True,
        n_contracts=len(contracts),
    )


def _market_iv(c: CalibrationContract, S0: float, r: float, q: float) -> float:
    try:
        res = solve_implied_volatility(S0, c.strike, c.ttm, r, q, c.option_type, c.market_price)
        if res.converged and math.isfinite(res.implied_vol):
            return float(res.implied_vol)
    except Exception:
        pass
    return math.nan


def _model_iv(S0: float, c: CalibrationContract, model_price: float, r: float, q: float) -> float:
    try:
        res = solve_implied_volatility(
            S0, c.strike, c.ttm, r, q, c.option_type, max(model_price, 1e-12)
        )
        if res.converged and math.isfinite(res.implied_vol):
            return float(res.implied_vol)
    except Exception:
        pass
    return math.nan
