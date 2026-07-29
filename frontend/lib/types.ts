/**
 * TypeScript types mirroring backend Pydantic schemas.
 */

export type MarketRegion = "US" | "IN";
export type OptionType = "call" | "put";
export type VarianceReductionMethod =
  | "standard"
  | "antithetic"
  | "control_variate"
  | "antithetic_cv"
  | "all";

export interface PricingRequest {
  ticker: string;
  market: MarketRegion;
  spot_override?: number | null;
  strike: number;
  expiry_date: string; // ISO date string YYYY-MM-DD
  option_type: OptionType;
  volatility: number;
  risk_free_rate: number;
  dividend_yield?: number | null;
  n_simulations: number;
  seed: number;
  variance_reduction: VarianceReductionMethod;
  convergence_grid?: number[] | null;
}

export interface MarketQuoteResponse {
  ticker: string;
  market: string;
  resolved_symbol: string;
  spot_price: number;
  daily_return: number;
  historical_volatility: {
    "20d": number;
    "60d": number;
    "126d": number;
    "252d": number;
  };
  dividend_yield: number;
  market_cap: number | null;
  currency: string;
  last_updated: string;
  data_warnings: string[];
}

export interface BSPreviewResult {
  price: number;
  delta: number;
  gamma: number;
}

export interface MCPreviewResult {
  price: number;
  delta: number;
  gamma: number;
}

export interface PricingPreviewResponse {
  black_scholes: BSPreviewResult;
  monte_carlo_standard: MCPreviewResult;
  tier: "preview";
  n_simulations: number;
  compute_ms: number;
}

export interface BSGreeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export interface BSFullResult {
  price: number;
  greeks: BSGreeks;
}

export interface MCResultItem {
  method: string;
  price: number;
  standard_error: number;
  ci_lower: number;
  ci_upper: number;
  runtime_ms: number;
  n_effective: number;
  paths_per_second: number;
}

export interface FDGreeksResult {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  bump_size_used: Record<string, number>;
}

export interface ConvergencePoint {
  n: number;
  standard_error: number;
}

export interface ConvergenceFit {
  slope: number;
  r_squared: number;
}

export interface DiagnosticsBlock {
  expected_payoff: number;
  discount_factor: number;
  terminal_mean: number;
  terminal_std: number;
  relative_error_vs_bs: number;
}

export interface PricingFullResponse {
  tier: "full";
  request_echo: PricingRequest;
  black_scholes: BSFullResult;
  mc_results: MCResultItem[];
  greeks_fd: FDGreeksResult;
  convergence_data: ConvergencePoint[];
  convergence_fit: ConvergenceFit;
  diagnostics: DiagnosticsBlock;
  terminal_distribution_sample: number[];
  compute_ms: number;
}

export interface CICoverageBlock {
  trials: number;
  nominal_confidence: number;
  observed_coverage: number | null;
  last_run: string | null;
}

export interface EdgeCasesBlock {
  total: number;
  passed: number;
  last_run: string | null;
}

export interface GreeksValidationBlock {
  total: number;
  passed: number;
  tolerances: Record<string, number>;
}

export interface ValidationSummaryResponse {
  ci_coverage: CICoverageBlock;
  edge_cases: EdgeCasesBlock;
  greeks_validation: GreeksValidationBlock;
}

export interface ErrorResponse {
  error: string;
  message: string;
  field?: string | null;
  fallback_available?: boolean | null;
}
