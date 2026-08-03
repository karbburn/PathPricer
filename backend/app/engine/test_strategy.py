"""Self-check tests for the multi-leg strategy engine.

Run with: python -m app.engine.test_strategy
"""

from .strategy import StrategyLeg, price_strategy

TODAY = "2024-01-15"


def _run_tests() -> None:
    # 1. Long straddle: buy ATM call + ATM put, same strike/expiry.
    leg = dict(
        expiry_date="2024-04-15",
        risk_free_rate=0.05,
        dividend_yield=0.0,
        volatility=0.25,
    )
    res = price_strategy(
        [
            StrategyLeg("call", 100.0, quantity=1.0, **leg),
            StrategyLeg("put", 100.0, quantity=1.0, **leg),
        ],
        spot=100.0,
        today=TODAY,
    )
    assert res.net_premium > 0, "straddle should be a debit"
    assert not res.is_credit
    # Symmetric straddle: net delta near zero (exactly 2N(d1)-1 with r>0).
    assert abs(res.net_delta) < 0.2, f"straddle delta should be small, got {res.net_delta}"
    # Net delta must equal quantity-weighted sum of per-leg deltas.
    assert abs(res.net_delta - sum(l.quantity * l.delta for l in res.legs)) < 1e-9
    # Put-call parity: C - P = S - K e^{-rT} (q=0).
    import math

    call = res.legs[0]
    put = res.legs[1]
    expected_diff = 100.0 * (1.0 - math.exp(-0.05 * 0.25))
    assert abs((call.price - put.price) - expected_diff) < 0.01
    # Two breakevens straddling spot.
    assert len(res.breakevens) == 2, f"expected 2 breakevens, got {res.breakevens}"
    assert all(80 < b < 120 for b in res.breakevens)
    # Long straddle: unbounded profit both tails, bounded loss ~ -premium.
    assert res.max_profit is None
    assert res.max_loss is not None and abs(res.max_loss + res.net_premium) < 1e-6

    # 2. Long call spread (debit): +1 C 100, -1 C 110.
    res = price_strategy(
        [
            StrategyLeg("call", 100.0, quantity=1.0, **leg),
            StrategyLeg("call", 110.0, quantity=-1.0, **leg),
        ],
        spot=100.0,
        today=TODAY,
    )
    assert res.net_premium > 0
    # Bounded both sides: max profit = width - premium, max loss = -premium.
    assert res.max_profit is not None and res.max_profit > 0
    assert res.max_loss is not None and res.max_loss < 0
    assert abs((res.max_profit - res.max_loss) - 10.0) < 1e-6, "profit-loss spread = strike width"
    assert len(res.breakevens) == 1, f"call spread should have 1 breakeven, got {res.breakevens}"
    assert 100 < res.breakevens[0] < 110

    # 3. Covered call: long stock + short call.
    res = price_strategy(
        [
            StrategyLeg("stock", None, quantity=1.0, **leg),
            StrategyLeg("call", 110.0, quantity=-1.0, **leg),
        ],
        spot=100.0,
        today=TODAY,
    )
    # Stock leg delta = 1, net reduced by short OTM call: 0 < delta < 1.
    assert 0 < res.net_delta < 1.0, f"covered call delta in (0,1), got {res.net_delta}"
    assert abs(res.net_delta - sum(l.quantity * l.delta for l in res.legs)) < 1e-9
    # Fully bounded: profit capped at 110 - premium, loss capped at -premium
    # (stock can only fall to zero).
    assert res.max_profit is not None
    assert res.max_loss is not None
    assert abs(res.max_loss + res.net_premium) < 1e-6, "loss floor = -premium"
    assert abs(res.max_profit - (110.0 - res.net_premium)) < 1e-6, "profit cap = K - premium"

    # 4. Net zero-delta straddle expiration payoff crosses exactly at breakevens.
    res = price_strategy(
        [
            StrategyLeg("call", 100.0, quantity=1.0, **leg),
            StrategyLeg("put", 100.0, quantity=1.0, **leg),
        ],
        spot=100.0,
        today=TODAY,
    )
    for s, v in zip(res.payoff_spots, res.payoff_values):
        assert abs(v - (abs(s - 100.0) - res.net_premium)) < 1e-6, (
            f"payoff mismatch at {s}: {v}"
        )

    # 5. Payoff grid must bracket spot and all strikes.
    assert min(res.payoff_spots) < 80 < 120 < max(res.payoff_spots)

    print("All strategy engine self-checks passed.")


if __name__ == "__main__":
    _run_tests()
