"""Unit and API integration tests for 2D Risk Grid Engine and Endpoint."""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.engine import black_scholes, risk_grid

client = TestClient(app)


def test_risk_grid_single_cell_matches_scalar_bs():
    """Verify single cell of risk grid matches direct scalar black_scholes calculation."""
    S0 = 100.0
    K = 100.0
    T = 1.0
    r = 0.05
    q = 0.01
    sigma = 0.20
    option_type = "call"

    # Compute a 5x5 grid varying spot from 90 to 110 and volatility from 0.15 to 0.25
    res = risk_grid.compute_risk_grid(
        S0=S0,
        K=K,
        T=T,
        r=r,
        q=q,
        sigma=sigma,
        option_type=option_type,
        axis_x="spot",
        axis_y="volatility",
        x_min=90.0,
        x_max=110.0,
        num_x=5,
        y_min=0.15,
        y_max=0.25,
        num_y=5,
        metric="price",
    )

    assert len(res.x_values) == 5
    assert len(res.y_values) == 5
    assert len(res.grid) == 5
    assert len(res.grid[0]) == 5

    # Check center cell (index i=2 for x=100.0, index j=2 for y=0.20)
    x_center = res.x_values[2]  # 100.0
    y_center = res.y_values[2]  # 0.20
    cell_price = res.grid[2][2]

    direct_price = black_scholes.price(
        S0=x_center, K=K, T=T, r=r, q=q, sigma=y_center, option_type=option_type
    )

    assert pytest.approx(cell_price, abs=1e-6) == direct_price


def test_risk_grid_greeks_match_scalar():
    """Verify risk grid delta metric matches direct scalar price_and_greeks call."""
    S0 = 100.0
    K = 105.0
    T = 0.5
    r = 0.04
    q = 0.0
    sigma = 0.25

    res = risk_grid.compute_risk_grid(
        S0=S0,
        K=K,
        T=T,
        r=r,
        q=q,
        sigma=sigma,
        option_type="put",
        axis_x="strike",
        axis_y="time_to_expiry",
        x_min=90.0,
        x_max=120.0,
        num_x=7,
        y_min=0.1,
        y_max=1.0,
        num_y=7,
        metric="delta",
    )

    # Check cell at x_idx=3, y_idx=4
    x_val = res.x_values[3]
    y_val = res.y_values[4]
    grid_delta = res.grid[4][3]

    scalar_res = black_scholes.price_and_greeks(
        S0=S0, K=x_val, T=y_val, r=r, q=q, sigma=sigma, option_type="put"
    )

    assert pytest.approx(grid_delta, abs=1e-6) == scalar_res.delta


def test_risk_grid_invalid_bounds_rejected():
    """Verify non-positive spot, strike, vol, or expiry bounds raise RiskGridError."""
    with pytest.raises(risk_grid.RiskGridError, match="must be strictly positive"):
        risk_grid.compute_risk_grid(
            S0=100.0, K=100.0, T=1.0, r=0.05, q=0.0, sigma=0.2, option_type="call",
            axis_x="spot", axis_y="volatility",
            x_min=-10.0, x_max=50.0, num_x=10,
            y_min=0.1, y_max=0.3, num_y=10,
        )

    with pytest.raises(risk_grid.RiskGridError, match="must be positive"):
        risk_grid.compute_risk_grid(
            S0=100.0, K=100.0, T=1.0, r=0.05, q=0.0, sigma=0.2, option_type="call",
            axis_x="spot", axis_y="volatility",
            x_min=80.0, x_max=120.0, num_x=10,
            y_min=-0.05, y_max=0.3, num_y=10,
        )

    with pytest.raises(risk_grid.RiskGridError, match="must be distinct"):
        risk_grid.compute_risk_grid(
            S0=100.0, K=100.0, T=1.0, r=0.05, q=0.0, sigma=0.2, option_type="call",
            axis_x="spot", axis_y="spot",
            x_min=80.0, x_max=120.0, num_x=10,
            y_min=80.0, y_max=120.0, num_y=10,
        )


def test_api_risk_grid_endpoint_success():
    """Verify POST /api/v1/price/risk-grid returns HTTP 200 with correct grid dimensions."""
    payload = {
        "ticker": "AAPL",
        "market": "US",
        "spot_override": 150.0,
        "strike": 150.0,
        "expiry_date": "2026-12-31",
        "option_type": "call",
        "volatility": 0.25,
        "risk_free_rate": 0.05,
        "dividend_yield": 0.01,
        "axis_x": "spot",
        "axis_y": "volatility",
        "x_range": {"min": 120.0, "max": 180.0, "num_points": 25},
        "y_range": {"min": 0.15, "max": 0.35, "num_points": 25},
        "metric": "price",
    }
    resp = client.post("/api/v1/price/risk-grid", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["x_values"]) == 25
    assert len(data["y_values"]) == 25
    assert len(data["grid"]) == 25
    assert len(data["grid"][0]) == 25
    assert data["metric"] == "price"
    assert data["axis_x"] == "spot"
    assert data["axis_y"] == "volatility"


def test_api_risk_grid_endpoint_validation_error():
    """Verify POST /api/v1/price/risk-grid returns HTTP 400 for invalid range bounds."""
    payload = {
        "ticker": "AAPL",
        "market": "US",
        "spot_override": 150.0,
        "strike": 150.0,
        "expiry_date": "2026-12-31",
        "option_type": "call",
        "volatility": 0.25,
        "risk_free_rate": 0.05,
        "dividend_yield": 0.01,
        "axis_x": "volatility",
        "axis_y": "time_to_expiry",
        "x_range": {"min": -0.1, "max": 0.3, "num_points": 10},
        "y_range": {"min": 0.1, "max": 1.0, "num_points": 10},
        "metric": "price",
    }
    resp = client.post("/api/v1/price/risk-grid", json=payload)
    assert resp.status_code == 400
    data = resp.json()
    assert data["error"] == "invalid_grid_range"
