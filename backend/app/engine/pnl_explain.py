"""P&L Explain and Greek Attribution Engine.

Calculates the actual Black-Scholes repriced P&L for a hypothetical scenario shift
and decomposes it into first- and second-order Taylor series Greek projections
(Delta, Gamma, Vega, Theta, Rho) and an unexplained residual.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..core.config import DAYS_PER_YEAR, MIN_SIGMA, MIN_T
from . import black_scholes


@dataclass(frozen=True)
class PnLExplainResult:
    """Container for P&L explain and Greek attribution breakdown.

    Attributes:
        base_price: Black-Scholes option price at the unshifted base scenario.
        shifted_price: Black-Scholes option price at the shifted scenario.
        actual_pnl: Ground-truth price difference (shifted_price - base_price).
        predicted_pnl_total: Total P&L predicted by first/second-order Greek Taylor series.
        delta_pnl: P&L contribution from spot price change (Delta * d_spot).
        gamma_pnl: Second-order P&L contribution from spot price change (0.5 * Gamma * d_spot^2).
        vega_pnl: P&L contribution from volatility change (Vega * d_vol).
        theta_pnl: P&L contribution from elapsed time (Theta_per_day * d_days).
        rho_pnl: P&L contribution from interest rate change (Rho * d_rate).
        unexplained_pnl: Residual difference capturing higher-order and cross-Greek effects.
    """

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


def explain_pnl(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
    d_spot: float = 0.0,
    d_vol: float = 0.0,
    d_days: float = 0.0,
    d_rate: float = 0.0,
) -> PnLExplainResult:
    """Decompose actual option P&L into Greek-attributed components and unexplained residual.

    Note: Both base and shifted repricing use closed-form analytical Black-Scholes rather than
    Monte Carlo simulation. This deliberate design choice eliminates Monte Carlo sampling noise,
    allowing an exact mathematical Taylor-series attribution breakdown.

    Args:
        S0: Base spot price of underlying (> 0).
        K: Option strike price (> 0).
        T: Base time to expiration in years (> 0).
        r: Base risk-free interest rate (annualized continuous rate).
        q: Base dividend yield (annualized continuous yield).
        sigma: Base volatility (> 0).
        option_type: 'call' or 'put'.
        d_spot: Change in spot price (S_new = S0 + d_spot).
        d_vol: Change in volatility in decimal (sigma_new = sigma + d_vol).
        d_days: Elapsed time in calendar days (T_new = T0 - d_days / 365.0).
        d_rate: Change in risk-free interest rate (r_new = r + d_rate).

    Returns:
        PnLExplainResult: Dataclass containing base/shifted prices, actual P&L,
            predicted Greek contributions, and higher-order unexplained residual.
    """
    # Evaluate base scenario price and analytical Greeks
    bs_base = black_scholes.price_and_greeks(S0, K, T, r, q, sigma, option_type)
    base_price = bs_base.price

    # Compute shifted scenario input values
    S_shifted = max(1e-6, S0 + d_spot)
    sigma_shifted = max(MIN_SIGMA, sigma + d_vol)
    # Elapsed days decrease remaining time to expiration (T_shifted = T0 - d_days / 365)
    T_shifted = max(MIN_T, T - (d_days / DAYS_PER_YEAR))
    r_shifted = r + d_rate

    # Evaluate ground-truth shifted Black-Scholes option price
    shifted_price = black_scholes.price(
        S0=S_shifted,
        K=K,
        T=T_shifted,
        r=r_shifted,
        q=q,
        sigma=sigma_shifted,
        option_type=option_type,
    )

    actual_pnl = shifted_price - base_price

    # Calculate Taylor-series Greek projected P&L terms
    delta_pnl = bs_base.delta * d_spot
    gamma_pnl = 0.5 * bs_base.gamma * (d_spot**2)
    vega_pnl = bs_base.vega * d_vol
    theta_pnl = bs_base.theta * d_days
    rho_pnl = bs_base.rho * d_rate

    predicted_pnl_total = delta_pnl + gamma_pnl + vega_pnl + theta_pnl + rho_pnl
    unexplained_pnl = actual_pnl - predicted_pnl_total

    return PnLExplainResult(
        base_price=float(base_price),
        shifted_price=float(shifted_price),
        actual_pnl=float(actual_pnl),
        predicted_pnl_total=float(predicted_pnl_total),
        delta_pnl=float(delta_pnl),
        gamma_pnl=float(gamma_pnl),
        vega_pnl=float(vega_pnl),
        theta_pnl=float(theta_pnl),
        rho_pnl=float(rho_pnl),
        unexplained_pnl=float(unexplained_pnl),
    )
