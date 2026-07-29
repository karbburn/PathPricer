"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { PricingFullResponse } from "@/lib/types";

interface ConvergenceChartProps {
  fullResult: PricingFullResponse;
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider">
            Monte Carlo Empirical Convergence Rate ($\log \widehat{"{"}SE{"}"}$ vs $\log N$)
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Log-log regression fit verifying theoretical $\mathcal{"{"}O{"}"}(N^{-1/2})$ error reduction rate
          </p>
        </div>
        <div className="text-right">
          <span className="text-sm font-extrabold font-mono text-cyan-300 block">
            Slope = {fit.slope.toFixed(3)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            R&sup2; = {fit.r_squared.toFixed(3)} &bull; Target: -0.500
          </span>
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <XAxis
              dataKey="logN"
              type="number"
              domain={[minLogN, maxLogN]}
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `10^${v}`}
              label={{ value: "log10(N)", position: "bottom", fill: "#64748b", fontSize: 10 }}
            />
            <YAxis
              dataKey="logSe"
              type="number"
              domain={["auto", "auto"]}
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `10^${v.toFixed(1)}`}
              label={{ value: "log10(SE)", angle: -90, position: "left", fill: "#64748b", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#090d16",
                borderColor: "#1e293b",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#e2e8f0",
              }}
              formatter={(val: unknown, name: unknown) => [
                Number(val).toFixed(4),
                name === "logSe" ? "Empirical log10(SE)" : "Fitted log10(SE)",
              ]}
            />

            {/* Empirical Scatter Points */}
            <Scatter name="logSe" dataKey="logSe" fill="#06b6d4" />

            {/* Fitted Linear Regression Line */}
            <Line
              type="linear"
              dataKey="fittedLogSe"
              stroke="#e11d48"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-slate-500 font-mono bg-slate-950 p-2.5 rounded border border-slate-800 flex justify-between items-center">
        <span>
          Theoretical Central Limit Theorem bound dictates slope = -0.500 ($\widehat{"{"}SE{"}"} \propto N^{-0.5}$).
        </span>
        <span className={`font-bold ${Math.abs(fit.slope - (-0.5)) <= 0.05 ? "text-emerald-400" : "text-amber-400"}`}>
          {Math.abs(fit.slope - (-0.5)) <= 0.05 ? "✓ Validated O(N⁻¹/²) Fit" : "High Sampling Noise"}
        </span>
      </div>
    </div>
  );
}
