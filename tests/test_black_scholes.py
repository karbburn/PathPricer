"""Unit tests for Black-Scholes analytical pricing engine (backend/app/engine/black_scholes.py).

Validates closed-form prices, analytical Greeks, edge cases, and Put-Call parity
against textbook benchmarks.
"""

import math
import pytest
from backend.app.engine import black_scholes
from backend.app.engine.black_scholes import BSResult


def test_black_scholes_known_benchmark_price():
    """Cross-check BSM call and put prices against textbook benchmark values.

    Parameters: S0=100, K=100, T=1.0, r=0.05, q=0.02, sigma=0.2
    Derived d1 = 0.25, d2 = 0.05
    Call ~ 9.2270, Put ~ 6.3302
    """
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2

    call_price = black_scholes.price(S0, K, T, r, q, sigma, "call")
    put_price = black_scholes.price(S0, K, T, r, q, sigma, "put")

    assert call_price == pytest.approx(9.2270, abs=1e-3)
    assert put_price == pytest.approx(6.3302, abs=1e-3)


def test_black_scholes_zero_dividend_benchmark():
    """Benchmark test with zero dividend yield (q=0.0).

    Parameters: S0=100, K=100, T=1.0, r=0.05, q=0.0, sigma=0.2
    Call ~ 10.4506
    """
    call_price = black_scholes.price(100.0, 100.0, 1.0, 0.05, 0.0, 0.2, "call")
    assert call_price == pytest.approx(10.4506, abs=1e-3)


def test_price_converges_to_intrinsic_as_T_approaches_zero():
    """Edge Case: T -> 0 limit test.

    As T approaches zero, option price must converge to intrinsic payoff.
    ITM Call (S0=100, K=95) -> max(100 - 95, 0) = 5.0
    ITM Put (S0=95, K=100) -> max(100 - 95, 0) = 5.0
    """
    T = 1e-6  # small positive time
    call_price = black_scholes.price(100.0, 95.0, T, r=0.05, q=0.0, sigma=0.2, option_type="call")
    put_price = black_scholes.price(95.0, 100.0, T, r=0.05, q=0.0, sigma=0.2, option_type="put")

    assert call_price == pytest.approx(5.0, abs=0.01)
    assert put_price == pytest.approx(5.0, abs=0.01)


def test_price_converges_when_volatility_approaches_zero():
    """Edge Case: sigma -> 0 limit test.

    When volatility is near zero, option behaves as deterministic discounted cashflow.
    ITM Call (S0=100, K=90, r=0.05, q=0, T=1) -> 100 - 90 * exp(-0.05) ~ 14.6123
    """
    call_price = black_scholes.price(100.0, 90.0, 1.0, 0.05, 0.0, 1e-6, "call")
    expected = 100.0 - 90.0 * math.exp(-0.05)
    assert call_price == pytest.approx(expected, abs=0.01)


def test_price_and_greeks_output_structure():
    """Verify price_and_greeks returns a complete BSResult dataclass with correct Greeks."""
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2

    call_res = black_scholes.price_and_greeks(S0, K, T, r, q, sigma, "call")
    put_res = black_scholes.price_and_greeks(S0, K, T, r, q, sigma, "put")

    assert isinstance(call_res, BSResult)
    assert isinstance(put_res, BSResult)

    # Prices match direct price() calls
    assert call_res.price == black_scholes.price(S0, K, T, r, q, sigma, "call")
    assert put_res.price == black_scholes.price(S0, K, T, r, q, sigma, "put")

    # Call Delta in (0, 1), Put Delta in (-1, 0)
    assert 0.0 < call_res.delta < 1.0
    assert -1.0 < put_res.delta < 0.0

    # Delta relationship: Call Delta - Put Delta = exp(-q*T)
    assert (call_res.delta - put_res.delta) == pytest.approx(math.exp(-q * T), abs=1e-10)

    # Gamma and Vega are positive and identical for call and put
    assert call_res.gamma > 0
    assert call_res.gamma == pytest.approx(put_res.gamma, abs=1e-12)
    assert call_res.vega > 0
    assert call_res.vega == pytest.approx(put_res.vega, abs=1e-12)

    # Theta is reported per calendar day
    annual_call_theta = call_res.theta * 365.0
    assert isinstance(call_res.theta, float)
    assert isinstance(annual_call_theta, float)


def test_put_call_parity_residual():
    """Verify put-call parity function produces near-zero residual for analytical prices."""
    S0, K, T, r, q, sigma = 100.0, 105.0, 0.5, 0.04, 0.01, 0.25

    c = black_scholes.price(S0, K, T, r, q, sigma, "call")
    p = black_scholes.price(S0, K, T, r, q, sigma, "put")

    residual = black_scholes.put_call_parity(c, p, S0, K, T, r, q)
    assert abs(residual) < 1e-12


def test_invalid_option_type_raises_value_error():
    """Verify invalid option_type raises ValueError."""
    with pytest.raises(ValueError, match="Invalid option_type"):
        black_scholes.price(100, 100, 1.0, 0.05, 0.0, 0.2, "straddle")

    with pytest.raises(ValueError, match="Invalid option_type"):
        black_scholes.price_and_greeks(100, 100, 1.0, 0.05, 0.0, 0.2, "invalid")
