"""Self-check for the SVI volatility surface engine.

Validates:
  1. fit_svi recovers a known parameter set from generated implied vols.
  2. The fitted slice reproduces the input implied vols to tight tolerance.
  3. build_surface + implied_vol interpolate sensibly across strikes and expiries.
  4. ATM vol matches the surface at moneyness 0.
"""

import math

import numpy as np

from app.engine.vol_surface import (
    SVIParams,
    SVIExpiry,
    build_surface,
    fit_svi,
)


def _run_tests() -> None:
    # --- 1. Parameter recovery ---------------------------------------------
    true_params = SVIParams(a=0.04, b=0.5, rho=-0.7, m=0.05, sigma=0.25)
    ttm = 0.5
    k = np.linspace(-1.0, 1.0, 21)
    total_var = true_params.total_variance(k)
    sigma_imp = np.sqrt(total_var / ttm)

    fitted = fit_svi(k, sigma_imp, ttm)
    assert fitted is not None
    assert abs(fitted.a - true_params.a) < 2e-2, f"a off: {fitted.a} vs {true_params.a}"
    assert abs(fitted.b - true_params.b) < 1e-2, f"b off: {fitted.b} vs {true_params.b}"
    assert abs(fitted.rho - true_params.rho) < 1e-2, f"rho off: {fitted.rho} vs {true_params.rho}"
    assert abs(fitted.m - true_params.m) < 2e-2, f"m off: {fitted.m} vs {true_params.m}"
    assert abs(fitted.sigma - true_params.sigma) < 5e-2, f"sigma off: {fitted.sigma} vs {true_params.sigma}"

    # --- 2. Reproduction error ----------------------------------------------
    back = fitted.implied_vol(k, ttm)
    max_err = float(np.max(np.abs(back - sigma_imp)))
    assert max_err < 1e-3, f"Max reproduction error too large: {max_err:.4e}"

    # --- 3. Surface interpolation -------------------------------------------
    spot, rate, q = 100.0, 0.05, 0.01
    # m centers the smile minimum at ATM: m = -rho*sigma/sqrt(1-rho^2).
    slice_short = SVIExpiry(
        ttm=0.25, params=SVIParams(a=0.03, b=0.45, rho=-0.6, m=-0.15, sigma=0.2)
    )
    slice_long = SVIExpiry(
        ttm=1.0, params=SVIParams(a=0.06, b=0.6, rho=-0.75, m=-0.237, sigma=0.3)
    )
    surface = build_surface(spot, rate, q, [slice_short, slice_long])

    # ATM vol at each fitted expiry equals slice implied vol at k=0.
    for sl in (slice_short, slice_long):
        v_slice = float(sl.params.implied_vol(np.array([0.0]), sl.ttm)[0])
        v_surface = surface.atm_vol(sl.ttm)
        assert abs(v_slice - v_surface) < 1e-9, f"ATM mismatch at T={sl.ttm}: {v_surface} vs {v_slice}"

    # Interpolated ATM vol at T=0.5 lies between the two slices' ATM vols.
    v_mid = surface.atm_vol(0.5)
    v_short = surface.atm_vol(0.25)
    v_long = surface.atm_vol(1.0)
    assert min(v_short, v_long) <= v_mid <= max(v_short, v_long), (
        f"Mid ATM vol {v_mid:.4f} not between {v_short:.4f} and {v_long:.4f}"
    )

    # Smile: at a fixed T, OTM implied vol exceeds ATM vol (skew + wings).
    fwd = spot * math.exp((rate - q) * 0.5)
    atm = surface.implied_vol(fwd, 0.5)
    otm_call = surface.implied_vol(fwd * 1.2, 0.5)
    otm_put = surface.implied_vol(fwd * 0.8, 0.5)
    assert atm < otm_call, f"Expected call wing above ATM: {atm:.4f} vs {otm_call:.4f}"
    assert atm < otm_put, f"Expected put wing above ATM: {atm:.4f} vs {otm_put:.4f}"

    # --- 4. Input validation -------------------------------------------------
    try:
        fit_svi(k[:4], sigma_imp[:4], ttm)
        raise AssertionError("Expected ValueError for <5 observations")
    except ValueError:
        pass

    try:
        fit_svi(k, np.full_like(k, np.nan), ttm)
        raise AssertionError("Expected ValueError for non-finite implied vols")
    except ValueError:
        pass

    # --- 5. Calendar-arbitrage rejection ------------------------------------
    # A later slice with LOWER total variance than an earlier one at the same
    # moneyness admits a calendar spread arbitrage; build_surface must reject it.
    try:
        build_surface(
            spot, rate, q,
            [
                SVIExpiry(ttm=0.25, params=SVIParams(a=0.06, b=0.5, rho=-0.6, m=-0.15, sigma=0.2)),
                SVIExpiry(ttm=1.0, params=SVIParams(a=0.03, b=0.45, rho=-0.6, m=-0.15, sigma=0.2)),
            ],
        )
        raise AssertionError("Expected ValueError for calendar arbitrage")
    except ValueError:
        pass

    print("SVI surface self-check OK")
    print(f"  recovered params: a={fitted.a:.4f} b={fitted.b:.4f} rho={fitted.rho:.4f} "
          f"m={fitted.m:.4f} sigma={fitted.sigma:.4f}")
    print(f"  max reproduction error = {max_err:.2e}")


if __name__ == "__main__":
    _run_tests()
