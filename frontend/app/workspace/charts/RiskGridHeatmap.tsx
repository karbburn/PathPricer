"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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

  useEffect(() => {
    fetchGrid();
  }, [fetchGrid]);

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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> 2D Risk Surface Heatmap</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Vectorized Black-Scholes surface evaluation across 2D parameter grid (25×25)
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => handlePresetChange("spot_vol")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              preset === "spot_vol"
                ? "bg-cyan-500 text-slate-950 font-bold shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Spot × Vol (Classic)
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange("strike_expiry")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              preset === "strike_expiry"
                ? "bg-cyan-500 text-slate-950 font-bold shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Strike × Expiry
          </button>
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              preset === "custom"
                ? "bg-teal-600 text-white font-bold shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Custom Grid
          </button>
        </div>
      </div>

      {/* Metric Selector & Axis Configurator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Target Metric
          </label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as RiskGridMetric)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-white"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                X-Axis Parameter
              </label>
              <select
                value={axisX}
                onChange={(e) => setAxisX(e.target.value as RiskGridAxis)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-white"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Y-Axis Parameter
              </label>
              <select
                value={axisY}
                onChange={(e) => setAxisY(e.target.value as RiskGridAxis)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-white"
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

      {/* Error state */}
      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-300 text-xs p-3 rounded-lg font-mono">
          <svg className="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Grid Computation Rejected: {error}
        </div>
      )}

      {/* Heatmap Area */}
      {isLoading ? (
        <div className="h-[380px] flex items-center justify-center bg-slate-950/50 rounded-lg border border-slate-800">
          <div className="text-xs text-teal-400 font-mono animate-pulse">
            <svg className="inline w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Evaluating vectorized 2D Black-Scholes meshgrid...
          </div>
        </div>
      ) : gridData ? (
        <div className="space-y-3">
          {/* Active Hover Tooltip Diagnostic Bar */}
          <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-lg flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              {hoveredCell
                ? `Cell Details: [${PARAM_LABELS[axisX]} = ${formatAxisVal(axisX, hoveredCell.x)}, ${
                    PARAM_LABELS[axisY]
                  } = ${formatAxisVal(axisY, hoveredCell.y)}]`
                : "Hover over any grid cell to view exact coordinates & metric value"}
            </span>
            <span className="text-cyan-400 font-bold">
              {hoveredCell ? `${METRIC_LABELS[metric]}: ${hoveredCell.val.toFixed(4)}` : ""}
            </span>
          </div>

          {/* 2D Heatmap Grid Container */}
          <div className="flex flex-col items-center">
            <div className="text-xs font-mono font-bold text-slate-400 mb-1">
              Y-Axis ↑ {PARAM_LABELS[axisY]}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-[10px] font-mono text-slate-500 flex flex-col justify-between h-64 text-right">
                <span>{formatAxisVal(axisY, gridData.y_values[gridData.y_values.length - 1])}</span>
                <span>{formatAxisVal(axisY, gridData.y_values[Math.floor(gridData.y_values.length / 2)])}</span>
                <span>{formatAxisVal(axisY, gridData.y_values[0])}</span>
              </div>

              {/* Grid Cells matrix */}
              <div
                className="grid gap-[1px] bg-slate-950 p-1 rounded-lg border border-slate-800 w-full max-w-xl h-64"
                style={{ gridTemplateColumns: "repeat(25, minmax(0, 1fr))" }}
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
                          onMouseEnter={() =>
                            setHoveredCell({ x: xVal, y: yVal, val: cellVal, i, j })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{ backgroundColor: getCellColor(cellVal) }}
                          className="w-full h-full rounded-[1px] transition-transform hover:scale-125 hover:z-10 hover:shadow-lg cursor-pointer"
                        />
                      );
                    });
                  })}
              </div>
            </div>

            <div className="text-xs font-mono font-bold text-slate-400 mt-1">
              X-Axis → {PARAM_LABELS[axisX]} ({formatAxisVal(axisX, gridData.x_values[0])} to{" "}
              {formatAxisVal(axisX, gridData.x_values[gridData.x_values.length - 1])})
            </div>
          </div>

          {/* Color Legend Bar */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-mono text-slate-400">
              Min: {minVal.toFixed(4)}
            </span>
            <div className="flex-1 max-w-md mx-4 h-3 rounded-full bg-gradient-to-r from-[hsl(240,80%,25%)] via-[hsl(120,80%,45%)] to-[hsl(0,80%,60%)] border border-slate-800" />
            <span className="text-xs font-mono text-slate-400">
              Max: {maxVal.toFixed(4)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
