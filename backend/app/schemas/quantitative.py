"""Pydantic schemas for the quantitative model endpoints.

These cover the SVI volatility surface, Heston calibration, and model
validation endpoints. The frontend uses these shapes for its three new
charts: Vol Surface, Heston Calibration, and Model Validation.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

_PROTECTED: dict = {"protected_namespaces": ()}


# ---------------------------------------------------------------------------
# Shared request
# ---------------------------------------------------------------------------


class QuantSurfaceRequest(BaseModel):
    """Base request for quant endpoints: one underlying, optional expiries."""

    ticker: str
    market: str = "US"
    spot_override: float | None = None
    risk_free_rate: float = 0.05
    dividend_yield: float | None = None
    expiries: list[str] | None = None
    max_expiries: int = Field(default=3, ge=1, le=6)


# ---------------------------------------------------------------------------
# SVI volatility surface
# ---------------------------------------------------------------------------


class SVIParamsSchema(BaseModel):
    """Raw SVI parameters for one expiry slice."""

    a: float
    b: float
    rho: float
    m: float
    sigma: float


class SurfacePoint(BaseModel):
    """One (strike, market_iv, fitted_iv) point on a slice."""

    strike: float
    market_iv: float | None
    fitted_iv: float | None


class SVISlice(BaseModel):
    """Fitted SVI slice for one expiry."""

    expiry: str
    ttm: float
    svi_params: SVIParamsSchema
    points: list[SurfacePoint]
    butterfly_arb_free: bool | None = None
    min_butterfly: float | None = None
    worst_strike: float | None = None


class VolSurfaceResponse(BaseModel):
    """SVI volatility surface fitted to market implied vols."""

    ticker: str
    market: str
    resolved_symbol: str
    spot: float
    rate: float
    dividend_yield: float
    slices: list[SVISlice]
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Volatility term structure
# ---------------------------------------------------------------------------


class TermStructurePoint(BaseModel):
    """ATM implied volatility at one expiry."""

    expiry: str
    ttm: float
    atm_vol: float


class TermStructureResponse(BaseModel):
    """ATM implied volatility across expiries — the volatility term structure."""

    ticker: str
    market: str
    resolved_symbol: str
    spot: float
    rate: float
    dividend_yield: float
    points: list[TermStructurePoint]
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Greeks surface
# ---------------------------------------------------------------------------


class GreeksSurfaceRequest(QuantSurfaceRequest):
    """Evaluate a Greek across a strike x expiry grid at market SVI vols."""

    metric: Literal["price", "delta", "gamma", "vega", "theta", "rho"] = "delta"
    option_type: Literal["call", "put"] = "call"
    num_strikes: int = Field(default=25, ge=2, le=100)
    strike_min_pct: float = Field(default=0.7, gt=0, lt=1.0)
    strike_max_pct: float = Field(default=1.3, gt=1.0)


class GreeksSurfaceResponse(BaseModel):
    """A Greek/price evaluated across the surface's strike x expiry grid."""

    ticker: str
    market: str
    resolved_symbol: str
    spot: float
    rate: float
    dividend_yield: float
    metric: str
    option_type: str
    x_values: list[float]
    y_values: list[float]
    grid: list[list[float]]
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Heston calibration
# ---------------------------------------------------------------------------


class HestonParamsSchema(BaseModel):
    """Fitted Heston model parameters."""

    v0: float
    kappa: float
    theta_v: float
    sigma_v: float
    rho: float


class CalibrationContractView(BaseModel):
    """One contract's market vs model price after calibration."""

    model_config = _PROTECTED

    strike: float
    ttm: float
    option_type: str
    market_price: float
    model_price: float
    relative_error: float


class HestonCalibrationResponse(BaseModel):
    """Result of fitting Heston to market option prices."""

    ticker: str
    market: str
    resolved_symbol: str
    spot: float
    rate: float
    dividend_yield: float
    params: HestonParamsSchema
    rmse: float
    mape: float
    max_abs_error: float
    feller_condition_holds: bool
    contracts: list[CalibrationContractView]
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Model validation
# ---------------------------------------------------------------------------


class ValidationContractView(BaseModel):
    """One contract's market vs model price/IV in the validation report."""

    model_config = _PROTECTED

    strike: float
    ttm: float
    option_type: str
    market_price: float
    model_price: float
    market_iv: float | None
    model_iv: float | None
    iv_error: float | None


class ModelValidationResponse(BaseModel):
    """How well a calibrated Heston model reproduces market prices/vols."""

    ticker: str
    market: str
    resolved_symbol: str
    spot: float
    rate: float
    dividend_yield: float
    price_rel_rmse: float
    price_mape: float
    iv_rmse: float | None
    market_parity_violation: float
    parity_holds: bool
    feller_condition_holds: bool
    in_sample: bool
    contracts: list[ValidationContractView]
    warnings: list[str] = Field(default_factory=list)
