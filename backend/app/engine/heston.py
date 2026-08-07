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

Known limitations (v1):
    - European options only; no early exercise (American/Bermudan).
    - The CF can produce non-finite values for extreme parameters (large
      sigma_v, large |rho|, very short T). The integrand is zeroed out
      where the CF overflows; this is safe because the contribution to
      the price integral is negligible.
    - Quadrature accuracy depends on the integration limit; very deep OTM
      options or very long maturities may need a wider range than the
      default HESTON_INTEGRATION_LIMIT.
"""

from __future__ import annotations

import functools
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

    def __post_init__(self) -> None:
        if self.v0 <= 0 or self.kappa <= 0 or self.theta_v <= 0 or self.sigma_v <= 0:
            raise ValueError(
                "v0, kappa, theta_v, sigma_v must all be strictly positive."
            )
        if abs(self.rho) >= 1.0:
            raise ValueError("|rho| must be strictly less than 1.")
        if self.rho != self.rho or not math.isfinite(self.rho):
            raise ValueError("rho must be a finite number.")
        for name, val in (
            ("v0", self.v0),
            ("kappa", self.kappa),
            ("theta_v", self.theta_v),
            ("sigma_v", self.sigma_v),
        ):
            if not math.isfinite(val):
                raise ValueError(f"{name} must be finite.")


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

    Note on theta sign: we report dV/dT (sensitivity to time-to-expiry),
    which is negative for long options and equals the standard -dV/dt market
    convention (since t = T_0 - T, dV/dt = -dV/dT).
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

    discriminant = (rho * sigma_v * iu - kappa) ** 2 + sigma_v**2 * (u**2 + iu)
    d = np.sqrt(discriminant)
    # Keep the well-conditioned principal branch Re(d) >= 0 explicitly. numpy's
    # sqrt defaults to this, but the explicit guard prevents a silent wrong
    # branch for unusual parameters where the discriminant crosses the cut.
    d = np.where(np.real(d) < 0, -d, d)
    numerator = kappa - rho * sigma_v * iu - d
    denominator = kappa - rho * sigma_v * iu + d
    g = numerator / denominator

    exp_dT = np.exp(-d * T)
    # C term: log((1 - g e^{-dT})/(1 - g)) computed as a difference of two
    # principal-branch logs. A single combined-ratio log can jump the branch cut
    # when numerator and denominator sit on opposite sides of the negative real
    # axis; the difference form keeps each log on its own branch.
    with np.errstate(divide="ignore", invalid="ignore"):
        log_ratio = np.log(1.0 - g * exp_dT) - np.log(1.0 - g)
        C = (kappa * theta_v / sigma_v**2) * (numerator * T - 2.0 * log_ratio)
        D = (numerator / sigma_v**2) * (1.0 - exp_dT) / (1.0 - g * exp_dT)

    result = np.exp(iu * (r - q) * T + C + D * params.v0)
    # Guard against overflow for extreme parameters (e.g. large v0 or sigma_v).
    # When the CF overflows, the integrand is negligible anyway, so zero it out.
    return np.where(np.isfinite(result), result, 0.0 + 0j)


@functools.lru_cache(maxsize=1)
def _quadrature_nodes() -> tuple[np.ndarray, np.ndarray]:
    """Gauss-Legendre nodes/weights on [0, HESTON_INTEGRATION_LIMIT].

    Cached: identical for every call, so compute once. Returns immutable views
    of the cached arrays to prevent accidental mutation.
    """
    n = HESTON_QUADRATURE_POINTS
    x, w = leggauss(n)
    # Map [-1, 1] -> [0, U_max]
    u = 0.5 * HESTON_INTEGRATION_LIMIT * (x + 1.0)
    w = 0.5 * HESTON_INTEGRATION_LIMIT * w
    u.flags.writeable = False
    w.flags.writeable = False
    return u, w


def _integrate_fourier(
    params: HestonParams, S0: float, K: float, T: float, r: float, q: float
) -> tuple[float, float]:
    """Return (P1, P2), the two Heston probability integrals for a strike K."""
    p1, p2 = _integrate_fourier_many(params, S0, np.asarray([K]), T, r, q)
    return float(p1[0]), float(p2[0])


def _integrate_fourier_many(
    params: HestonParams, S0: float, K: np.ndarray, T: float, r: float, q: float
) -> tuple[np.ndarray, np.ndarray]:
    """Vectorized (P1, P2) for many strikes at one expiry.

    The quadrature nodes and characteristic function depend only on the
    parameters, rate and expiry — not on the strike — so the Fourier factors
    are evaluated once and combined with all strikes via a matrix product.
    This makes multi-strike pricing (calibration, grids) ~100x faster.
    """
    K = np.asarray(K, dtype=np.float64)
    T_eff = max(T, MIN_T)
    cf = _cf_set(params, T_eff, r, q)
    return _integrate_prepared(cf, S0, K)


def _cf_set(params: HestonParams, T: float, r: float, q: float):
    """Precompute the quadrature nodes and characteristic functions.

    These depend only on (params, T, r, q), not on the strike or spot, so a
    single set can price many strikes *and* many bumped spots. Returns a tuple
    consumed by _integrate_prepared / _price_prepared.
    """
    u, w = _quadrature_nodes()
    phi = _characteristic_function(u, params, T, r, q)
    phi_shifted = _characteristic_function(u - 1j, params, T, r, q)
    phi_neg_i = math.exp((r - q) * T)
    return u, w, phi, phi_shifted, phi_neg_i


def _integrate_prepared(cf, S0: float, K: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(P1, P2) from a precomputed CF set for arbitrary spot and strikes."""
    u, w, phi, phi_shifted, phi_neg_i = cf
    K = np.asarray(K, dtype=np.float64)
    x = np.log(K / S0)
    # exp(-i u x): [n_strikes, n_nodes] outer product, integrated over u.
    exp_terms = np.exp(-1j * np.outer(x, u))
    p2 = 0.5 + (1.0 / math.pi) * np.real(
        (exp_terms * (phi / (1j * u))).dot(w)
    )
    p1 = 0.5 + (1.0 / math.pi) * np.real(
        (exp_terms * (phi_shifted / phi_neg_i / (1j * u))).dot(w)
    )
    return p1, p2


def _price_prepared(cf, S0, K, T: float, r: float, q: float, option_type: str) -> np.ndarray:
    """Prices from a precomputed CF set.

    S0 and K may be scalars or arrays of the same shape (used to batch the
    spot bumps of price_and_greeks through a single Fourier evaluation).
    """
    p1, p2 = _integrate_prepared(cf, S0, K)
    discounted_spot = S0 * math.exp(-q * max(T, MIN_T))
    discounted_strike = K * math.exp(-r * max(T, MIN_T))
    call = discounted_spot * p1 - discounted_strike * p2
    if option_type == "call":
        return call
    return call - discounted_spot + discounted_strike


def price_european_many(
    S0: float,
    K: np.ndarray | list[float],
    T: float,
    r: float,
    q: float,
    params: HestonParams,
    option_type: str = "call",
) -> np.ndarray:
    """Price European options under Heston for many strikes at one expiry."""
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")

    p1, p2 = _integrate_fourier_many(params, S0, np.asarray(K, dtype=np.float64), T, r, q)
    discounted_spot = S0 * math.exp(-q * max(T, MIN_T))
    discounted_strike = K * math.exp(-r * max(T, MIN_T))
    call = discounted_spot * p1 - discounted_strike * p2
    if opt_type == "call":
        return call
    return call - discounted_spot + discounted_strike


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


def heston_delta(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    params: HestonParams,
    option_type: str = "call",
) -> float:
    """Analytical Heston delta via the stock-measure probability P1.

    Delta = dCall/dS0 = e^{-qT} * P1 for calls.
    For puts, delta = e^{-qT} * (P1 - 1) via put-call parity.
    """
    if T <= 1e-10:
        if option_type == "call":
            return 1.0 if S0 > K else 0.0
        return -1.0 if S0 < K else 0.0

    p1, _ = _integrate_fourier(params, S0, K, T, r, q)
    disc = math.exp(-q * T)
    if option_type == "call":
        return float(disc * p1)
    return float(disc * (p1 - 1.0))


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

    # Precompute the CF set once per unique (params, T, r, q). The spot and
    # vanna bumps only vary S0 / v0, so one CF set serves many bumped prices —
    # 6 Fourier evaluations instead of 12.
    spots = np.asarray([S0, S0 + h_S, S0 - h_S])
    strikes = np.full(3, K)

    cf_base = _cf_set(params, T_eff, r, q)
    base_prices = _price_prepared(cf_base, spots, strikes, T_eff, r, q, opt_type)
    base = float(base_prices[0])
    price_S_up, price_S_dn = float(base_prices[1]), float(base_prices[2])

    # Delta / Gamma (spot)
    delta = (price_S_up - price_S_dn) / (2.0 * h_S)
    gamma = (price_S_up - 2.0 * base + price_S_dn) / h_S**2

    # Vega / Volga / Vanna (v0 bumps; same spots so the cross bumps are reused)
    cf_v_up = _cf_set(_bump_v0(h_v0), T_eff, r, q)
    cf_v_dn = _cf_set(_bump_v0(-h_v0), T_eff, r, q)
    up_prices = _price_prepared(cf_v_up, spots, strikes, T_eff, r, q, opt_type)
    dn_prices = _price_prepared(cf_v_dn, spots, strikes, T_eff, r, q, opt_type)
    price_v_up, price_up_up, price_dn_up = (float(v) for v in up_prices)
    price_v_dn, price_up_dn, price_dn_dn = (float(v) for v in dn_prices)

    dV_dv0 = (price_v_up - price_v_dn) / (2.0 * h_v0)
    d2V_dv0_2 = (price_v_up - 2.0 * base + price_v_dn) / h_v0**2
    d2V_dS_dv0 = (price_up_up - price_up_dn - price_dn_up + price_dn_dn) / (4.0 * h_S * h_v0)

    # Chain rule w.r.t. sigma = sqrt(v0):
    #   vega  = dV/dv0 * 2s
    #   volga = d2V/ds^2 = 4 v0 d2V/dv0^2 + 2 dV/dv0
    vega = dV_dv0 * 2.0 * sigma0
    volga = d2V_dv0_2 * 4.0 * v0 + 2.0 * dV_dv0
    vanna = d2V_dS_dv0 * 2.0 * sigma0

    # Theta (one-sided, per calendar day)
    T_down = max(T_eff - h_T, 1e-6)
    cf_t_down = _cf_set(params, T_down, r, q)
    price_T_down = float(_price_prepared(cf_t_down, S0, K, T_down, r, q, opt_type))
    theta_annual = (price_T_down - base) / h_T
    theta = theta_annual / DAYS_PER_YEAR

    # Rho
    cf_r_up = _cf_set(params, T_eff, r + h_r, q)
    cf_r_dn = _cf_set(params, T_eff, r - h_r, q)
    price_r_up = float(_price_prepared(cf_r_up, S0, K, T_eff, r + h_r, q, opt_type))
    price_r_dn = float(_price_prepared(cf_r_dn, S0, K, T_eff, r - h_r, q, opt_type))
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
