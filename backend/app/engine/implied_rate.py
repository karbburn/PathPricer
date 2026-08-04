"""Implied risk-free rate extraction from put-call parity.

Put-call parity links call and put prices for the same strike:

    C - P = S e^{-qT} - K e^{-rT}

Solving for the continuously-compounded risk-free rate r:

    r = -ln( (S e^{-qT} - C + P) / K ) / T

If the quoted call/put/spot/strike are mutually consistent, the extracted
rate lands near the prevailing money-market rate. A rate far from consensus
is a red flag on the quotes (stale mid, crossed bid/ask, dividend mis-priced)
— this is a data-quality probe, not a rate for pricing.
"""

from __future__ import annotations

import math


def extract_implied_rate(
    call_price: float,
    put_price: float,
    spot: float,
    strike: float,
    ttm: float,
    dividend_yield: float = 0.0,
) -> float:
    """Extract the risk-free rate implied by one call/put parity pair.

    Args:
        call_price: Mid (or last) price of the call.
        put_price: Mid (or last) price of the put at the same strike.
        spot: Underlying spot price.
        strike: Shared strike of the call/put pair.
        ttm: Time to expiry in years (> 0).
        dividend_yield: Continuous dividend yield used in the parity relation.

    Returns:
        Continuously-compounded annualized risk-free rate.

    Raises:
        ValueError: If any input is non-positive, or the quotes imply a
            non-positive discounted strike (inconsistent/inverted data).
    """
    if call_price <= 0 or put_price <= 0:
        raise ValueError("call_price and put_price must be strictly positive.")
    if spot <= 0 or strike <= 0:
        raise ValueError("spot and strike must be strictly positive.")
    if ttm <= 0:
        raise ValueError("ttm must be strictly positive.")

    discounted_spot = spot * math.exp(-dividend_yield * ttm)
    discounted_strike = discounted_spot - call_price + put_price
    if discounted_strike <= 0:
        raise ValueError(
            "Put-call parity implies a non-positive discounted strike; "
            "quotes are inconsistent (C - P >= S e^{-qT})."
        )
    rate = -math.log(discounted_strike / strike) / ttm

    # Self-check: the extracted rate must reproduce the observed spread.
    recomputed_spread = discounted_spot - strike * math.exp(-rate * ttm)
    if not math.isclose(recomputed_spread, call_price - put_price, rel_tol=1e-9, abs_tol=1e-9):
        raise ValueError(
            "Self-check failed: extracted rate does not reproduce the call-put spread."
        )
    return rate
