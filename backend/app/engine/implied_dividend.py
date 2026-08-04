"""Implied dividend yield extraction from put-call parity.

From put-call parity:

    C - P = S e^{-qT} - K e^{-rT}

Solving for the continuously-compounded dividend yield q:

    q = -ln( (K e^{-rT} + C - P) / S ) / T

This is the companion probe to the implied risk-free rate: given a trusted
rate, the parity relation recovers the dividend yield the market is
implying. A large divergence from the reported dividend flags mis-priced
dividends or inconsistent quotes.
"""

from __future__ import annotations

import math


def extract_implied_dividend(
    call_price: float,
    put_price: float,
    spot: float,
    strike: float,
    ttm: float,
    risk_free_rate: float,
) -> float:
    """Extract the dividend yield implied by one call/put parity pair.

    Args:
        call_price: Mid (or last) price of the call.
        put_price: Mid (or last) price of the put at the same strike.
        spot: Underlying spot price.
        strike: Shared strike of the call/put pair.
        ttm: Time to expiry in years (> 0).
        risk_free_rate: Continuously-compounded risk-free rate.

    Returns:
        Continuously-compounded annualized dividend yield.

    Raises:
        ValueError: If any input is non-positive, or the quotes imply a
            non-positive discounted spot (inconsistent/inverted data).
    """
    if call_price <= 0 or put_price <= 0:
        raise ValueError("call_price and put_price must be strictly positive.")
    if spot <= 0 or strike <= 0:
        raise ValueError("spot and strike must be strictly positive.")
    if ttm <= 0:
        raise ValueError("ttm must be strictly positive.")

    discounted_strike = strike * math.exp(-risk_free_rate * ttm)
    discounted_spot = discounted_strike + call_price - put_price
    if discounted_spot <= 0:
        raise ValueError(
            "Put-call parity implies a non-positive discounted spot; "
            "quotes are inconsistent (P - C >= K e^{-rT})."
        )
    dividend = -math.log(discounted_spot / spot) / ttm

    # Self-check: the extracted dividend must reproduce the observed spread.
    recomputed_spread = spot * math.exp(-dividend * ttm) - discounted_strike
    if not math.isclose(recomputed_spread, call_price - put_price, rel_tol=1e-9, abs_tol=1e-9):
        raise ValueError(
            "Self-check failed: extracted dividend does not reproduce the call-put spread."
        )
    return dividend
