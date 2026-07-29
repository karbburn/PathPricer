"""Unit tests for the Implied Volatility Solver engine and API endpoint."""

import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.engine import black_scholes, implied_vol

client = TestClient(app)


def test_implied_vol_round_trip_call():
    """Verify round-trip volatility recovery for a standard call option using Newton-Raphson."""
    S0 = 100.0
    K = 100.0
    T = 1.0
    r = 0.05
    q = 0.02
    known_sigma = 0.25
    option_type = "call"

    # Price option with known volatility
    target_price = black_scholes.price(S0, K, T, r, q, known_sigma, option_type)

    # Solve for implied volatility
    result = implied_vol.solve_implied_volatility(
        S0=S0, K=K, T=T, r=r, q=q, option_type=option_type, market_price=target_price
    )

    assert result.converged is True
    assert result.method_used == "newton"
    assert pytest.approx(result.implied_vol, abs=1e-5) == known_sigma
    assert pytest.approx(result.final_residual, abs=1e-5) == 0.0
    assert pytest.approx(result.bs_price_at_solution, abs=1e-5) == target_price


def test_implied_vol_round_trip_put():
    """Verify round-trip volatility recovery for a standard put option using Newton-Raphson."""
    S0 = 120.0
    K = 110.0
    T = 0.5
    r = 0.04
    q = 0.01
    known_sigma = 0.35
    option_type = "put"

    target_price = black_scholes.price(S0, K, T, r, q, known_sigma, option_type)

    result = implied_vol.solve_implied_volatility(
        S0=S0, K=K, T=T, r=r, q=q, option_type=option_type, market_price=target_price
    )

    assert result.converged is True
    assert result.method_used == "newton"
    assert pytest.approx(result.implied_vol, abs=1e-5) == known_sigma


def test_implied_vol_no_solution_exists():
    """Verify that market prices outside theoretical BSM bounds raise ImpliedVolError."""
    S0 = 100.0
    K = 100.0
    T = 1.0
    r = 0.05
    q = 0.02

    # Price below intrinsic for deep ITM call
    S0_itm = 150.0
    K_itm = 100.0
    # Intrinsic value is ~ 150*exp(-0.02) - 100*exp(-0.05) = 147.03 - 95.12 = 51.91
    invalid_low_price = 10.0

    with pytest.raises(implied_vol.ImpliedVolError, match="outside valid theoretical"):
        implied_vol.solve_implied_volatility(
            S0=S0_itm, K=K_itm, T=T, r=r, q=q, option_type="call", market_price=invalid_low_price
        )

    # Price above discounted spot for call
    invalid_high_price = 200.0
    with pytest.raises(implied_vol.ImpliedVolError, match="outside valid theoretical"):
        implied_vol.solve_implied_volatility(
            S0=S0, K=K, T=T, r=r, q=q, option_type="call", market_price=invalid_high_price
        )


def test_implied_vol_brent_fallback_trigger():
    """Verify that near-expiry / tiny vega conditions trigger Brent fallback and achieve convergence."""
    S0 = 100.0
    K = 100.0
    T = 0.0001  # Extremely short time to expiry => Vega near zero (~ 0.0005)
    r = 0.05
    q = 0.0
    known_sigma = 0.20
    option_type = "call"

    target_price = black_scholes.price(S0, K, T, r, q, known_sigma, option_type)

    # Trigger solver with custom vega_floor to explicitly force Brent fallback
    result = implied_vol.solve_implied_volatility(
        S0=S0,
        K=K,
        T=T,
        r=r,
        q=q,
        option_type=option_type,
        market_price=target_price,
        vega_floor=1.0,  # Force vega floor check to trigger fallback
    )

    assert result.converged is True
    assert result.method_used == "brent_fallback"
    assert pytest.approx(result.implied_vol, abs=1e-4) == known_sigma


def test_implied_vol_api_success():
    """Test POST /api/v1/price/implied-vol endpoint success scenario."""
    future_date = (date.today() + timedelta(days=90)).isoformat()
    payload = {
        "ticker": "AAPL",
        "market": "US",
        "spot_override": 150.0,
        "strike": 150.0,
        "expiry_date": future_date,
        "option_type": "call",
        "market_price": 8.50,
        "risk_free_rate": 0.05,
        "dividend_yield": 0.01,
    }

    response = client.post("/api/v1/price/implied-vol", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "implied_vol" in data
    assert data["implied_vol"] > 0
    assert data["converged"] is True
    assert data["method_used"] in ("newton", "brent_fallback")
    assert "final_residual" in data
    assert "bs_price_at_solution" in data


def test_implied_vol_api_no_solution_400():
    """Test POST /api/v1/price/implied-vol endpoint error handling for impossible market prices."""
    future_date = (date.today() + timedelta(days=90)).isoformat()
    payload = {
        "ticker": "AAPL",
        "market": "US",
        "spot_override": 100.0,
        "strike": 100.0,
        "expiry_date": future_date,
        "option_type": "call",
        "market_price": 0.00001,  # Unachievably low market price for ATM call with r=0.05
        "risk_free_rate": 0.05,
        "dividend_yield": 0.0,
    }

    response = client.post("/api/v1/price/implied-vol", json=payload)
    assert response.status_code == 400

    data = response.json()
    assert data["error"] == "no_solution_exists"
    assert "outside valid theoretical" in data["message"] or "cannot be bracketed" in data["message"]
    assert data["field"] == "market_price"
