"""Self-check tests for the butterfly arbitrage engine.

Run with: python -m app.engine.test_butterfly_arb
"""

from .butterfly_arb import check_surface_butterfly_arb
from .vol_surface import SVIExpiry, SVIParams, SVISurface


def _surface_with(params: SVIParams, ttm: float = 1.0) -> SVISurface:
    return SVISurface(
        spot=100.0,
        rate=0.03,
        dividend_yield=0.0,
        slices=[SVIExpiry(ttm=ttm, params=params)],
    )


def _run_tests() -> None:
    # 1. Flat total variance => pure log-normal density, never negative.
    flat = SVIParams(a=0.04, b=0.0, rho=0.0, m=0.0, sigma=0.1)
    res = check_surface_butterfly_arb(_surface_with(flat))
    assert res[0].arb_free, "flat total variance must be butterfly-arb free"
    assert res[0].min_butterfly >= 0.0, "flat slice butterfly value must be non-negative"

    # 2. Steep asymmetric SVI smile produces a negative-density (non-convex)
    #    call price region on one wing => butterfly arbitrage detected.
    skew = SVIParams(a=0.02, b=3.0, rho=-0.95, m=0.0, sigma=0.05)
    res_skew = check_surface_butterfly_arb(_surface_with(skew))
    assert not res_skew[0].arb_free, "steep SVI smile must show butterfly arb"
    assert res_skew[0].min_butterfly < 0.0

    # 3. Grid validation.
    try:
        check_surface_butterfly_arb(_surface_with(flat), n_points=2)
        assert False, "n_points < 3 must raise"
    except ValueError:
        pass

    print("All butterfly arb self-checks passed.")


if __name__ == "__main__":
    _run_tests()
