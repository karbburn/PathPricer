"""Self-check for the implied dividend yield engine.

Validates:
  1. Recovery: prices generated at a known dividend yield reproduce it.
  2. Rate sensitivity: a wrong rate shifts the recovered dividend.
  3. Invalid inputs raise ValueError.
"""

from app.engine.implied_dividend import extract_implied_dividend
from app.engine.black_scholes import price


def _run_tests() -> None:
    S0, K, T, r = 100.0, 100.0, 0.5, 0.05
    q_true = 0.018

    # --- 1. Recovery --------------------------------------------------------
    call = price(S0, K, T, r, q_true, 0.25, "call")
    put = price(S0, K, T, r, q_true, 0.25, "put")
    q_hat = extract_implied_dividend(call, put, S0, K, T, r)
    assert abs(q_hat - q_true) < 1e-9, f"Dividend recovery off: {q_hat} vs {q_true}"

    # --- 2. Rate sensitivity ------------------------------------------------
    # Same prices, but parity assumes a different rate -> different q.
    q_wrong_rate = extract_implied_dividend(call, put, S0, K, T, 0.04)
    assert q_wrong_rate != q_true

    # --- 3. Input validation ------------------------------------------------
    for bad in (
        dict(call_price=-1.0, put_price=1.0, spot=S0, strike=K, ttm=T, risk_free_rate=r),
        dict(call_price=1.0, put_price=1.0, spot=0.0, strike=K, ttm=T, risk_free_rate=r),
        dict(call_price=1.0, put_price=1.0, spot=S0, strike=K, ttm=0.0, risk_free_rate=r),
    ):
        try:
            extract_implied_dividend(**bad)
            raise AssertionError(f"Expected ValueError for {bad}")
        except ValueError:
            pass

    # Deep ITM put makes P - C >= K e^{-rT} (parity inversion): must raise.
    try:
        extract_implied_dividend(0.05, 150.0, S0, K, T, r)
        raise AssertionError("Expected ValueError for inverted parity quotes")
    except ValueError:
        pass

    print(f"Implied dividend self-check OK  (q_hat={q_hat:.6f}, true={q_true})")


if __name__ == "__main__":
    _run_tests()
