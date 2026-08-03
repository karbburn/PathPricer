"""Multi-leg option strategy engine.

Prices a portfolio of option/stock legs under Black-Scholes and aggregates
their Greeks into portfolio-level risk. Also builds the expiration payoff
diagram (net P&L across a spot grid) and finds breakeven points — the core
view for strategies like straddles, spreads, iron condors, and butterflies.

A leg is a signed contract: positive quantity = long, negative = short.
Stock legs use the forward-carried value S e^{-qT} with delta=1.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from ..core.config import DAYS_PER_YEAR, MIN_SIGMA, MIN_T
from . import black_scholes


@dataclass(frozen=True)
class StrategyLeg:
    """One leg of a multi-leg option strategy."""

    option_type: str          # "call", "put", or "stock"
    strike: float | None      # None for stock legs
    expiry_date: str          # ISO date YYYY-MM-DD
    quantity: float           # > 0 long, < 0 short
    volatility: float
    risk_free_rate: float
    dividend_yield: float


@dataclass(frozen=True)
class StrategyLegResult:
    """Priced single leg.

    `price` and Greek fields are raw per-contract values (option prices and
    deltas are always positive, regardless of long/short). Net portfolio
    values in StrategyResult are the quantity-weighted sums.
    """

    leg_index: int
    option_type: str
    strike: float | None
    expiry_date: str
    quantity: float
    ttm: float
    price: float            # per-contract price (unsigned)
    delta: float            # per-contract delta (unsigned)
    gamma: float
    vega: float
    theta: float
    rho: float


@dataclass(frozen=True)
class StrategyResult:
    """Full multi-leg strategy pricing."""

    legs: list[StrategyLegResult]
    net_premium: float        # sum of signed leg values (debit > 0)
    net_delta: float
    net_gamma: float
    net_vega: float
    net_theta: float
    net_rho: float
    payoff_spots: list[float]       # x-axis of expiration payoff
    payoff_values: list[float]      # net P&L at each spot
    breakevens: list[float]         # zero-crossings of payoff
    max_profit: float | None        # None = unbounded
    max_loss: float | None          # None = unbounded
    is_credit: bool                 # True when net_premium < 0 (sold premium)


def _ttm_from_expiry(expiry_date: str, today=None) -> float:
    from datetime import date, datetime

    if today is None:
        today = date.today()
    else:
        today = datetime.strptime(today, "%Y-%m-%d").date() if isinstance(today, str) else today
    exp = datetime.strptime(expiry_date, "%Y-%m-%d").date()
    return max((exp - today).days / DAYS_PER_YEAR, MIN_T)


def _payoff_at_spot(legs: list[StrategyLeg], spot: float) -> float:
    """Net expiration payoff of the whole strategy at a given spot."""
    total = 0.0
    for leg in legs:
        if leg.option_type == "stock":
            payoff = spot
        elif leg.option_type == "call":
            payoff = max(spot - leg.strike, 0.0)
        else:
            payoff = max(leg.strike - spot, 0.0)
        total += leg.quantity * payoff
    return total


def _payoff_grid(
    legs: list[StrategyLeg], spot: float, n_points: int = 120
) -> tuple[list[float], list[float]]:
    """Spot grid spanning all strikes wide enough to capture every breakeven."""
    strikes = [l.strike for l in legs if l.strike is not None]
    lo = min([spot * 0.5] + strikes) * 0.85
    hi = max([spot * 1.5] + strikes) * 1.15
    step = (hi - lo) / (n_points - 1)
    spots = [lo + step * i for i in range(n_points)]
    return spots, [_payoff_at_spot(legs, s) for s in spots]


def _find_breakevens(spots: list[float], payoffs: list[float]) -> list[float]:
    """Linear-interpolated zero crossings of the payoff curve."""
    out: list[float] = []
    for i in range(1, len(spots)):
        p0, p1 = payoffs[i - 1], payoffs[i]
        # A crossing between segments, or a payoff that lands exactly on zero.
        if (p0 > 0 >= p1) or (p0 < 0 <= p1):
            t = p0 / (p0 - p1)
            out.append(spots[i - 1] + t * (spots[i] - spots[i - 1]))
        elif p0 == 0 and p1 != 0:
            out.append(spots[i - 1])
    return out


def _payoff_extremes(legs: list[StrategyLeg], premium: float) -> tuple[float | None, float | None]:
    """Exact max profit / max loss over spot in [0, inf).

    Expiration payoff is piecewise-linear in spot: kinks at every strike, so
    the global extrema live at the strike kinks, the low-tail value (spot -> 0,
    always finite: puts cap at qty*K) and the high tail (spot -> inf, finite
    only when the call+stock slope is zero).

    Net P&L = payoff - premium. None means unbounded.
    """
    def net_at(spot: float) -> float:
        return _payoff_at_spot(legs, spot) - premium

    q_call = sum(l.quantity for l in legs if l.option_type == "call")
    q_put = sum(l.quantity for l in legs if l.option_type == "put")
    q_stock = sum(l.quantity for l in legs if l.option_type == "stock")

    candidates: list[float] = [net_at(k) for k in (l.strike for l in legs if l.strike is not None)]
    candidates.append(sum(l.quantity * l.strike for l in legs if l.option_type == "put") - premium)

    unbounded_profit = False
    unbounded_loss = False

    slope_hi = q_call + q_stock
    if slope_hi > 0:
        unbounded_profit = True
    elif slope_hi < 0:
        unbounded_loss = True
    else:
        candidates.append(-sum(l.quantity * l.strike for l in legs if l.option_type == "call") - premium)

    max_profit = None if unbounded_profit else max(candidates)
    max_loss = None if unbounded_loss else min(candidates)
    return max_profit, max_loss


def price_strategy(
    legs: list[StrategyLeg],
    spot: float,
    today: str | None = None,
    payoff_points: int = 120,
) -> StrategyResult:
    """Price all legs, aggregate Greeks, and build the expiration payoff.

    Args:
        legs: Strategy legs (1-10).
        spot: Underlying spot price (> 0).
        today: Reference date (YYYY-MM-DD). Defaults to today.
        payoff_points: Number of payoff grid points.

    Returns:
        StrategyResult with per-leg pricing, aggregate Greeks, payoff curve,
        breakevens, and bounded/unbounded max profit & loss.

    Raises:
        ValueError: If no legs, spot <= 0, or any leg is invalid.
    """
    if not legs:
        raise ValueError("Strategy must contain at least one leg.")
    if spot <= 0:
        raise ValueError("spot must be strictly positive.")

    leg_results: list[StrategyLegResult] = []
    net_premium = 0.0
    net_delta = net_gamma = net_vega = net_theta = net_rho = 0.0

    for i, leg in enumerate(legs):
        ttm = _ttm_from_expiry(leg.expiry_date, today)
        qty = leg.quantity
        if leg.option_type == "stock":
            price = spot * math.exp(-leg.dividend_yield * ttm)
            delta, gamma, vega, theta, rho = 1.0, 0.0, 0.0, 0.0, 0.0
        elif leg.option_type in ("call", "put"):
            res = black_scholes.price_and_greeks(
                spot, leg.strike, ttm, leg.risk_free_rate,
                leg.dividend_yield, leg.volatility, leg.option_type,
            )
            price, delta, gamma = res.price, res.delta, res.gamma
            vega, theta, rho = res.vega, res.theta, res.rho
        else:
            raise ValueError(f"Invalid option_type: '{leg.option_type}'. Must be call/put/stock.")

        leg_results.append(
            StrategyLegResult(
                leg_index=i,
                option_type=leg.option_type,
                strike=leg.strike,
                expiry_date=leg.expiry_date,
                quantity=qty,
                ttm=ttm,
                price=price,
                delta=delta,
                gamma=gamma,
                vega=vega,
                theta=theta,
                rho=rho,
            )
        )
        net_premium += qty * price
        net_delta += qty * delta
        net_gamma += qty * gamma
        net_vega += qty * vega
        net_theta += qty * theta
        net_rho += qty * rho

    spots, payoffs = _payoff_grid(legs, spot, payoff_points)
    # Net P&L at expiration = payoff - net premium paid today.
    net_payoffs = [p - net_premium for p in payoffs]
    breakevens = _find_breakevens(spots, net_payoffs)
    max_profit, max_loss = _payoff_extremes(legs, net_premium)

    return StrategyResult(
        legs=leg_results,
        net_premium=net_premium,
        net_delta=net_delta,
        net_gamma=net_gamma,
        net_vega=net_vega,
        net_theta=net_theta,
        net_rho=net_rho,
        payoff_spots=spots,
        payoff_values=net_payoffs,
        breakevens=breakevens,
        max_profit=max_profit,
        max_loss=max_loss,
        is_credit=net_premium < 0,
    )
