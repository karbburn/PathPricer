"""Pydantic schemas for API request/response models.

Mirrors API Specification JSON shapes exactly. Preview and Full
response types are deliberately distinct to enforce the two-tier compute
model at the schema level.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared request schema
# ---------------------------------------------------------------------------


class PricingRequestSchema(BaseModel):
    """Pricing request shared by preview and full endpoints."""

    ticker: str
    market: Literal["US", "IN"]
    spot_override: float | None = None
    strike: float = Field(..., gt=0)
    expiry_date: date
    option_type: Literal["call", "put"]
    volatility: float = Field(..., gt=0)
    risk_free_rate: float
    dividend_yield: float | None = None
    n_simulations: int = Field(..., ge=1)
    seed: int = 42
    variance_reduction: Literal[
        "standard", "antithetic", "control_variate", "antithetic_cv", "quasi_monte_carlo", "all"
    ] = "all"
    convergence_grid: list[int] | None = None


# ---------------------------------------------------------------------------
# Sub-models for response composition
# ---------------------------------------------------------------------------


class BSPreviewResult(BaseModel):
    """Black-Scholes result subset for preview tier (price + delta/gamma only)."""

    price: float
    delta: float
    gamma: float


class MCPreviewResult(BaseModel):
    """Standard MC result subset for preview tier (price + delta/gamma only)."""

    price: float
    delta: float
    gamma: float


class BSGreeks(BaseModel):
    """Full analytical Greeks block."""

    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


class BSFullResult(BaseModel):
    """Black-Scholes result for full tier (price + full Greeks)."""

    price: float
    greeks: BSGreeks


class MCResultItem(BaseModel):
    """Single MC estimator result in full response."""

    method: str
    price: float
    standard_error: float
    ci_lower: float
    ci_upper: float
    runtime_ms: float
    n_effective: int
    paths_per_second: float


class FDGreeksResult(BaseModel):
    """Finite-difference Greeks result in full response."""

    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float
    bump_size_used: dict[str, float]


class ConvergencePoint(BaseModel):
    """Single (N, SE) data point for convergence chart."""

    n: int
    standard_error: float


class ConvergenceFit(BaseModel):
    """Log-log regression fit of SE vs N."""

    slope: float
    r_squared: float


class DiagnosticsBlock(BaseModel):
    """Diagnostics block in full response."""

    expected_payoff: float
    discount_factor: float
    terminal_mean: float
    terminal_std: float
    relative_error_vs_bs: float


# ---------------------------------------------------------------------------
# Preview response — deliberately smaller, distinct type
# ---------------------------------------------------------------------------


class PricingPreviewResponse(BaseModel):
    """Preview-tier pricing response. Deliberately omits SE/CI/full diagnostics."""

    black_scholes: BSPreviewResult
    monte_carlo_standard: MCPreviewResult
    tier: Literal["preview"] = "preview"
    n_simulations: int
    compute_ms: float


# ---------------------------------------------------------------------------
# Full response — all estimators, Greeks, convergence, diagnostics
# ---------------------------------------------------------------------------


class PricingFullResponse(BaseModel):
    """Full-tier pricing response with all MC estimators, Greeks, convergence, and diagnostics."""

    tier: Literal["full"] = "full"
    request_echo: PricingRequestSchema
    black_scholes: BSFullResult
    mc_results: list[MCResultItem]
    greeks_fd: FDGreeksResult
    convergence_data: list[ConvergencePoint]
    convergence_fit: ConvergenceFit
    diagnostics: DiagnosticsBlock
    terminal_distribution_sample: list[float]
    compute_ms: float


# ---------------------------------------------------------------------------
# Market quote response
# ---------------------------------------------------------------------------


class MarketQuoteResponse(BaseModel):
    """Market data quote response model."""

    ticker: str
    market: str
    resolved_symbol: str
    spot_price: float
    daily_return: float
    historical_volatility: dict[str, float]
    dividend_yield: float
    market_cap: float | None
    currency: str
    last_updated: str
    data_warnings: list[str]


# ---------------------------------------------------------------------------
# Validation summary response — CI-time artifact, served statically
# ---------------------------------------------------------------------------


class CICoverageBlock(BaseModel):
    """CI coverage check result block."""

    trials: int
    nominal_confidence: float
    observed_coverage: float | None
    last_run: str | None


class EdgeCasesBlock(BaseModel):
    """Edge-case test result block."""

    total: int
    passed: int
    last_run: str | None


class GreeksValidationBlock(BaseModel):
    """Greeks validation result block."""

    total: int
    passed: int
    tolerances: dict[str, float]


class ValidationSummaryResponse(BaseModel):
    """Static validation summary served from CI artifacts."""

    ci_coverage: CICoverageBlock
    edge_cases: EdgeCasesBlock
    greeks_validation: GreeksValidationBlock


# ---------------------------------------------------------------------------
# Error response
# ---------------------------------------------------------------------------


class ErrorResponse(BaseModel):
    """Structured error response for 400/404/500 errors."""

    error: str
    message: str
    field: str | None = None
    fallback_available: bool | None = None


# ---------------------------------------------------------------------------
# Implied Volatility schemas
# ---------------------------------------------------------------------------


class ImpliedVolRequest(BaseModel):
    """Request schema for implied volatility solver endpoint."""

    ticker: str
    market: Literal["US", "IN"]
    spot_override: float | None = None
    strike: float = Field(..., gt=0)
    expiry_date: date
    option_type: Literal["call", "put"]
    market_price: float = Field(..., gt=0)
    risk_free_rate: float
    dividend_yield: float | None = None


class ImpliedVolResponse(BaseModel):
    """Response schema for implied volatility solver endpoint."""

    implied_vol: float
    iterations_used: int
    method_used: Literal["newton", "brent_fallback"]
    converged: bool
    final_residual: float
    bs_price_at_solution: float


# ---------------------------------------------------------------------------
# P&L Explain schemas
# ---------------------------------------------------------------------------


class PnLShiftSchema(BaseModel):
    """Scenario parameter shifts for P&L attribution."""

    d_spot: float = 0.0
    d_vol: float = 0.0
    d_days: float = 0.0
    d_rate: float = 0.0


class PnLExplainRequest(BaseModel):
    """Request schema for P&L explain endpoint."""

    ticker: str
    market: Literal["US", "IN"]
    spot_override: float | None = None
    strike: float = Field(..., gt=0)
    expiry_date: date
    option_type: Literal["call", "put"]
    volatility: float = Field(..., gt=0)
    risk_free_rate: float
    dividend_yield: float | None = None
    shift: PnLShiftSchema = Field(default_factory=PnLShiftSchema)


class PnLExplainResponse(BaseModel):
    """Response schema for P&L explain endpoint."""

    base_price: float
    shifted_price: float
    actual_pnl: float
    predicted_pnl_total: float
    delta_pnl: float
    gamma_pnl: float
    vega_pnl: float
    theta_pnl: float
    rho_pnl: float
    unexplained_pnl: float


# ---------------------------------------------------------------------------
# Risk Grid schemas
# ---------------------------------------------------------------------------


class GridRangeSchema(BaseModel):
    """Range configuration for a risk grid parameter axis."""

    min: float
    max: float
    num_points: int = Field(default=25, ge=2, le=100)


class RiskGridRequest(BaseModel):
    """Request schema for 2D risk grid surface calculation endpoint."""

    ticker: str
    market: Literal["US", "IN"]
    spot_override: float | None = None
    strike: float = Field(..., gt=0)
    expiry_date: date
    option_type: Literal["call", "put"]
    volatility: float = Field(..., gt=0)
    risk_free_rate: float
    dividend_yield: float | None = None
    axis_x: Literal["spot", "strike", "volatility", "time_to_expiry", "rate"]
    axis_y: Literal["spot", "strike", "volatility", "time_to_expiry", "rate"]
    x_range: GridRangeSchema
    y_range: GridRangeSchema
    metric: Literal["price", "delta", "gamma", "vega", "theta", "rho"] = "price"


class RiskGridResponse(BaseModel):
    """Response schema for 2D risk grid surface calculation endpoint."""

    x_values: list[float]
    y_values: list[float]
    grid: list[list[float]]
    metric: str
    axis_x: str
    axis_y: str


# ---------------------------------------------------------------------------
# Options Chain schemas
# ---------------------------------------------------------------------------


class OptionContract(BaseModel):
    """Single option contract in an options chain."""

    contractSymbol: str | None = None
    strike: float
    lastPrice: float | None = None
    bid: float | None = None
    ask: float | None = None
    change: float | None = None
    percentChange: float | None = None
    volume: int | None = None
    openInterest: int | None = None
    impliedVolatility: float | None = None


class OptionsChainResponse(BaseModel):
    """Response schema for options chain endpoint."""

    ticker: str
    market: str
    resolved_symbol: str
    underlying_price: float | None = None
    expiries: list[str]
    selected_expiry: str
    calls: list[OptionContract]
    puts: list[OptionContract]


# ---------------------------------------------------------------------------
# Historical OHLCV schemas
# ---------------------------------------------------------------------------


class OhlcvBar(BaseModel):
    """Single OHLCV bar."""

    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class HistoryResponse(BaseModel):
    """Response schema for historical OHLCV endpoint."""

    ticker: str
    market: str
    currency: str
    interval: str
    bars: list[OhlcvBar]



