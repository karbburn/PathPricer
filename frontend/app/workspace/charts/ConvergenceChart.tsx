"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
} from "recharts";
import { PricingFullResponse } from "@/lib/types";

interface ConvergenceChartProps {
  fullResult: PricingFullResponse;
}

interface ZoomArea {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function ConvergenceChart({ fullResult }: ConvergenceChartProps) {
  const dataPoints = fullResult.convergence_data;
  const fit = fullResult.convergence_fit;

  const { chartData, minLogN, maxLogN } = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) {
      return { chartData: [], minLogN: 3, maxLogN: 6 };
    }

    const logNValues = dataPoints.map((p) => Math.log10(p.n));
    const minLog = Math.floor(Math.min(...logNValues));
    const maxLog = Math.ceil(Math.max(...logNValues));

    const pts = dataPoints.map((p) => ({
      ln: Math.log10(p.n),
      lse: p.standard_error > 0 ? Math.log10(p.standard_error) : -4,
    }));
    const meanLn = pts.reduce((s, p) => s + p.ln, 0) / pts.length;
    const meanLse = pts.reduce((s, p) => s + p.lse, 0) / pts.length;
    const intercept = meanLse - fit.slope * meanLn;

    const formattedData = dataPoints.map((p) => {
      const logN = Math.log10(p.n);
      const logSe = p.standard_error > 0 ? Math.log10(p.standard_error) : -4;
      const fittedLogSe = fit.slope * logN + intercept;

      return {
        n: p.n,
        logN: Number(logN.toFixed(2)),
        se: p.standard_error,
        logSe: Number(logSe.toFixed(3)),
        fittedLogSe: Number(fittedLogSe.toFixed(3)),
      };
    });

    return { chartData: formattedData, minLogN: minLog, maxLogN: maxLog };
  }, [dataPoints, fit]);

  const [zoom, setZoom] = useState<ZoomArea | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);

  const zoomedData = useMemo(() => {
    if (!zoom) return chartData;
    const xMin = Math.min(zoom.x1, zoom.x2);
    const xMax = Math.max(zoom.x1, zoom.x2);
    const yMin = Math.min(zoom.y1, zoom.y2);
    const yMax = Math.max(zoom.y1, zoom.y2);
    return chartData.filter(
      (d) => d.logN >= xMin && d.logN <= xMax && d.logSe >= yMin && d.logSe <= yMax
    );
  }, [chartData, zoom]);

  const handleMouseDown = useCallback((e: { activeLabel?: string | number }) => {
    if (e.activeLabel != null) setRefAreaLeft(String(e.activeLabel));
  }, []);

  const handleMouseMove = useCallback((e: { activeLabel?: string | number }) => {
    if (refAreaLeft && e.activeLabel != null) {
      setRefAreaRight(String(e.activeLabel));
    }
  }, [refAreaLeft]);

  const handleMouseUp = useCallback(() => {
    if (!refAreaLeft || !refAreaRight || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    const left = Math.min(Number(refAreaLeft), Number(refAreaRight));
    const right = Math.max(Number(refAreaLeft), Number(refAreaRight));
    const pointsInZoom = chartData.filter((d) => d.logN >= left && d.logN <= right);
    if (pointsInZoom.length < 2) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    const yMin = Math.min(...pointsInZoom.map((d) => d.logSe));
    const yMax = Math.max(...pointsInZoom.map((d) => d.logSe));
    setZoom({ x1: left, y1: yMin, x2: right, y2: yMax });
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, chartData]);

  const handleResetZoom = useCallback(() => {
    setZoom(null);
  }, []);

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#58a6ff] uppercase tracking-wider">
            Monte Carlo Empirical Convergence Rate ($\log \widehat{"{"}SE{"}"}$ vs $\log N$)
          </h3>
          <p className="text-xs text-[#6e7681] font-mono mt-0.5">
            Log-log regression fit verifying theoretical $\mathcal{"{"}O{"}"}(N^{-1/2})$ error reduction rate
          </p>
        </div>
        <div className="text-right">
          <span className="text-sm font-extrabold font-mono text-[#79c0ff] block">
            Slope = {fit.slope.toFixed(3)}
          </span>
          <span className="text-xs text-[#6e7681] font-mono">
            R&sup2; = {fit.r_squared.toFixed(3)} &bull; Target: -0.500
          </span>
        </div>
      </div>

      {zoom && (
        <button
          type="button"
          onClick={handleResetZoom}
          className="text-xs font-mono text-[#58a6ff] hover:text-[#79c0ff] border border-[#21262d] rounded px-2 py-1 transition-colors"
        >
          Reset zoom
        </button>
      )}

      <div className="h-[380px] w-full chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={zoomedData}
            margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleResetZoom}
          >
            <XAxis
              dataKey="logN"
              type="number"
              domain={zoom ? [zoom.x1, zoom.x2] : [minLogN, maxLogN]}
              stroke="#6e7681"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `10^${v}`}
              label={{ value: "log10(N)", position: "bottom", fill: "#6e7681", fontSize: 10 }}
            />
            <YAxis
              dataKey="logSe"
              type="number"
              domain={zoom ? [zoom.y1, zoom.y2] : ["auto", "auto"]}
              stroke="#6e7681"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `10^${v.toFixed(1)}`}
              label={{ value: "log10(SE)", angle: -90, position: "left", fill: "#6e7681", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0d1117",
                borderColor: "#21262d",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#e2e8f0",
              }}
              cursor={{ stroke: "#58a6ff", strokeWidth: 1, strokeDasharray: "4 4" }}
              formatter={(val: unknown, name: unknown) => [
                Number(val).toFixed(4),
                name === "logSe" ? "Empirical log10(SE)" : "Fitted log10(SE)",
              ]}
            />

            <Scatter name="logSe" dataKey="logSe" fill="#58a6ff" />

            <Line
              type="linear"
              dataKey="fittedLogSe"
              stroke="#e11d48"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />

            {refAreaLeft && refAreaRight && (
              <ReferenceArea
                x1={Number(refAreaLeft)}
                x2={Number(refAreaRight)}
                strokeOpacity={0.3}
                fill="#58a6ff"
                fillOpacity={0.1}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-[#6e7681] font-mono bg-[#0d1117] p-2.5 rounded border border-[#21262d] flex justify-between items-center">
        <span>
          Theoretical Central Limit Theorem bound dictates slope = -0.500 ($\widehat{"{"}SE{"}"} \propto N^{-0.5}$).
        </span>
        <span className={`font-bold ${Math.abs(fit.slope - (-0.5)) <= 0.05 ? "text-[#3fb950]" : "text-[#58a6ff]"}`}>
          {Math.abs(fit.slope - (-0.5)) <= 0.05 ? "✓ Validated O(N⁻¹/²) Fit" : "High Sampling Noise"}
        </span>
      </div>
    </div>
  );
}
