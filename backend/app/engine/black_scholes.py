"""Black-Scholes-Merton (BSM) analytical benchmark pricing engine.

Implements closed-form option pricing, analytical Greeks, and put-call parity
checks.
"""

import math
from dataclasses import dataclass
from scipy.stats import norm

from ..core.config import DAYS_PER_YEAR, MIN_SIGMA, MIN_T


@dataclass(frozen=True)
class BSResult:
    """Dataclass holding analytical Black-Scholes price and Greeks.

    Attributes:
        price: Analytical option price.
        delta: Option Delta (rate of change of price w.r.t. spot price).
        gamma: Option Gamma (rate of change of delta w.r.t. spot price).
        vega: Option Vega (rate of change of price w.r.t. volatility).
        theta: Option Theta per calendar day (rate of time decay / 365).
        rho: Option Rho (rate of change of price w.r.t. risk-free rate).
    """

    price: float
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


def price(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
) -> float:
    """Calculate closed-form Black-Scholes-Merton option price.

    Args:
        S0: Current spot price of the underlying asset (> 0).
        K: Strike price of the option (> 0).
        T: Time to expiration in years (ACT/365).
        r: Risk-free interest rate (continuously compounded, annualized).
        q: Dividend yield (continuously compounded, annualized).
        sigma: Volatility of the underlying asset (annualized).
        option_type: 'call' or 'put' (case-insensitive).

    Returns:
        float: Analytical BSM option price.

    Raises:
        ValueError: If option_type is not 'call' or 'put'.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")

    # Handle edge case bounds for T and sigma
    T_eff = max(T, MIN_T)
    sigma_eff = max(sigma, MIN_SIGMA)

    sqrt_T = math.sqrt(T_eff)
    d1 = (math.log(S0 / K) + (r - q + 0.5 * sigma_eff**2) * T_eff) / (sigma_eff * sqrt_T)
    d2 = d1 - sigma_eff * sqrt_T

    if opt_type == "call":
        return float(S0 * math.exp(-q * T_eff) * norm.cdf(d1) - K * math.exp(-r * T_eff) * norm.cdf(d2))
    else:
        return float(K * math.exp(-r * T_eff) * norm.cdf(-d2) - S0 * math.exp(-q * T_eff) * norm.cdf(-d1))


def price_and_greeks(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
) -> BSResult:
    """Calculate closed-form Black-Scholes option price and analytical Greeks.

    Theta is returned per calendar day (annualized theta divided by 365).
    Gamma, Vega, and absolute values align with Merton (1973) continuous yield extension.

    Args:
        S0: Current spot price of the underlying asset (> 0).
        K: Strike price of the option (> 0).
        T: Time to expiration in years (ACT/365).
        r: Risk-free interest rate (continuously compounded, annualized).
        q: Dividend yield (continuously compounded, annualized).
        sigma: Volatility of the underlying asset (annualized).
        option_type: 'call' or 'put' (case-insensitive).

    Returns:
        BSResult: Container holding price, delta, gamma, vega, theta, and rho.

    Raises:
        ValueError: If option_type is not 'call' or 'put'.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")

    # Handle edge case bounds for T and sigma
    T_eff = max(T, MIN_T)
    sigma_eff = max(sigma, MIN_SIGMA)

    sqrt_T = math.sqrt(T_eff)
    d1 = (math.log(S0 / K) + (r - q + 0.5 * sigma_eff**2) * T_eff) / (sigma_eff * sqrt_T)
    d2 = d1 - sigma_eff * sqrt_T

    pdf_d1 = norm.pdf(d1)
    cdf_d1 = norm.cdf(d1)
    cdf_d2 = norm.cdf(d2)
    cdf_neg_d1 = norm.cdf(-d1)
    cdf_neg_d2 = norm.cdf(-d2)

    exp_qT = math.exp(-q * T_eff)
    exp_rT = math.exp(-r * T_eff)

    if opt_type == "call":
        bs_price = S0 * exp_qT * cdf_d1 - K * exp_rT * cdf_d2
        delta = exp_qT * cdf_d1
        theta_annual = (
            -(S0 * exp_qT * pdf_d1 * sigma_eff) / (2.0 * sqrt_T)
            - r * K * exp_rT * cdf_d2
            + q * S0 * exp_qT * cdf_d1
        )
        rho = K * T_eff * exp_rT * cdf_d2
    else:
        bs_price = K * exp_rT * cdf_neg_d2 - S0 * exp_qT * cdf_neg_d1
        delta = -exp_qT * cdf_neg_d1
        theta_annual = (
            -(S0 * exp_qT * pdf_d1 * sigma_eff) / (2.0 * sqrt_T)
            + r * K * exp_rT * cdf_neg_d2
            - q * S0 * exp_qT * cdf_neg_d1
        )
        rho = -K * T_eff * exp_rT * cdf_neg_d2

    # Gamma and Vega are identical for calls and puts
    gamma = (exp_qT * pdf_d1) / (S0 * sigma_eff * sqrt_T)
    vega = S0 * exp_qT * pdf_d1 * sqrt_T
    theta_per_day = theta_annual / DAYS_PER_YEAR

    return BSResult(
        price=float(bs_price),
        delta=float(delta),
        gamma=float(gamma),
        vega=float(vega),
        theta=float(theta_per_day),
        rho=float(rho),
    )


def put_call_parity(
    call_price: float,
    put_price: float,
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
) -> float:
    """Calculate Put-Call parity residual difference.

    Put-call parity relation with continuous dividend yield:
        C - P = S0 * exp(-q * T) - K * exp(-r * T)

    Returns residual (C - P) - (S0 * exp(-q * T) - K * exp(-r * T)).
    Zero residual indicates perfect put-call parity holding.

    Args:
        call_price: Price of European call option.
        put_price: Price of European put option.
        S0: Spot price of underlying.
        K: Strike price.
        T: Time to expiration in years.
        r: Risk-free rate.
        q: Dividend yield.

    Returns:
        float: Residual difference (should be ~0.0).
    """
    return call_price - put_price - (S0 * math.exp(-q * T) - K * math.exp(-r * T))
