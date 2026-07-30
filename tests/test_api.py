"""API endpoint tests using FastAPI TestClient.

Verifies all routes return correct JSON shapes, input validation rejects
invalid requests with 400, and error paths return structured errors.
"""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


def test_health_check():
    """GET /health returns 200 with status ok."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# POST /api/v1/price/preview
# ---------------------------------------------------------------------------


def _make_pricing_request(**overrides) -> dict:
    """Build a valid pricing request payload with sensible defaults."""
    future_date = (date.today() + timedelta(days=90)).isoformat()
    base = {
        "ticker": "TEST",
        "market": "US",
        "spot_override": 100.0,
        "strike": 105.0,
        "expiry_date": future_date,
        "option_type": "call",
        "volatility": 0.25,
        "risk_free_rate": 0.05,
        "dividend_yield": 0.02,
        "n_simulations": 5000,
        "seed": 42,
    }
    base.update(overrides)
    return base


def test_preview_returns_200_with_correct_shape():
    """POST /api/v1/price/preview returns preview-tier response."""
    payload = _make_pricing_request(n_simulations=5000)
    resp = client.post("/api/v1/price/preview", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["tier"] == "preview"
    assert "black_scholes" in body
    assert "monte_carlo_standard" in body
    assert "price" in body["black_scholes"]
    assert "delta" in body["black_scholes"]
    assert "gamma" in body["black_scholes"]
    # Preview must NOT contain SE/CI fields
    assert "standard_error" not in body.get("monte_carlo_standard", {})


def test_preview_rejects_past_expiry():
    """POST /api/v1/price/preview with past expiry returns 400."""
    past = (date.today() - timedelta(days=1)).isoformat()
    payload = _make_pricing_request(expiry_date=past)
    resp = client.post("/api/v1/price/preview", json=payload)
    assert resp.status_code == 400
    body = resp.json()
    assert body["error"] == "invalid_expiry"
    assert body["field"] == "expiry_date"


def test_preview_rejects_zero_volatility():
    """POST /api/v1/price/preview with vol<=0 returns 400."""
    payload = _make_pricing_request(volatility=0.0)
    resp = client.post("/api/v1/price/preview", json=payload)
    # Pydantic gt=0 catches this at schema level → 422
    assert resp.status_code == 422


def test_preview_rejects_negative_volatility():
    """POST /api/v1/price/preview with negative vol returns 422 (Pydantic)."""
    payload = _make_pricing_request(volatility=-0.1)
    resp = client.post("/api/v1/price/preview", json=payload)
    assert resp.status_code == 422


def test_preview_rejects_n_too_large():
    """POST /api/v1/price/preview with N > preview_max_n returns 400."""
    payload = _make_pricing_request(n_simulations=50000)
    resp = client.post("/api/v1/price/preview", json=payload)
    assert resp.status_code == 400
    body = resp.json()
    assert body["error"] == "invalid_n_simulations"


# ---------------------------------------------------------------------------
# POST /api/v1/price/full
# ---------------------------------------------------------------------------


def test_full_returns_200_with_correct_shape():
    """POST /api/v1/price/full returns full-tier response with all fields."""
    payload = _make_pricing_request(n_simulations=5000)
    resp = client.post("/api/v1/price/full", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["tier"] == "full"
    assert "request_echo" in body
    assert "black_scholes" in body
    assert "greeks" in body["black_scholes"]
    assert "mc_results" in body
    assert "greeks_fd" in body
    assert "convergence_data" in body
    assert "convergence_fit" in body
    assert "diagnostics" in body
    assert "terminal_distribution_sample" in body

    # Verify MC results contain all 5 methods when variance_reduction=all
    methods = {r["method"] for r in body["mc_results"]}
    assert methods == {"standard", "antithetic", "control_variate", "antithetic_cv", "quasi_monte_carlo"}


def test_full_rejects_past_expiry():
    """POST /api/v1/price/full with past expiry returns 400."""
    past = (date.today() - timedelta(days=1)).isoformat()
    payload = _make_pricing_request(expiry_date=past)
    resp = client.post("/api/v1/price/full", json=payload)
    assert resp.status_code == 400


def test_full_rejects_n_below_minimum():
    """POST /api/v1/price/full with N < 1000 returns 400."""
    payload = _make_pricing_request(n_simulations=500)
    resp = client.post("/api/v1/price/full", json=payload)
    assert resp.status_code == 400
    body = resp.json()
    assert body["error"] == "invalid_n_simulations"


def test_full_rejects_n_above_maximum():
    """POST /api/v1/price/full with N > 2_000_000 returns 400."""
    payload = _make_pricing_request(n_simulations=3_000_000)
    resp = client.post("/api/v1/price/full", json=payload)
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/v1/report/pdf
# ---------------------------------------------------------------------------


def test_report_pdf_returns_pdf():
    """POST /api/v1/report/pdf returns 200 with application/pdf content type."""
    payload = _make_pricing_request(n_simulations=5000)
    resp = client.post("/api/v1/report/pdf", json=payload)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    # PDF files start with %PDF magic bytes
    assert resp.content[:5] == b"%PDF-"


def test_report_pdf_rejects_past_expiry():
    """POST /api/v1/report/pdf with past expiry returns 400."""
    past = (date.today() - timedelta(days=1)).isoformat()
    payload = _make_pricing_request(expiry_date=past)
    resp = client.post("/api/v1/report/pdf", json=payload)
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Preview vs Full type enforcement
# ---------------------------------------------------------------------------


def test_preview_and_full_are_structurally_distinct():
    """Preview response must NOT contain fields exclusive to full response."""
    payload = _make_pricing_request(n_simulations=5000)
    preview_resp = client.post("/api/v1/price/preview", json=payload).json()
    full_resp = client.post("/api/v1/price/full", json=payload).json()

    assert preview_resp["tier"] == "preview"
    assert full_resp["tier"] == "full"

    # Preview MUST NOT include full simulation diagnostics or estimators table
    assert "mc_results" not in preview_resp
    assert "greeks_fd" not in preview_resp
    assert "convergence_fit" not in preview_resp

    # Full MUST include estimators table, FD Greeks, and convergence
    assert "mc_results" in full_resp
    assert "greeks_fd" in full_resp
    assert "convergence_fit" in full_resp


# ---------------------------------------------------------------------------
# GET /api/v1/validation/summary
# ---------------------------------------------------------------------------


def test_get_validation_summary_returns_200():
    """GET /api/v1/validation/summary returns 200 with CI coverage and edge cases."""
    resp = client.get("/api/v1/validation/summary")
    assert resp.status_code == 200
    data = resp.json()

    assert "ci_coverage" in data
    assert "edge_cases" in data
    assert "greeks_validation" in data
    assert data["ci_coverage"]["trials"] == 200
