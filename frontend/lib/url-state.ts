/**
 * URL State management module.
 *
 * Encodes and decodes PricingRequest inputs into/from URL query parameters.
 * URL is the single source of truth for all pricing inputs across the app.
 */

import { MarketRegion, OptionType, PricingRequest, VarianceReductionMethod } from "./types";

export const DEFAULT_PRICING_REQUEST: PricingRequest = {
  ticker: "",
  market: "US",
  spot_override: null,
  strike: 350,
  expiry_date: "2026-10-30",
  option_type: "call",
  volatility: 0.25,
  risk_free_rate: 0.05,
  dividend_yield: 0.0,
  n_simulations: 500000,
  seed: 42,
  variance_reduction: "all",
};

/**
 * Serialize a PricingRequest object into a URL search query string.
 *
 * Example output:
 * "ticker=AAPL&market=US&strike=350&expiry_date=2026-10-30&option_type=call&volatility=0.25&risk_free_rate=0.05&n_simulations=500000&seed=42&variance_reduction=all"
 */
export function serializeInputs(inputs: PricingRequest): string {
  const params = new URLSearchParams();

  params.set("ticker", inputs.ticker.trim().toUpperCase());
  params.set("market", inputs.market);
  if (inputs.spot_override !== null && inputs.spot_override !== undefined) {
    params.set("spot_override", inputs.spot_override.toString());
  }
  params.set("strike", inputs.strike.toString());
  params.set("expiry_date", inputs.expiry_date);
  params.set("option_type", inputs.option_type);
  params.set("volatility", inputs.volatility.toString());
  params.set("risk_free_rate", inputs.risk_free_rate.toString());
  if (inputs.dividend_yield !== null && inputs.dividend_yield !== undefined) {
    params.set("dividend_yield", inputs.dividend_yield.toString());
  }
  params.set("n_simulations", inputs.n_simulations.toString());
  params.set("seed", inputs.seed.toString());
  params.set("variance_reduction", inputs.variance_reduction);

  return params.toString();
}

/**
 * Deserialize a URLSearchParams object or key-value object into a Partial<PricingRequest>.
 */
export function deserializeParams(
  searchParams: URLSearchParams | Record<string, string>
): Partial<PricingRequest> {
  const getParam = (key: string): string | null => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key);
    }
    return searchParams[key] ?? null;
  };

  const result: Partial<PricingRequest> = {};

  const ticker = getParam("ticker");
  if (ticker) result.ticker = ticker.trim().toUpperCase();

  const market = getParam("market")?.toUpperCase();
  if (market === "US" || market === "IN" || market === "FX" || market === "CRYPTO") result.market = market as MarketRegion;

  const spot = getParam("spot_override") ?? getParam("spot");
  if (spot !== null && !isNaN(Number(spot))) result.spot_override = Number(spot);

  const strike = getParam("strike");
  if (strike !== null && !isNaN(Number(strike))) result.strike = Number(strike);

  const expiry = getParam("expiry_date") ?? getParam("expiry");
  if (expiry) result.expiry_date = expiry;

  const optType = (getParam("option_type") ?? getParam("type"))?.toLowerCase();
  if (optType === "call" || optType === "put") result.option_type = optType as OptionType;

  const vol = getParam("volatility") ?? getParam("vol");
  if (vol !== null && !isNaN(Number(vol))) result.volatility = Number(vol);

  const rate = getParam("risk_free_rate") ?? getParam("rate");
  if (rate !== null && !isNaN(Number(rate))) result.risk_free_rate = Number(rate);

  const div = getParam("dividend_yield") ?? getParam("div");
  if (div !== null && !isNaN(Number(div))) result.dividend_yield = Number(div);

  const n = getParam("n_simulations") ?? getParam("n");
  if (n !== null && !isNaN(Number(n))) result.n_simulations = Number(n);

  const seed = getParam("seed");
  if (seed !== null && !isNaN(Number(seed))) result.seed = Number(seed);

  const vr = getParam("variance_reduction") ?? getParam("vr");
  if (
    vr === "standard" ||
    vr === "antithetic" ||
    vr === "control_variate" ||
    vr === "antithetic_cv" ||
    vr === "quasi_monte_carlo" ||
    vr === "all"
  ) {
    result.variance_reduction = vr as VarianceReductionMethod;
  }

  return result;
}

/**
 * Merge default pricing inputs with deserialized URL params to guarantee complete inputs.
 */
export function getEffectiveInputs(
  searchParams: URLSearchParams | Record<string, string>
): PricingRequest {
  const parsed = deserializeParams(searchParams);
  return {
    ...DEFAULT_PRICING_REQUEST,
    ...parsed,
  };
}
