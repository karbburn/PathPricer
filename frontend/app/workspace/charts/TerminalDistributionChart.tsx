"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { PricingFullResponse } from "@/lib/types";

interface TerminalDistributionChartProps {
  fullResult: PricingFullResponse;
}

export function TerminalDistributionChart({ fullResult }: TerminalDistributionChartProps) {
  const sample = fullResult.terminal_distribution_sample;
  const req = fullResult.request_echo;

  const chartData = useMemo(() => {
    if (!sample || sample.length === 0) return [];

    const numBins = 35;
    const minVal = Math.min(...sample);
    const maxVal = Math.max(...sample);
    const binWidth = (maxVal - minVal) / numBins;

    // Bin empirical terminal prices
    const bins = Array.from({ length: numBins }, (_, i) => {
      const xStart = minVal + i * binWidth;
      const xEnd = xStart + binWidth;
      const xMid = xStart + binWidth / 2;
      return {
        xMid: Number(xMid.toFixed(2)),
        xStart,
        xEnd,
        count: 0,
      };
    });

    sample.forEach((val) => {
      let idx = Math.floor((val - minVal) / binWidth);
      if (idx >= numBins) idx = numBins - 1;
      if (idx < 0) idx = 0;
      bins[idx].count += 1;
    });

    // Compute empirical probability density height for histogram
    // density = count / (N * binWidth)
    const totalN = sample.length;

    const today = new Date();
    const expiry = new Date(req.expiry_date);
    const T = Math.max(0.0833, (expiry.getTime() - today.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const S0 = req.spot_override ?? 100.0;
    const r = req.risk_free_rate;
    const q = req.dividend_yield ?? 0.0;
    const sigma = req.volatility;

    const muLn = Math.log(S0) + (r - q - 0.5 * sigma * sigma) * T;
    const varLn = sigma * sigma * T;
    const stdLn = Math.sqrt(varLn);

    return bins.map((bin) => {
      const empiricalDensity = bin.count / (totalN * binWidth);

      // Theoretical log-normal PDF p(S_T)
      let theoreticalDensity = 0;
      if (bin.xMid > 0 && stdLn > 0) {
        const lnX = Math.log(bin.xMid);
        const z = (lnX - muLn) / stdLn;
        theoreticalDensity =
          (1.0 / (bin.xMid * stdLn * Math.sqrt(2 * Math.PI))) *
          Math.exp(-0.5 * z * z);
      }

      return {
        price: bin.xMid,
        count: bin.count,
        empiricalDensity: Number(empiricalDensity.toFixed(5)),
        theoreticalDensity: Number(theoreticalDensity.toFixed(5)),
      };
    });
  }, [sample, req]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider">
            Terminal Price Distribution ($S_T$) &amp; Log-Normal Density Overlay
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Empirical histogram vs Black-Scholes theoretical $p(S_T)$ curve (Validation Visual)
          </p>
        </div>
        <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-1 rounded font-mono">
          Sample: {sample.length.toLocaleString()} paths (Downsampled)
        </span>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <XAxis
              dataKey="price"
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `$${v}`}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => v.toFixed(3)}
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
                Number(val).toFixed(5),
                name === "empiricalDensity"
                  ? "Empirical Density"
                  : "BS Log-Normal Density",
              ]}
            />
            <ReferenceLine
              x={req.strike}
              stroke="#e11d48"
              strokeDasharray="4 4"
              label={{ value: `Strike $${req.strike}`, fill: "#e11d48", fontSize: 10, position: "top" }}
            />
            {/* Histogram Bars */}
            <Bar dataKey="empiricalDensity" fill="#1e293b" stroke="#334155" radius={[2, 2, 0, 0]} />
            {/* Theoretical Log-Normal Density Overlay Curve */}
            <Line
              type="monotone"
              dataKey="theoreticalDensity"
              stroke="#06b6d4"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-slate-500 font-mono bg-slate-950 p-2.5 rounded border border-slate-800 flex justify-between items-center">
        <span>
          Note: Downsampled sample capped at 5,000 terminal prices for API performance.
        </span>
        <span className="text-cyan-400 font-semibold">Cyan Curve = Theoretical BS PDF</span>
      </div>
    </div>
  );
}
