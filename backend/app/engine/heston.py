"""Heston stochastic volatility pricing engine.

Prices European options in semi-closed form via the Heston (1993)
characteristic function and Fourier inversion. Heston extends Black-Scholes
with a second state variable, the instantaneous variance v(t), which follows
a mean-reverting square-root (CIR) process:

    dS = (r - q) S dt + sqrt(v) S dW1
    dv = kappa (theta - v) dt + sigma_v sqrt(v) dW2
    E[dW1 dW2] = rho dt

Parameters (HestonParams):
    v0:      initial instantaneous variance
    kappa:   mean-reversion speed of variance
    theta_v: long-run (unconditional) mean variance
    sigma_v: vol-of-vol (volatility of the variance process)
    rho:     instantaneous spot-vol correlation (typically negative for equity)

The price is recovered from two probability integrals P1, P2 via the
Carr-Madan / Lewis Fourier-inversion formulation:

    Call = S0 e^{-qT} P1 - K e^{-rT} P2

The characteristic function for the log-return X = ln(S_T/S0) is

    phi(u) = exp( i u (r-q) T + C(u,T) + D(u,T) v0 )

with (Gatheral form)

    d = sqrt((rho sigma_v i u - kappa)^2 + sigma_v^2 (u^2 + i u))
    g = (kappa - rho sigma_v i u - d) / (kappa - rho sigma_v i u + d)
    C = (kappa theta_v / sigma_v^2) [ (kappa - rho sigma_v i u - d) T
                                        - 2 ln( (1 - g e^{-dT}) / (1 - g) ) ]
    D = (kappa - rho sigma_v i u - d) / sigma_v^2
          * (1 - e^{-dT}) / (1 - g e^{-dT})

P2 uses phi(u) directly; P1 uses the numeraire-changed characteristic
function phi(u - i) / phi(-i). The principal complex square root branch keeps
Re(d) >= 0, which is the well-conditioned branch.

Integration is Gauss-Legendre quadrature over a bounded range; the integrand
is smooth and decays for large u, so this is fast and deterministic (no
Monte Carlo noise), which makes finite-difference Greeks clean.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.polynomial.legendre import leggauss

from ..core.config import (
    BUMP_FRACTION_DEFAULT,
    DAYS_PER_YEAR,
    HESTON_QUADRATURE_POINTS,
    HESTON_INTEGRATION_LIMIT,
    MIN_T,
)


@dataclass(frozen=True)
class HestonParams:
    """Parameters of the Heston stochastic volatility model."""

    v0: float
    kappa: float
    theta_v: float
    sigma_v: float
    rho: float


@dataclass(frozen=True)
class HestonResult:
    """Price and Greeks under the Heston model.

    Attributes:
        price: Heston option price.
        delta: dV/dS.
        gamma: d^2V/dS^2.
        vega: dV/d(sqrt(v0)) — sensitivity to a change in the initial volatility.
        volga: d^2V/d(sqrt(v0))^2 — volatility convexity.
        vanna: d^2V/dS d(sqrt(v0)) — spot/vol cross-sensitivity.
        theta: dV/dT per calendar day (negative for long options).
        rho: dV/dr.
    """

    price: float
    delta: float
    gamma: float
    vega: float
    volga: float
    vanna: float
    theta: float
    rho: float


# ---------------------------------------------------------------------------
# Characteristic function
# ---------------------------------------------------------------------------


def _characteristic_function(
    u: np.ndarray, params: HestonParams, T: float, r: float, q: float
) -> np.ndarray:
    """Heston characteristic function E[exp(i u ln(S_T/S0))] at scalar u-array."""
    iu = 1j * u
    kappa, theta_v, sigma_v, rho = params.kappa, params.theta_v, params.sigma_v, params.rho

    d = np.sqrt((rho * sigma_v * iu - kappa) ** 2 + sigma_v**2 * (u**2 + iu))
    numerator = kappa - rho * sigma_v * iu - d
    denominator = kappa - rho * sigma_v * iu + d
    g = numerator / denominator

    exp_dT = np.exp(-d * T)
    # C term; use log1p-style to avoid catastrophic cancellation in 1 - g e^{-dT}
    with np.errstate(divide="ignore", invalid="ignore"):
        ratio = (1.0 - g * exp_dT) / (1.0 - g)
        log_ratio = np.log(ratio + 1e-300)
        C = (kappa * theta_v / sigma_v**2) * (numerator * T - 2.0 * log_ratio)
        D = (numerator / sigma_v**2) * (1.0 - exp_dT) / (1.0 - g * exp_dT)

    return np.exp(iu * (r - q) * T + C + D * params.v0)


def _quadrature_nodes() -> tuple[np.ndarray, np.ndarray]:
    """Gauss-Legendre nodes/weights on [0, HESTON_INTEGRATION_LIMIT]."""
    n = HESTON_QUADRATURE_POINTS
    x, w = leggauss(n)
    # Map [-1, 1] -> [0, U_max]
    u = 0.5 * HESTON_INTEGRATION_LIMIT * (x + 1.0)
    w = 0.5 * HESTON_INTEGRATION_LIMIT * w
    return u, w


def _integrate_fourier(
    params: HestonParams, S0: float, K: float, T: float, r: float, q: float
) -> tuple[float, float]:
    """Return (P1, P2), the two Heston probability integrals for a strike K."""
    T_eff = max(T, MIN_T)
    x = math.log(K / S0)

    u, w = _quadrature_nodes()
    phi = _characteristic_function(u, params, T_eff, r, q)

    # P2 integrand: Re[ e^{-iu x} phi(u) / (iu) ]
    factor = np.exp(-1j * u * x) * phi / (1j * u)
    p2 = 0.5 + (1.0 / math.pi) * np.sum(w * np.real(factor))

    # P1 via numeraire change: phi(u - i) / phi(-i); phi(-i) = e^{(r-q)T}.
    phi_shifted = _characteristic_function(u - 1j, params, T_eff, r, q)
    phi_neg_i = math.exp((r - q) * T_eff)
    factor1 = np.exp(-1j * u * x) * phi_shifted / phi_neg_i / (1j * u)
    p1 = 0.5 + (1.0 / math.pi) * np.sum(w * np.real(factor1))

    return float(p1), float(p2)


def price_european(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    params: HestonParams,
    option_type: str = "call",
) -> float:
    """Price a European option under Heston via Fourier inversion.

    Put prices use put-call parity (exact in Heston, which is arbitrage-free):
    P = C - S0 e^{-qT} + K e^{-rT}.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")

    p1, p2 = _integrate_fourier(params, S0, K, T, r, q)
    discounted_spot = S0 * math.exp(-q * max(T, MIN_T))
    discounted_strike = K * math.exp(-r * max(T, MIN_T))

    call = discounted_spot * p1 - discounted_strike * p2
    if opt_type == "call":
        return float(call)
    return float(call - discounted_spot + discounted_strike)


def price_and_greeks(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    params: HestonParams,
    option_type: str = "call",
    bump_frac: float = BUMP_FRACTION_DEFAULT,
) -> HestonResult:
    """Price under Heston and compute Greeks by central finite differences.

    Because the Heston price is deterministic (no MC noise), finite-difference
    Greeks are clean and stable. Volga/vanna are reported w.r.t. the initial
    volatility sqrt(v0), the quantity traders quote.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")

    T_eff = max(T, MIN_T)
    v0 = params.v0
    sigma0 = math.sqrt(v0)

    base = price_european(S0, K, T_eff, r, q, params, opt_type)

    # Bump sizes
    h_S = max(bump_frac * S0, 1e-4)
    h_v0 = max(bump_frac * v0, 1e-5)
    h_r = max(bump_frac * abs(r) if r != 0 else bump_frac, 1e-4)
    h_T = max(bump_frac * T_eff, 1e-5)

    def _bump_v0(dv0: float) -> HestonParams:
        return HestonParams(
            v0=max(v0 + dv0, 1e-6),
            kappa=params.kappa,
            theta_v=params.theta_v,
            sigma_v=params.sigma_v,
            rho=params.rho,
        )

    # Delta / Gamma (spot)
    price_S_up = price_european(S0 + h_S, K, T_eff, r, q, params, opt_type)
    price_S_dn = price_european(S0 - h_S, K, T_eff, r, q, params, opt_type)
    delta = (price_S_up - price_S_dn) / (2.0 * h_S)
    gamma = (price_S_up - 2.0 * base + price_S_dn) / h_S**2

    # Vega / Volga (initial variance bumps, reported w.r.t. sigma0 = sqrt(v0))
    price_v_up = price_european(S0, K, T_eff, r, q, _bump_v0(h_v0), opt_type)
    price_v_dn = price_european(S0, K, T_eff, r, q, _bump_v0(-h_v0), opt_type)
    dV_dv0 = (price_v_up - price_v_dn) / (2.0 * h_v0)
    d2V_dv0_2 = (price_v_up - 2.0 * base + price_v_dn) / h_v0**2

    # Chain rule w.r.t. sigma = sqrt(v0): dV/ds = dV/dv0 * 2s, d2V/ds2 = 4 v0 d2V/dv0^2
    vega = dV_dv0 * 2.0 * sigma0
    volga = d2V_dv0_2 * 4.0 * v0

    # Vanna: d2V / dS dsigma = 2 s * d2V/dS dv0 (cross bump)
    price_up_up = price_european(S0 + h_S, K, T_eff, r, q, _bump_v0(h_v0), opt_type)
    price_up_dn = price_european(S0 + h_S, K, T_eff, r, q, _bump_v0(-h_v0), opt_type)
    price_dn_up = price_european(S0 - h_S, K, T_eff, r, q, _bump_v0(h_v0), opt_type)
    price_dn_dn = price_european(S0 - h_S, K, T_eff, r, q, _bump_v0(-h_v0), opt_type)
    d2V_dS_dv0 = (price_up_up - price_up_dn - price_dn_up + price_dn_dn) / (4.0 * h_S * h_v0)
    vanna = d2V_dS_dv0 * 2.0 * sigma0

    # Theta (one-sided, per calendar day)
    T_down = max(T_eff - h_T, 1e-6)
    price_T_down = price_european(S0, K, T_down, r, q, params, opt_type)
    theta_annual = (price_T_down - base) / h_T
    theta = theta_annual / DAYS_PER_YEAR

    # Rho
    price_r_up = price_european(S0, K, T_eff, r + h_r, q, params, opt_type)
    price_r_dn = price_european(S0, K, T_eff, r - h_r, q, params, opt_type)
    rho = (price_r_up - price_r_dn) / (2.0 * h_r)

    return HestonResult(
        price=float(base),
        delta=float(delta),
        gamma=float(gamma),
        vega=float(vega),
        volga=float(volga),
        vanna=float(vanna),
        theta=float(theta),
        rho=float(rho),
    )
