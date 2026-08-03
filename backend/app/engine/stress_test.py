"""Scenario / stress-testing engine.

Reprices a single option under a set of named market scenarios (coordinate
shifts in spot, vol, rate, and time) using closed-form Black-Scholes, and
reports the P&L impact of each scenario plus the worst-case drawdown.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..core.config import DAYS_PER_YEAR, MIN_SIGMA, MIN_T
from . import black_scholes


@dataclass(frozen=True)
class StressScenario:
    """A named stress scenario defined by coordinate shifts."""

    name: str
    description: str
    d_spot: float = 0.0      # absolute spot shift
    d_spot_pct: float = 0.0  # proportional spot shift (applied on top of d_spot)
    d_vol: float = 0.0       # absolute vol shift
    d_days: float = 0.0      # elapsed days
    d_rate: float = 0.0      # rate shift


@dataclass(frozen=True)
class ScenarioResult:
    """P&L impact of one stress scenario."""

    name: str
    description: str
    spot: float
    volatility: float
    price: float
    pnl: float
    pnl_pct: float


@dataclass(frozen=True)
class StressTestResult:
    """Container for the full stress-test run."""

    base_price: float
    base_spot: float
    scenarios: list[ScenarioResult]
    worst_loss: float | None
    worst_scenario: str | None
    best_gain: float | None
    best_scenario: str | None

    @property
    def unrealized_risk(self) -> float:
        """Largest single-scenario absolute loss, as a fraction of base price."""
        if self.worst_loss is None or self.base_price == 0:
            return 0.0
        return abs(self.worst_loss) / self.base_price


NAMED_SCENARIOS: list[StressScenario] = [
    StressScenario(
        name="2008 Crisis",
        description="-40% spot, +20 vol pts, +100 bp rates",
        d_spot_pct=-0.40,
        d_vol=0.20,
        d_rate=0.01,
    ),
    StressScenario(
        name="COVID Crash",
        description="-30% spot, +15 vol pts, -150 bp rates",
        d_spot_pct=-0.30,
        d_vol=0.15,
        d_rate=-0.015,
    ),
    StressScenario(
        name="Rate Hike +200bp",
        description="+200 bp rates, -3 vol pts, flat spot",
        d_vol=-0.03,
        d_rate=0.02,
    ),
    StressScenario(
        name="Vol Crush",
        description="-12 vol pts, +2% spot",
        d_spot_pct=0.02,
        d_vol=-0.12,
    ),
    StressScenario(
        name="Slow Drift Down",
        description="-10% spot over 30 days, +2 vol pts",
        d_spot_pct=-0.10,
        d_vol=0.02,
        d_days=30.0,
    ),
    StressScenario(
        name="Flash Crash",
        description="-25% spot in 2 days, +25 vol pts",
        d_spot_pct=-0.25,
        d_vol=0.25,
        d_days=2.0,
    ),
]


def run_stress_test(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
    scenarios: list[StressScenario] | None = None,
) -> StressTestResult:
    """Reprice an option under each scenario and summarize P&L impact.

    Args:
        S0: Base spot price (> 0).
        K: Strike price (> 0).
        T: Base time to expiry in years (> 0).
        r: Risk-free rate.
        q: Dividend yield.
        sigma: Base volatility (> 0).
        option_type: 'call' or 'put'.
        scenarios: Scenario list. Defaults to NAMED_SCENARIOS.

    Returns:
        StressTestResult with per-scenario P&L and worst/best outcomes.
    """
    scenarios = scenarios or NAMED_SCENARIOS
    base_price = black_scholes.price(S0, K, T, r, q, sigma, option_type)

    scenario_results: list[ScenarioResult] = []
    for sc in scenarios:
        S_new = max(1e-6, S0 + sc.d_spot + sc.d_spot_pct * S0)
        sigma_new = max(MIN_SIGMA, sigma + sc.d_vol)
        T_new = max(MIN_T, T - sc.d_days / DAYS_PER_YEAR)
        r_new = r + sc.d_rate

        price_new = black_scholes.price(S_new, K, T_new, r_new, q, sigma_new, option_type)
        pnl = price_new - base_price
        pnl_pct = pnl / base_price if base_price != 0 else 0.0

        scenario_results.append(
            ScenarioResult(
                name=sc.name,
                description=sc.description,
                spot=S_new,
                volatility=sigma_new,
                price=price_new,
                pnl=pnl,
                pnl_pct=pnl_pct,
            )
        )

    worst = min(scenario_results, key=lambda s: s.pnl)
    best = max(scenario_results, key=lambda s: s.pnl)

    return StressTestResult(
        base_price=base_price,
        base_spot=S0,
        scenarios=scenario_results,
        worst_loss=worst.pnl,
        worst_scenario=worst.name,
        best_gain=best.pnl,
        best_scenario=best.name,
    )
