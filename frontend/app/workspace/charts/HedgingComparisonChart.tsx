"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ReferenceLine,
} from "recharts";
import { postHedgingCompare } from "@/lib/api-client";
import type {
  HedgingCompareRequest,
  HedgingCompareResponse,
} from "@/lib/types";

const DEFAULT_PARAMS = {
  S0: 100,
  K: 100,
  T: 0.25,
  r: 0.05,
  q: 0.0,
  option_type: "call" as const,
  heston_params: {
    v0: 0.04,
    kappa: 2.0,
    theta_v: 0.04,
    sigma_v: 0.5,
    rho: -0.7,
  },
  n_rebalance: 63,
  n_simulations: 500,
  tc_bps: 5.0,
  seed: 42,
};

function buildHistogram(errors: number[], nBins: number = 40) {
  if (errors.length === 0) return [];
  const min = Math.min(...errors);
  const max = Math.max(...errors);
  const range = max - min || 1;
  const binWidth = range / nBins;
  const bins: { center: number; bs: number; heston: number }[] = [];

  for (let i = 0; i < nBins; i++) {
    bins.push({
      center: min + (i + 0.5) * binWidth,
      bs: 0,
      heston: 0,
    });
  }

  for (const e of errors) {
    const idx = Math.min(Math.floor((e - min) / binWidth), nBins - 1);
    bins[idx].bs += 1;
  }
  return bins;
}

function mergeHistograms(bsErrors: number[], hestonErrors: number[], nBins: number = 40) {
  if (bsErrors.length === 0 || hestonErrors.length === 0) return [];
  const allMin = Math.min(Math.min(...bsErrors), Math.min(...hestonErrors));
  const allMax = Math.max(Math.max(...bsErrors), Math.max(...hestonErrors));
  const range = allMax - allMin || 1;
  const binWidth = range / nBins;

  const bins: { center: number; bs: number; heston: number }[] = [];
  for (let i = 0; i < nBins; i++) {
    bins.push({ center: allMin + (i + 0.5) * binWidth, bs: 0, heston: 0 });
  }
  for (const e of bsErrors) {
    const idx = Math.min(Math.floor((e - allMin) / binWidth), nBins - 1);
    bins[idx].bs += 1;
  }
  for (const e of hestonErrors) {
    const idx = Math.min(Math.floor((e - allMin) / binWidth), nBins - 1);
    bins[idx].heston += 1;
  }
  return bins;
}

export function HedgingComparisonChart() {
  const [result, setResult] = useState<HedgingCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [showForm, setShowForm] = useState(true);

  const runComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await postHedgingCompare(params as HedgingCompareRequest);
      setResult(res);
      setShowForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const histogram = result
    ? mergeHistograms(result.bs.errors, result.heston.errors)
    : [];

  const samplePath = result?.sample_paths?.[0];

  return (
    <div className="space-y-4">
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#58a6ff] uppercase tracking-wider">
            BS vs Heston Hedging Comparison
          </h3>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-mono text-[#8b949e] hover:text-white transition-colors"
          >
            {showForm ? "Hide" : "Edit"} params
          </button>
        </div>

        {showForm && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">Spot (S0)</span>
              <input
                type="number"
                value={params.S0}
                onChange={(e) => setParams({ ...params, S0: +e.target.value })}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">Strike (K)</span>
              <input
                type="number"
                value={params.K}
                onChange={(e) => setParams({ ...params, K: +e.target.value })}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">T (years)</span>
              <input
                type="number"
                step="0.05"
                value={params.T}
                onChange={(e) => setParams({ ...params, T: +e.target.value })}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">Rate (r)</span>
              <input
                type="number"
                step="0.005"
                value={params.r}
                onChange={(e) => setParams({ ...params, r: +e.target.value })}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">v0</span>
              <input
                type="number"
                step="0.01"
                value={params.heston_params.v0}
                onChange={(e) =>
                  setParams({
                    ...params,
                    heston_params: { ...params.heston_params, v0: +e.target.value },
                  })
                }
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">kappa</span>
              <input
                type="number"
                step="0.1"
                value={params.heston_params.kappa}
                onChange={(e) =>
                  setParams({
                    ...params,
                    heston_params: { ...params.heston_params, kappa: +e.target.value },
                  })
                }
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">sigma_v</span>
              <input
                type="number"
                step="0.05"
                value={params.heston_params.sigma_v}
                onChange={(e) =>
                  setParams({
                    ...params,
                    heston_params: { ...params.heston_params, sigma_v: +e.target.value },
                  })
                }
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">rho</span>
              <input
                type="number"
                step="0.05"
                value={params.heston_params.rho}
                onChange={(e) =>
                  setParams({
                    ...params,
                    heston_params: { ...params.heston_params, rho: +e.target.value },
                  })
                }
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">Rebalances</span>
              <input
                type="number"
                value={params.n_rebalance}
                onChange={(e) => setParams({ ...params, n_rebalance: +e.target.value })}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">Simulations</span>
              <input
                type="number"
                value={params.n_simulations}
                onChange={(e) => setParams({ ...params, n_simulations: +e.target.value })}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8b949e]">TC (bps)</span>
              <input
                type="number"
                step="0.5"
                value={params.tc_bps}
                onChange={(e) => setParams({ ...params, tc_bps: +e.target.value })}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-white"
              />
            </label>
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-300 text-xs p-3 rounded-lg font-mono">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={runComparison}
          disabled={loading}
          className="w-full bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/40 hover:bg-[#58a6ff]/30 text-xs font-mono font-bold py-2.5 rounded transition-colors disabled:opacity-50"
        >
          {loading ? "Running comparison..." : "Run Hedging Comparison"}
        </button>
      </div>

      {result && (
        <>
          {/* Variance ratio banner */}
          <div className={`rounded-lg p-4 border ${
            result.variance_pct_improvement > 0
              ? "bg-green-950/30 border-green-800/50 text-green-400"
              : "bg-red-950/30 border-red-800/50 text-red-400"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold">
                {result.variance_pct_improvement > 0
                  ? `Heston reduces hedging error variance by ${result.variance_pct_improvement.toFixed(1)}%`
                  : `BS hedging error variance is ${Math.abs(result.variance_pct_improvement).toFixed(1)}% lower`}
              </span>
              <span className="text-xs font-mono opacity-70">
                ratio: {result.variance_ratio.toFixed(3)}
              </span>
            </div>
          </div>

          {/* Stats table */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-bold text-[#f85149] uppercase tracking-wider">
                Black-Scholes (fixed IV = {(result.sigma_fixed * 100).toFixed(1)}%)
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[#8b949e] block">Variance</span>
                  <span className="text-white font-bold">{result.bs.variance.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">RMSE</span>
                  <span className="text-white font-bold">{result.bs.rmse.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">Max |Err|</span>
                  <span className="text-white font-bold">{result.bs.max_drawdown.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">Mean</span>
                  <span className="text-white font-bold">{result.bs.mean.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">Std</span>
                  <span className="text-white font-bold">{result.bs.std.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">Avg TC</span>
                  <span className="text-white font-bold">{result.bs.total_tc.toFixed(4)}</span>
                </div>
              </div>
            </div>
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-bold text-[#3fb950] uppercase tracking-wider">
                Heston (model-informed delta)
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[#8b949e] block">Variance</span>
                  <span className="text-white font-bold">{result.heston.variance.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">RMSE</span>
                  <span className="text-white font-bold">{result.heston.rmse.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">Max |Err|</span>
                  <span className="text-white font-bold">{result.heston.max_drawdown.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">Mean</span>
                  <span className="text-white font-bold">{result.heston.mean.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">Std</span>
                  <span className="text-white font-bold">{result.heston.std.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#8b949e] block">Avg TC</span>
                  <span className="text-white font-bold">{result.heston.total_tc.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Histogram */}
          {histogram.length > 0 && (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5">
              <h4 className="text-xs font-bold text-[#8b949e] uppercase tracking-wider mb-3">
                Hedging Error Distribution
              </h4>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={histogram}>
                  <XAxis
                    dataKey="center"
                    tick={{ fontSize: 10, fill: "#8b949e" }}
                    tickFormatter={(v: number) => v.toFixed(2)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#8b949e" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#161b22",
                      border: "1px solid #30363d",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    labelFormatter={(v) => `Error: ${Number(v).toFixed(4)}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine x={0} stroke="#30363d" strokeDasharray="3 3" />
                  <Bar dataKey="bs" name="Black-Scholes" fill="#f85149" fillOpacity={0.6} />
                  <Bar dataKey="heston" name="Heston" fill="#3fb950" fillOpacity={0.6} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Sample path: delta comparison */}
          {samplePath && (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5">
              <h4 className="text-xs font-bold text-[#8b949e] uppercase tracking-wider mb-3">
                Sample Path: Delta Comparison
              </h4>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart
                  data={samplePath.bs_delta.map((d, i) => ({
                    step: i,
                    bs: d,
                    heston: samplePath.heston_delta[i],
                  }))}
                >
                  <XAxis
                    dataKey="step"
                    tick={{ fontSize: 10, fill: "#8b949e" }}
                    label={{ value: "Rebalance step", position: "bottom", fontSize: 10, fill: "#8b949e" }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#8b949e" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#161b22",
                      border: "1px solid #30363d",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="bs" name="BS Delta" stroke="#f85149" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="heston" name="Heston Delta" stroke="#3fb950" dot={false} strokeWidth={1.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Timing */}
          <div className="text-[10px] font-mono text-[#8b949e] text-right">
            Sim: {result.timing_ms.simulation.toFixed(0)}ms · Hedge: {result.timing_ms.hedging.toFixed(0)}ms · Total: {result.timing_ms.total.toFixed(0)}ms
          </div>
        </>
      )}
    </div>
  );
}
