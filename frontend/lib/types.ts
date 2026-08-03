/**
 * TypeScript types mirroring backend Pydantic schemas.
 */

export type MarketRegion = "US" | "IN" | "FX" | "CRYPTO";
export type OptionType = "call" | "put";
export type VarianceReductionMethod =
  | "standard"
  | "antithetic"
  | "control_variate"
  | "antithetic_cv"
  | "quasi_monte_carlo"
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

export interface ImpliedVolRequest {
  ticker: string;
  market: MarketRegion;
  spot_override?: number | null;
  strike: number;
  expiry_date: string;
  option_type: OptionType;
  market_price: number;
  risk_free_rate: number;
  dividend_yield?: number | null;
}

export interface ImpliedVolResponse {
  implied_vol: number;
  iterations_used: number;
  method_used: "newton" | "brent_fallback";
  converged: boolean;
  final_residual: number;
  bs_price_at_solution: number;
}

export interface PnLShift {
  d_spot: number;
  d_vol: number;
  d_days: number;
  d_rate: number;
}

export interface PnLExplainRequest {
  ticker: string;
  market: MarketRegion;
  spot_override?: number | null;
  strike: number;
  expiry_date: string;
  option_type: OptionType;
  volatility: number;
  risk_free_rate: number;
  dividend_yield?: number | null;
  shift: PnLShift;
}

export interface PnLExplainResponse {
  base_price: number;
  shifted_price: number;
  actual_pnl: number;
  predicted_pnl_total: number;
  delta_pnl: number;
  gamma_pnl: number;
  vega_pnl: number;
  theta_pnl: number;
  rho_pnl: number;
  unexplained_pnl: number;
}

export type RiskGridMetric = "price" | "delta" | "gamma" | "vega" | "theta" | "rho";
export type RiskGridAxis = "spot" | "strike" | "volatility" | "time_to_expiry" | "rate";

export interface GridRange {
  min: number;
  max: number;
  num_points: number;
}

export interface RiskGridRequest {
  ticker: string;
  market: MarketRegion;
  spot_override?: number | null;
  strike: number;
  expiry_date: string;
  option_type: OptionType;
  volatility: number;
  risk_free_rate: number;
  dividend_yield?: number | null;
  axis_x: RiskGridAxis;
  axis_y: RiskGridAxis;
  x_range: GridRange;
  y_range: GridRange;
  metric: RiskGridMetric;
}

export interface RiskGridResponse {
  x_values: number[];
  y_values: number[];
  grid: number[][];
  metric: RiskGridMetric;
  axis_x: RiskGridAxis;
  axis_y: RiskGridAxis;
}

// ---------------------------------------------------------------------------
// Options Chain types
// ---------------------------------------------------------------------------

export interface OptionContract {
  contractSymbol?: string;
  strike: number;
  lastPrice?: number;
  bid?: number;
  ask?: number;
  change?: number;
  percentChange?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
}

export interface OptionsChainResponse {
  ticker: string;
  market: string;
  resolved_symbol: string;
  underlying_price: number | null;
  expiries: string[];
  selected_expiry: string;
  calls: OptionContract[];
  puts: OptionContract[];
}

// ---------------------------------------------------------------------------
// Historical OHLCV types
// ---------------------------------------------------------------------------

export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryResponse {
  ticker: string;
  market: string;
  currency: string;
  interval: string;
  bars: OhlcvBar[];
}

// ---------------------------------------------------------------------------
// Implied rate / dividend (market data quality probes)
// ---------------------------------------------------------------------------

export interface ImpliedParityRequest {
  ticker: string;
  market: MarketRegion;
  spot_override?: number | null;
  expiry_date?: string | null;
  risk_free_rate: number;
  dividend_yield?: number | null;
}

export interface ImpliedRateResponse {
  ticker: string;
  market: string;
  resolved_symbol: string;
  spot: number;
  strike: number;
  ttm: number;
  call_price: number;
  put_price: number;
  implied_rate: number;
  reference_rate: number;
  divergence: number;
  warnings: string[];
}

export interface ImpliedDividendResponse {
  ticker: string;
  market: string;
  resolved_symbol: string;
  spot: number;
  strike: number;
  ttm: number;
  call_price: number;
  put_price: number;
  implied_dividend: number;
  market_dividend: number | null;
  divergence: number | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Quantitative model types (SVI surface, Heston calibration, validation)
// ---------------------------------------------------------------------------

export interface QuantSurfaceRequest {
  ticker: string;
  market: MarketRegion;
  spot_override?: number | null;
  risk_free_rate: number;
  dividend_yield?: number | null;
  expiries?: string[] | null;
  max_expiries: number;
}

export interface SVIParams {
  a: number;
  b: number;
  rho: number;
  m: number;
  sigma: number;
}

export interface SurfacePoint {
  strike: number;
  market_iv: number | null;
  fitted_iv: number | null;
}

export interface SVISlice {
  expiry: string;
  ttm: number;
  svi_params: SVIParams;
  points: SurfacePoint[];
}

export interface VolSurfaceResponse {
  ticker: string;
  market: string;
  resolved_symbol: string;
  spot: number;
  rate: number;
  dividend_yield: number;
  slices: SVISlice[];
  warnings: string[];
}

export interface TermStructurePoint {
  expiry: string;
  ttm: number;
  atm_vol: number;
}

export interface TermStructureResponse {
  ticker: string;
  market: string;
  resolved_symbol: string;
  spot: number;
  rate: number;
  dividend_yield: number;
  points: TermStructurePoint[];
  warnings: string[];
}

export interface HestonParams {
  v0: number;
  kappa: number;
  theta_v: number;
  sigma_v: number;
  rho: number;
}

export interface CalibrationContractView {
  strike: number;
  ttm: number;
  option_type: string;
  market_price: number;
  model_price: number;
  relative_error: number;
}

export interface HestonCalibrationResponse {
  ticker: string;
  market: string;
  resolved_symbol: string;
  spot: number;
  rate: number;
  dividend_yield: number;
  params: HestonParams;
  rmse: number;
  mape: number;
  max_abs_error: number;
  feller_condition_holds: boolean;
  contracts: CalibrationContractView[];
  warnings: string[];
}

export interface ValidationContractView {
  strike: number;
  ttm: number;
  option_type: string;
  market_price: number;
  model_price: number;
  market_iv: number | null;
  model_iv: number | null;
  iv_error: number | null;
}

export interface ModelValidationResponse {
  ticker: string;
  market: string;
  resolved_symbol: string;
  spot: number;
  rate: number;
  dividend_yield: number;
  price_rel_rmse: number;
  price_mape: number;
  iv_rmse: number | null;
  market_parity_violation: number;
  parity_holds: boolean;
  feller_condition_holds: boolean;
  in_sample: boolean;
  contracts: ValidationContractView[];
  warnings: string[];
}

export type StrategyOptionType = "call" | "put" | "stock";

export interface StrategyLeg {
  option_type: StrategyOptionType;
  strike?: number | null;
  expiry_date: string;
  quantity: number;
  volatility: number;
  risk_free_rate: number;
  dividend_yield: number;
}

export interface StrategyLegResult {
  leg_index: number;
  option_type: string;
  strike: number | null;
  expiry_date: string;
  quantity: number;
  ttm: number;
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export interface StrategyRequest {
  spot: number;
  legs: StrategyLeg[];
}

export interface StrategyResponse {
  net_premium: number;
  net_delta: number;
  net_gamma: number;
  net_vega: number;
  net_theta: number;
  net_rho: number;
  payoff_spots: number[];
  payoff_values: number[];
  breakevens: number[];
  max_profit: number | null;
  max_loss: number | null;
  is_credit: boolean;
  legs: StrategyLegResult[];
}

export interface StressScenario {
  name: string;
  description: string;
  d_spot: number;
  d_spot_pct: number;
  d_vol: number;
  d_days: number;
  d_rate: number;
}

export interface StressTestRequest {
  ticker: string;
  market: MarketRegion;
  spot_override?: number | null;
  strike: number;
  expiry_date: string;
  option_type: OptionType;
  volatility: number;
  risk_free_rate: number;
  dividend_yield?: number | null;
  scenarios?: StressScenario[] | null;
}

export interface StressScenarioResult {
  name: string;
  description: string;
  spot: number;
  volatility: number;
  price: number;
  pnl: number;
  pnl_pct: number;
}

export interface StressTestResponse {
  base_price: number;
  base_spot: number;
  scenarios: StressScenarioResult[];
  worst_loss: number | null;
  worst_scenario: string | null;
  best_gain: number | null;
  best_scenario: string | null;
  unrealized_risk: number;
}

