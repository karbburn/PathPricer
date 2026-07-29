"""Option pricing API endpoints.

POST /price/preview — Standard MC + BS only, preview-tier response.
POST /price/full — All 4 estimators, full diagnostics, convergence data, FD Greeks.

No numerical logic here; delegates to engine/ modules.
"""

from __future__ import annotations

import math
import time
from datetime import date

import numpy as np
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ..core.config import (
    DEFAULT_CONVERGENCE_GRID,
    DEFAULT_GREEKS_N,
    MAX_N_SIMULATIONS,
    MIN_N_SIMULATIONS,
    PREVIEW_MAX_N,
)
from ..core.rng import make_rng
from ..engine import black_scholes, monte_carlo
from ..engine.greeks import finite_difference_greeks
from ..schemas.pricing import (
    BSFullResult,
    BSGreeks,
    BSPreviewResult,
    ConvergenceFit,
    ConvergencePoint,
    DiagnosticsBlock,
    ErrorResponse,
    FDGreeksResult,
    MCPreviewResult,
    MCResultItem,
    PricingFullResponse,
    PricingPreviewResponse,
    PricingRequestSchema,
)

router = APIRouter(prefix="/price", tags=["pricing"])

# Terminal distribution sample cap
_TERMINAL_SAMPLE_CAP = 5000


def validate_request(req: PricingRequestSchema, max_n: int) -> ErrorResponse | None:
    """Validate pricing request. Returns ErrorResponse or None."""
    today = date.today()
    if req.expiry_date <= today:
        return ErrorResponse(
            error="invalid_expiry",
            message="Expiry date must be in the future.",
            field="expiry_date",
        )

    if req.volatility <= 0:
        return ErrorResponse(
            error="invalid_volatility",
            message="Volatility must be positive.",
            field="volatility",
        )

    if req.n_simulations < MIN_N_SIMULATIONS or req.n_simulations > max_n:
        return ErrorResponse(
            error="invalid_n_simulations",
            message=f"n_simulations must be between {MIN_N_SIMULATIONS} and {max_n}.",
            field="n_simulations",
        )

    return None


def _compute_T(expiry_date: date) -> float:
    """Compute time to expiry in years using ACT/365."""
    delta = expiry_date - date.today()
    return delta.days / 365.0


def run_full_simulation(req: PricingRequestSchema) -> PricingFullResponse:
    """Run full simulation: all 4 MC estimators, FD Greeks, convergence, diagnostics."""
    t_start = time.perf_counter()

    T = _compute_T(req.expiry_date)
    S0 = req.spot_override if req.spot_override is not None else 100.0
    r = req.risk_free_rate
    q = req.dividend_yield if req.dividend_yield is not None else 0.0
    sigma = req.volatility
    opt = req.option_type

    bs = black_scholes.price_and_greeks(S0, req.strike, T, r, q, sigma, opt)

    rng = make_rng(req.seed)
    base_Z = rng.standard_normal(req.n_simulations)

    mc_results_raw = []
    mc_std = monte_carlo.estimate_standard(
        S0, req.strike, T, r, q, sigma, opt, req.n_simulations, rng, base_Z=base_Z
    )
    mc_results_raw.append(mc_std)

    methods = (
        ["antithetic", "control_variate", "antithetic_cv"]
        if req.variance_reduction == "all"
        else [req.variance_reduction]
        if req.variance_reduction != "standard"
        else []
    )

    for method in methods:
        if method == "antithetic":
            result = monte_carlo.estimate_antithetic(
                S0, req.strike, T, r, q, sigma, opt, req.n_simulations, rng, base_Z=base_Z
            )
        elif method == "control_variate":
            result = monte_carlo.estimate_control_variate(
                S0, req.strike, T, r, q, sigma, opt, req.n_simulations, rng, base_Z=base_Z
            )
        elif method == "antithetic_cv":
            result = monte_carlo.estimate_antithetic_cv(
                S0, req.strike, T, r, q, sigma, opt, req.n_simulations, rng, base_Z=base_Z
            )
        else:
            continue
        mc_results_raw.append(result)

    mc_results = [
        MCResultItem(
            method=r.method, price=r.price, standard_error=r.standard_error,
            ci_lower=r.ci_lower, ci_upper=r.ci_upper, runtime_ms=r.runtime_ms,
            n_effective=r.n_effective, paths_per_second=r.paths_per_second,
        )
        for r in mc_results_raw
    ]

    fd = finite_difference_greeks(S0, req.strike, T, r, q, sigma, opt, seed=req.seed, n=DEFAULT_GREEKS_N)

    grid = req.convergence_grid or DEFAULT_CONVERGENCE_GRID
    convergence_data = []
    for i, n_grid in enumerate(grid):
        grid_rng = make_rng(req.seed + i)
        grid_result = monte_carlo.estimate_standard(
            S0, req.strike, T, r, q, sigma, opt, n_grid, grid_rng
        )
        convergence_data.append(ConvergencePoint(n=n_grid, standard_error=grid_result.standard_error))

    if len(convergence_data) >= 2:
        log_n = np.log([p.n for p in convergence_data])
        log_se = np.log([p.standard_error for p in convergence_data if p.standard_error > 0])
        if len(log_se) == len(log_n) and len(log_n) >= 2:
            coeffs = np.polyfit(log_n, log_se, 1)
            slope = float(coeffs[0])
            predicted = np.polyval(coeffs, log_n)
            ss_res = float(np.sum((log_se - predicted) ** 2))
            ss_tot = float(np.sum((log_se - np.mean(log_se)) ** 2))
            r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
        else:
            slope, r_squared = -0.5, 0.0
    else:
        slope, r_squared = -0.5, 0.0

    conv_fit = ConvergenceFit(slope=round(slope, 3), r_squared=round(r_squared, 3))

    discount_factor = math.exp(-r * T)
    drift = (r - q - 0.5 * sigma**2) * T
    vol_sqrt_T = sigma * math.sqrt(T)
    S_T = S0 * np.exp(drift + vol_sqrt_T * base_Z)

    if opt == "call":
        payoffs = np.maximum(S_T - req.strike, 0.0)
    else:
        payoffs = np.maximum(req.strike - S_T, 0.0)

    expected_payoff = float(np.mean(payoffs))
    terminal_mean = float(np.mean(S_T))
    terminal_std = float(np.std(S_T))
    relative_error = abs(mc_std.price - bs.price) / bs.price if bs.price != 0 else 0.0

    diagnostics = DiagnosticsBlock(
        expected_payoff=round(expected_payoff, 2),
        discount_factor=round(discount_factor, 4),
        terminal_mean=round(terminal_mean, 1),
        terminal_std=round(terminal_std, 1),
        relative_error_vs_bs=round(relative_error, 5),
    )

    if len(S_T) > _TERMINAL_SAMPLE_CAP:
        sample_rng = make_rng(req.seed + 999)
        indices = sample_rng.choice(len(S_T), size=_TERMINAL_SAMPLE_CAP, replace=False)
        terminal_sample = [float(x) for x in S_T[indices]]
    else:
        terminal_sample = [float(x) for x in S_T]

    compute_ms = (time.perf_counter() - t_start) * 1000.0

    return PricingFullResponse(
        request_echo=req,
        black_scholes=BSFullResult(
            price=bs.price,
            greeks=BSGreeks(
                delta=bs.delta, gamma=bs.gamma, vega=bs.vega, theta=bs.theta, rho=bs.rho
            ),
        ),
        mc_results=mc_results,
        greeks_fd=FDGreeksResult(
            delta=fd.delta, gamma=fd.gamma, vega=fd.vega, theta=fd.theta, rho=fd.rho,
            bump_size_used=fd.bump_sizes_used,
        ),
        convergence_data=convergence_data,
        convergence_fit=conv_fit,
        diagnostics=diagnostics,
        terminal_distribution_sample=terminal_sample,
        compute_ms=round(compute_ms, 1),
    )


@router.post(
    "/preview",
    response_model=PricingPreviewResponse,
    responses={400: {"model": ErrorResponse}},
)
def price_preview(req: PricingRequestSchema) -> PricingPreviewResponse | JSONResponse:
    """Preview-tier pricing: Standard MC + BS only, no SE/CI/diagnostics."""
    validation_err = validate_request(req, max_n=PREVIEW_MAX_N)
    if validation_err is not None:
        return JSONResponse(status_code=400, content=validation_err.model_dump())

    t_start = time.perf_counter()

    T = _compute_T(req.expiry_date)
    S0 = req.spot_override if req.spot_override is not None else 100.0
    r = req.risk_free_rate
    q = req.dividend_yield if req.dividend_yield is not None else 0.0
    sigma = req.volatility
    opt = req.option_type

    bs = black_scholes.price_and_greeks(S0, req.strike, T, r, q, sigma, opt)

    rng = make_rng(req.seed)
    mc = monte_carlo.estimate_standard(S0, req.strike, T, r, q, sigma, opt, req.n_simulations, rng)

    compute_ms = (time.perf_counter() - t_start) * 1000.0

    return PricingPreviewResponse(
        black_scholes=BSPreviewResult(price=bs.price, delta=bs.delta, gamma=bs.gamma),
        monte_carlo_standard=MCPreviewResult(price=mc.price, delta=bs.delta, gamma=bs.gamma),
        n_simulations=req.n_simulations,
        compute_ms=round(compute_ms, 1),
    )


@router.post(
    "/full",
    response_model=PricingFullResponse,
    responses={400: {"model": ErrorResponse}},
)
def price_full(req: PricingRequestSchema) -> PricingFullResponse | JSONResponse:
    """Full-tier pricing: all 4 estimators, full diagnostics, convergence, FD Greeks."""
    validation_err = validate_request(req, max_n=MAX_N_SIMULATIONS)
    if validation_err is not None:
        return JSONResponse(status_code=400, content=validation_err.model_dump())
    return run_full_simulation(req)
