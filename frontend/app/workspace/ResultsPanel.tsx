import React from "react";
import { PreviewBadge } from "./PreviewBadge";
import { ApiError } from "@/lib/api-client";
import {
  PricingPreviewResponse,
  PricingFullResponse,
} from "@/lib/types";

interface ResultsPanelProps {
  microState: "pending" | "preview" | "error";
  previewResult: PricingPreviewResponse | null;
  fullResult: PricingFullResponse | null;
  error: ApiError | null;
  activeTier: "preview" | "full";
}

export function ResultsPanel({
  microState,
  previewResult,
  fullResult,
  error,
  activeTier,
}: ResultsPanelProps) {
  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-800 rounded-lg p-6 text-red-200">
        <h3 className="text-lg font-bold text-red-300 mb-2">Pricing Error</h3>
        <p className="text-sm font-mono">{error.message}</p>
        {error.field && (
          <p className="text-xs text-red-400 mt-2 font-mono">
            Invalid field: {error.field}
          </p>
        )}
      </div>
    );
  }

  // Display Full Simulation Results when active
  if (activeTier === "full" && fullResult) {
    const bs = fullResult.black_scholes;
    const stdMc = fullResult.mc_results.find((m) => m.method === "standard");

    return (
      <div className="space-y-6">
        {/* Tier Header */}
        <div className="flex items-center justify-between bg-gray-800/80 border border-gray-700 rounded-lg p-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Validated Pricing Results
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Computed under risk-neutral measure Q &bull; Seed: {fullResult.request_echo.seed}
            </p>
          </div>
          <PreviewBadge
            tier="full"
            nSimulations={fullResult.request_echo.n_simulations}
            computeMs={fullResult.compute_ms}
          />
        </div>

        {/* Headline Price Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 border border-blue-900/60 rounded-lg p-5">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">
              Black-Scholes Benchmark
            </span>
            <div className="text-3xl font-extrabold text-white font-mono">
              ${bs.price.toFixed(4)}
            </div>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              Analytical closed-form price
            </p>
          </div>

          <div className="bg-gray-800/60 border border-emerald-900/60 rounded-lg p-5">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">
              Monte Carlo (Standard)
            </span>
            <div className="text-3xl font-extrabold text-emerald-300 font-mono">
              ${stdMc ? stdMc.price.toFixed(4) : "N/A"}
            </div>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              SE: ±${stdMc ? stdMc.standard_error.toFixed(4) : "0.0000"}
            </p>
          </div>
        </div>

        {/* Analytical Greeks */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5">
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">
            Analytical Greeks (Black-Scholes)
          </h3>
          <div className="grid grid-cols-5 gap-2 text-center font-mono">
            <div className="bg-gray-950 p-2.5 rounded border border-gray-800">
              <span className="text-[10px] text-gray-500 block">Delta (Δ)</span>
              <span className="text-sm font-bold text-white">
                {bs.greeks.delta.toFixed(4)}
              </span>
            </div>
            <div className="bg-gray-950 p-2.5 rounded border border-gray-800">
              <span className="text-[10px] text-gray-500 block">Gamma (Γ)</span>
              <span className="text-sm font-bold text-white">
                {bs.greeks.gamma.toFixed(5)}
              </span>
            </div>
            <div className="bg-gray-950 p-2.5 rounded border border-gray-800">
              <span className="text-[10px] text-gray-500 block">Vega (ν)</span>
              <span className="text-sm font-bold text-white">
                {bs.greeks.vega.toFixed(4)}
              </span>
            </div>
            <div className="bg-gray-950 p-2.5 rounded border border-gray-800">
              <span className="text-[10px] text-gray-500 block">Theta (θ/day)</span>
              <span className="text-sm font-bold text-white">
                {bs.greeks.theta.toFixed(4)}
              </span>
            </div>
            <div className="bg-gray-950 p-2.5 rounded border border-gray-800">
              <span className="text-[10px] text-gray-500 block">Rho (ρ)</span>
              <span className="text-sm font-bold text-white">
                {bs.greeks.rho.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* MC Estimators Table */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5">
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">
            Monte Carlo Variance Reduction Estimators
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-gray-950 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="p-2">Method</th>
                  <th className="p-2 text-right">Price</th>
                  <th className="p-2 text-right">Std Error (SE)</th>
                  <th className="p-2 text-center">95% Confidence Interval</th>
                  <th className="p-2 text-right">Runtime (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-200">
                {fullResult.mc_results.map((mc) => (
                  <tr key={mc.method} className="hover:bg-gray-800/40">
                    <td className="p-2 font-bold capitalize text-blue-300">
                      {mc.method.replace("_", " ")}
                    </td>
                    <td className="p-2 text-right font-bold text-white">
                      ${mc.price.toFixed(4)}
                    </td>
                    <td className="p-2 text-right text-yellow-400">
                      ±${mc.standard_error.toFixed(4)}
                    </td>
                    <td className="p-2 text-center text-gray-400">
                      [${mc.ci_lower.toFixed(2)}, ${mc.ci_upper.toFixed(2)}]
                    </td>
                    <td className="p-2 text-right text-gray-400">
                      {mc.runtime_ms.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Display Indicative Preview Results
  return (
    <div className="space-y-6">
      {/* Tier Header */}
      <div className="flex items-center justify-between bg-gray-800/80 border border-gray-700 rounded-lg p-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Indicative Preview
          </h2>
          <p className="text-xs text-gray-400 font-mono">
            Fast debounced estimate (&le; 10k simulations) &bull; Run full simulation for validated pricing
          </p>
        </div>
        <PreviewBadge
          tier={microState}
          nSimulations={previewResult?.n_simulations ?? 10000}
          computeMs={previewResult?.compute_ms}
        />
      </div>

      {previewResult ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-800/40 border border-gray-700/80 rounded-lg p-5">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Black-Scholes (Indicative)
            </span>
            <div className="text-3xl font-extrabold text-gray-200 font-mono">
              ${previewResult.black_scholes.price.toFixed(2)}
            </div>
            <div className="mt-3 flex gap-4 text-xs font-mono text-gray-400">
              <span>Δ: {previewResult.black_scholes.delta.toFixed(4)}</span>
              <span>Γ: {previewResult.black_scholes.gamma.toFixed(5)}</span>
            </div>
          </div>

          <div className="bg-gray-800/40 border border-gray-700/80 rounded-lg p-5">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Standard MC (Indicative)
            </span>
            <div className="text-3xl font-extrabold text-gray-200 font-mono">
              ${previewResult.monte_carlo_standard.price.toFixed(2)}
            </div>
            <div className="mt-3 flex gap-4 text-xs font-mono text-gray-400">
              <span>Δ: {previewResult.monte_carlo_standard.delta.toFixed(4)}</span>
              <span>Γ: {previewResult.monte_carlo_standard.gamma.toFixed(5)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-8 text-center text-gray-400 font-mono text-sm">
          Loading preview pricing estimate...
        </div>
      )}
    </div>
  );
}
