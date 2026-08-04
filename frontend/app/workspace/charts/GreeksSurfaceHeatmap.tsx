"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  GreeksMetric,
  GreeksSurfaceRequest,
  GreeksSurfaceResponse,
  OptionType,
  PricingRequest,
} from "@/lib/types";
import { postGreeksSurface, ApiError } from "@/lib/api-client";
import { formatPrice } from "@/lib/formatters";
import { HeatmapGrid } from "./HeatmapGrid";

interface GreeksSurfaceHeatmapProps {
  request: PricingRequest;
}

const METRIC_LABELS: Record<GreeksMetric, string> = {
  price: "Option Price",
  delta: "Delta (Δ)",
  gamma: "Gamma (Γ)",
  vega: "Vega (ν)",
  theta: "Theta (θ/day)",
  rho: "Rho (ρ)",
};

export function GreeksSurfaceHeatmap({ request }: GreeksSurfaceHeatmapProps) {
  const [metric, setMetric] = useState<GreeksMetric>("delta");
  const [optionType, setOptionType] = useState<OptionType>("call");

  const [data, setData] = useState<GreeksSurfaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [hoveredCell, setHoveredCell] = useState<{
    x: number;
    y: number;
    val: number;
    i: number;
    j: number;
  } | null>(null);

  // Clear stale surface data when the underlying request parameters change.
  useEffect(() => {
    setData(null);
    setError(null);
  }, [request.ticker, request.market, request.spot_override, request.risk_free_rate, request.dividend_yield]);

  const fetchGrid = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const req: GreeksSurfaceRequest = {
        ticker: request.ticker,
        market: request.market,
        spot_override: request.spot_override,
        risk_free_rate: request.risk_free_rate,
        dividend_yield: request.dividend_yield,
        expiries: null,
        max_expiries: 6,
        metric,
        option_type: optionType,
        num_strikes: 25,
        strike_min_pct: 0.7,
        strike_max_pct: 1.3,
      };
      setData(await postGreeksSurface(req));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to compute Greeks surface.");
      } else {
        setError("Error connecting to backend quant API.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [request, metric, optionType]);

  const { minVal, maxVal } = useMemo(() => {
    if (!data || !data.grid || data.grid.length === 0) {
      return { minVal: 0, maxVal: 1 };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const row of data.grid) {
      for (const val of row) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    return { minVal: min, maxVal: max === min ? min + 1 : max };
  }, [data]);

  const getCellColor = (val: number) => {
    if (!Number.isFinite(val)) return "#3b4252"; // invalid cell -> neutral grey
    const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    const hue = (1 - norm) * 240;
    const lightness = 25 + norm * 35;
    return `hsl(${hue}, 80%, ${lightness}%)`;
  };

  const formatCell = (val: number) => {
    if (metric === "price") return formatPrice(val);
    if (metric === "delta") return val.toFixed(3);
    return val.toFixed(4);
  };

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-6 space-y-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#21262d] pb-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-[#58a6ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Greeks Surface Heatmap</span>
          </h3>
          <p className="text-xs text-[#8b949e] mt-0.5">
            {data
              ? `Greek across strikes × expiries at market SVI vols (${data.x_values.length}×${data.y_values.length})`
              : "Vectorized Black-Scholes on the fitted market SVI surface (strike × expiry grid)"}
          </p>
        </div>

        {data && (
          <div className="text-[10px] font-mono text-[#8b949e] bg-[#0d1117] border border-[#21262d] rounded px-3 py-1">
            {data.resolved_symbol} · Spot {formatPrice(data.spot)} · {data.option_type} ·{" "}
            {METRIC_LABELS[data.metric as GreeksMetric] ?? data.metric}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0d1117]/60 p-4 rounded-lg border border-[#21262d]">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#8b949e] mb-1">
            Target Metric
          </label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as GreeksMetric)}
            aria-label="Target Greek metric"
            className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs font-mono text-white"
          >
            {Object.entries(METRIC_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#8b949e] mb-1">
            Option Type
          </label>
          <select
            value={optionType}
            onChange={(e) => setOptionType(e.target.value as OptionType)}
            aria-label="Option type"
            className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs font-mono text-white"
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={fetchGrid}
        disabled={isLoading}
        className="w-full px-4 py-2.5 text-xs font-mono font-bold rounded bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/40 hover:bg-[#58a6ff]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60"
      >
        {isLoading ? "Pricing on market surface..." : data ? "Recompute Surface" : "Compute Greeks Surface"}
      </button>

      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-300 text-xs p-3 rounded-lg font-mono">
          Greeks Surface Rejected: {error}
        </div>
      )}

      {data && data.warnings.length > 0 && (
        <div className="bg-yellow-950/30 border border-yellow-800/50 text-yellow-200/80 text-xs p-3 rounded-lg font-mono space-y-1">
          {data.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="h-[400px] flex items-center justify-center bg-[#0d1117]/50 rounded-lg border border-[#21262d]">
          <div className="text-xs text-[#58a6ff] font-mono animate-pulse">
            Evaluating vectorized Black-Scholes on SVI surface...
          </div>
        </div>
      ) : data && data.grid.length > 0 ? (
        <HeatmapGrid
          xValues={data.x_values}
          yValues={data.y_values}
          grid={data.grid}
          xLabel="Strike Price (K)"
          yLabel="Time to Expiry (yrs)"
          xTickFormat={(v) => formatPrice(v)}
          yTickFormat={(v) => `${v.toFixed(2)}y`}
          cellColor={getCellColor}
          minVal={minVal}
          maxVal={maxVal}
          metricLabel={METRIC_LABELS[metric]}
          hoveredCell={hoveredCell}
          onHoverCell={setHoveredCell}
          onLeaveCell={() => setHoveredCell(null)}
          hoverText={(c) => `Strike = ${formatPrice(c.x)}, T = ${c.y.toFixed(2)}y`}
          metricText={(val) => `${METRIC_LABELS[metric]}: ${formatCell(val)}`}
          cellTitle={(x, y, val) => `Strike ${formatPrice(x)}, T ${y.toFixed(2)}y: ${formatCell(val)}`}
        />
      ) : (
        <div className="h-[400px] flex items-center justify-center bg-[#0d1117]/50 rounded-lg border border-[#21262d]">
          <div className="text-xs text-[#8b949e] font-mono text-center px-6">
            Pick a metric and press "Compute Greeks Surface" to evaluate Black-Scholes at the fitted market SVI vols.
          </div>
        </div>
      )}
    </div>
  );
}
