"use client";

import React from "react";
import { PreviewBadge, PrecisionTier } from "./PreviewBadge";
import { ApiError } from "@/lib/api-client";
import { PricingPreviewResponse, PricingFullResponse, BSGreeks, MarketRegion, ImpliedVolResponse, PnLExplainResponse } from "@/lib/types";
import { useDensity } from "@/lib/contexts/DensityContext";
import { formatPercent, formatPrice } from "@/lib/formatters";

interface ResultsPanelProps {
  microState: "pending" | "preview" | "error";
  previewResult: PricingPreviewResponse | null;
  fullResult: PricingFullResponse | null;
  error: ApiError | null;
  activeTier: "preview" | "full";
  isFullSimulating: boolean;
  market: MarketRegion;
  workspaceMode?: "pricing" | "implied_vol" | "pnl_explain";
  impliedVolResult?: ImpliedVolResponse | null;
  isSolvingIv?: boolean;
  pnlExplainResult?: PnLExplainResponse | null;
  isCalculatingPnL?: boolean;
}

const CURRENCY_SYMBOL: Record<MarketRegion, string> = { US: "$", IN: "\u20B9", FX: "$", CRYPTO: "$" };

// Validation tolerances for FD Greeks comparison
const GREEK_TOLERANCES: Record<string, { name: string; symbol: string; tolerance: number }> = {
  delta: { name: "Delta", symbol: "Δ", tolerance: 0.02 }, // 2%
  gamma: { name: "Gamma", symbol: "Γ", tolerance: 0.05 }, // 5%
  vega: { name: "Vega", symbol: "ν", tolerance: 0.03 },  // 3%
  theta: { name: "Theta", symbol: "θ", tolerance: 0.05 }, // 5%
  rho: { name: "Rho", symbol: "ρ", tolerance: 0.03 },    // 3%
};

export function ResultsPanel({
  microState,
  previewResult,
  fullResult,
  error,
  activeTier,
  isFullSimulating,
  market,
  workspaceMode = "pricing",
  impliedVolResult,
  isSolvingIv = false,
  pnlExplainResult,
  isCalculatingPnL = false,
}: ResultsPanelProps) {
  const { density } = useDensity();
  const compact = density === "compact";
  const currencySymbol = CURRENCY_SYMBOL[market];
  // Error state — structured error display
  if (error) {
    const isMarketError = error.error === "ticker_not_found";
    const isValidationError = error.error === "validation_error";
    return (
      <div className="bg-[#161b22] border border-red-500/40 rounded-lg overflow-hidden">
        <div className="bg-red-950/50 px-6 py-4 border-b border-red-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-900/80 border border-red-700 flex items-center justify-center">
              <span className="text-[#f85149] text-sm font-bold">!</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-200">
                {isValidationError ? "Input Validation Failed" : isMarketError ? "Market Data Error" : "Pricing Engine Error"}
              </h3>
              <p className="text-xs text-[#f85149]/80 font-mono mt-0.5">{error.error}</p>
            </div>
          </div>
          <PreviewBadge tier="error" nSimulations={0} />
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-[#8b949e] leading-relaxed">{error.message}</p>
          {error.field && (
            <div className="flex items-center gap-2 text-xs text-[#8b949e]">
              <span className="text-[#8b949e]">Field:</span>
              <code className="bg-[#21262d] border border-[#30363d] px-2 py-0.5 rounded font-mono text-red-300">{error.field}</code>
            </div>
          )}
          {error.statusCode >= 500 && (
            <p className="text-xs text-[#8b949e] mt-2">
              If this persists, the backend pricing engine may be unreachable.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Implied Volatility Mode Results Render
  if (workspaceMode === "implied_vol") {
    if (isSolvingIv) {
      return (
        <div className="bg-[#161b22] border border-[#58a6ff]/60 rounded-xl p-8 text-center space-y-4">
          <div className="flex justify-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#bc8cff] animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-3 w-3 rounded-full bg-[#bc8cff] animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-3 w-3 rounded-full bg-[#bc8cff] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-sm text-[#79c0ff] font-semibold">
            Solving Implied Volatility via Black-Scholes inversion...
          </p>
        </div>
      );
    }

    if (!impliedVolResult) {
      return (
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#0d1117]/60 border border-[#21262d] text-[#58a6ff] flex items-center justify-center mx-auto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <h3 className="text-lg font-bold text-white">Implied Volatility Solver</h3>
          <p className="text-sm text-[#8b949e] max-w-md mx-auto">
            Enter a target market option price and click &quot;Solve Implied Volatility&quot; to compute the implied volatility (&sigma;) that yields that price under Black-Scholes.
          </p>
        </div>
      );
    }

    return (
      <div className="card bg-[#161b22] border border-[#58a6ff]/40 rounded-xl overflow-hidden shadow-xl space-y-6 p-6">
        <div className="flex items-center justify-between border-b border-[#21262d] pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Implied Volatility Solver Output</span>
            </h2>
            <p className="text-xs text-[#8b949e] mt-0.5">
              Closed-form BSM Newton-Raphson / Brent Fallback root finder
            </p>
          </div>
          <span className="px-3 py-1 bg-[#0d1117] border border-[#30363d] text-[#79c0ff] text-xs font-mono font-bold rounded-full">
            Discrete Solve
          </span>
        </div>

        {/* Hero Display */}
        <div className="bg-[#0d1117] border border-[#30363d]/50 rounded-xl p-6 text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#58a6ff]">
            Solved Implied Volatility (&sigma;)
          </span>
          <div className="text-5xl font-extrabold text-[#79c0ff] tracking-tight font-mono">
            {formatPercent(impliedVolResult.implied_vol, 2)}
          </div>
          <p className="text-xs text-[#8b949e]">
            Annualized Volatility Parameter
          </p>
        </div>

        {/* Solver Diagnostics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-[#0d1117]/80 border border-[#21262d] p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#8b949e] block mb-1">
              Solver Method
            </span>
            <span className={`inline-block px-2 py-0.5 text-xs font-mono font-bold rounded ${
              impliedVolResult.method_used === "newton"
                ? "bg-[#0d1117] text-[#79c0ff] border border-[#21262d]"
                : "bg-[#161b22] text-[#79c0ff] border border-[#30363d]"
            }`}>
              {impliedVolResult.method_used === "newton" ? "Newton-Raphson" : "Brent Fallback"}
            </span>
          </div>

          <div className="bg-[#0d1117]/80 border border-[#21262d] p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#8b949e] block mb-1">
              Convergence
            </span>
            <span className={`inline-block px-2 py-0.5 text-xs font-mono font-bold rounded ${
              impliedVolResult.converged
                ? "bg-[#0d1117] text-[#3fb950] border border-[#30363d]"
                : "bg-red-950 text-red-300 border border-red-800"
            }`}>
              {impliedVolResult.converged ? "Converged" : "Failed"}
            </span>
          </div>

          <div className="bg-[#0d1117]/80 border border-[#21262d] p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#8b949e] block mb-1">
              Iterations Used
            </span>
            <span className="text-sm font-mono font-bold text-white">
              {impliedVolResult.iterations_used}
            </span>
          </div>

          <div className="bg-[#0d1117]/80 border border-[#21262d] p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#8b949e] block mb-1">
              BS Price at Soln
            </span>
            <span className="text-sm font-mono font-bold text-white">
              {currencySymbol}{formatPrice(impliedVolResult.bs_price_at_solution, 4)}
            </span>
          </div>
        </div>

        {/* Residual diagnostic line */}
        <div className="bg-[#0d1117]/50 border border-[#21262d] px-4 py-2.5 rounded-lg flex items-center justify-between text-xs font-mono text-[#8b949e]">
          <span>Final Price Residual:</span>
          <span className="text-[#e6edf3]">
            {impliedVolResult.final_residual >= 0 ? "+" : ""}
            {impliedVolResult.final_residual.toExponential(3)}
          </span>
        </div>
      </div>
    );
  }

  // P&L Explain Mode Results Render
  if (workspaceMode === "pnl_explain") {
    if (isCalculatingPnL) {
      return (
        <div className="bg-[#161b22] border border-[#58a6ff]/60 rounded-xl p-8 text-center space-y-4">
          <div className="flex justify-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#58a6ff] animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-3 w-3 rounded-full bg-[#58a6ff] animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-3 w-3 rounded-full bg-[#58a6ff] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-sm text-[#79c0ff] font-semibold">
            Recomputing Black-Scholes scenario P&amp;L &amp; Taylor series Greek attribution...
          </p>
        </div>
      );
    }

    if (!pnlExplainResult) {
      return (
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#0d1117]/60 border border-[#21262d] text-[#58a6ff] flex items-center justify-center mx-auto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg>
          </div>
          <h3 className="text-lg font-bold text-white">P&amp;L Explain &amp; Greek Attribution</h3>
          <p className="text-sm text-[#8b949e] max-w-md mx-auto">
            Adjust hypothetical scenario shift sliders (&Delta;S, &Delta;&sigma;, &Delta;t, &Delta;r) and click &quot;Explain P&amp;L Attribution&quot; to decompose actual option P&amp;L into Greek contributions and higher-order residual.
          </p>
        </div>
      );
    }

    const {
      base_price,
      shifted_price,
      actual_pnl,
      predicted_pnl_total,
      delta_pnl,
      gamma_pnl,
      vega_pnl,
      theta_pnl,
      rho_pnl,
      unexplained_pnl,
    } = pnlExplainResult;

    const terms = [
      { name: "Delta P&L (Δ · ΔS)", val: delta_pnl, color: "bg-[#58a6ff]", text: "text-[#58a6ff]", border: "border-[#21262d]/40" },
      { name: "Gamma P&L (½Γ · ΔS²)", val: gamma_pnl, color: "bg-[#bc8cff]", text: "text-[#bc8cff]", border: "border-[#30363d]/40" },
      { name: "Vega P&L (ν · Δσ)", val: vega_pnl, color: "bg-[#58a6ff]", text: "text-[#58a6ff]", border: "border-[#21262d]/40" },
      { name: "Theta P&L (θ · Δt)", val: theta_pnl, color: "bg-[#d29922]", text: "text-[#58a6ff]", border: "border-[#30363d]/40" },
      { name: "Rho P&L (ρ · Δr)", val: rho_pnl, color: "bg-[#58a6ff]", text: "text-[#58a6ff]", border: "border-[#21262d]/40" },
      { name: "Higher-Order Residual", val: unexplained_pnl, color: "bg-[#f85149]", text: "text-[#f85149]", border: "border-[#f85149]/40 bg-[#f85149]/10" },
    ];

    return (
      <div className="card bg-[#161b22] border border-[#58a6ff]/40 rounded-xl overflow-hidden shadow-xl space-y-6 p-6">
        <div className="flex items-center justify-between border-b border-[#21262d] pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>P&amp;L Explain &amp; Greek Attribution Output</span>
            </h2>
            <p className="text-xs text-[#8b949e] mt-0.5">
              1st &amp; 2nd order Taylor Series decomposition vs actual BSM repriced P&amp;L
            </p>
          </div>
          <span className="px-3 py-1 bg-[#0d1117] border border-[#30363d] text-[#79c0ff] text-xs font-mono font-bold rounded-full">
            Exact BSM
          </span>
        </div>

        {/* Base vs Shifted Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0d1117]/80 border border-[#21262d] p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#8b949e] block mb-1">
              Base Price (V₀)
            </span>
            <span className="text-sm font-mono font-bold text-white">
              {currencySymbol}{formatPrice(base_price, 4)}
            </span>
          </div>

          <div className="bg-[#0d1117]/80 border border-[#21262d] p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#8b949e] block mb-1">
              Shifted Price (V_shift)
            </span>
            <span className="text-sm font-mono font-bold text-white">
              {currencySymbol}{formatPrice(shifted_price, 4)}
            </span>
          </div>

          <div className="bg-[#0d1117]/80 border border-[#21262d] p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#8b949e] block mb-1">
              Actual Repriced P&amp;L
            </span>
            <span className={`text-sm font-mono font-bold ${actual_pnl >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}`}>
              {actual_pnl >= 0 ? "+" : ""}{currencySymbol}{formatPrice(actual_pnl, 4)}
            </span>
          </div>

          <div className="bg-[#0d1117]/80 border border-[#21262d] p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#8b949e] block mb-1">
              Predicted P&amp;L Total
            </span>
            <span className="text-sm font-mono font-bold text-[#79c0ff]">
              {predicted_pnl_total >= 0 ? "+" : ""}{currencySymbol}{formatPrice(predicted_pnl_total, 4)}
            </span>
          </div>
        </div>

        {/* Per-Term Attribution Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#58a6ff]">
            P&amp;L Term Breakdown &amp; Attribution
          </h3>
          <div className="divide-y divide-[#21262d]/60 border border-[#21262d] rounded-lg overflow-hidden bg-[#0d1117]/60">
            {terms.map((t) => (
              <div
                key={t.name}
                className={`flex items-center justify-between px-4 py-2.5 text-xs font-mono ${t.border}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${t.color}`} />
                  <span className="text-[#8b949e] font-medium">{t.name}</span>
                </div>
                <span className={`font-bold ${t.text}`}>
                  {t.val >= 0 ? "+" : ""}{currencySymbol}{formatPrice(t.val, 4)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Unexplained Residual Explanation Banner */}
        <div className="bg-[#f85149]/10 border border-[#f85149]/40 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#f85149] flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Unexplained Higher-Order Residual:
              </span>
            <span className="text-xs font-mono font-bold text-[#f85149]">
              {unexplained_pnl >= 0 ? "+" : ""}{currencySymbol}{formatPrice(unexplained_pnl, 4)}
            </span>
          </div>
          <p className="text-[11px] text-[#8b949e] leading-relaxed">
            This residual captures higher-order and cross-Greek interactions (such as Vanna, Volga, and cross-gamma between spot and volatility) that first- and second-order single-variable Greeks do not account for.
          </p>
        </div>
      </div>
    );
  }



  // Full Simulation Computing State (Elapsed Time Timer)
  if (isFullSimulating) {
    return (
      <div className="bg-[#161b22] border border-[#58a6ff]/60 rounded-lg p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#21262d] pb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Executing Full Monte Carlo Simulation
            </h2>
            <p className="text-xs text-[#8b949e] font-mono mt-1">
              Evaluating 4 estimators &bull; Finite-difference Greeks (CRN) &bull; Convergence sweep
            </p>
          </div>
          <PreviewBadge tier="computing" nSimulations={fullResult?.request_echo.n_simulations ?? 500000} />
        </div>

        <div className="py-12 text-center space-y-4">
          <div className="flex justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#58a6ff] animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 rounded-full bg-[#58a6ff] animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 rounded-full bg-[#58a6ff] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <div className="space-y-2">
            <div className="animate-shimmer h-4 w-48 mx-auto rounded" />
            <div className="animate-shimmer h-3 w-32 mx-auto rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Full Simulation Validated Results
  if (activeTier === "full" && fullResult) {
    const bs = fullResult.black_scholes;
    const fd = fullResult.greeks_fd;
    const stdMc = fullResult.mc_results.find((m) => m.method === "standard");
    const stdSe = stdMc?.standard_error || 1e-6;

    // Calculate Relative Efficiency for each estimator relative to Standard MC
    // Var(Standard) / Var(Method) = (SE_Standard / SE_Method)^2
    const mcWithEfficiency = fullResult.mc_results.map((mc) => {
      const relEff = Math.pow(stdSe / (mc.standard_error || 1e-6), 2);
      const ciWidth = mc.ci_upper - mc.ci_lower;
      return {
        ...mc,
        relative_efficiency: relEff,
        ci_width: ciWidth,
      };
    });

    const maxEfficiency = Math.max(...mcWithEfficiency.map((m) => m.relative_efficiency), 1.0);

    return (
      <div className="card space-y-6">
        {/* Header Strip with Validated PreviewBadge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#161b22] border-2 border-[#58a6ff]/80 rounded-lg p-4 gap-4 shadow-lg shadow-[#0d1117]/40">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Validated Pricing Results
            </h2>
            <p className="text-xs text-[#8b949e] font-mono mt-0.5">
              Risk-neutral measure ℚ &bull; Seed: {fullResult.request_echo.seed}
            </p>
          </div>
          <PreviewBadge
            tier="full"
            nSimulations={fullResult.request_echo.n_simulations}
            computeMs={fullResult.compute_ms}
          />
        </div>

        {/* 1. Headline Price Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#161b22] border border-[#58a6ff]/60 rounded-lg p-6 shadow-md">
            <span className="text-xs font-extrabold text-[#58a6ff] uppercase tracking-wider block mb-1">
              Black-Scholes Benchmark
            </span>
            <div className="text-4xl font-black text-white font-[family-name:var(--font-display)] tracking-tight">
              {currencySymbol}{bs.price.toFixed(4)}
            </div>
            <p className="text-xs text-[#8b949e] mt-2 font-mono">
              Analytical closed-form price
            </p>
          </div>

          <div className="bg-[#161b22] border border-[#3fb950]/60 rounded-lg p-6 shadow-md">
            <span className="text-xs font-extrabold text-[#3fb950] uppercase tracking-wider block mb-1">
              Monte Carlo (Standard)
            </span>
            <div className="text-4xl font-black text-[#3fb950] font-[family-name:var(--font-display)] tracking-tight">
              {currencySymbol}{stdMc ? stdMc.price.toFixed(4) : "N/A"}
            </div>
            <p className="text-xs text-[#8b949e] mt-2 font-mono">
              SE: &plusmn;${stdMc ? stdMc.standard_error.toFixed(4) : "0.0000"}
            </p>
          </div>
        </div>

        {/* 2. Analytical Greeks Table (all 5 side-by-side) */}
        <div className="section bg-[#161b22] border border-[#21262d] rounded-lg p-5">
          <h3 className="text-xs font-extrabold text-[#58a6ff] uppercase tracking-wider mb-3">
            Analytical Greeks (Black-Scholes Closed-Form)
          </h3>
          <div className="grid grid-cols-5 gap-2 text-center font-mono">
            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block">Delta (&Delta;)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.delta.toFixed(4)}
              </span>
            </div>
            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block">Gamma (&Gamma;)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.gamma.toFixed(5)}
              </span>
            </div>
            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block">Vega (&nu;)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.vega.toFixed(4)}
              </span>
            </div>
            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block">Theta (&theta;/day)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.theta.toFixed(4)}
              </span>
            </div>
            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block">Rho (&rho;)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.rho.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Monte Carlo Estimator Comparison — Variance Reduction & Relative Efficiency */}
        <div className="section bg-[#161b22] border border-[#21262d] rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold text-[#58a6ff] uppercase tracking-wider">
              Monte Carlo Estimator Comparison &amp; Variance Reduction
            </h3>
            <span className="text-xs text-[#8b949e] font-mono">
              Relative Efficiency = Var(Std) / Var(Method)
            </span>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
                  <tr>
                    <th className="table-cell p-2.5">Method</th>
                    <th className="table-cell p-2.5 text-right">Price</th>
                    <th className="table-cell p-2.5 text-right">Std Error (SE)</th>
                    <th className="table-cell p-2.5 text-right">95% CI Width</th>
                    <th className="table-cell p-2.5 text-right">Runtime</th>
                    <th className="table-cell p-2.5 text-right">N_eff</th>
                    <th className="table-cell p-2.5 text-center">Relative Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
                  {mcWithEfficiency.map((mc) => {
                    const barPercent = Math.min(100, (mc.relative_efficiency / maxEfficiency) * 100);
                    const isFocalPoint = mc.relative_efficiency > 1.05;

                    return (
                      <tr key={mc.method} className="hover:bg-[#21262d]/40">
                        <td className="table-cell p-2.5 font-bold text-[#79c0ff]">
                          {mc.method === "quasi_monte_carlo"
                            ? "Randomized QMC (Sobol)"
                            : mc.method === "antithetic_cv"
                            ? "Combined Antithetic + CV"
                            : mc.method === "control_variate"
                            ? "Control Variates (S_T)"
                            : mc.method.replace(/_/g, " ")}
                        </td>
                        <td className="table-cell p-2.5 text-right font-extrabold text-white">
                          {currencySymbol}{mc.price.toFixed(4)}
                        </td>
                        <td className="table-cell p-2.5 text-right text-[#58a6ff] font-bold">
                          &plusmn;${mc.standard_error.toFixed(4)}
                        </td>
                        <td className="table-cell p-2.5 text-right text-[#8b949e]">
                          ${mc.ci_width.toFixed(4)}
                        </td>
                        <td className="table-cell p-2.5 text-right text-[#8b949e]">
                          {mc.runtime_ms.toFixed(1)}ms
                        </td>
                        <td className="table-cell p-2.5 text-right text-[#8b949e]">
                          {mc.n_effective.toLocaleString()}
                        </td>

                        {/* Relative Efficiency — bar-in-cell visual treatment */}
                        <td className="table-cell p-2.5 text-right font-bold">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-[#0d1117] h-2 rounded overflow-hidden border border-[#21262d]">
                            <div
                              className={`h-full ${
                                isFocalPoint ? "bg-[#58a6ff]" : "bg-[#30363d]"
                              }`}
                              style={{ width: `${barPercent}%` }}
                            ></div>
                          </div>
                          <span
                            className={`text-sm ${
                              isFocalPoint
                                ? "text-[#79c0ff] font-extrabold text-base"
                                : "text-[#8b949e]"
                            }`}
                          >
                            {mc.relative_efficiency > 9999 ? ">9999" : mc.relative_efficiency.toFixed(2)}x
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Greeks Comparison — Analytical BS vs Finite-Difference MC */}
        <div className="section bg-[#161b22] border border-[#21262d] rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold text-[#58a6ff] uppercase tracking-wider">
              Greeks Comparison: Analytical BS vs Finite-Difference MC (CRN)
            </h3>
            <span className="text-xs text-[#8b949e] font-mono">
              Deltas shown explicitly &bull; CRN seed={fullResult.request_echo.seed}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
                <tr>
                  <th className="table-cell p-2.5">Greek</th>
                  <th className="table-cell p-2.5 text-right">Analytical BS</th>
                  <th className="table-cell p-2.5 text-right">FD Monte Carlo</th>
                  <th className="table-cell p-2.5 text-right">Delta (Difference)</th>
                  <th className="table-cell p-2.5 text-right">Rel Error</th>
                  <th className="table-cell p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
                {Object.entries(GREEK_TOLERANCES).map(([key, meta]) => {
                  const bsVal = bs.greeks[key as keyof BSGreeks] ?? 0;
                  const fdVal = fd[key as keyof BSGreeks] ?? 0;
                  const diff = fdVal - bsVal;
                  const absBs = Math.abs(bsVal);
                  const isNearZero = absBs < 1e-4;
                  const relErr = !isNearZero ? Math.abs(diff / bsVal) : 0;
                  const isWithinTolerance = isNearZero
                    ? Math.abs(diff) <= 0.01
                    : relErr <= meta.tolerance;

                  return (
                    <tr key={key} className="hover:bg-[#21262d]/40">
                      <td className="table-cell p-2.5 font-bold text-white">
                        {meta.name} ({meta.symbol})
                      </td>
                      <td className="table-cell p-2.5 text-right text-[#8b949e] font-bold">
                        {bsVal.toFixed(5)}
                      </td>
                      <td className="table-cell p-2.5 text-right text-[#79c0ff] font-bold">
                        {fdVal.toFixed(5)}
                      </td>
                      {/* Delta column — explicit difference display */}
                      <td
                        className={`table-cell p-2.5 text-right font-bold ${
                          diff >= 0 ? "text-[#3fb950]" : "text-[#f85149]"
                        }`}
                      >
                        {diff >= 0 ? "+" : ""}
                        {diff.toFixed(5)}
                      </td>
                      <td className="table-cell p-2.5 text-right text-[#8b949e]">
                        {isNearZero ? "N/A (near 0)" : `${(relErr * 100).toFixed(2)}%`}
                      </td>
                      <td className="table-cell p-2.5 text-center">
                        {isWithinTolerance ? (
                          <span className="px-2 py-0.5 rounded bg-[#0d1117] text-[#3fb950] border border-[#30363d] text-xs font-bold">
                            ✓ Pass ({isNearZero ? "< 0.01" : `&le; ${(meta.tolerance * 100).toFixed(0)}%`})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-[#161b22] text-[#79c0ff] border border-[#30363d] text-xs">
                            <svg className="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> High Noise
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Diagnostics Panel */}
        <div className="section bg-[#161b22] border border-[#21262d] rounded-lg p-5">
          <h3 className="text-xs font-extrabold text-[#58a6ff] uppercase tracking-wider mb-3">
            Simulation Diagnostics Panel
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block mb-1">Expected Payoff</span>
              <span className="text-base font-bold text-white">
                ${fullResult.diagnostics.expected_payoff.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block mb-1">Discount Factor</span>
              <span className="text-base font-bold text-white">
                {fullResult.diagnostics.discount_factor.toFixed(4)}
              </span>
            </div>

            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block mb-1">Terminal Mean (S_T)</span>
              <span className="text-base font-bold text-white">
                ${fullResult.diagnostics.terminal_mean.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block mb-1">Terminal Std (S_T)</span>
              <span className="text-base font-bold text-white">
                ${fullResult.diagnostics.terminal_std.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block mb-1">Standard Error (SE)</span>
              <span className="text-base font-bold text-[#58a6ff]">
                &plusmn;${(stdMc?.standard_error || 0).toFixed(4)}
              </span>
            </div>

            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block mb-1">95% CI Width</span>
              <span className="text-base font-bold text-white">
                ${stdMc ? (stdMc.ci_upper - stdMc.ci_lower).toFixed(4) : "0.0000"}
              </span>
            </div>

            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block mb-1">Paths / Second</span>
              <span className="text-base font-bold text-[#79c0ff]">
                {stdMc ? stdMc.paths_per_second.toLocaleString() : "0"}
              </span>
            </div>

            <div className="bg-[#0d1117] p-3 rounded border border-[#21262d]">
              <span className="text-xs text-[#8b949e] block mb-1">Relative Error vs BS</span>
              <span className="text-base font-bold text-[#3fb950]">
                {(fullResult.diagnostics.relative_error_vs_bs * 100).toFixed(3)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preview results — muted / desaturated style for indicative tier
  const currentBadgeTier: PrecisionTier = microState === "pending" ? "pending" : "preview";

  return (
    <div className="card space-y-6">
      {/* Header Strip with Muted PreviewBadge */}
      <div className="flex items-center justify-between bg-[#161b22]/60 border border-[#21262d] rounded-lg p-4">
        <div>
          <h2 className="text-xl font-bold text-[#8b949e] tracking-tight">
            Indicative Preview
          </h2>
          <p className="text-xs text-[#8b949e] font-mono mt-0.5">
            Fast debounced scenario estimate (&le; 10k simulations) &bull; Run full simulation for validated pricing
          </p>
        </div>
        <PreviewBadge
          tier={currentBadgeTier}
          nSimulations={previewResult?.n_simulations ?? 10000}
          computeMs={previewResult?.compute_ms}
        />
      </div>

      {previewResult ? (
        /* Muted / desaturated card styling for indicative tier */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-90">
          <div className="bg-[#0d1117]/60 border border-[#21262d] rounded-lg p-5">
            <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider block mb-1">
              Black-Scholes (Indicative)
            </span>
            <div className="text-4xl font-black text-[#8b949e] font-mono">
              {currencySymbol}{previewResult.black_scholes.price.toFixed(2)}
            </div>
            <div className="mt-3 flex gap-4 text-xs font-mono text-[#8b949e]">
              <span>&Delta;: {previewResult.black_scholes.delta.toFixed(4)}</span>
              <span>&Gamma;: {previewResult.black_scholes.gamma.toFixed(5)}</span>
            </div>
          </div>

          <div className="bg-[#0d1117]/60 border border-[#21262d] rounded-lg p-5">
            <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider block mb-1">
              Standard MC (Indicative)
            </span>
            <div className="text-4xl font-black text-[#8b949e] font-mono">
              {currencySymbol}{previewResult.monte_carlo_standard.price.toFixed(2)}
            </div>
            <div className="mt-3 flex gap-4 text-xs font-mono text-[#8b949e]">
              <span>&Delta;: {previewResult.monte_carlo_standard.delta.toFixed(4)}</span>
              <span>&Gamma;: {previewResult.monte_carlo_standard.gamma.toFixed(5)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#0d1117]/40 border border-[#21262d] rounded-lg p-8 space-y-3">
          <div className="animate-shimmer h-4 w-40 rounded" />
          <div className="animate-shimmer h-8 w-28 rounded" />
          <div className="flex gap-4">
            <div className="animate-shimmer h-3 w-20 rounded" />
            <div className="animate-shimmer h-3 w-20 rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
