"""Implied Volatility (IV) numerical solver engine.

Implements Newton-Raphson root finding on option Vega with Brenner-Subrahmanyam
initialization and automatic fallback to Brent's method when Vega is near zero
or numerically unstable.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import scipy.optimize

from ..core.config import (
    IV_INITIAL_SIGMA_MAX,
    IV_INITIAL_SIGMA_MIN,
    IV_MAX_ITERATIONS,
    IV_SIGMA_MAX,
    IV_SIGMA_MIN,
    IV_TOLERANCE,
    IV_VEGA_FLOOR,
)
from . import black_scholes


class ImpliedVolError(ValueError):
    """Exception raised when implied volatility root finding fails to find a valid solution."""

    pass


@dataclass(frozen=True)
class ImpliedVolResult:
    """Dataclass holding implied volatility solver output and diagnostic parameters.

    Attributes:
        implied_vol: Calculated implied volatility (annualized standard deviation).
        iterations_used: Number of iterations required to achieve convergence.
        method_used: Solver algorithm used ('newton' or 'brent_fallback').
        converged: Boolean flag indicating if solver satisfied convergence tolerance.
        final_residual: Residual difference between Black-Scholes price and target market price.
        bs_price_at_solution: Black-Scholes price calculated using the solved implied volatility.
    """

    implied_vol: float
    iterations_used: int
    method_used: str
    converged: bool
    final_residual: float
    bs_price_at_solution: float


def solve_implied_volatility(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    option_type: str,
    market_price: float,
    tolerance: float = IV_TOLERANCE,
    max_iterations: int = IV_MAX_ITERATIONS,
    vega_floor: float = IV_VEGA_FLOOR,
    sigma_min: float = IV_SIGMA_MIN,
    sigma_max: float = IV_SIGMA_MAX,
) -> ImpliedVolResult:
    """Solve for Black-Scholes implied volatility given a target market option price.

    Uses Newton-Raphson root-finding on option Vega as the primary algorithm, initialized
    with the Brenner-Subrahmanyam approximation. If Vega drops below a minimum threshold
    or the iterate leaves valid bounds, the solver falls back to Brent's bisection-secant algorithm.

    Args:
        S0: Spot price of the underlying asset (> 0).
        K: Strike price (> 0).
        T: Time to expiration in years (> 0).
        r: Risk-free interest rate (annualized continuous rate).
        q: Dividend yield (annualized continuous yield).
        option_type: Option type ('call' or 'put').
        market_price: Target market option price (> 0).
        tolerance: Price convergence threshold (default 1e-6).
        max_iterations: Maximum iteration count (default 100).
        vega_floor: Vega threshold below which Newton-Raphson switches to Brent (default 1e-8).
        sigma_min: Minimum search bound for Brent fallback (default 0.001).
        sigma_max: Maximum search bound for Brent fallback (default 5.0).

    Returns:
        ImpliedVolResult: Result container with solved volatility and diagnostic information.

    Raises:
        ImpliedVolError: If market price is outside valid theoretical bounds or no solution exists.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")

    if market_price <= 0:
        raise ImpliedVolError("Market price must be strictly positive.")

    # Check theoretical arbitrage bounds
    discounted_spot = S0 * math.exp(-q * T)
    discounted_strike = K * math.exp(-r * T)

    if opt_type == "call":
        intrinsic = max(0.0, discounted_spot - discounted_strike)
        upper_bound = discounted_spot
    else:
        intrinsic = max(0.0, discounted_strike - discounted_spot)
        upper_bound = discounted_strike

    if market_price <= intrinsic or market_price >= upper_bound:
        raise ImpliedVolError(
            f"Target market price ({market_price:.4f}) is outside valid theoretical "
            f"Black-Scholes bounds ({intrinsic:.4f}, {upper_bound:.4f})."
        )

    # Initial guess using Brenner-Subrahmanyam approximation
    sigma_initial = math.sqrt(2.0 * math.pi / T) * (market_price / S0)
    sigma_n = max(IV_INITIAL_SIGMA_MIN, min(IV_INITIAL_SIGMA_MAX, sigma_initial))

    # Primary method: Newton-Raphson
    newton_converged = False
    newton_iterations = 0
    final_bs_res = None

    for i in range(1, max_iterations + 1):
        newton_iterations = i
        bs_res = black_scholes.price_and_greeks(S0, K, T, r, q, sigma_n, opt_type)
        residual = bs_res.price - market_price

        if abs(residual) < tolerance:
            newton_converged = True
            final_bs_res = bs_res
            break

        if bs_res.vega < vega_floor:
            # Low vega makes Newton step unstable; fall back to Brent's method
            break

        delta_sigma = residual / bs_res.vega
        next_sigma = sigma_n - delta_sigma

        if next_sigma <= 0 or next_sigma > sigma_max * 2.0:
            # Straying out of bounds; trigger Brent fallback
            break

        sigma_n = next_sigma

    if newton_converged and final_bs_res is not None:
        return ImpliedVolResult(
            implied_vol=float(sigma_n),
            iterations_used=newton_iterations,
            method_used="newton",
            converged=True,
            final_residual=float(final_bs_res.price - market_price),
            bs_price_at_solution=float(final_bs_res.price),
        )

    # Fallback method: Brent's method (bisection-secant hybrid)
    def objective(vol: float) -> float:
        return black_scholes.price(S0, K, T, r, q, vol, opt_type) - market_price

    f_low = objective(sigma_min)
    f_high = objective(sigma_max)

    if f_low * f_high > 0:
        raise ImpliedVolError(
            "Market price cannot be bracketed within volatility search bounds."
        )

    try:
        sol, r_res = scipy.optimize.brentq(
            objective,
            sigma_min,
            sigma_max,
            xtol=tolerance,
            rtol=tolerance,
            maxiter=max_iterations,
            full_output=True,
        )
        solved_price = black_scholes.price(S0, K, T, r, q, sol, opt_type)
        final_res = solved_price - market_price

        return ImpliedVolResult(
            implied_vol=float(sol),
            iterations_used=int(r_res.iterations),
            method_used="brent_fallback",
            converged=bool(r_res.converged),
            final_residual=float(final_res),
            bs_price_at_solution=float(solved_price),
        )
    except Exception as exc:
        raise ImpliedVolError(f"Brent solver failed to find implied volatility: {exc}") from exc
