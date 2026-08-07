"""Hedging comparison API endpoints.

POST /hedging/compare — Compare BS vs Heston delta-hedging.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..engine.hedging_comparison import compare_hedging
from ..engine.heston import HestonParams
from ..schemas.hedging import HedgingCompareRequest

router = APIRouter(prefix="/hedging", tags=["hedging"])


@router.post("/compare")
def hedging_compare(req: HedgingCompareRequest) -> dict:
    """Compare Black-Scholes vs Heston delta-hedging performance.

    Simulates Heston price paths (ground truth), then delta-hedges
    with each model. Returns error distributions and summary stats.
    """
    heston_params = HestonParams(
        v0=req.heston_params.v0,
        kappa=req.heston_params.kappa,
        theta_v=req.heston_params.theta_v,
        sigma_v=req.heston_params.sigma_v,
        rho=req.heston_params.rho,
    )

    result = compare_hedging(
        S0=req.S0,
        K=req.K,
        T=req.T,
        r=req.r,
        q=req.q,
        option_type=req.option_type,
        heston_params=heston_params,
        n_rebalance=req.n_rebalance,
        n_simulations=req.n_simulations,
        tc_bps=req.tc_bps,
        seed=req.seed,
    )

    return result
