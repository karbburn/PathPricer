"""Unit tests for P&L Explain engine and API endpoint."""

import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.engine import pnl_explain

client = TestClient(app)


def test_pnl_explain_small_shift_tight_taylor():
    """Verify that a small spot shift yields a very tight Taylor series approximation with near-zero unexplained residual."""
    S0 = 100.0
    K = 100.0
    T = 1.0
    r = 0.05
    q = 0.02
    sigma = 0.25
    option_type = "call"

    # Small spot move: dS = 0.10 (0.1% of S0)
    d_spot = 0.10

    res = pnl_explain.explain_pnl(
        S0=S0, K=K, T=T, r=r, q=q, sigma=sigma, option_type=option_type, d_spot=d_spot
    )

    assert res.actual_pnl > 0
    # Relative unexplained residual should be < 0.1% of actual P&L for small moves
    assert abs(res.unexplained_pnl) < 1e-4
    assert abs(res.unexplained_pnl / res.actual_pnl) < 0.001


def test_pnl_explain_large_shift_residual_growth():
    """Verify that a large shift causes higher-order effects to grow materially, increasing unexplained P&L."""
    S0 = 100.0
    K = 100.0
    T = 1.0
    r = 0.05
    q = 0.02
    sigma = 0.25
    option_type = "call"

    # Small shift
    res_small = pnl_explain.explain_pnl(
        S0=S0, K=K, T=T, r=r, q=q, sigma=sigma, option_type=option_type, d_spot=0.10
    )

    # Large shift in spot and volatility
    res_large = pnl_explain.explain_pnl(
        S0=S0, K=K, T=T, r=r, q=q, sigma=sigma, option_type=option_type, d_spot=20.0, d_vol=0.10
    )

    # Assert that unexplained residual for large shift is orders of magnitude larger
    assert abs(res_large.unexplained_pnl) > 100.0 * abs(res_small.unexplained_pnl)
    assert abs(res_large.unexplained_pnl) > 0.05


def test_pnl_explain_theta_time_decay_sign():
    """Verify that positive elapsed time (d_days > 0) results in a negative theta P&L contribution for a long call position."""
    S0 = 100.0
    K = 100.0
    T = 1.0
    r = 0.05
    q = 0.0
    sigma = 0.20

    res = pnl_explain.explain_pnl(
        S0=S0, K=K, T=T, r=r, q=q, sigma=sigma, option_type="call", d_days=5.0
    )

    assert res.theta_pnl < 0.0
    # Base price > shifted price due to 5 days of time decay
    assert res.shifted_price < res.base_price
    assert res.actual_pnl < 0.0


def test_pnl_explain_api_endpoint_success():
    """Test POST /api/v1/price/pnl-explain endpoint with valid request payload."""
    future_date = (date.today() + timedelta(days=180)).isoformat()
    payload = {
        "ticker": "AAPL",
        "market": "US",
        "spot_override": 150.0,
        "strike": 150.0,
        "expiry_date": future_date,
        "option_type": "call",
        "volatility": 0.25,
        "risk_free_rate": 0.05,
        "dividend_yield": 0.01,
        "shift": {
            "d_spot": 5.0,
            "d_vol": 0.02,
            "d_days": 3,
            "d_rate": 0.0025,
        },
    }

    response = client.post("/api/v1/price/pnl-explain", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "base_price" in data
    assert "shifted_price" in data
    assert "actual_pnl" in data
    assert "predicted_pnl_total" in data
    assert "delta_pnl" in data
    assert "gamma_pnl" in data
    assert "vega_pnl" in data
    assert "theta_pnl" in data
    assert "rho_pnl" in data
    assert "unexplained_pnl" in data


def test_pnl_explain_api_validation_error():
    """Test POST /api/v1/price/pnl-explain error handling for invalid inputs."""
    past_date = (date.today() - timedelta(days=1)).isoformat()
    payload = {
        "ticker": "AAPL",
        "market": "US",
        "spot_override": 150.0,
        "strike": 150.0,
        "expiry_date": past_date,
        "option_type": "call",
        "volatility": 0.25,
        "risk_free_rate": 0.05,
    }

    response = client.post("/api/v1/price/pnl-explain", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["error"] == "invalid_expiry"
