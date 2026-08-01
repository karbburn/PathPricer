"""Pydantic schemas for the quantitative model endpoints.

These cover the SVI volatility surface, Heston calibration, and model
validation endpoints. The frontend uses these shapes for its three new
charts: Vol Surface, Heston Calibration, and Model Validation.
"""

from __future__ import annotations

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
    price_rmse: float
    price_mape: float
    iv_rmse: float | None
    parity_max_error: float
    parity_holds: bool
    feller_condition_holds: bool
    contracts: list[ValidationContractView]
    warnings: list[str] = Field(default_factory=list)
