"""Pydantic schemas for hedging comparison API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HestonParamsSchema(BaseModel):
    """Heston model parameters for the hedging comparison."""

    v0: float = Field(..., gt=0, description="Initial variance")
    kappa: float = Field(..., gt=0, description="Mean-reversion speed")
    theta_v: float = Field(..., gt=0, description="Long-run variance")
    sigma_v: float = Field(..., gt=0, description="Vol-of-vol")
    rho: float = Field(..., gt=-1, lt=1, description="Spot-vol correlation")


class HedgingCompareRequest(BaseModel):
    """Request body for hedging comparison endpoint."""

    S0: float = Field(..., gt=0, description="Initial spot price")
    K: float = Field(..., gt=0, description="Strike price")
    T: float = Field(..., gt=0, description="Time to expiry in years")
    r: float = Field(..., description="Risk-free rate (continuous)")
    q: float = Field(0.0, description="Dividend yield (continuous)")
    option_type: Literal["call", "put"] = "call"
    heston_params: HestonParamsSchema
    n_rebalance: int = Field(63, ge=2, le=504, description="Rebalance steps (63 = daily for 3mo)")
    n_simulations: int = Field(500, ge=10, le=5000, description="MC paths")
    tc_bps: float = Field(5.0, ge=0, le=100, description="Transaction cost (basis points)")
    seed: int = Field(42, description="RNG seed")


class HedgingModelStats(BaseModel):
    """Per-model hedging statistics."""

    mean: float
    variance: float
    std: float
    rmse: float
    max_drawdown: float
    total_tc: float
    errors: list[float]


class SamplePath(BaseModel):
    """A single sample path for chart visualization."""

    S: list[float]
    v: list[float]
    bs_delta: list[float]
    heston_delta: list[float]
    bs_portfolio: list[float]
    heston_portfolio: list[float]


class TimingStats(BaseModel):
    """Computation timing breakdown."""

    simulation: float
    hedging: float
    total: float


class HedgingCompareResponse(BaseModel):
    """Response from hedging comparison endpoint."""

    bs: HedgingModelStats
    heston: HedgingModelStats
    variance_ratio: float
    variance_pct_improvement: float
    sample_paths: list[SamplePath]
    config: dict
    timing_ms: TimingStats
