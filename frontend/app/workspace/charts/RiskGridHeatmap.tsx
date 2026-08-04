"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  PricingRequest,
  RiskGridAxis,
  RiskGridMetric,
  RiskGridRequest,
  RiskGridResponse,
} from "@/lib/types";
import { postRiskGrid, ApiError } from "@/lib/api-client";
import { formatPercent, formatPrice } from "@/lib/formatters";

interface RiskGridHeatmapProps {
  request: PricingRequest;
}

type PresetMode = "spot_vol" | "strike_expiry" | "custom";

const PARAM_LABELS: Record<RiskGridAxis, string> = {
  spot: "Spot Price (S₀)",
  strike: "Strike Price (K)",
  volatility: "Volatility (σ)",
  time_to_expiry: "Time to Expiry (T)",
  rate: "Risk-Free Rate (r)",
};

const METRIC_LABELS: Record<RiskGridMetric, string> = {
  price: "Option Price",
  delta: "Delta (Δ)",
  gamma: "Gamma (Γ)",
  vega: "Vega (ν)",
  theta: "Theta (θ/day)",
  rho: "Rho (ρ)",
};

export function RiskGridHeatmap({ request }: RiskGridHeatmapProps) {
  const [preset, setPreset] = useState<PresetMode>("spot_vol");
  const [metric, setMetric] = useState<RiskGridMetric>("price");

  const [axisX, setAxisX] = useState<RiskGridAxis>("spot");
  const [axisY, setAxisY] = useState<RiskGridAxis>("volatility");

  const spotBase = request.spot_override ?? 100;
  const strikeBase = request.strike;
  const volBase = request.volatility;

  // Custom Axis ranges
  const [xMin, setXMin] = useState<number>(Math.round(spotBase * 0.8));
  const [xMax, setXMax] = useState<number>(Math.round(spotBase * 1.2));
  const [yMin, setYMin] = useState<number>(Math.max(0.05, Math.round((volBase - 0.1) * 100) / 100));
  const [yMax, setYMax] = useState<number>(Math.round((volBase + 0.1) * 100) / 100);

  const [gridData, setGridData] = useState<RiskGridResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [hoveredCell, setHoveredCell] = useState<{
    x: number;
    y: number;
    val: number;
    i: number;
    j: number;
  } | null>(null);

  // Re-derive axis ranges when the underlying request parameters change.
  useEffect(() => {
    if (preset === "spot_vol") {
      setXMin(Math.round(spotBase * 0.8));
      setXMax(Math.round(spotBase * 1.2));
      setYMin(Math.max(0.02, Math.round((volBase * 0.5) * 100) / 100));
      setYMax(Math.round((volBase * 1.5) * 100) / 100);
    } else if (preset === "strike_expiry") {
      setXMin(Math.round(strikeBase * 0.8));
      setXMax(Math.round(strikeBase * 1.2));
      setYMin(0.1);
      setYMax(2.0);
    }
  }, [preset, spotBase, strikeBase, volBase]);

  // Update presets
  const handlePresetChange = (newPreset: PresetMode) => {
    setPreset(newPreset);
    if (newPreset === "spot_vol") {
      setAxisX("spot");
      setAxisY("volatility");
      setXMin(Math.round(spotBase * 0.8));
      setXMax(Math.round(spotBase * 1.2));
      setYMin(Math.max(0.02, Math.round((volBase * 0.5) * 100) / 100));
      setYMax(Math.round((volBase * 1.5) * 100) / 100);
    } else if (newPreset === "strike_expiry") {
      setAxisX("strike");
      setAxisY("time_to_expiry");
      setXMin(Math.round(strikeBase * 0.8));
      setXMax(Math.round(strikeBase * 1.2));
      setYMin(0.1);
      setYMax(2.0);
    }
  };

  const fetchGrid = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const gridReq: RiskGridRequest = {
        ticker: request.ticker,
        market: request.market,
        spot_override: request.spot_override,
        strike: request.strike,
        expiry_date: request.expiry_date,
        option_type: request.option_type,
        volatility: request.volatility,
        risk_free_rate: request.risk_free_rate,
        dividend_yield: request.dividend_yield,
        axis_x: axisX,
        axis_y: axisY,
        x_range: { min: xMin, max: xMax, num_points: 25 },
        y_range: { min: yMin, max: yMax, num_points: 25 },
        metric: metric,
      };
      const data = await postRiskGrid(gridReq);
      setGridData(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to compute risk grid surface.");
      } else {
        setError("Error connecting to backend pricer.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [request, axisX, axisY, xMin, xMax, yMin, yMax, metric]);

  // Color mapping bounds & color scale
  const { minVal, maxVal } = useMemo(() => {
    if (!gridData || !gridData.grid || gridData.grid.length === 0) {
      return { minVal: 0, maxVal: 1 };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const row of gridData.grid) {
      for (const val of row) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    return { minVal: min, maxVal: max === min ? min + 1 : max };
  }, [gridData]);

  // Color interpolator (Slate -> Indigo -> Teal -> Amber -> Rose/Emerald)
  const getCellColor = (val: number) => {
    if (!Number.isFinite(val)) return "#3b4252"; // invalid cell -> neutral grey
    const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    // Interpolate between dark slate (0%) and vibrant teal/amber (100%)
    const hue = (1 - norm) * 240; // 240 (blue) down to 0 (red) or 160 (emerald) to 40 (amber)
    const lightness = 25 + norm * 35; // 25% to 60%
    return `hsl(${hue}, 80%, ${lightness}%)`;
  };

  const formatAxisVal = (axis: RiskGridAxis, val: number) => {
    if (axis === "spot" || axis === "strike") return `$${val.toFixed(1)}`;
    if (axis === "volatility" || axis === "rate") return `${(val * 100).toFixed(1)}%`;
    if (axis === "time_to_expiry") return `${val.toFixed(2)}y`;
    return val.toFixed(2);
  };

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-6 space-y-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#21262d] pb-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-[#58a6ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> 2D Risk Surface Heatmap</span>
          </h3>
          <p className="text-xs text-[#8b949e] mt-0.5">
            Vectorized Black-Scholes surface evaluation across 2D parameter grid (25×25)
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex bg-[#0d1117] p-1 rounded-lg border border-[#21262d] gap-1">
          <button
            type="button"
            onClick={() => handlePresetChange("spot_vol")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              preset === "spot_vol"
                ? "bg-[#58a6ff]/20 text-[#58a6ff] font-bold shadow"
                : "text-[#8b949e] hover:text-white"
            }`}
          >
            Spot × Vol (Classic)
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange("strike_expiry")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              preset === "strike_expiry"
                ? "bg-[#58a6ff]/20 text-[#58a6ff] font-bold shadow"
                : "text-[#8b949e] hover:text-white"
            }`}
          >
            Strike × Expiry
          </button>
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              preset === "custom"
                ? "bg-[#58a6ff]/20 text-[#58a6ff] font-bold shadow"
                : "text-[#8b949e] hover:text-white"
            }`}
          >
            Custom Grid
          </button>
        </div>
      </div>

      {/* Metric Selector & Axis Configurator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0d1117]/60 p-4 rounded-lg border border-[#21262d]">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#8b949e] mb-1">
            Target Metric
          </label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as RiskGridMetric)}
            className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs font-mono text-white"
          >
            {Object.entries(METRIC_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {preset === "custom" && (
          <>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8b949e] mb-1">
                X-Axis Parameter
              </label>
              <select
                value={axisX}
                onChange={(e) => setAxisX(e.target.value as RiskGridAxis)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs font-mono text-white"
              >
                {Object.entries(PARAM_LABELS)
                  .filter(([k]) => k !== axisY)
                  .map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8b949e] mb-1">
                Y-Axis Parameter
              </label>
              <select
                value={axisY}
                onChange={(e) => setAxisY(e.target.value as RiskGridAxis)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs font-mono text-white"
              >
                {Object.entries(PARAM_LABELS)
                  .filter(([k]) => k !== axisX)
                  .map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={fetchGrid}
        disabled={isLoading}
        className="w-full px-4 py-2.5 text-xs font-mono font-bold rounded bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/40 hover:bg-[#58a6ff]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60"
      >
        {isLoading ? "Computing 25×25 surface..." : gridData ? "Recompute Grid" : "Compute Risk Grid"}
      </button>

      {/* Error state */}
      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-300 text-xs p-3 rounded-lg font-mono">
          <svg className="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Grid Computation Rejected: {error}
        </div>
      )}

      {/* Heatmap Area */}
      {isLoading ? (
        <div className="h-[400px] flex items-center justify-center bg-[#0d1117]/50 rounded-lg border border-[#21262d]">
          <div className="text-xs text-[#58a6ff] font-mono animate-pulse">
            <svg className="inline w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Evaluating vectorized 2D Black-Scholes meshgrid...
          </div>
        </div>
      ) : gridData ? (
        <div className="flex flex-col gap-3">
          {/* Hover Tooltip — inline bar above heatmap */}
          <div className="bg-[#0d1117] border border-[#21262d] px-4 py-2 rounded-lg flex items-center justify-between text-xs font-mono min-h-[36px]">
            <span className="text-[#8b949e]">
              {hoveredCell
                ? `${PARAM_LABELS[axisX]} = ${formatAxisVal(axisX, hoveredCell.x)}, ${PARAM_LABELS[axisY]} = ${formatAxisVal(axisY, hoveredCell.y)}`
                : "Hover over any grid cell to inspect"}
            </span>
            <span className="text-[#58a6ff] font-bold tabular-nums">
              {hoveredCell ? `${METRIC_LABELS[metric]}: ${hoveredCell.val.toFixed(4)}` : ""}
            </span>
          </div>

          {/* Heatmap + Colorbar row */}
          <div className="flex gap-3 items-stretch">
            {/* Y-axis label */}
            <div className="flex flex-col items-center justify-center min-w-[28px]">
              <span className="text-[10px] font-mono font-bold text-[#8b949e] whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                {PARAM_LABELS[axisY]}
              </span>
            </div>

            {/* Y tick labels + Grid */}
            <div className="flex-1 min-w-0 overflow-x-auto">
              <div className="flex min-w-[500px]">
                {/* Y-axis tick labels — 5 ticks aligned to grid rows */}
                <div className="flex flex-col justify-between py-[3px] text-[10px] font-mono text-[#8b949e] text-right w-14 shrink-0 select-none">
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                    const idx = Math.round(frac * (gridData.y_values.length - 1));
                    return <span key={frac}>{formatAxisVal(axisY, gridData.y_values[idx])}</span>;
                  })}
                </div>

                {/* Grid cells */}
                <div className="flex-1 min-w-0">
                  <div
                    className="grid gap-[1px] bg-[#0d1117] p-[3px] rounded-lg border border-[#21262d] w-full"
                    style={{ gridTemplateColumns: `repeat(${gridData.x_values.length}, minmax(0, 1fr))`, aspectRatio: "1.6" }}
                  >
                    {gridData.grid
                      .slice()
                      .reverse()
                      .map((row, rowRevIdx) => {
                        const j = gridData.grid.length - 1 - rowRevIdx;
                        const yVal = gridData.y_values[j];
                        return row.map((cellVal, i) => {
                          const xVal = gridData.x_values[i];
                          return (
                            <div
                              key={`${j}-${i}`}
                              onMouseEnter={() => setHoveredCell({ x: xVal, y: yVal, val: cellVal, i, j })}
                              onMouseLeave={() => setHoveredCell(null)}
                              style={{ backgroundColor: getCellColor(cellVal) }}
                              className="w-full h-full rounded-[1px] transition-transform hover:scale-[1.3] hover:z-10 hover:shadow-lg cursor-pointer min-h-[8px]"
                            />
                          );
                        });
                      })}
                  </div>

                  {/* X-axis tick labels — 5 ticks below grid */}
                  <div className="flex justify-between px-[3px] mt-1 text-[10px] font-mono text-[#8b949e] select-none">
                    {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                      const idx = Math.round(frac * (gridData.x_values.length - 1));
                      return <span key={frac}>{formatAxisVal(axisX, gridData.x_values[idx])}</span>;
                    })}
                  </div>

                  {/* X-axis title */}
                  <div className="text-center text-[10px] font-mono font-bold text-[#8b949e] mt-1 select-none">
                    {PARAM_LABELS[axisX]}
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Colorbar */}
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
            Configure the axes and metric, then press "Compute Risk Grid" to evaluate the 2D surface.
          </div>
        </div>
      )}
    </div>
  );
}
