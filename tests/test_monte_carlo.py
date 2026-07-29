"""Unit tests for Monte Carlo simulation engine (backend/app/engine/monte_carlo.py).

Validates standard Monte Carlo, Antithetic Variates, Control Variates, and Combined Antithetic+CV
estimators for convergence to Black-Scholes benchmark, SE decay, 95% CI coverage, reproducibility,
and variance reduction ordering.
"""

import pytest
import numpy as np
from backend.app.core.rng import make_rng
from backend.app.engine import black_scholes
from backend.app.engine import monte_carlo
from backend.app.engine.monte_carlo import MCEstimatorResult


def test_estimate_standard_result_structure():
    """Verify estimate_standard returns MCEstimatorResult with correct attributes."""
    rng = make_rng(42)
    res = monte_carlo.estimate_standard(
        S0=100.0,
        K=100.0,
        T=1.0,
        r=0.05,
        q=0.02,
        sigma=0.2,
        option_type="call",
        n_simulations=10_000,
        rng=rng,
    )

    assert isinstance(res, MCEstimatorResult)
    assert res.method == "standard"
    assert res.n_effective == 10_000
    assert res.standard_error > 0
    assert res.ci_lower < res.price < res.ci_upper
    assert res.runtime_ms >= 0
    assert res.paths_per_second >= 0


def test_mc_converges_to_bs_and_se_decreases_with_n():
    """Verify MC price converges to Black-Scholes price and SE decreases as N increases."""
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2
    bs_call = black_scholes.price(S0, K, T, r, q, sigma, "call")

    rng1 = make_rng(123)
    res_small = monte_carlo.estimate_standard(S0, K, T, r, q, sigma, "call", 1_000, rng1)

    rng2 = make_rng(123)
    res_large = monte_carlo.estimate_standard(S0, K, T, r, q, sigma, "call", 100_000, rng2)

    # Standard error decreases with larger N
    assert res_large.standard_error < res_small.standard_error

    # Larger N price is closer to analytical BS price
    assert abs(res_large.price - bs_call) < abs(res_small.price - bs_call) or abs(res_large.price - bs_call) < 0.05

    # 95% CI contains the analytical BS price
    assert res_large.ci_lower <= bs_call <= res_large.ci_upper


def test_mc_put_option_pricing():
    """Verify standard MC estimator correctly prices Put options and CI contains BS price."""
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2
    bs_put = black_scholes.price(S0, K, T, r, q, sigma, "put")

    rng = make_rng(999)
    res = monte_carlo.estimate_standard(S0, K, T, r, q, sigma, "put", 100_000, rng)

    assert res.ci_lower <= bs_put <= res.ci_upper


def test_base_z_reuse():
    """Verify supplying explicit base_Z yields reproducible deterministic results."""
    rng = make_rng(42)
    Z = rng.standard_normal(5_000)

    res1 = monte_carlo.estimate_standard(
        100.0, 100.0, 1.0, 0.05, 0.0, 0.2, "call", 5_000, rng=rng, base_Z=Z
    )
    res2 = monte_carlo.estimate_standard(
        100.0, 100.0, 1.0, 0.05, 0.0, 0.2, "call", 5_000, rng=rng, base_Z=Z
    )

    assert res1.price == res2.price
    assert res1.standard_error == res2.standard_error


def test_reproducibility_with_same_seed():
    """Verify independent runs with identical seeds produce identical prices."""
    rng1 = make_rng(2026)
    res1 = monte_carlo.estimate_standard(100.0, 100.0, 1.0, 0.05, 0.02, 0.2, "call", 20_000, rng1)

    rng2 = make_rng(2026)
    res2 = monte_carlo.estimate_standard(100.0, 100.0, 1.0, 0.05, 0.02, 0.2, "call", 20_000, rng2)

    assert res1.price == res2.price
    assert res1.standard_error == res2.standard_error


def test_invalid_inputs_raise_value_errors():
    """Verify invalid option_type or non-positive n_simulations raise ValueError."""
    rng = make_rng(42)
    with pytest.raises(ValueError, match="Invalid option_type"):
        monte_carlo.estimate_standard(100, 100, 1.0, 0.05, 0.0, 0.2, "binary", 1000, rng)

    with pytest.raises(ValueError, match="n_simulations must be positive"):
        monte_carlo.estimate_standard(100, 100, 1.0, 0.05, 0.0, 0.2, "call", 0, rng)

    with pytest.raises(ValueError, match="Invalid option_type"):
        monte_carlo.estimate_antithetic(100, 100, 1.0, 0.05, 0.0, 0.2, "binary", 1000, rng)

    with pytest.raises(ValueError, match="n_pairs must be positive"):
        monte_carlo.estimate_antithetic(100, 100, 1.0, 0.05, 0.0, 0.2, "call", -10, rng)

    with pytest.raises(ValueError, match="Invalid option_type"):
        monte_carlo.estimate_control_variate(100, 100, 1.0, 0.05, 0.0, 0.2, "binary", 1000, rng)

    with pytest.raises(ValueError, match="n_simulations must be positive"):
        monte_carlo.estimate_control_variate(100, 100, 1.0, 0.05, 0.0, 0.2, "call", -5, rng)

    with pytest.raises(ValueError, match="Invalid option_type"):
        monte_carlo.estimate_antithetic_cv(100, 100, 1.0, 0.05, 0.0, 0.2, "binary", 1000, rng)

    with pytest.raises(ValueError, match="n_pairs must be positive"):
        monte_carlo.estimate_antithetic_cv(100, 100, 1.0, 0.05, 0.0, 0.2, "call", 0, rng)


def test_estimate_antithetic_result_structure_and_n_effective():
    """Verify estimate_antithetic returns method='antithetic' and n_effective == 2 * n_pairs."""
    rng = make_rng(42)
    n_pairs = 10_000
    res = monte_carlo.estimate_antithetic(
        S0=100.0,
        K=100.0,
        T=1.0,
        r=0.05,
        q=0.02,
        sigma=0.2,
        option_type="call",
        n_pairs=n_pairs,
        rng=rng,
    )

    assert isinstance(res, MCEstimatorResult)
    assert res.method == "antithetic"
    assert res.n_effective == 2 * n_pairs
    assert res.standard_error > 0
    assert res.ci_lower < res.price < res.ci_upper


def test_antithetic_variance_reduction_se_less_than_standard():
    """Verify Antithetic SE < Standard SE at matched n_pairs."""
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2
    n_pairs = 50_000
    bs_call = black_scholes.price(S0, K, T, r, q, sigma, "call")

    rng_std = make_rng(100)
    std_res = monte_carlo.estimate_standard(S0, K, T, r, q, sigma, "call", n_pairs, rng_std)

    rng_anti = make_rng(100)
    anti_res = monte_carlo.estimate_antithetic(S0, K, T, r, q, sigma, "call", n_pairs, rng_anti)

    # Antithetic SE must be lower than Standard SE at matched n_pairs
    assert anti_res.standard_error < std_res.standard_error

    # Antithetic 95% CI contains the true Black-Scholes price
    assert anti_res.ci_lower <= bs_call <= anti_res.ci_upper


def test_estimate_control_variate_result_structure():
    """Verify estimate_control_variate returns method='control_variate'."""
    rng = make_rng(42)
    n_simulations = 10_000
    res = monte_carlo.estimate_control_variate(
        S0=100.0,
        K=100.0,
        T=1.0,
        r=0.05,
        q=0.02,
        sigma=0.2,
        option_type="call",
        n_simulations=n_simulations,
        rng=rng,
    )

    assert isinstance(res, MCEstimatorResult)
    assert res.method == "control_variate"
    assert res.n_effective == n_simulations
    assert res.standard_error > 0
    assert res.ci_lower < res.price < res.ci_upper


def test_control_variate_variance_reduction_se_less_than_standard():
    """Verify Control Variate SE < Standard SE at same N."""
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2
    N = 50_000
    bs_call = black_scholes.price(S0, K, T, r, q, sigma, "call")

    rng_std = make_rng(555)
    std_res = monte_carlo.estimate_standard(S0, K, T, r, q, sigma, "call", N, rng_std)

    rng_cv = make_rng(555)
    cv_res = monte_carlo.estimate_control_variate(S0, K, T, r, q, sigma, "call", N, rng_cv)

    # Control Variate SE must be significantly lower than Standard SE
    assert cv_res.standard_error < std_res.standard_error

    # CV 95% CI contains the analytical Black-Scholes price
    assert cv_res.ci_lower <= bs_call <= cv_res.ci_upper


def test_estimate_antithetic_cv_result_structure():
    """Verify estimate_antithetic_cv returns method='antithetic_cv' and n_effective == 2 * n_pairs."""
    rng = make_rng(42)
    n_pairs = 10_000
    res = monte_carlo.estimate_antithetic_cv(
        S0=100.0,
        K=100.0,
        T=1.0,
        r=0.05,
        q=0.02,
        sigma=0.2,
        option_type="call",
        n_pairs=n_pairs,
        rng=rng,
    )

    assert isinstance(res, MCEstimatorResult)
    assert res.method == "antithetic_cv"
    assert res.n_effective == 2 * n_pairs
    assert res.standard_error > 0
    assert res.ci_lower < res.price < res.ci_upper


def test_variance_reduction_ordering():
    """Verify variance reduction ordering across all 4 estimators:
    Std SE > Antithetic SE & CV SE > Combined Antithetic+CV SE.
    """
    S0, K, T, r, q, sigma = 100.0, 100.0, 1.0, 0.05, 0.02, 0.2
    n_pairs = 50_000
    bs_call = black_scholes.price(S0, K, T, r, q, sigma, "call")

    rng1 = make_rng(777)
    std_res = monte_carlo.estimate_standard(S0, K, T, r, q, sigma, "call", n_pairs, rng1)

    rng2 = make_rng(777)
    anti_res = monte_carlo.estimate_antithetic(S0, K, T, r, q, sigma, "call", n_pairs, rng2)

    rng3 = make_rng(777)
    cv_res = monte_carlo.estimate_control_variate(S0, K, T, r, q, sigma, "call", n_pairs, rng3)

    rng4 = make_rng(777)
    acv_res = monte_carlo.estimate_antithetic_cv(S0, K, T, r, q, sigma, "call", n_pairs, rng4)

    # Combined SE < standalone Antithetic SE and standalone CV SE
    assert acv_res.standard_error < anti_res.standard_error
    assert acv_res.standard_error < cv_res.standard_error

    # Overall ordering: Standard SE > (Anti SE, CV SE) > Combined SE
    assert std_res.standard_error > anti_res.standard_error
    assert std_res.standard_error > cv_res.standard_error

    # Combined 95% CI contains Black-Scholes price
    assert acv_res.ci_lower <= bs_call <= acv_res.ci_upper
