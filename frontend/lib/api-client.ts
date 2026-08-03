/**
 * API Client module.
 *
 * Typed fetch wrappers for backend FastAPI endpoints.
 */

import {
  PricingRequest,
  PricingPreviewResponse,
  PricingFullResponse,
  ValidationSummaryResponse,
  ImpliedVolRequest,
  ImpliedVolResponse,
  PnLExplainRequest,
  PnLExplainResponse,
  RiskGridRequest,
  RiskGridResponse,
  ErrorResponse,
  MarketQuoteResponse,
  MarketRegion,
  OptionsChainResponse,
  HistoryResponse,
  QuantSurfaceRequest,
  VolSurfaceResponse,
  HestonCalibrationResponse,
  ModelValidationResponse,
  ImpliedParityRequest,
  ImpliedRateResponse,
  ImpliedDividendResponse,
  StrategyRequest,
  StrategyResponse,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  error: string;
  field?: string | null;
  fallback_available?: boolean | null;
  statusCode: number;

  constructor(status: number, data: ErrorResponse) {
    super(data.message || "An unexpected error occurred.");
    this.name = "ApiError";
    this.statusCode = status;
    this.error = data.error || "unknown_error";
    this.field = data.field;
    this.fallback_available = data.fallback_available;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ErrorResponse;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: "http_error",
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    throw new ApiError(response.status, errorData);
  }
  return response.json() as Promise<T>;
}

export async function getMarketQuote(
  ticker: string,
  market: MarketRegion,
  signal?: AbortSignal
): Promise<MarketQuoteResponse> {
  const url = `${BASE_URL}/market/quote?ticker=${encodeURIComponent(
    ticker
  )}&market=${encodeURIComponent(market)}`;
  const response = await fetch(url, { method: "GET", signal });
  return handleResponse<MarketQuoteResponse>(response);
}

export async function postPricePreview(
  request: PricingRequest,
  signal?: AbortSignal
): Promise<PricingPreviewResponse> {
  const url = `${BASE_URL}/price/preview`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  return handleResponse<PricingPreviewResponse>(response);
}

export async function postPriceFull(
  request: PricingRequest,
  signal?: AbortSignal
): Promise<PricingFullResponse> {
  const url = `${BASE_URL}/price/full`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  return handleResponse<PricingFullResponse>(response);
}

export async function getValidationSummary(
  signal?: AbortSignal
): Promise<ValidationSummaryResponse> {
  const url = `${BASE_URL}/validation/summary`;
  const response = await fetch(url, { method: "GET", signal });
  return handleResponse<ValidationSummaryResponse>(response);
}

export async function fetchReportPdf(
  request: PricingRequest,
  signal?: AbortSignal
): Promise<Blob> {
  const url = `${BASE_URL}/report/pdf`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    let errorData: ErrorResponse;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: "http_error",
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    throw new ApiError(response.status, errorData);
  }

  return response.blob();
}

export async function postImpliedVol(
  request: ImpliedVolRequest,
  signal?: AbortSignal
): Promise<ImpliedVolResponse> {
  const url = `${BASE_URL}/price/implied-vol`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  return handleResponse<ImpliedVolResponse>(response);
}

export async function postPnLExplain(
  request: PnLExplainRequest,
  signal?: AbortSignal
): Promise<PnLExplainResponse> {
  const url = `${BASE_URL}/price/pnl-explain`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  return handleResponse<PnLExplainResponse>(response);
}

export async function postRiskGrid(
  request: RiskGridRequest,
  signal?: AbortSignal
): Promise<RiskGridResponse> {
  const url = `${BASE_URL}/price/risk-grid`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  return handleResponse<RiskGridResponse>(response);
}

export async function getOptionsChain(
  ticker: string,
  market: MarketRegion,
  expiry?: string,
  signal?: AbortSignal
): Promise<OptionsChainResponse> {
  const params = new URLSearchParams({ ticker, market });
  if (expiry) params.set("expiry", expiry);
  const url = `${BASE_URL}/market/options?${params}`;
  const response = await fetch(url, { method: "GET", signal });
  return handleResponse<OptionsChainResponse>(response);
}

export async function getMarketHistory(
  ticker: string,
  market: MarketRegion,
  period: string = "1y",
  interval: string = "1d",
  signal?: AbortSignal
): Promise<HistoryResponse> {
  const params = new URLSearchParams({ ticker, market, period, interval });
  const url = `${BASE_URL}/market/history?${params}`;
  const response = await fetch(url, { method: "GET", signal });
  return handleResponse<HistoryResponse>(response);
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return handleResponse<T>(response);
}

export async function postVolSurface(
  request: QuantSurfaceRequest,
  signal?: AbortSignal
): Promise<VolSurfaceResponse> {
  return postJson<VolSurfaceResponse>(`${BASE_URL}/quant/vol-surface`, request, signal);
}

export async function postHestonCalibrate(
  request: QuantSurfaceRequest,
  signal?: AbortSignal
): Promise<HestonCalibrationResponse> {
  return postJson<HestonCalibrationResponse>(`${BASE_URL}/quant/heston-calibrate`, request, signal);
}

export async function postModelValidate(
  request: QuantSurfaceRequest,
  signal?: AbortSignal
): Promise<ModelValidationResponse> {
  return postJson<ModelValidationResponse>(`${BASE_URL}/quant/model-validate`, request, signal);
}

export async function postImpliedRate(
  request: ImpliedParityRequest,
  signal?: AbortSignal
): Promise<ImpliedRateResponse> {
  return postJson<ImpliedRateResponse>(`${BASE_URL}/market/implied-rate`, request, signal);
}

export async function postImpliedDividend(
  request: ImpliedParityRequest,
  signal?: AbortSignal
): Promise<ImpliedDividendResponse> {
  return postJson<ImpliedDividendResponse>(`${BASE_URL}/market/implied-dividend`, request, signal);
}

export async function postStrategy(
  request: StrategyRequest,
  signal?: AbortSignal
): Promise<StrategyResponse> {
  return postJson<StrategyResponse>(`${BASE_URL}/price/strategy`, request, signal);
}



