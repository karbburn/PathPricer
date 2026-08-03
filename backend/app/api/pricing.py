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
    BUMP_FRACTION_DEFAULT,
    DEFAULT_CONVERGENCE_GRID,
    DEFAULT_GREEKS_N,
    MAX_N_SIMULATIONS,
    MIN_N_SIMULATIONS,
    PREVIEW_MAX_N,
)
from ..core.rng import make_rng
from ..engine import black_scholes, implied_vol, monte_carlo, pnl_explain, risk_grid, strategy, stress_test
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
    ImpliedVolRequest,
    ImpliedVolResponse,
    MCPreviewResult,
    MCResultItem,
    PnLExplainRequest,
    PnLExplainResponse,
    PricingFullResponse,
    PricingPreviewResponse,
    PricingRequestSchema,
    RiskGridRequest,
    RiskGridResponse,
    StrategyLegResultSchema,
    StrategyRequest,
    StrategyResponse,
    StressScenarioResultSchema,
    StressTestRequest,
    StressTestResponse,
)

router = APIRouter(prefix="/price", tags=["pricing"])

# Terminal distribution sample cap
_TERMINAL_SAMPLE_CAP = 5000


def _validate_common(req) -> ErrorResponse | None:
    """Validate fields shared by every pricing endpoint.

    Returns ErrorResponse or None. Spot must be positive (a negative spot
    silently produces NaN prices) and the rate must stay in a sane range.
    """
    today = date.today()
    if req.expiry_date <= today:
        return ErrorResponse(
            error="invalid_expiry",
            message="Expiry date must be in the future.",
            field="expiry_date",
        )

    if req.spot_override is not None and req.spot_override <= 0:
        return ErrorResponse(
            error="invalid_spot",
            message="Spot price must be positive.",
            field="spot_override",
        )

    if not -1.0 <= req.risk_free_rate <= 1.0:
        return ErrorResponse(
            error="invalid_rate",
            message="Risk-free rate must be between -100% and 100%.",
            field="risk_free_rate",
        )

    return None


def validate_request(req: PricingRequestSchema, max_n: int) -> ErrorResponse | None:
    """Validate pricing request. Returns ErrorResponse or None."""
    common_err = _validate_common(req)
    if common_err is not None:
        return common_err

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


def _carry_yield(req: PricingRequestSchema) -> float:
    """Cost-of-carry yield (q) for the request.

    Cryptocurrencies pay no dividends, so their carry yield is always zero
    even if a dividend_yield was supplied.
    """
    if req.market == "CRYPTO":
        return 0.0
    return req.dividend_yield if req.dividend_yield is not None else 0.0


def run_full_simulation(req: PricingRequestSchema) -> PricingFullResponse:
    """Run full simulation: all 4 MC estimators, FD Greeks, convergence, diagnostics."""
    t_start = time.perf_counter()

    T = _compute_T(req.expiry_date)
    S0 = req.spot_override if req.spot_override is not None else 100.0
    r = req.risk_free_rate
    q = _carry_yield(req)
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
        ["antithetic", "control_variate", "antithetic_cv", "quasi_monte_carlo"]
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
        elif method == "quasi_monte_carlo":
            result = monte_carlo.estimate_qmc(
                S0, req.strike, T, r, q, sigma, opt, req.n_simulations, seed=req.seed
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
    q = _carry_yield(req)
    sigma = req.volatility
    opt = req.option_type

    bs = black_scholes.price_and_greeks(S0, req.strike, T, r, q, sigma, opt)

    rng = make_rng(req.seed)
    base_Z = rng.standard_normal(req.n_simulations)

    mc = monte_carlo.estimate_standard(
        S0, req.strike, T, r, q, sigma, opt, req.n_simulations, rng, base_Z=base_Z
    )

    # MC delta/gamma via central finite difference under Common Random Numbers,
    # so sampling noise cancels between the bumped scenarios.
    h_S = max(BUMP_FRACTION_DEFAULT * S0, 1e-4)
    mc_price_up = monte_carlo.estimate_standard(
        S0 + h_S, req.strike, T, r, q, sigma, opt, req.n_simulations, rng, base_Z=base_Z
    ).price
    mc_price_down = monte_carlo.estimate_standard(
        S0 - h_S, req.strike, T, r, q, sigma, opt, req.n_simulations, rng, base_Z=base_Z
    ).price
    mc_delta = (mc_price_up - mc_price_down) / (2.0 * h_S)
    mc_gamma = (mc_price_up - 2.0 * mc.price + mc_price_down) / (h_S**2)

    compute_ms = (time.perf_counter() - t_start) * 1000.0

    return PricingPreviewResponse(
        black_scholes=BSPreviewResult(price=bs.price, delta=bs.delta, gamma=bs.gamma),
        monte_carlo_standard=MCPreviewResult(
            price=mc.price, delta=round(mc_delta, 4), gamma=round(mc_gamma, 4)
        ),
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


@router.post(
    "/implied-vol",
    response_model=ImpliedVolResponse,
    responses={400: {"model": ErrorResponse}},
)
def price_implied_vol(req: ImpliedVolRequest) -> ImpliedVolResponse | JSONResponse:
    """Solve for Black-Scholes implied volatility given market option price."""
    common_err = _validate_common(req)
    if common_err is not None:
        return JSONResponse(status_code=400, content=common_err.model_dump())

    if req.market_price <= 0:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="invalid_market_price",
                message="Market price must be positive.",
                field="market_price",
            ).model_dump(),
        )

    if req.strike <= 0:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="invalid_strike",
                message="Strike price must be positive.",
                field="strike",
            ).model_dump(),
        )

    T = _compute_T(req.expiry_date)
    S0 = req.spot_override if req.spot_override is not None else 100.0
    r = req.risk_free_rate
    q = _carry_yield(req)

    try:
        res = implied_vol.solve_implied_volatility(
            S0=S0,
            K=req.strike,
            T=T,
            r=r,
            q=q,
            option_type=req.option_type,
            market_price=req.market_price,
        )
        return ImpliedVolResponse(
            implied_vol=res.implied_vol,
            iterations_used=res.iterations_used,
            method_used=res.method_used,
            converged=res.converged,
            final_residual=res.final_residual,
            bs_price_at_solution=res.bs_price_at_solution,
        )
    except implied_vol.ImpliedVolError as exc:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="no_solution_exists",
                message=str(exc),
                field="market_price",
            ).model_dump(),
        )


@router.post(
    "/pnl-explain",
    response_model=PnLExplainResponse,
    responses={400: {"model": ErrorResponse}},
)
def price_pnl_explain(req: PnLExplainRequest) -> PnLExplainResponse | JSONResponse:
    """Decompose actual option P&L into Greek-attributed components and unexplained residual."""
    common_err = _validate_common(req)
    if common_err is not None:
        return JSONResponse(status_code=400, content=common_err.model_dump())

    if req.volatility <= 0:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="invalid_volatility",
                message="Volatility must be positive.",
                field="volatility",
            ).model_dump(),
        )

    if req.strike <= 0:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="invalid_strike",
                message="Strike price must be positive.",
                field="strike",
            ).model_dump(),
        )

    T = _compute_T(req.expiry_date)
    S0 = req.spot_override if req.spot_override is not None else 100.0
    r = req.risk_free_rate
    q = _carry_yield(req)

    res = pnl_explain.explain_pnl(
        S0=S0,
        K=req.strike,
        T=T,
        r=r,
        q=q,
        sigma=req.volatility,
        option_type=req.option_type,
        d_spot=req.shift.d_spot,
        d_vol=req.shift.d_vol,
        d_days=req.shift.d_days,
        d_rate=req.shift.d_rate,
    )

    return PnLExplainResponse(
        base_price=res.base_price,
        shifted_price=res.shifted_price,
        actual_pnl=res.actual_pnl,
        predicted_pnl_total=res.predicted_pnl_total,
        delta_pnl=res.delta_pnl,
        gamma_pnl=res.gamma_pnl,
        vega_pnl=res.vega_pnl,
        theta_pnl=res.theta_pnl,
        rho_pnl=res.rho_pnl,
        unexplained_pnl=res.unexplained_pnl,
    )


@router.post(
    "/risk-grid",
    response_model=RiskGridResponse,
    responses={400: {"model": ErrorResponse}},
)
def compute_risk_grid_endpoint(req: RiskGridRequest) -> RiskGridResponse | JSONResponse:
    """Compute 2D option price or Greek risk grid across specified parameter ranges."""
    common_err = _validate_common(req)
    if common_err is not None:
        return JSONResponse(status_code=400, content=common_err.model_dump())

    if req.volatility <= 0:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="invalid_volatility",
                message="Volatility must be positive.",
                field="volatility",
            ).model_dump(),
        )

    if req.strike <= 0:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="invalid_strike",
                message="Strike price must be positive.",
                field="strike",
            ).model_dump(),
        )

    S0 = req.spot_override if req.spot_override is not None else 100.0
    r = req.risk_free_rate
    q = _carry_yield(req)
    T = _compute_T(req.expiry_date)

    try:
        res = risk_grid.compute_risk_grid(
            S0=S0,
            K=req.strike,
            T=T,
            r=r,
            q=q,
            sigma=req.volatility,
            option_type=req.option_type,
            axis_x=req.axis_x,
            axis_y=req.axis_y,
            x_min=req.x_range.min,
            x_max=req.x_range.max,
            num_x=req.x_range.num_points,
            y_min=req.y_range.min,
            y_max=req.y_range.max,
            num_y=req.y_range.num_points,
            metric=req.metric,
        )
    except risk_grid.RiskGridError as e:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="invalid_grid_range",
                message=str(e),
                field="x_range/y_range",
            ).model_dump(),
        )

    return RiskGridResponse(
        x_values=res.x_values,
        y_values=res.y_values,
        grid=res.grid,
        metric=res.metric,
        axis_x=res.axis_x,
        axis_y=res.axis_y,
    )


@router.post(
    "/strategy",
    response_model=StrategyResponse,
    responses={400: {"model": ErrorResponse}},
)
def price_strategy_endpoint(req: StrategyRequest) -> StrategyResponse | JSONResponse:
    """Price a multi-leg option strategy: per-leg prices, net Greeks, payoff curve, breakevens."""
    from datetime import date as _date

    for leg in req.legs:
        if leg.expiry_date <= _date.today():
            return JSONResponse(
                status_code=400,
                content=ErrorResponse(
                    error="invalid_expiry",
                    message="Expiry date must be in the future.",
                    field="expiry_date",
                ).model_dump(),
            )
        if leg.option_type in ("call", "put") and leg.strike is None:
            return JSONResponse(
                status_code=400,
                content=ErrorResponse(
                    error="invalid_strike",
                    message="Call/put legs require a strike.",
                    field="strike",
                ).model_dump(),
            )

    legs = [
        strategy.StrategyLeg(
            option_type=leg.option_type,
            strike=leg.strike,
            expiry_date=leg.expiry_date.isoformat(),
            quantity=leg.quantity,
            volatility=leg.volatility,
            risk_free_rate=leg.risk_free_rate,
            dividend_yield=leg.dividend_yield,
        )
        for leg in req.legs
    ]

    res = strategy.price_strategy(legs=legs, spot=req.spot)

    return StrategyResponse(
        net_premium=res.net_premium,
        net_delta=res.net_delta,
        net_gamma=res.net_gamma,
        net_vega=res.net_vega,
        net_theta=res.net_theta,
        net_rho=res.net_rho,
        payoff_spots=res.payoff_spots,
        payoff_values=res.payoff_values,
        breakevens=res.breakevens,
        max_profit=res.max_profit,
        max_loss=res.max_loss,
        is_credit=res.is_credit,
        legs=[
            StrategyLegResultSchema(
                leg_index=l.leg_index,
                option_type=l.option_type,
                strike=l.strike,
                expiry_date=l.expiry_date,
                quantity=l.quantity,
                ttm=l.ttm,
                price=l.price,
                delta=l.delta,
                gamma=l.gamma,
                vega=l.vega,
                theta=l.theta,
                rho=l.rho,
            )
            for l in res.legs
        ],
    )


@router.post(
    "/stress-test",
    response_model=StressTestResponse,
    responses={400: {"model": ErrorResponse}},
)
def price_stress_test(req: StressTestRequest) -> StressTestResponse | JSONResponse:
    """Reprice an option under named stress scenarios and report P&L impact."""
    common_err = _validate_common(req)
    if common_err is not None:
        return JSONResponse(status_code=400, content=common_err.model_dump())

    if req.volatility <= 0:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="invalid_volatility",
                message="Volatility must be positive.",
                field="volatility",
            ).model_dump(),
        )

    T = _compute_T(req.expiry_date)
    S0 = req.spot_override if req.spot_override is not None else 100.0
    r = req.risk_free_rate
    q = _carry_yield(req)

    scenarios = None
    if req.scenarios is not None:
        scenarios = [
            stress_test.StressScenario(
                name=s.name,
                description=s.description,
                d_spot=s.d_spot,
                d_spot_pct=s.d_spot_pct,
                d_vol=s.d_vol,
                d_days=s.d_days,
                d_rate=s.d_rate,
            )
            for s in req.scenarios
        ]

    res = stress_test.run_stress_test(
        S0=S0,
        K=req.strike,
        T=T,
        r=r,
        q=q,
        sigma=req.volatility,
        option_type=req.option_type,
        scenarios=scenarios,
    )

    return StressTestResponse(
        base_price=res.base_price,
        base_spot=res.base_spot,
        scenarios=[
            StressScenarioResultSchema(
                name=s.name,
                description=s.description,
                spot=s.spot,
                volatility=s.volatility,
                price=s.price,
                pnl=s.pnl,
                pnl_pct=s.pnl_pct,
            )
            for s in res.scenarios
        ],
        worst_pnl=res.worst_pnl,
        worst_scenario=res.worst_scenario,
        best_pnl=res.best_pnl,
        best_scenario=res.best_scenario,
        unrealized_risk=res.unrealized_risk,
    )



