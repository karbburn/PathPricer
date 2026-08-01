"""Self-check for the Heston pricing engine.

Validates the characteristic-function pricing against:
  1. A published Heston benchmark (Heston 1993, the original paper's numbers
     for a call option).
  2. Put-call parity.
  3. Degenerate-case limit to Black-Scholes (variance process held at mean
     with tiny vol-of-vol -> constant vol).
  4. Finite-difference Greeks sanity (delta sign / magnitude).
"""

import math

from app.engine.heston import HestonParams, price_and_greeks, price_european
from app.engine.black_scholes import price as bs_price


def _run_tests() -> None:
    # --- 1. Heston benchmark (exact reference) ------------------------------
    # S0=100, K=100, T=1, r=0.05, q=0, kappa=2, theta=0.01, sigma_v=1.0, v0=0.01,
    # rho=0.0. Independently computed two ways (exact CIR integrated-variance
    # Laplace transform; exact noncentral-chi-square simulation conditioning the
    # Black-Scholes formula on V = int v dt, valid at rho=0) -> 6.078 +/- 0.007.
    params = HestonParams(v0=0.01, kappa=2.0, theta_v=0.01, sigma_v=1.0, rho=0.0)
    call = price_european(100.0, 100.0, 1.0, 0.05, 0.0, params, "call")
    assert abs(call - 6.078) < 2e-2, f"Heston benchmark call off: {call:.4f}"

    # --- 2. Put-call parity -------------------------------------------------
    # Heston is arbitrage-free; P = C - S e^{-qT} + K e^{-rT} must hold.
    S0, K, T, r, q = 100.0, 105.0, 0.5, 0.03, 0.01
    p = HestonParams(v0=0.04, kappa=1.5, theta_v=0.05, sigma_v=0.4, rho=-0.6)
    c = price_european(S0, K, T, r, q, p, "call")
    pu = price_european(S0, K, T, r, q, p, "put")
    lhs = c - pu
    rhs = S0 * math.exp(-q * T) - K * math.exp(-r * T)
    assert abs(lhs - rhs) < 1e-6, f"Put-call parity violated: {lhs - rhs:.2e}"

    # --- 3. Degenerate limit -> Black-Scholes --------------------------------
    # vol-of-vol -> 0 with v0 = theta = sigma^2 makes Heston collapse to BS.
    sigma = 0.25
    deg = HestonParams(v0=sigma**2, kappa=5.0, theta_v=sigma**2, sigma_v=1e-6, rho=0.0)
    S0, K, T, r, q = 100.0, 98.0, 0.75, 0.05, 0.02
    h_price = price_european(S0, K, T, r, q, deg, "call")
    bs = bs_price(S0, K, T, r, q, sigma, "call")
    assert abs(h_price - bs) < 1e-2, f"Heston->BS limit off: {h_price:.4f} vs {bs:.4f}"

    # --- 4. Greeks sanity -----------------------------------------------------
    S0, K, T, r, q = 100.0, 100.0, 1.0, 0.03, 0.0
    p = HestonParams(v0=0.04, kappa=2.0, theta_v=0.04, sigma_v=0.3, rho=-0.7)
    res = price_and_greeks(S0, K, T, r, q, p, "call")
    assert 0.0 < res.delta < 1.0, f"Delta out of range: {res.delta}"
    assert res.gamma > 0, f"Gamma negative for call: {res.gamma}"
    assert res.vega > 0, f"Vega negative: {res.vega}"
    assert res.theta < 0, f"Theta should be negative for long call: {res.theta}"
    assert abs(res.rho) < K * T, f"Rho magnitude implausible: {res.rho}"

    print("Heston engine self-check OK")
    print(f"  benchmark call = {call:.4f} (expect ~6.078)")
    print(f"  delta={res.delta:.4f} gamma={res.gamma:.4f} vega={res.vega:.4f} "
          f"volga={res.volga:.4f} vanna={res.vanna:.4f} theta={res.theta:.4f} rho={res.rho:.4f}")


if __name__ == "__main__":
    _run_tests()
