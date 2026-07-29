"""Unit tests for finite-difference Greeks engine (backend/app/engine/greeks.py).

Validates finite-difference Greeks (with CRN) against analytical Black-Scholes Greeks
using relative tolerances:
- Delta: 2%
- Gamma: 5%
- Vega: 3%
- Theta: 5%
- Rho: 3%
"""

import pytest
from backend.app.core.rng import make_rng
from backend.app.engine import black_scholes
from backend.app.engine import greeks
from backend.app.engine.monte_carlo import estimate_standard
from backend.app.engine.greeks import FDGreeksResult


def test_fd_greeks_call_vs_analytical_tolerances():
    """Verify Call FD Greeks match analytical Black-Scholes Greeks within tolerances."""
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2
    seed = 100
    n = 100_000

    bs_res = black_scholes.price_and_greeks(S0, K, T, r, q, sigma, "call")
    fd_res = greeks.finite_difference_greeks(S0, K, T, r, q, sigma, "call", seed=seed, n=n)

    assert isinstance(fd_res, FDGreeksResult)

    # Relative tolerances:
    # Delta: 2%, Gamma: 5%, Vega: 3%, Theta: 5%, Rho: 3%
    assert fd_res.delta == pytest.approx(bs_res.delta, rel=0.02)
    assert fd_res.gamma == pytest.approx(bs_res.gamma, rel=0.05)
    assert fd_res.vega == pytest.approx(bs_res.vega, rel=0.03)
    assert fd_res.theta == pytest.approx(bs_res.theta, rel=0.05)
    assert fd_res.rho == pytest.approx(bs_res.rho, rel=0.03)


def test_fd_greeks_put_vs_analytical_tolerances():
    """Verify Put FD Greeks match analytical Black-Scholes Greeks within tolerances."""
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2
    seed = 100
    n = 100_000

    bs_res = black_scholes.price_and_greeks(S0, K, T, r, q, sigma, "put")
    fd_res = greeks.finite_difference_greeks(S0, K, T, r, q, sigma, "put", seed=seed, n=n)

    assert fd_res.delta == pytest.approx(bs_res.delta, rel=0.02)
    assert fd_res.gamma == pytest.approx(bs_res.gamma, rel=0.05)
    assert fd_res.vega == pytest.approx(bs_res.vega, rel=0.03)
    assert fd_res.theta == pytest.approx(bs_res.theta, rel=0.05)
    assert fd_res.rho == pytest.approx(bs_res.rho, rel=0.03)


def test_crn_essential_for_noise_reduction():
    """Verify Common Random Numbers (CRN) dramatically reduce finite-difference noise.

    Compares CRN (same seed reused for base and bumped runs) vs non-CRN (different seeds).
    CRN isolates the sensitivity, producing accurate Delta within tolerance.
    """
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2
    n = 10_000
    h_S = 0.5

    bs_delta = black_scholes.price_and_greeks(S0, K, T, r, q, sigma, "call").delta

    # With CRN (same seed = 42 for both runs)
    rng_crn_up = make_rng(42)
    Z_crn = rng_crn_up.standard_normal(n)
    p_up_crn = estimate_standard(S0 + h_S, K, T, r, q, sigma, "call", n, rng=rng_crn_up, base_Z=Z_crn).price
    p_down_crn = estimate_standard(S0 - h_S, K, T, r, q, sigma, "call", n, rng=make_rng(42), base_Z=Z_crn).price
    delta_crn = (p_up_crn - p_down_crn) / (2.0 * h_S)

    # Without CRN (different seeds = 42 vs 999)
    p_up_no_crn = estimate_standard(S0 + h_S, K, T, r, q, sigma, "call", n, rng=make_rng(42)).price
    p_down_no_crn = estimate_standard(S0 - h_S, K, T, r, q, sigma, "call", n, rng=make_rng(999)).price
    delta_no_crn = (p_up_no_crn - p_down_no_crn) / (2.0 * h_S)

    # CRN error is much smaller than non-CRN error
    err_crn = abs(delta_crn - bs_delta)
    err_no_crn = abs(delta_no_crn - bs_delta)

    assert err_crn < err_no_crn
    assert delta_crn == pytest.approx(bs_delta, rel=0.03)


def test_bump_sizes_used_keys():
    """Verify bump_sizes_used contains expected keys for parameters S0, sigma, T, r."""
    fd_res = greeks.finite_difference_greeks(100.0, 100.0, 1.0, 0.05, 0.02, 0.2, "call", seed=42)
    bump_dict = fd_res.bump_sizes_used

    assert "S0" in bump_dict
    assert "sigma" in bump_dict
    assert "T" in bump_dict
    assert "r" in bump_dict
    assert bump_dict["S0"] == pytest.approx(0.5, abs=1e-4)


def test_invalid_option_type_raises_value_error():
    """Verify invalid option_type raises ValueError."""
    with pytest.raises(ValueError, match="Invalid option_type"):
        greeks.finite_difference_greeks(100, 100, 1.0, 0.05, 0.02, 0.2, "invalid", seed=42)
