"""Quantitative model API endpoints.

POST /quant/vol-surface     — fit SVI slices to market implied vols.
POST /quant/heston-calibrate — fit Heston params to market option prices.
POST /quant/model-validate   — validate a calibrated Heston model vs market.

These wire the engine/ modules (vol_surface, heston_calibration,
model_validation) to real options-chain market data.
"""

from __future__ import annotations

import math
from datetime import date, datetime

import numpy as np
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ..core.dependencies import get_market_data_service
from ..engine.heston_calibration import CalibrationContract, calibrate_heston
from ..engine.implied_vol import solve_implied_volatility
from ..engine.model_validation import validate_model_fit
from ..engine.vol_surface import SVIExpiry, build_surface, fit_svi
from ..providers.market_data import MarketDataError, MarketDataService
from ..schemas.quantitative import (
    CalibrationContractView,
    HestonCalibrationResponse,
    HestonParamsSchema,
    ModelValidationResponse,
    QuantSurfaceRequest,
    SVIParamsSchema,
    SVISlice,
    SurfacePoint,
    ValidationContractView,
    VolSurfaceResponse,
)
from ..schemas.pricing import ErrorResponse

router = APIRouter(prefix="/quant", tags=["quantitative"])

# Moneyness band for calibration contracts: skip extreme OTM quotes whose tiny
# prices would dominate relative-error metrics and blow up the optimizer.
_MAX_ABS_MONEYNESS = 0.6
# Minimum market price (currency) for a contract to be used in calibration.
_MIN_MARKET_PRICE = 0.02


def _ttm_from_expiry(expiry: str) -> float:
    """Time to expiry in years (ACT/365) for a YYYY-MM-DD expiry string."""
    exp_date = datetime.strptime(expiry, "%Y-%m-%d").date()
    delta = exp_date - date.today()
    return max(delta.days / 365.0, 1e-4)


def _spot_for(chain: dict, spot_override: float | None) -> float:
    if spot_override is not None and spot_override > 0:
        return float(spot_override)
    return float(chain.get("underlying_price") or 100.0)


def _mid_price(contract: dict) -> float | None:
    bid = contract.get("bid")
    ask = contract.get("ask")
    if isinstance(bid, float) and isinstance(ask, float) and math.isfinite(bid) and math.isfinite(ask):
        return 0.5 * (bid + ask)
    last = contract.get("lastPrice")
    if isinstance(last, float) and math.isfinite(last):
        return float(last)
    return None


def _chain_iv(contract: dict) -> float | None:
    iv = contract.get("impliedVolatility")
    if isinstance(iv, float) and math.isfinite(iv) and iv > 0:
        return float(iv)
    return None


def _solve_iv(S0: float, K: float, T: float, r: float, q: float, opt: str, price: float) -> float | None:
    try:
        res = solve_implied_volatility(S0, K, T, r, q, opt, price)
        if res.converged and math.isfinite(res.implied_vol):
            return float(res.implied_vol)
    except Exception:
        pass
    return None


def _fetch_chain(
    service: MarketDataService, ticker: str, market: str, expiry: str | None = None
) -> dict | None:
    try:
        return service.get_options_chain(ticker, market, expiry)
    except MarketDataError:
        return None


def _build_vol_surface(
    service: MarketDataService, req: QuantSurfaceRequest
) -> tuple[VolSurfaceResponse | None, list[str]]:
    """Fit SVI slices to market implied vols for up to `max_expiries` expiries."""
    warnings: list[str] = []
    base = _fetch_chain(service, req.ticker, req.market)
    if base is None:
        raise MarketDataError(
            message=f"Options chain unavailable for '{req.ticker}'.",
            ticker=req.ticker,
            fallback_available=False,
        )

    expiries = req.expiries or []
    if not expiries:
        expiries = list(base.get("expiries") or [])[: req.max_expiries]
    if not expiries:
        raise MarketDataError(
            message=f"No option expiries found for '{req.ticker}'.",
            ticker=req.ticker,
            fallback_available=False,
        )

    spot = _spot_for(base, req.spot_override)
    r = req.risk_free_rate
    q = req.dividend_yield if req.dividend_yield is not None else 0.0
    resolved = base.get("resolved_symbol") or req.ticker.upper()

    slices: list[SVISlice] = []
    for expiry in expiries[: req.max_expiries]:
        chain = _fetch_chain(service, req.ticker, req.market, expiry) or base
        T = _ttm_from_expiry(expiry)
        forward = spot * math.exp((r - q) * T)
        all_points: list[tuple[float, float, str]] = []  # (k, iv, opt)
        for opt, contracts in (("call", chain.get("calls") or []), ("put", chain.get("puts") or [])):
            for c in contracts:
                strike = c.get("strike")
                if not isinstance(strike, float) or not math.isfinite(strike) or strike <= 0:
                    continue
                iv = _chain_iv(c)
                if iv is None:
                    price = _mid_price(c)
                    if price is None or price <= 0:
                        continue
                    iv = _solve_iv(spot, strike, T, r, q, opt, price)
                if iv is None or not math.isfinite(iv) or iv <= 1e-4:
                    continue
                k = math.log(strike / forward)
                all_points.append((k, iv, opt))

        if len(all_points) < 5:
            warnings.append(f"Expiry {expiry}: too few usable quotes, skipped.")
            continue

        ks = np.asarray([p[0] for p in all_points], dtype=np.float64)
        ivs = np.asarray([p[1] for p in all_points], dtype=np.float64)
        try:
            params = fit_svi(ks, ivs, T)
        except ValueError as exc:
            warnings.append(f"Expiry {expiry}: SVI fit failed ({exc}), skipped.")
            continue

        fitted_ivs = params.implied_vol(ks, T)
        points = [
            SurfacePoint(
                strike=float(spot * math.exp(k)),
                market_iv=iv,
                fitted_iv=float(fitted_iv),
            )
            for (k, iv, _), fitted_iv in zip(all_points, fitted_ivs)
        ]
        slices.append(
            SVISlice(
                expiry=expiry,
                ttm=T,
                svi_params=SVIParamsSchema(
                    a=params.a, b=params.b, rho=params.rho, m=params.m, sigma=params.sigma
                ),
                points=points,
            )
        )

    if not slices:
        raise MarketDataError(
            message="No SVI slices could be fitted from the options chain.",
            ticker=req.ticker,
            fallback_available=False,
        )

    return (
        VolSurfaceResponse(
            ticker=req.ticker.upper(),
            market=req.market.upper(),
            resolved_symbol=resolved,
            spot=spot,
            rate=r,
            dividend_yield=q,
            slices=slices,
            warnings=warnings,
        ),
        warnings,
    )


def _calibration_contracts(
    chain: dict, spot: float, r: float, q: float, expiry: str
) -> list[CalibrationContract]:
    """Build calibration contracts from a chain, filtering junk quotes."""
    T = _ttm_from_expiry(expiry)
    forward = spot * math.exp((r - q) * T)
    contracts: list[CalibrationContract] = []
    for opt, rows in (("call", chain.get("calls") or []), ("put", chain.get("puts") or [])):
        for c in rows:
            strike = c.get("strike")
            if not isinstance(strike, float) or not math.isfinite(strike) or strike <= 0:
                continue
            price = _mid_price(c)
            if price is None or price <= 0 or price < _MIN_MARKET_PRICE:
                continue
            moneyness = math.log(strike / forward)
            if abs(moneyness) > _MAX_ABS_MONEYNESS:
                continue
            contracts.append(
                CalibrationContract(strike=strike, ttm=T, market_price=price, option_type=opt)
            )
    return contracts


def _calibrate_chain(
    service: MarketDataService, req: QuantSurfaceRequest
) -> HestonCalibrationResponse:
    """Calibrate Heston to the nearest expiry's option chain."""
    chain = _fetch_chain(service, req.ticker, req.market)
    if chain is None:
        raise MarketDataError(
            message=f"Options chain unavailable for '{req.ticker}'.",
            ticker=req.ticker,
            fallback_available=False,
        )
    expiry = (req.expiries or [None])[0] or chain.get("selected_expiry")
    if expiry not in (chain.get("expiries") or []):
        expiry = (chain.get("expiries") or [None])[0]
    if expiry is None:
        raise MarketDataError(
            message=f"No option expiries found for '{req.ticker}'.",
            ticker=req.ticker,
            fallback_available=False,
        )

    spot = _spot_for(chain, req.spot_override)
    r = req.risk_free_rate
    q = req.dividend_yield if req.dividend_yield is not None else 0.0

    if expiry != chain.get("selected_expiry"):
        chain = _fetch_chain(service, req.ticker, req.market, expiry) or chain

    contracts = _calibration_contracts(chain, spot, r, q, expiry)
    if len(contracts) < 5:
        raise MarketDataError(
            message=f"Not enough usable option quotes at expiry {expiry} to calibrate.",
            ticker=req.ticker,
            fallback_available=False,
        )

    result = calibrate_heston(contracts, spot, r, q)
    p = result.params
    views = [
        CalibrationContractView(
            strike=c.strike,
            ttm=c.ttm,
            option_type=c.option_type,
            market_price=c.market_price,
            model_price=float(model),
            relative_error=float((model - c.market_price) / c.market_price),
        )
        for c, model in zip(contracts, _model_prices(contracts, p, spot, r, q))
    ]
    return HestonCalibrationResponse(
        ticker=req.ticker.upper(),
        market=req.market.upper(),
        resolved_symbol=chain.get("resolved_symbol") or req.ticker.upper(),
        spot=spot,
        rate=r,
        dividend_yield=q,
        params=HestonParamsSchema(v0=p.v0, kappa=p.kappa, theta_v=p.theta_v,
                                  sigma_v=p.sigma_v, rho=p.rho),
        rmse=result.rmse,
        mape=result.mape,
        max_abs_error=result.max_abs_error,
        feller_condition_holds=result.feller_condition_holds,
        contracts=views,
    )


def _model_prices(
    contracts: list[CalibrationContract], params, S0: float, r: float, q: float
) -> list[float]:
    from ..engine.heston import price_european_many

    out: list[float] = []
    groups: dict[tuple[float, str], list[int]] = {}
    for i, c in enumerate(contracts):
        groups.setdefault((c.ttm, c.option_type.lower()), []).append(i)
    prices = [0.0] * len(contracts)
    for (ttm, opt), idxs in groups.items():
        ks = np.asarray([contracts[i].strike for i in idxs], dtype=np.float64)
        vals = price_european_many(S0, ks, ttm, r, q, params, opt)
        for j, i in enumerate(idxs):
            prices[i] = float(vals[j])
    return prices


def _validate_chain(
    service: MarketDataService, req: QuantSurfaceRequest
) -> ModelValidationResponse:
    """Validate a calibrated Heston model against the market chain."""
    calib = _calibrate_chain(service, req)
    chain = _fetch_chain(service, req.ticker, req.market)
    if chain is None:
        raise MarketDataError(
            message=f"Options chain unavailable for '{req.ticker}'.",
            ticker=req.ticker,
            fallback_available=False,
        )
    expiry = calib_contracts_meta(chain, req)
    contracts = _calibration_contracts(chain, calib.spot, calib.rate, calib.dividend_yield, expiry)

    p = _params_obj(calib.params)
    result = validate_model_fit(contracts, p, calib.spot, calib.rate, calib.dividend_yield)

    views = []
    for d in result.contracts:
        views.append(
            ValidationContractView(
                strike=d.strike,
                ttm=d.ttm,
                option_type=d.option_type,
                market_price=d.market_price,
                model_price=d.model_price,
                market_iv=d.market_iv if math.isfinite(d.market_iv) else None,
                model_iv=d.model_iv if math.isfinite(d.model_iv) else None,
                iv_error=d.iv_error if math.isfinite(d.iv_error) else None,
            )
        )
    return ModelValidationResponse(
        ticker=calib.ticker,
        market=calib.market,
        resolved_symbol=calib.resolved_symbol,
        spot=calib.spot,
        rate=calib.rate,
        dividend_yield=calib.dividend_yield,
        price_rmse=result.price_rmse,
        price_mape=result.price_mape,
        iv_rmse=result.iv_rmse if math.isfinite(result.iv_rmse) else None,
        parity_max_error=result.parity_max_error,
        parity_holds=result.parity_holds,
        feller_condition_holds=result.feller_condition_holds,
        contracts=views,
    )


def calib_contracts_meta(chain: dict, req: QuantSurfaceRequest) -> str:
    expiry = (req.expiries or [None])[0] or chain.get("selected_expiry")
    if expiry not in (chain.get("expiries") or []):
        expiry = (chain.get("expiries") or [None])[0]
    if expiry is None:
        raise MarketDataError(
            message=f"No option expiries found for '{req.ticker}'.",
            ticker=req.ticker,
            fallback_available=False,
        )
    return expiry


def _params_obj(schema: HestonParamsSchema):
    from ..engine.heston import HestonParams

    return HestonParams(v0=schema.v0, kappa=schema.kappa, theta_v=schema.theta_v,
                        sigma_v=schema.sigma_v, rho=schema.rho)


def _error_response(err: MarketDataError) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content=ErrorResponse(
            error="quant_data_unavailable",
            message=err.message,
            fallback_available=err.fallback_available,
        ).model_dump(),
    )


@router.post(
    "/vol-surface",
    response_model=VolSurfaceResponse,
    responses={404: {"model": ErrorResponse}},
)
def quant_vol_surface(
    req: QuantSurfaceRequest,
    market_data: MarketDataService = Depends(get_market_data_service),
) -> VolSurfaceResponse | JSONResponse:
    """Fit an SVI volatility surface to the market options chain."""
    try:
        resp, _ = _build_vol_surface(market_data, req)
        return resp
    except MarketDataError as err:
        return _error_response(err)


@router.post(
    "/heston-calibrate",
    response_model=HestonCalibrationResponse,
    responses={404: {"model": ErrorResponse}},
)
def quant_heston_calibrate(
    req: QuantSurfaceRequest,
    market_data: MarketDataService = Depends(get_market_data_service),
) -> HestonCalibrationResponse | JSONResponse:
    """Fit Heston model parameters to market option prices."""
    try:
        return _calibrate_chain(market_data, req)
    except MarketDataError as err:
        return _error_response(err)


@router.post(
    "/model-validate",
    response_model=ModelValidationResponse,
    responses={404: {"model": ErrorResponse}},
)
def quant_model_validate(
    req: QuantSurfaceRequest,
    market_data: MarketDataService = Depends(get_market_data_service),
) -> ModelValidationResponse | JSONResponse:
    """Validate a calibrated Heston model against the market options chain."""
    try:
        return _validate_chain(market_data, req)
    except MarketDataError as err:
        return _error_response(err)
