"""Heston stochastic volatility path simulator.

Generates joint (S, v) paths under the Heston SDE using Euler
discretization with full truncation.  The variance process uses
reflection (truncate at 0) and the stock price uses log-Euler.

    dS = (r - q) S dt + sqrt(v) S dW_S
    dv = kappa (theta_v - v) dt + sigma_v sqrt(v) dW_v
    E[dW_S dW_v] = rho dt

This module is purpose-built for the hedging comparison experiment
where we need *sample paths* (not just terminal prices).
"""

from __future__ import annotations

import numpy as np

from .heston import HestonParams


def simulate_heston_paths(
    params: HestonParams,
    S0: float,
    T: float,
    r: float,
    q: float,
    n_steps: int,
    n_paths: int,
    seed: int | None = None,
    antithetic: bool = True,
) -> tuple[np.ndarray, np.ndarray]:
    """Simulate joint (S, v) paths under Heston dynamics.

    Uses Euler discretization with full truncation (v clamped >= 0).
    When antithetic=True, half the paths use +Z and the other half -Z,
    which halves variance for free (standard practice in MC hedging sims).

    Args:
        params: Heston model parameters.
        S0: Initial spot price.
        T: Time to expiry in years.
        r: Risk-free rate (continuous, annualized).
        q: Dividend yield (continuous, annualized).
        n_steps: Number of discrete time steps.
        n_paths: Number of simulation paths (must be even if antithetic=True).
        seed: RNG seed for reproducibility.
        antithetic: Use antithetic variates for variance reduction.

    Returns:
        (S, v) arrays of shape (n_paths, n_steps + 1).
    """
    if antithetic and n_paths % 2 != 0:
        n_paths += 1  # round up silently

    rng = np.random.default_rng(seed)
    dt = T / n_steps
    sqrt_dt = np.sqrt(dt)

    # Pre-allocate
    S = np.empty((n_paths, n_steps + 1), dtype=np.float64)
    v = np.empty((n_paths, n_steps + 1), dtype=np.float64)
    S[:, 0] = S0
    v[:, 0] = params.v0

    # Correlated Brownian increments: Z_s and Z_v with correlation rho
    # Using Cholesky: Z_s = eps1, Z_v = rho*eps1 + sqrt(1-rho^2)*eps2
    half = n_paths // 2
    eps1 = rng.standard_normal((half, n_steps))
    eps2 = rng.standard_normal((half, n_steps))

    if antithetic:
        eps1 = np.vstack([eps1, -eps1])
        eps2 = np.vstack([eps2, -eps2])

    Z_s = eps1
    Z_v = params.rho * eps1 + np.sqrt(1.0 - params.rho**2) * eps2

    # Euler steps
    for t in range(n_steps):
        vt = np.maximum(v[:, t], 0.0)  # full truncation
        sqrt_vt = np.sqrt(vt)

        # Variance process (CIR step with truncation)
        v[:, t + 1] = np.maximum(
            0.0,
            vt
            + params.kappa * (params.theta_v - vt) * dt
            + params.sigma_v * sqrt_vt * sqrt_dt * Z_v[:, t],
        )

        # Stock process (log-Euler)
        S[:, t + 1] = S[:, t] * np.exp(
            (r - q - 0.5 * vt) * dt + sqrt_vt * sqrt_dt * Z_s[:, t]
        )

    return S, v
