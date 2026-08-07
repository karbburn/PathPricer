"""Hedging comparison: Black-Scholes vs Heston.

Runs N parallel hedging simulations on the same Heston-generated
price paths, collects error distributions, and computes summary
statistics for the comparison.

BS hedging uses a FIXED implied vol (solved from the Heston ATM price
at t=0).  This is the realistic scenario: traders observe market IV and
hedge with it.  Heston hedging uses model-informed deltas that adapt
to the current variance state.
"""

from __future__ import annotations

import math
import time

import numpy as np

from .heston import HestonParams, price_european
from .heston_simulator import simulate_heston_paths
from .hedging import hedge_path
from .implied_vol import solve_implied_volatility


def compare_hedging(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    option_type: str,
    heston_params: HestonParams,
    n_rebalance: int,
    n_simulations: int,
    tc_bps: float,
    seed: int,
    antithetic: bool = True,
) -> dict:
    """Run the full hedging comparison.

    Computes BS fixed IV from the Heston ATM price at t=0, then
    hedges BS with that constant vol and Heston with model deltas.
    """
    t0 = time.perf_counter()

    # Compute BS fixed IV from Heston ATM price (realistic: market observer)
    atm_price = price_european(S0, K, T, r, q, heston_params, option_type)
    sigma_fixed = solve_implied_volatility(
        S0=S0, K=K, T=T, r=r, q=q,
        market_price=atm_price, option_type=option_type,
    ).implied_vol

    # Simulate paths under Heston (ground truth)
    n_paths = n_simulations + (n_simulations % 2)  # ensure even for antithetic
    S, v = simulate_heston_paths(
        params=heston_params,
        S0=S0,
        T=T,
        r=r,
        q=q,
        n_steps=n_rebalance,
        n_paths=n_paths,
        seed=seed,
        antithetic=antithetic,
    )

    t_sim = time.perf_counter()

    actual_n_paths = S.shape[0]
    bs_errors = np.empty(actual_n_paths)
    heston_errors = np.empty(actual_n_paths)
    bs_tc = np.empty(actual_n_paths)
    heston_tc = np.empty(actual_n_paths)

    n_sample = min(5, actual_n_paths)
    sample_paths = []

    for i in range(actual_n_paths):
        bs_res = hedge_path(
            S=S[i], v=v[i], K=K, T=T, r=r, q=q,
            option_type=option_type, model="bs",
            tc_bps=tc_bps, sigma_fixed=sigma_fixed,
        )
        heston_res = hedge_path(
            S=S[i], v=v[i], K=K, T=T, r=r, q=q,
            option_type=option_type, model="heston",
            heston_params=heston_params, tc_bps=tc_bps,
            heston_delta_mode="average",
        )
        bs_errors[i] = bs_res["hedging_error"]
        heston_errors[i] = heston_res["hedging_error"]
        bs_tc[i] = bs_res["total_tc"]
        heston_tc[i] = heston_res["total_tc"]

        if i < n_sample:
            sample_paths.append({
                "S": S[i].tolist(),
                "v": v[i].tolist(),
                "bs_delta": bs_res["delta_path"].tolist(),
                "heston_delta": heston_res["delta_path"].tolist(),
                "bs_portfolio": bs_res["portfolio_values"].tolist(),
                "heston_portfolio": heston_res["portfolio_values"].tolist(),
            })

    t_hedge = time.perf_counter()

    def _stats(errors: np.ndarray, tc: np.ndarray) -> dict:
        return {
            "mean": float(np.mean(errors)),
            "variance": float(np.var(errors)),
            "std": float(np.std(errors)),
            "rmse": float(np.sqrt(np.mean(errors**2))),
            "max_abs_error": float(np.max(np.abs(errors))),
            "total_tc": float(np.mean(tc)),
            "errors": errors.tolist(),
        }

    bs_stats = _stats(bs_errors, bs_tc)
    heston_stats = _stats(heston_errors, heston_tc)

    variance_ratio = (
        bs_stats["variance"] / heston_stats["variance"]
        if heston_stats["variance"] > 1e-20
        else (1.0 if bs_stats["variance"] < 1e-20 else float("inf"))
    )
    variance_pct = (
        (1.0 - heston_stats["variance"] / bs_stats["variance"]) * 100.0
        if bs_stats["variance"] > 1e-20
        else 0.0
    )

    return {
        "bs": bs_stats,
        "heston": heston_stats,
        "variance_ratio": variance_ratio,
        "variance_pct_improvement": variance_pct,
        "sigma_fixed": sigma_fixed,
        "sample_paths": sample_paths,
        "config": {
            "S0": S0, "K": K, "T": T, "r": r, "q": q,
            "option_type": option_type,
            "heston_params": {
                "v0": heston_params.v0,
                "kappa": heston_params.kappa,
                "theta_v": heston_params.theta_v,
                "sigma_v": heston_params.sigma_v,
                "rho": heston_params.rho,
            },
            "n_rebalance": n_rebalance,
            "n_simulations": n_simulations,
            "tc_bps": tc_bps,
            "seed": seed,
        },
        "timing_ms": {
            "simulation": (t_sim - t0) * 1000,
            "hedging": (t_hedge - t_sim) * 1000,
            "total": (t_hedge - t0) * 1000,
        },
    }
