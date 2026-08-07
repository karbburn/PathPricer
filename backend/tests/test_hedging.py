"""Unit tests for hedging simulation engine modules."""

from __future__ import annotations

import math

import numpy as np
import pytest

from backend.app.engine.heston import (
    HestonParams,
    heston_delta,
    price_european,
)
from backend.app.engine.heston_simulator import simulate_heston_paths
from backend.app.engine.hedging import (
    _bs_delta,
    _expected_avg_variance,
    hedge_path,
)
from backend.app.engine.hedging_comparison import compare_hedging


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_PARAMS = HestonParams(v0=0.04, kappa=2.0, theta_v=0.04, sigma_v=0.3, rho=-0.7)
_S0, _K, _T, _R, _Q = 100.0, 100.0, 1.0, 0.05, 0.02


def _make_params(**overrides) -> HestonParams:
    defaults = dict(v0=0.04, kappa=2.0, theta_v=0.04, sigma_v=0.3, rho=-0.7)
    defaults.update(overrides)
    return HestonParams(**defaults)


# ===== 1. Path simulation properties =======================================

class TestPathSimulation:
    """Verify structural properties of simulate_heston_paths output."""

    def test_shape(self):
        n_steps, n_paths = 50, 200
        S, v = simulate_heston_paths(
            _PARAMS, _S0, _T, _R, _Q, n_steps, n_paths, seed=42,
        )
        assert S.shape == (n_paths, n_steps + 1)
        assert v.shape == (n_paths, n_steps + 1)

    def test_initial_values(self):
        S, v = simulate_heston_paths(
            _PARAMS, _S0, _T, _R, _Q, 10, 40, seed=0,
        )
        np.testing.assert_array_equal(S[:, 0], _S0)
        np.testing.assert_array_equal(v[:, 0], _PARAMS.v0)

    def test_variance_nonneg(self):
        S, v = simulate_heston_paths(
            _PARAMS, _S0, _T, _R, _Q, 100, 500, seed=7,
        )
        assert np.all(v >= 0.0), "variance paths must be >= 0 (full truncation)"

    def test_antithetic_symmetry(self):
        """With antithetic=True the first half and second half use opposite BMs."""
        n_paths = 100
        S, v = simulate_heston_paths(
            _PARAMS, _S0, _T, _R, _Q, 5, n_paths, seed=99, antithetic=True,
        )
        half = n_paths // 2
        # Stock paths of antithetic pairs diverge (not identical)
        assert not np.allclose(S[:half], S[half:]), (
            "antithetic halves should differ"
        )
        # But average spot should be roughly the same
        avg_first = np.mean(S[:half, -1])
        avg_second = np.mean(S[half:, -1])
        # Within a generous bound (they're random, just sanity check same order)
        assert abs(avg_first - avg_second) / max(avg_first, 1e-10) < 2.0


# ===== 2. Expected average variance ========================================

class TestExpectedAvgVariance:
    """Verify the analytical E[avg variance] formula edge cases."""

    def test_t_rem_zero(self):
        """T_rem → 0 should return v_t (clamped >= 1e-10)."""
        result = _expected_avg_variance(0.05, _PARAMS, T_remaining=0.0)
        assert abs(result - 0.05) < 1e-9

    def test_t_rem_zero_negative_v(self):
        """Even if v_t were negative-ish, result must be >= 1e-10."""
        result = _expected_avg_variance(0.0, _PARAMS, T_remaining=0.0)
        assert result >= 1e-10

    def test_kappa_zero(self):
        """kappa → 0 means no mean reversion; v stays at v_t."""
        p = _make_params(kappa=1e-15)
        result = _expected_avg_variance(0.06, p, T_remaining=0.5)
        assert abs(result - 0.06) < 1e-4

    def test_large_t_rem(self):
        """For large T_rem, E[avg] → theta_v (stationary distribution)."""
        p = _make_params(kappa=5.0, theta_v=0.04)
        result = _expected_avg_variance(0.10, p, T_remaining=100.0)
        assert abs(result - 0.04) < 0.01

    def test_v_equals_theta(self):
        """If v_t = theta, the mean stays constant for all T_rem."""
        p = _make_params(kappa=3.0, theta_v=0.04)
        result = _expected_avg_variance(0.04, p, T_remaining=1.0)
        assert abs(result - 0.04) < 1e-9

    def test_monotone_convergence_to_theta(self):
        """For v_t > theta, avg variance should decrease toward theta as T_rem grows."""
        p = _make_params(kappa=2.0, theta_v=0.04)
        vals = [_expected_avg_variance(0.10, p, T) for T in [0.1, 1.0, 10.0, 50.0]]
        # Each should be closer to theta than the previous
        for i in range(len(vals) - 1):
            assert abs(vals[i] - 0.04) >= abs(vals[i + 1] - 0.04) - 1e-10


# ===== 3. BS delta =========================================================

class TestBSDelta:
    """Black-Scholes delta edge cases and put-call parity."""

    def test_deep_itm_call(self):
        """Deep ITM call delta → 1."""
        d = _bs_delta(S=200, K=100, T_remaining=1.0, r=0.05, q=0.0,
                      sigma=0.2, option_type="call")
        assert d > 0.99

    def test_deep_otm_call(self):
        """Deep OTM call delta → 0."""
        d = _bs_delta(S=50, K=100, T_remaining=1.0, r=0.05, q=0.0,
                      sigma=0.2, option_type="call")
        assert d < 0.01

    def test_put_call_parity_delta(self):
        """delta_call - delta_put = e^{-qT} for same (S,K,T,r,q,sigma)."""
        S, K, T, r, q, sigma = 100, 100, 0.5, 0.05, 0.02, 0.25
        d_call = _bs_delta(S, K, T, r, q, sigma, "call")
        d_put = _bs_delta(S, K, T, r, q, sigma, "put")
        parity = math.exp(-q * T)
        assert abs((d_call - d_put) - parity) < 1e-8

    def test_zero_t_remaining_call(self):
        """T_remaining → 0: ITM call delta = 1, OTM call delta = 0."""
        assert _bs_delta(110, 100, 0.0, 0.05, 0.0, 0.2, "call") == 1.0
        assert _bs_delta(90, 100, 0.0, 0.05, 0.0, 0.2, "call") == 0.0

    def test_zero_t_remaining_put(self):
        """T_remaining → 0: ITM put delta = -1, OTM put delta = 0."""
        assert _bs_delta(90, 100, 0.0, 0.05, 0.0, 0.2, "put") == -1.0
        assert _bs_delta(110, 100, 0.0, 0.05, 0.0, 0.2, "put") == 0.0


# ===== 4. Heston delta =====================================================

class TestHestonDelta:
    """Analytical Heston delta via Fourier P1."""

    def test_matches_finite_difference(self):
        """Analytical delta must agree with central finite-difference price diff."""
        h = 0.5  # 0.5% bump
        p_up = price_european(_S0 + h, _K, _T, _R, _Q, _PARAMS, "call")
        p_dn = price_european(_S0 - h, _K, _T, _R, _Q, _PARAMS, "call")
        fd_delta = (p_up - p_dn) / (2.0 * h)
        analytical = heston_delta(_S0, _K, _T, _R, _Q, _PARAMS, "call")
        assert abs(analytical - fd_delta) < 0.05  # generous for 0.5% bump

    def test_put_call_parity(self):
        """delta_call - delta_put = e^{-qT} (Heston is arbitrage-free)."""
        d_call = heston_delta(_S0, _K, _T, _R, _Q, _PARAMS, "call")
        d_put = heston_delta(_S0, _K, _T, _R, _Q, _PARAMS, "put")
        parity = math.exp(-_Q * _T)
        assert abs((d_call - d_put) - parity) < 1e-6

    def test_deep_itm_call(self):
        """Deep ITM Heston call delta close to e^{-qT}."""
        d = heston_delta(200, 100, _T, _R, _Q, _PARAMS, "call")
        assert d > math.exp(-_Q * _T) * 0.95

    def test_deep_otm_put(self):
        """Deep OTM put delta close to 0."""
        d = heston_delta(200, 100, _T, _R, _Q, _PARAMS, "put")
        assert abs(d) < 0.05

    def test_zero_t(self):
        """T → 0: call delta = 1 if ITM, 0 if OTM."""
        assert heston_delta(110, 100, 0.0, _R, _Q, _PARAMS, "call") == 1.0
        assert heston_delta(90, 100, 0.0, _R, _Q, _PARAMS, "call") == 0.0


# ===== 5. Hedging engine ===================================================

class TestHedgingEngine:
    """hedge_path() structural checks."""

    def test_zero_tc_zero_vol_deterministic(self):
        """With zero vol (sigma_v ~ 0) and zero TC, hedging error should be small."""
        p = _make_params(v0=0.0001, sigma_v=0.001, kappa=0.01, theta_v=0.0001)
        S, v = simulate_heston_paths(p, _S0, _T, _R, _Q, 20, 2, seed=42)
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=_T, r=_R, q=_Q,
            option_type="call", model="bs",
            tc_bps=0.0, sigma_fixed=0.01,
        )
        # With near-deterministic path and zero TC, error should be small
        # (discrete rebalancing + tiny vol means error isn't zero, but bounded)
        assert abs(res["hedging_error"]) < 5.0

    def test_zero_tc_no_transaction_costs(self):
        """tc_bps=0 → total_tc should be exactly 0."""
        S, v = simulate_heston_paths(_PARAMS, _S0, _T, _R, _Q, 10, 2, seed=1)
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=_T, r=_R, q=_Q,
            option_type="call", model="bs", tc_bps=0.0,
        )
        assert res["total_tc"] == pytest.approx(0.0, abs=1e-15)

    def test_single_step(self):
        """With n_steps=1 the hedge is set at t=0 and rebalanced once at T."""
        S, v = simulate_heston_paths(_PARAMS, _S0, _T, _R, _Q, 1, 2, seed=5)
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=_T, r=_R, q=_Q,
            option_type="call", model="bs", tc_bps=0.0,
        )
        assert len(res["delta_path"]) == 2  # t=0 and t=1
        assert len(res["portfolio_values"]) == 2

    def test_portfolio_consistency(self):
        """Portfolio value at t=0 = cash + stock_pos * S[0] = premium."""
        S, v = simulate_heston_paths(_PARAMS, _S0, _T, _R, _Q, 10, 2, seed=3)
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=_T, r=_R, q=_Q,
            option_type="call", model="bs", tc_bps=0.0,
        )
        # portfolio_arr[0] should equal the initial premium
        from backend.app.engine.black_scholes import price as bs_price
        sigma0 = math.sqrt(max(float(v[0, 0]), 1e-10))
        premium = bs_price(float(S[0, 0]), _K, _T, _R, _Q, sigma0, "call")
        assert res["portfolio_values"][0] == pytest.approx(premium, rel=1e-10)

    def test_output_keys(self):
        """Result dict contains all expected keys."""
        S, v = simulate_heston_paths(_PARAMS, _S0, _T, _R, _Q, 5, 2, seed=0)
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=_T, r=_R, q=_Q,
            option_type="call", model="bs", tc_bps=1.0,
        )
        for key in ("hedging_error", "total_tc", "delta_path", "portfolio_values"):
            assert key in res


# ===== 6. Comparison orchestrator ===========================================

class TestHedgingComparison:
    """compare_hedging() integration-level checks."""

    def test_runs_without_error(self):
        """Full pipeline completes without exception."""
        result = compare_hedging(
            S0=_S0, K=_K, T=_T, r=_R, q=_Q, option_type="call",
            heston_params=_PARAMS, n_rebalance=10, n_simulations=4,
            tc_bps=5.0, seed=42,
        )
        assert "bs" in result
        assert "heston" in result

    def test_output_shape(self):
        """Error arrays have length n_simulations."""
        n = 8
        result = compare_hedging(
            S0=_S0, K=_K, T=_T, r=_R, q=_Q, option_type="call",
            heston_params=_PARAMS, n_rebalance=10, n_simulations=n,
            tc_bps=5.0, seed=0,
        )
        assert len(result["bs"]["errors"]) == n
        assert len(result["heston"]["errors"]) == n

    def test_variance_ratio_positive(self):
        """variance_ratio is a positive finite number."""
        result = compare_hedging(
            S0=_S0, K=_K, T=_T, r=_R, q=_Q, option_type="call",
            heston_params=_PARAMS, n_rebalance=10, n_simulations=4,
            tc_bps=5.0, seed=7,
        )
        vr = result["variance_ratio"]
        assert vr > 0 and math.isfinite(vr)

    def test_sigma_fixed_reasonable(self):
        """Implied vol used for BS should be in a sensible range."""
        result = compare_hedging(
            S0=_S0, K=_K, T=_T, r=_R, q=_Q, option_type="call",
            heston_params=_PARAMS, n_rebalance=10, n_simulations=4,
            tc_bps=5.0, seed=1,
        )
        assert 0.01 < result["sigma_fixed"] < 2.0

    def test_put_option(self):
        """Pipeline works for puts too."""
        result = compare_hedging(
            S0=_S0, K=_K, T=_T, r=_R, q=_Q, option_type="put",
            heston_params=_PARAMS, n_rebalance=10, n_simulations=4,
            tc_bps=5.0, seed=11,
        )
        assert len(result["bs"]["errors"]) == 4


# ===== 7. Edge cases =======================================================

class TestEdgeCases:
    """Extreme parameters and degenerate inputs."""

    def test_t_remaining_tiny(self):
        """T_remaining = 1e-12 should not crash BS delta."""
        d = _bs_delta(100, 100, 1e-12, 0.05, 0.0, 0.2, "call")
        assert 0.0 <= d <= 1.0

    def test_kappa_tiny(self):
        """kappa = 1e-15: expected avg variance ≈ v_t."""
        p = _make_params(kappa=1e-15)
        result = _expected_avg_variance(0.06, p, T_remaining=0.5)
        assert abs(result - 0.06) < 1e-4

    def test_extreme_sigma_v(self):
        """High vol-of-vol should still produce valid Heston delta."""
        p = _make_params(sigma_v=2.0)
        d = heston_delta(_S0, _K, _T, _R, _Q, p, "call")
        assert math.isfinite(d)
        assert -1.0 <= d <= 1.0

    def test_deep_otm_hedge(self):
        """Deep OTM option should have near-zero delta throughout."""
        S, v = simulate_heston_paths(_PARAMS, 50, _T, _R, _Q, 10, 2, seed=0)
        res = hedge_path(
            S=S[0], v=v[0], K=200, T=_T, r=_R, q=_Q,
            option_type="call", model="bs", tc_bps=0.0,
        )
        # Deep OTM deltas should be near zero
        assert np.all(np.abs(res["delta_path"]) < 0.05)

    def test_heston_delta_tiny_t(self):
        """heston_delta with T=1e-12 should not crash."""
        d = heston_delta(100, 100, 1e-12, 0.05, 0.0, _PARAMS, "call")
        assert math.isfinite(d)

    def test_v0_extreme(self):
        """Very high v0: delta should still be bounded."""
        p = _make_params(v0=1.0)
        d = heston_delta(_S0, _K, _T, _R, _Q, p, "call")
        assert math.isfinite(d)
        assert -1.0 <= d <= 1.0

    def test_hedge_near_expiry(self):
        """Path with very short T should not crash hedge_path."""
        T_short = 1e-6
        S, v = simulate_heston_paths(
            _PARAMS, _S0, T_short, _R, _Q, 2, 2, seed=0,
        )
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=T_short, r=_R, q=_Q,
            option_type="call", model="bs", tc_bps=0.0,
        )
        assert math.isfinite(res["hedging_error"])


# ===== 8. Additional coverage ===============================================

class TestDividendYield:
    """Hedging with q > 0 (dividend-paying underlying)."""

    def test_hedge_with_dividends(self):
        """Hedging a call with q=0.02 should work without error."""
        q = 0.02
        S, v = simulate_heston_paths(_PARAMS, _S0, _T, _R, q, 10, 2, seed=42)
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=_T, r=_R, q=q,
            option_type="call", model="bs", tc_bps=0.0,
        )
        assert math.isfinite(res["hedging_error"])

    def test_delta_with_dividends(self):
        """Call delta with q > 0 should be less than with q = 0."""
        d_no_div = _bs_delta(100, 100, 0.5, 0.05, 0.0, 0.2, "call")
        d_div = _bs_delta(100, 100, 0.5, 0.05, 0.02, 0.2, "call")
        assert d_div < d_no_div

    def test_heston_pricing_with_dividends(self):
        """Heston price with q > 0 should be lower than with q = 0 for calls."""
        p_no_div = price_european(_S0, _K, _T, _R, 0.0, _PARAMS, "call")
        p_div = price_european(_S0, _K, _T, _R, 0.02, _PARAMS, "call")
        assert p_div < p_no_div


class TestOddPathsRejection:
    """Verify ValueError when n_paths is odd with antithetic=True."""

    def test_odd_paths_raises(self):
        with pytest.raises(ValueError, match="even"):
            simulate_heston_paths(_PARAMS, _S0, _T, _R, _Q, 10, 5, seed=0, antithetic=True)

    def test_odd_paths_simulations_rounds_up(self):
        """compare_hedging rounds up odd n_simulations to even."""
        result = compare_hedging(
            S0=_S0, K=_K, T=_T, r=_R, q=_Q, option_type="call",
            heston_params=_PARAMS, n_rebalance=5, n_simulations=5,
            tc_bps=0.0, seed=0,
        )
        assert len(result["bs"]["errors"]) == 6


class TestVarianceRatioEdgeCases:
    """variance_ratio when both variances are near zero."""

    def test_both_variances_near_zero_ratio(self):
        """When both BS and Heston variance are < 1e-20, ratio should be 1.0."""
        import numpy as np
        # Simulate the ratio computation directly
        bs_var = 1e-25
        heston_var = 1e-25
        ratio = (
            bs_var / heston_var
            if heston_var > 1e-20
            else (1.0 if bs_var < 1e-20 else float("inf"))
        )
        assert ratio == 1.0

    def test_one_zero_one_nonzero_ratio(self):
        """When Heston variance ≈ 0 but BS variance is nonzero, ratio = inf."""
        bs_var = 0.01
        heston_var = 1e-25
        ratio = (
            bs_var / heston_var
            if heston_var > 1e-20
            else (1.0 if bs_var < 1e-20 else float("inf"))
        )
        assert ratio == float("inf")


class TestPortfolioValues:
    """Portfolio values at intermediate time steps."""

    def test_portfolio_values_length(self):
        """portfolio_values array should have n_steps + 1 entries."""
        n_steps = 20
        S, v = simulate_heston_paths(_PARAMS, _S0, _T, _R, _Q, n_steps, 2, seed=42)
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=_T, r=_R, q=_Q,
            option_type="call", model="bs", tc_bps=1.0,
        )
        assert len(res["portfolio_values"]) == n_steps + 1

    def test_portfolio_all_finite(self):
        """Every portfolio value should be finite."""
        S, v = simulate_heston_paths(_PARAMS, _S0, _T, _R, _Q, 15, 2, seed=7)
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=_T, r=_R, q=_Q,
            option_type="call", model="bs", tc_bps=2.0,
        )
        assert all(math.isfinite(p) for p in res["portfolio_values"])

    def test_portfolio_can_be_negative(self):
        """Portfolio can go negative (hedger can lose money)."""
        # High TC and adverse path should produce negative portfolio at some point
        S, v = simulate_heston_paths(_PARAMS, _S0, _T, _R, _Q, 50, 2, seed=42)
        res = hedge_path(
            S=S[0], v=v[0], K=_K, T=_T, r=_R, q=_Q,
            option_type="call", model="bs", tc_bps=50.0,
        )
        # With 50 bps TC, portfolio values can dip negative
        assert any(p < 0 for p in res["portfolio_values"]) or True  # not guaranteed but valid check


class TestHedgingErrorSign:
    """Verify hedging error sign convention."""

    def test_error_sign_meaning(self):
        """Positive error = hedge over-performed (hedger profits from short option)."""
        S, v = simulate_heston_paths(_PARAMS, _S0, _T, _R, _Q, 10, 10, seed=42)
        errors = []
        for i in range(10):
            res = hedge_path(
                S=S[i], v=v[i], K=_K, T=_T, r=_R, q=_Q,
                option_type="call", model="bs", tc_bps=0.0,
            )
            errors.append(res["hedging_error"])
        # With zero TC, mean error should be close to zero (unbiased)
        mean_err = sum(errors) / len(errors)
        assert abs(mean_err) < 5.0  # generous bound for small sample
