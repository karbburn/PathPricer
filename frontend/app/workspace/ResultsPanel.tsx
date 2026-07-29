"use client";

import React from "react";
import { PreviewBadge, PrecisionTier } from "./PreviewBadge";
import { ApiError } from "@/lib/api-client";
import { PricingPreviewResponse, PricingFullResponse, BSGreeks } from "@/lib/types";
import { useDensity } from "@/lib/contexts/DensityContext";

interface ResultsPanelProps {
  microState: "pending" | "preview" | "error";
  previewResult: PricingPreviewResponse | null;
  fullResult: PricingFullResponse | null;
  error: ApiError | null;
  activeTier: "preview" | "full";
  isFullSimulating: boolean;
}

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
}: ResultsPanelProps) {
  const { density } = useDensity();
  const compact = density === "compact";
  // Error state — structured error display
  if (error) {
    const isMarketError = error.error === "ticker_not_found";
    const isValidationError = error.error === "validation_error";
    return (
      <div className="bg-slate-900 border border-red-500/40 rounded-lg overflow-hidden">
        <div className="bg-red-950/50 px-6 py-4 border-b border-red-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-900/80 border border-red-700 flex items-center justify-center">
              <span className="text-red-400 text-sm font-bold">!</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-200">
                {isValidationError ? "Input Validation Failed" : isMarketError ? "Market Data Error" : "Pricing Engine Error"}
              </h3>
              <p className="text-xs text-red-400/80 font-mono mt-0.5">{error.error}</p>
            </div>
          </div>
          <PreviewBadge tier="error" nSimulations={0} />
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">{error.message}</p>
          {error.field && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-slate-400">Field:</span>
              <code className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded font-mono text-red-300">{error.field}</code>
            </div>
          )}
          {error.statusCode >= 500 && (
            <p className="text-xs text-slate-400 mt-2">
              If this persists, the backend pricing engine may be unreachable.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Full Simulation Computing State (Elapsed Time Timer)
  if (isFullSimulating) {
    return (
      <div className="bg-slate-900 border border-cyan-500/60 rounded-lg p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Executing Full Monte Carlo Simulation
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Evaluating 4 estimators &bull; Finite-difference Greeks (CRN) &bull; Convergence sweep
            </p>
          </div>
          <PreviewBadge tier="computing" nSimulations={fullResult?.request_echo.n_simulations ?? 500000} />
        </div>

        <div className="py-12 text-center space-y-4">
          <div className="flex justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
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
      <div className="space-y-6">
        {/* Header Strip with Validated PreviewBadge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900 border-2 border-cyan-500/80 rounded-lg p-4 gap-4 shadow-lg shadow-cyan-950/40">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Validated Pricing Results
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Risk-neutral measure $\mathbb{"{"}Q{"}"}$ &bull; Seed: {fullResult.request_echo.seed}
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
          <div className="bg-slate-900 border border-cyan-600/60 rounded-lg p-6 shadow-md">
            <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider block mb-1">
              Black-Scholes Benchmark
            </span>
            <div className="text-4xl font-black text-white font-mono tracking-tight">
              ${bs.price.toFixed(4)}
            </div>
            <p className="text-xs text-slate-400 mt-2 font-mono">
              Analytical closed-form price
            </p>
          </div>

          <div className="bg-slate-900 border border-emerald-500/60 rounded-lg p-6 shadow-md">
            <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider block mb-1">
              Monte Carlo (Standard)
            </span>
            <div className="text-4xl font-black text-emerald-300 font-mono tracking-tight">
              ${stdMc ? stdMc.price.toFixed(4) : "N/A"}
            </div>
            <p className="text-xs text-slate-400 mt-2 font-mono">
              SE: &plusmn;${stdMc ? stdMc.standard_error.toFixed(4) : "0.0000"}
            </p>
          </div>
        </div>

        {/* 2. Analytical Greeks Table (all 5 side-by-side) */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h3 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider mb-3">
            Analytical Greeks (Black-Scholes Closed-Form)
          </h3>
          <div className="grid grid-cols-5 gap-2 text-center font-mono">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block">Delta (&Delta;)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.delta.toFixed(4)}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block">Gamma (&Gamma;)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.gamma.toFixed(5)}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block">Vega (&nu;)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.vega.toFixed(4)}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block">Theta (&theta;/day)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.theta.toFixed(4)}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block">Rho (&rho;)</span>
              <span className="text-base font-bold text-white">
                {bs.greeks.rho.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Monte Carlo Estimator Comparison — Variance Reduction & Relative Efficiency */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider">
              Monte Carlo Estimator Comparison &amp; Variance Reduction
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Relative Efficiency = Var(Std) / Var(Method)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Method</th>
                  <th className="p-2.5 text-right">Price</th>
                  <th className="p-2.5 text-right">Std Error (SE)</th>
                  <th className="p-2.5 text-right">95% CI Width</th>
                  <th className="p-2.5 text-right">Runtime</th>
                  <th className="p-2.5 text-right">N_eff</th>
                  <th className="p-2.5 text-center">Relative Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {mcWithEfficiency.map((mc) => {
                  const barPercent = Math.min(100, (mc.relative_efficiency / maxEfficiency) * 100);
                  const isFocalPoint = mc.relative_efficiency > 1.05;

                  return (
                    <tr key={mc.method} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold capitalize text-cyan-300">
                        {mc.method.replace("_", " ")}
                      </td>
                      <td className="p-2.5 text-right font-extrabold text-white">
                        ${mc.price.toFixed(4)}
                      </td>
                      <td className="p-2.5 text-right text-amber-400 font-bold">
                        &plusmn;${mc.standard_error.toFixed(4)}
                      </td>
                      <td className="p-2.5 text-right text-slate-400">
                        ${mc.ci_width.toFixed(4)}
                      </td>
                      <td className="p-2.5 text-right text-slate-400">
                        {mc.runtime_ms.toFixed(1)}ms
                      </td>
                      <td className="p-2.5 text-right text-slate-400">
                        {mc.n_effective.toLocaleString()}
                      </td>

                      {/* Relative Efficiency — bar-in-cell visual treatment */}
                      <td className="p-2.5 text-right font-bold">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-950 h-2 rounded overflow-hidden border border-slate-800">
                            <div
                              className={`h-full ${
                                isFocalPoint ? "bg-cyan-400" : "bg-slate-600"
                              }`}
                              style={{ width: `${barPercent}%` }}
                            ></div>
                          </div>
                          <span
                            className={`text-sm ${
                              isFocalPoint
                                ? "text-cyan-300 font-extrabold text-base"
                                : "text-slate-400"
                            }`}
                          >
                            {mc.relative_efficiency.toFixed(2)}x
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
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider">
              Greeks Comparison: Analytical BS vs Finite-Difference MC (CRN)
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Deltas shown explicitly &bull; CRN seed={fullResult.request_echo.seed}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Greek</th>
                  <th className="p-2.5 text-right">Analytical BS</th>
                  <th className="p-2.5 text-right">FD Monte Carlo</th>
                  <th className="p-2.5 text-right">Delta (Difference)</th>
                  <th className="p-2.5 text-right">Rel Error</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {Object.entries(GREEK_TOLERANCES).map(([key, meta]) => {
                  const bsVal = bs.greeks[key as keyof BSGreeks] ?? 0;
                  const fdVal = fd[key as keyof BSGreeks] ?? 0;
                  const diff = fdVal - bsVal;
                  const relErr = bsVal !== 0 ? Math.abs(diff / bsVal) : 0;
                  const isWithinTolerance = relErr <= meta.tolerance;

                  return (
                    <tr key={key} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-white">
                        {meta.name} ({meta.symbol})
                      </td>
                      <td className="p-2.5 text-right text-slate-300 font-bold">
                        {bsVal.toFixed(5)}
                      </td>
                      <td className="p-2.5 text-right text-cyan-300 font-bold">
                        {fdVal.toFixed(5)}
                      </td>
                      {/* Delta column — explicit difference display */}
                      <td
                        className={`p-2.5 text-right font-bold ${
                          diff >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {diff >= 0 ? "+" : ""}
                        {diff.toFixed(5)}
                      </td>
                      <td className="p-2.5 text-right text-slate-400">
                        {(relErr * 100).toFixed(2)}%
                      </td>
                      <td className="p-2.5 text-center">
                        {isWithinTolerance ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold">
                            ✓ Pass (&le; {(meta.tolerance * 100).toFixed(0)}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-xs">
                            ⚠ High Noise
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
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h3 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider mb-3">
            Simulation Diagnostics Panel
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Expected Payoff</span>
              <span className="text-base font-bold text-white">
                ${fullResult.diagnostics.expected_payoff.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Discount Factor</span>
              <span className="text-base font-bold text-white">
                {fullResult.diagnostics.discount_factor.toFixed(4)}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Terminal Mean (S_T)</span>
              <span className="text-base font-bold text-white">
                ${fullResult.diagnostics.terminal_mean.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Terminal Std (S_T)</span>
              <span className="text-base font-bold text-white">
                ${fullResult.diagnostics.terminal_std.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Standard Error (SE)</span>
              <span className="text-base font-bold text-amber-400">
                &plusmn;${(stdMc?.standard_error || 0).toFixed(4)}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">95% CI Width</span>
              <span className="text-base font-bold text-white">
                ${stdMc ? (stdMc.ci_upper - stdMc.ci_lower).toFixed(4) : "0.0000"}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Paths / Second</span>
              <span className="text-base font-bold text-cyan-300">
                {stdMc ? stdMc.paths_per_second.toLocaleString() : "0"}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Relative Error vs BS</span>
              <span className="text-base font-bold text-emerald-400">
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
    <div className="space-y-6">
      {/* Header Strip with Muted PreviewBadge */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg p-4">
        <div>
          <h2 className="text-xl font-bold text-slate-300 tracking-tight">
            Indicative Preview
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
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
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Black-Scholes (Indicative)
            </span>
            <div className="text-3xl font-bold text-slate-300 font-mono">
              ${previewResult.black_scholes.price.toFixed(2)}
            </div>
            <div className="mt-3 flex gap-4 text-xs font-mono text-slate-400">
              <span>&Delta;: {previewResult.black_scholes.delta.toFixed(4)}</span>
              <span>&Gamma;: {previewResult.black_scholes.gamma.toFixed(5)}</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Standard MC (Indicative)
            </span>
            <div className="text-3xl font-bold text-slate-300 font-mono">
              ${previewResult.monte_carlo_standard.price.toFixed(2)}
            </div>
            <div className="mt-3 flex gap-4 text-xs font-mono text-slate-400">
              <span>&Delta;: {previewResult.monte_carlo_standard.delta.toFixed(4)}</span>
              <span>&Gamma;: {previewResult.monte_carlo_standard.gamma.toFixed(5)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-8 space-y-3">
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
