"""Discrete-time delta-hedging engine.

Runs a delta-hedging simulation over a pre-simulated price path,
using either Black-Scholes or Heston deltas.

Two Heston delta modes:
  - 'spot': uses current v_t (instantaneous). Simple but overreacts to
    vol spikes because it ignores mean reversion.
  - 'average': uses expected average variance E[v|v_t] over remaining life.
    More stable, accounts for mean reversion. This is the realistic mode.

BS hedging:
  - sigma_fixed: constant implied vol from ATM Heston price at t=0.
"""

from __future__ import annotations

import numpy as np

from .black_scholes import price_and_greeks as bs_price_and_greeks
from .heston import HestonParams, heston_delta as _heston_delta_analytical


def _bs_delta(
    S: float, K: float, T_remaining: float, r: float, q: float,
    sigma: float, option_type: str,
) -> float:
    if T_remaining <= 1e-10:
        if option_type == "call":
            return 1.0 if S > K else 0.0
        return -1.0 if S < K else 0.0
    res = bs_price_and_greeks(S, K, T_remaining, r, q, sigma, option_type)
    return res.delta


def _expected_avg_variance(v_t: float, params: HestonParams, T_remaining: float) -> float:
    """E[ (1/T_rem) * integral_t^T v_s ds | v_t ] for Heston CIR.

    Uses the exact conditional mean of the CIR process:
        E[v_s | v_t] = theta_v + (v_t - theta_v) * exp(-kappa * (s - t))

    Integrates from t to T to get the time-averaged expected variance.
    """
    if T_remaining <= 1e-10:
        return max(v_t, 1e-10)
    kappa = params.kappa
    theta = params.theta_v
    if abs(kappa) < 1e-12:
        # No mean reversion: v stays at v_t
        return max(v_t, 1e-10)
    # Integral of E[v_s] from 0 to T_rem:
    # = theta * T_rem + (v_t - theta) * (1 - exp(-kappa * T_rem)) / kappa
    integral = theta * T_remaining + (v_t - theta) * (1.0 - np.exp(-kappa * T_remaining)) / kappa
    return max(integral / T_remaining, 1e-10)


def hedge_path(
    S: np.ndarray,
    v: np.ndarray,
    K: float,
    T: float,
    r: float,
    q: float,
    option_type: str,
    model: str,
    heston_params: HestonParams | None = None,
    tc_bps: float = 5.0,
    sigma_fixed: float | None = None,
    heston_delta_mode: str = "average",
) -> dict:
    """Delta-hedge a single simulated path.

    Args:
        heston_delta_mode: 'spot' (current v_t) or 'average' (E[v] over remaining life).
    """
    n_steps = len(S) - 1
    dt = T / n_steps
    tc_rate = tc_bps / 10_000.0

    T_remaining = T
    sigma0 = sigma_fixed if sigma_fixed is not None else np.sqrt(max(v[0], 1e-10))

    if model == "bs":
        delta0 = _bs_delta(S[0], K, T_remaining, r, q, sigma0, option_type)
    else:
        if heston_delta_mode == "average":
            avg_v0 = _expected_avg_variance(v[0], heston_params, T_remaining)
            sigma_h0 = np.sqrt(avg_v0)
            delta0 = _bs_delta(S[0], K, T_remaining, r, q, sigma_h0, option_type)
        else:
            delta0 = _heston_delta_analytical(S[0], K, T_remaining, r, q, heston_params, option_type)

    from .black_scholes import price as bs_price_fn
    from .heston import price_european as heston_price_fn
    if model == "bs":
        premium = bs_price_fn(S[0], K, T, r, q, sigma0, option_type)
    else:
        premium = heston_price_fn(S[0], K, T, r, q, heston_params, option_type)

    stock_pos = delta0
    cash = premium - delta0 * S[0]

    delta_arr = np.empty(n_steps + 1)
    portfolio_arr = np.empty(n_steps + 1)
    tc_total = 0.0

    delta_arr[0] = delta0
    portfolio_arr[0] = cash + stock_pos * S[0]

    for t in range(1, n_steps + 1):
        T_remaining = max(T - t * dt, 1e-10)
        cash *= np.exp(r * dt)

        if model == "bs":
            sigma_t = sigma_fixed if sigma_fixed is not None else np.sqrt(max(v[t], 1e-10))
            target_delta = _bs_delta(S[t], K, T_remaining, r, q, sigma_t, option_type)
        else:
            if heston_delta_mode == "average":
                avg_vt = _expected_avg_variance(v[t], heston_params, T_remaining)
                sigma_ht = np.sqrt(avg_vt)
                target_delta = _bs_delta(S[t], K, T_remaining, r, q, sigma_ht, option_type)
            else:
                target_delta = _heston_delta_analytical(
                    S[t], K, T_remaining, r, q, heston_params, option_type
                )

        delta_trade = target_delta - stock_pos
        tc_cost = tc_rate * abs(delta_trade) * S[t]
        cash -= delta_trade * S[t] + tc_cost
        stock_pos = target_delta
        tc_total += tc_cost

        delta_arr[t] = target_delta
        portfolio_arr[t] = cash + stock_pos * S[t]

    if option_type == "call":
        payoff = max(S[-1] - K, 0.0)
    else:
        payoff = max(K - S[-1], 0.0)

    hedging_error = cash + stock_pos * S[-1] - payoff

    return {
        "hedging_error": float(hedging_error),
        "total_tc": float(tc_total),
        "delta_path": delta_arr,
        "portfolio_values": portfolio_arr,
    }
