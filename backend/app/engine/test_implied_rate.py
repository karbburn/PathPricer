"""Self-check for the implied risk-free rate engine.

Validates:
  1. Recovery: prices generated at a known rate reproduce that rate.
  2. Dividend adjustment shifts the extracted rate correctly.
  3. Invalid inputs (non-positive price/strike/T) raise ValueError.
"""

import math

from app.engine.implied_rate import extract_implied_rate
from app.engine.black_scholes import price


def _run_tests() -> None:
    S0, K, T, q = 100.0, 100.0, 0.5, 0.02
    r_true = 0.043

    # --- 1. Recovery --------------------------------------------------------
    call = price(S0, K, T, r_true, q, 0.25, "call")
    put = price(S0, K, T, r_true, q, 0.25, "put")
    r_hat = extract_implied_rate(call, put, S0, K, T, q)
    assert abs(r_hat - r_true) < 1e-9, f"Rate recovery off: {r_hat} vs {r_true}"

    # --- 2. Dividend sensitivity --------------------------------------------
    # Same prices, but the parity relation assumes q=0 -> a different rate.
    r_no_div = extract_implied_rate(call, put, S0, K, T, 0.0)
    assert r_no_div != r_true

    # --- 3. Input validation ------------------------------------------------
    for bad in (
        dict(call_price=-1.0, put_price=1.0, spot=S0, strike=K, ttm=T),
        dict(call_price=1.0, put_price=1.0, spot=0.0, strike=K, ttm=T),
        dict(call_price=1.0, put_price=1.0, spot=S0, strike=K, ttm=0.0),
    ):
        try:
            extract_implied_rate(**bad)
            raise AssertionError(f"Expected ValueError for {bad}")
        except ValueError:
            pass

    # Deep ITM call makes C - P >= S e^{-qT} (parity inversion): must raise.
    try:
        extract_implied_rate(150.0, 0.05, S0, K, T, q)
        raise AssertionError("Expected ValueError for inverted parity quotes")
    except ValueError:
        pass

    print(f"Implied rate self-check OK  (r_hat={r_hat:.6f}, true={r_true})")


if __name__ == "__main__":
    _run_tests()
