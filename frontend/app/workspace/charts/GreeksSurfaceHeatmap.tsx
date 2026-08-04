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
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-[#58a6ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Greeks Surface Heatmap</span>
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
        <div className="flex flex-col gap-3">
          <div className="bg-[#0d1117] border border-[#21262d] px-4 py-2 rounded-lg flex items-center justify-between text-xs font-mono min-h-[36px]">
            <span className="text-[#8b949e]">
              {hoveredCell
                ? `Strike = ${formatPrice(hoveredCell.x)}, T = ${hoveredCell.y.toFixed(2)}y`
                : "Hover over any grid cell to inspect"}
            </span>
            <span className="text-[#58a6ff] font-bold tabular-nums">
              {hoveredCell ? `${METRIC_LABELS[metric]}: ${formatCell(hoveredCell.val)}` : ""}
            </span>
          </div>

          <div className="flex gap-3 items-stretch">
            <div className="flex flex-col items-center justify-center min-w-[28px]">
              <span className="text-[10px] font-mono font-bold text-[#8b949e] whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                Time to Expiry (yrs)
              </span>
            </div>

            <div className="flex-1 min-w-0 overflow-x-auto">
              <div className="flex min-w-[500px]">
                <div className="flex flex-col justify-between py-[3px] text-[10px] font-mono text-[#8b949e] text-right w-14 shrink-0 select-none">
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                    const idx = Math.round(frac * (data.y_values.length - 1));
                    return <span key={frac}>{data.y_values[idx].toFixed(2)}y</span>;
                  })}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className="grid gap-[1px] bg-[#0d1117] p-[3px] rounded-lg border border-[#21262d] w-full"
                    style={{ gridTemplateColumns: `repeat(${data.x_values.length}, minmax(0, 1fr))`, aspectRatio: "1.6" }}
                  >
                    {data.grid
                      .slice()
                      .reverse()
                      .map((row, rowRevIdx) => {
                        const j = data.grid.length - 1 - rowRevIdx;
                        const yVal = data.y_values[j];
                        return row.map((cellVal, i) => {
                          const xVal = data.x_values[i];
                          return (
                            <div
                              key={`${j}-${i}`}
                              onMouseEnter={() => setHoveredCell({ x: xVal, y: yVal, val: cellVal, i, j })}
                              onMouseLeave={() => setHoveredCell(null)}
                              style={{ backgroundColor: getCellColor(cellVal) }}
                              className="w-full h-full rounded-[1px] transition-transform hover:scale-[1.3] hover:z-10 hover:shadow-lg cursor-pointer min-h-[8px]"
                              title={`Strike ${formatPrice(xVal)}, T ${yVal.toFixed(2)}y: ${formatCell(cellVal)}`}
                            />
                          );
                        });
                      })}
                  </div>

                  <div className="flex justify-between px-[3px] mt-1 text-[10px] font-mono text-[#8b949e] select-none">
                    {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                      const idx = Math.round(frac * (data.x_values.length - 1));
                      return <span key={frac}>{formatPrice(data.x_values[idx])}</span>;
                    })}
                  </div>

                  <div className="text-center text-[10px] font-mono font-bold text-[#8b949e] mt-1 select-none">
                    Strike Price (K)
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center shrink-0 w-10 select-none">
              <span className="text-[9px] font-mono text-[#58a6ff] font-bold mb-1">{maxVal.toFixed(2)}</span>
              <div className="flex-1 w-3 rounded-full border border-[#21262d] overflow-hidden"
                   style={{ background: `linear-gradient(to bottom, hsl(0,80%,60%), hsl(60,80%,50%), hsl(120,80%,45%), hsl(180,80%,35%), hsl(240,80%,25%))` }}>
              </div>
              <span className="text-[9px] font-mono text-[#8b949e] mt-1">{minVal.toFixed(2)}</span>
              <span className="text-[8px] font-mono text-[#8b949e] mt-0.5">{METRIC_LABELS[metric]}</span>
            </div>
          </div>
        </div>
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
