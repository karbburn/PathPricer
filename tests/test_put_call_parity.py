"""Put-call parity extraction self-checks."""

import math

import pytest

from backend.app.engine.implied_dividend import extract_implied_dividend
from backend.app.engine.implied_rate import extract_implied_rate

CALL, PUT, SPOT, STRIKE, TTM = 8.0, 4.0, 100.0, 100.0, 0.25


def test_implied_rate_round_trips():
    q = 0.02
    r = extract_implied_rate(CALL, PUT, SPOT, STRIKE, TTM, q)
    spread = SPOT * math.exp(-q * TTM) - STRIKE * math.exp(-r * TTM)
    assert math.isclose(spread, CALL - PUT, rel_tol=1e-9, abs_tol=1e-9)


def test_implied_rate_zero_dividend():
    r = extract_implied_rate(CALL, PUT, SPOT, STRIKE, TTM, 0.0)
    assert math.isclose(SPOT - STRIKE * math.exp(-r * TTM), CALL - PUT, rel_tol=1e-9)


def test_implied_rate_positive_prices_required():
    with pytest.raises(ValueError):
        extract_implied_rate(0.0, PUT, SPOT, STRIKE, TTM)


def test_implied_dividend_round_trips():
    r = 0.05
    q = extract_implied_dividend(CALL, PUT, SPOT, STRIKE, TTM, r)
    spread = SPOT * math.exp(-q * TTM) - STRIKE * math.exp(-r * TTM)
    assert math.isclose(spread, CALL - PUT, rel_tol=1e-9, abs_tol=1e-9)


def test_implied_dividend_positive_prices_required():
    with pytest.raises(ValueError):
        extract_implied_dividend(CALL, 0.0, SPOT, STRIKE, TTM, 0.05)
