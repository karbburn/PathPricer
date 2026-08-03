"""Numerical finite-difference Greeks estimation engine with Common Random Numbers (CRN).

Calculates Delta, Gamma, Vega, Theta, and Rho by applying finite-difference bumps
to Monte Carlo simulations under Common Random Numbers.
"""

from dataclasses import dataclass
from ..core.config import BUMP_FRACTION_DEFAULT, DAYS_PER_YEAR, DEFAULT_GREEKS_N
from ..core.rng import make_rng
from .monte_carlo import estimate_standard


@dataclass
class FDGreeksResult:
    """Dataclass holding finite-difference Greeks and parameter bump sizes.

    Attributes:
        delta: Finite-difference Delta sensitivity.
        gamma: Finite-difference Gamma sensitivity.
        vega: Finite-difference Vega sensitivity.
        theta: Finite-difference Theta sensitivity per calendar day.
        rho: Finite-difference Rho sensitivity.
        bump_sizes_used: Dictionary mapping parameter names to the absolute bump sizes used.
    """

    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float
    bump_sizes_used: dict[str, float]


def finite_difference_greeks(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
    seed: int,
    n: int = DEFAULT_GREEKS_N,
    bump_frac: float = BUMP_FRACTION_DEFAULT,
) -> FDGreeksResult:
    """Estimate option Greeks using central finite differences and Common Random Numbers (CRN).

    Why CRN is essential for numerical Greeks:
    Calculating finite differences (f(x + h) - f(x - h)) / (2h) on Monte Carlo estimates
    requires isolating the parameter sensitivity from random sampling noise. By using Common
    Random Numbers (reusing the exact same standard normal random draw sequence Z across all
    base and bumped simulations), the random sampling variance cancels out in the difference.
    Without CRN, independent random draws introduce O(1 / sqrt(N)) simulation noise that
    completely dominates the small derivative difference.

    Finite Difference Schemes:
    - Delta: Central difference w.r.t. spot S0: (V(S0+h) - V(S0-h)) / (2 * h_S)
    - Gamma: Second central difference w.r.t. spot S0: (V(S0+h) - 2*V(S0) + V(S0-h)) / (h_S^2)
    - Vega: Central difference w.r.t. volatility sigma: (V(sigma+h) - V(sigma-h)) / (2 * h_sigma)
    - Theta: One-sided difference w.r.t. time T: (V(T - h_T) - V(T)) / h_T / 365 (per calendar day)
    - Rho: Central difference w.r.t. interest rate r: (V(r+h) - V(r-h)) / (2 * h_r)

    Args:
        S0: Current spot price (> 0).
        K: Strike price (> 0).
        T: Time to expiration in years (ACT/365).
        r: Risk-free rate (annualized).
        q: Dividend yield (annualized).
        sigma: Volatility (annualized).
        option_type: 'call' or 'put' (case-insensitive).
        seed: Random seed for CRN generation.
        n: Number of Monte Carlo simulation paths (default 50,000).
        bump_frac: Relative bump size fraction (default 0.005 = 0.5%).

    Returns:
        FDGreeksResult: Container holding estimated Greeks and absolute bump sizes used.

    Raises:
        ValueError: If option_type is not 'call' or 'put'.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")

    # Draw single base Z array for CRN reuse across all bumped scenarios
    rng_base = make_rng(seed)
    base_Z = rng_base.standard_normal(n)

    # Compute absolute bump sizes: relative bump with a small absolute floor
    # so tiny parameter values (near-zero T, r, sigma) don't produce
    # vanishing bumps where finite differences lose precision.
    h_S = max(bump_frac * S0, 1e-4)
    h_sigma = max(bump_frac * sigma, 1e-4)
    h_T = max(bump_frac * T, 1e-5)
    h_r = max(bump_frac * abs(r) if r != 0 else bump_frac, 1e-4)

    # Base price scenario with CRN
    price_base = estimate_standard(
        S0, K, T, r, q, sigma, opt_type, n_simulations=n, rng=make_rng(seed), base_Z=base_Z
    ).price

    # Spot price S0 bumps for Delta and Gamma
    price_S_up = estimate_standard(
        S0 + h_S, K, T, r, q, sigma, opt_type, n_simulations=n, rng=make_rng(seed), base_Z=base_Z
    ).price
    price_S_down = estimate_standard(
        S0 - h_S, K, T, r, q, sigma, opt_type, n_simulations=n, rng=make_rng(seed), base_Z=base_Z
    ).price

    delta = (price_S_up - price_S_down) / (2.0 * h_S)
    gamma = (price_S_up - 2.0 * price_base + price_S_down) / (h_S**2)

    # Volatility sigma bumps for Vega
    price_vega_up = estimate_standard(
        S0, K, T, r, q, sigma + h_sigma, opt_type, n_simulations=n, rng=make_rng(seed), base_Z=base_Z
    ).price
    price_vega_down = estimate_standard(
        S0, K, T, r, q, max(sigma - h_sigma, 1e-6), opt_type, n_simulations=n, rng=make_rng(seed), base_Z=base_Z
    ).price

    vega = (price_vega_up - price_vega_down) / (2.0 * h_sigma)

    # Expiry T bump for Theta (one-sided difference: time moves forward, remaining T decreases)
    T_down = max(T - h_T, 1e-6)
    price_T_down = estimate_standard(
        S0, K, T_down, r, q, sigma, opt_type, n_simulations=n, rng=make_rng(seed), base_Z=base_Z
    ).price

    theta_annual = (price_T_down - price_base) / h_T
    theta_per_day = theta_annual / DAYS_PER_YEAR

    # Interest rate r bumps for Rho
    price_r_up = estimate_standard(
        S0, K, T, r + h_r, q, sigma, opt_type, n_simulations=n, rng=make_rng(seed), base_Z=base_Z
    ).price
    price_r_down = estimate_standard(
        S0, K, T, r - h_r, q, sigma, opt_type, n_simulations=n, rng=make_rng(seed), base_Z=base_Z
    ).price

    rho = (price_r_up - price_r_down) / (2.0 * h_r)

    bump_sizes_used = {
        "S0": float(h_S),
        "sigma": float(h_sigma),
        "T": float(h_T),
        "r": float(h_r),
    }

    return FDGreeksResult(
        delta=float(delta),
        gamma=float(gamma),
        vega=float(vega),
        theta=float(theta_per_day),
        rho=float(rho),
        bump_sizes_used=bump_sizes_used,
    )
