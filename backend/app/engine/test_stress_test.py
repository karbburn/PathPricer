"""Self-check tests for the stress-test engine.

Run with: python -m app.engine.test_stress_test
"""

from .stress_test import NAMED_SCENARIOS, StressScenario, run_stress_test


def _run_tests() -> None:
    # Long call: crashes should hurt it, vol crush should hurt it too.
    res = run_stress_test(
        S0=100.0, K=100.0, T=0.5, r=0.05, q=0.0, sigma=0.25, option_type="call"
    )
    assert res.base_price > 0
    assert len(res.scenarios) == len(NAMED_SCENARIOS)
    names = {s.name for s in res.scenarios}
    assert "2008 Crisis" in names and "Vol Crush" in names
    # Worst pnl is negative; best pnl is positive or zero.
    assert res.worst_pnl is not None and res.worst_pnl < 0
    assert res.worst_scenario in names
    assert res.best_pnl is not None
    # Every scenario's price must equal BS at that shifted coordinate.
    from ..engine import black_scholes

    for s, sc in zip(res.scenarios, NAMED_SCENARIOS):
        t_new = 0.5 - sc.d_days / 365.0
        r_new = 0.05 + sc.d_rate
        repriced = black_scholes.price(s.spot, 100.0, t_new, r_new, 0.0, s.volatility, "call")
        assert abs(repriced - s.price) < 1e-9, f"mismatch for {s.name}"

    # Stress scenario math: 2008 crisis spot = 100 * (1 - 0.40) = 60.
    crisis = next(s for s in res.scenarios if s.name == "2008 Crisis")
    assert abs(crisis.spot - 60.0) < 1e-9
    assert abs(crisis.volatility - 0.45) < 1e-9

    # Custom scenario list honored.
    custom = [StressScenario(name="Flat", description="no-op")]
    res2 = run_stress_test(
        S0=100.0, K=100.0, T=0.5, r=0.05, q=0.0, sigma=0.25,
        option_type="call", scenarios=custom,
    )
    assert len(res2.scenarios) == 1
    assert res2.scenarios[0].name == "Flat"
    assert abs(res2.scenarios[0].pnl) < 1e-9, "no-op scenario must have zero P&L"
    assert res2.unrealized_risk == 0.0, "no downside means zero risk metric"

    # Put option reacts inversely: 2008 crisis is a big gain.
    put_res = run_stress_test(
        S0=100.0, K=100.0, T=0.5, r=0.05, q=0.0, sigma=0.25, option_type="put"
    )
    assert put_res.best_pnl is not None and put_res.best_pnl > 0

    print("All stress-test engine self-checks passed.")


if __name__ == "__main__":
    _run_tests()
