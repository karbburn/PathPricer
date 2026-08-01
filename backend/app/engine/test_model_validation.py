"""Self-check for the model validation engine.

Validates:
  1. A perfectly-fitted Heston model yields near-zero price/IV residuals.
  2. Put-call parity holds across all contracts (Heston is arbitrage-free).
  3. A deliberately mis-specified model produces large residuals (catches the
     case where the engine reports a good fit unconditionally).
  4. Input validation rejects empty contract lists.
"""

import numpy as np

from app.engine.heston import HestonParams, price_european
from app.engine.heston_calibration import CalibrationContract, calibrate_heston
from app.engine.model_validation import validate_model_fit


def _make_market(
    true_params: HestonParams, S0: float, r: float, q: float
) -> list[CalibrationContract]:
    strikes = [80.0, 90.0, 95.0, 100.0, 105.0, 110.0, 120.0]
    ttms = [0.25, 0.5, 1.0]
    contracts = []
    for ttm in ttms:
        for K in strikes:
            call = price_european(S0, K, ttm, r, q, true_params, "call")
            put = price_european(S0, K, ttm, r, q, true_params, "put")
            contracts.append(CalibrationContract(strike=K, ttm=ttm, market_price=call, option_type="call"))
            contracts.append(CalibrationContract(strike=K, ttm=ttm, market_price=put, option_type="put"))
    return contracts


def _run_tests() -> None:
    true_params = HestonParams(v0=0.04, kappa=2.0, theta_v=0.04, sigma_v=0.3, rho=-0.7)
    S0, r, q = 100.0, 0.05, 0.01
    market = _make_market(true_params, S0, r, q)

    # --- 1 & 2. Well-fitted model -------------------------------------------
    calib = calibrate_heston(market, S0, r, q)
    result = validate_model_fit(market, calib.params, S0, r, q)

    assert result.n_contracts == len(market)
    assert result.price_rmse < 1e-3, f"Price RMSE too large for good fit: {result.price_rmse:.4e}"
    assert result.price_mape < 0.1, f"MAPE too large for good fit: {result.price_mape:.3f}%"
    assert result.iv_rmse < 5e-3, f"IV RMSE too large for good fit: {result.iv_rmse:.4e}"
    assert result.parity_holds, f"Put-call parity should hold: max err {result.parity_max_error:.2e}"
    assert result.feller_condition_holds

    # Per-contract residuals should be tiny.
    assert max(abs(d.price_residual) for d in result.contracts) < 1e-2

    # --- 3. Mis-specified model ---------------------------------------------
    wrong = HestonParams(v0=0.09, kappa=0.5, theta_v=0.09, sigma_v=0.9, rho=0.0)
    bad = validate_model_fit(market, wrong, S0, r, q)
    assert bad.price_rmse > 0.05, (
        f"Mis-specified model should show large RMSE, got {bad.price_rmse:.4e}"
    )

    # --- 4. Input validation --------------------------------------------------
    try:
        validate_model_fit([], true_params, S0, r, q)
        raise AssertionError("Expected ValueError for empty contracts")
    except ValueError:
        pass

    print("Model validation self-check OK")
    print(f"  good-fit price_rmse={result.price_rmse:.2e} iv_rmse={result.iv_rmse:.2e} "
          f"parity_max={result.parity_max_error:.2e}")
    print(f"  mis-specified price_rmse={bad.price_rmse:.3f}")


if __name__ == "__main__":
    _run_tests()
