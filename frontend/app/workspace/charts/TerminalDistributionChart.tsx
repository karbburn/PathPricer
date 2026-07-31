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
  currencySymbol: string;
}

export function TerminalDistributionChart({ fullResult, currencySymbol }: TerminalDistributionChartProps) {
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
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#58a6ff] uppercase tracking-wider">
            Terminal Price Distribution ($S_T$) &amp; Log-Normal Density Overlay
          </h3>
          <p className="text-xs text-[#8b949e] font-mono mt-0.5">
            Empirical histogram vs Black-Scholes theoretical $p(S_T)$ curve (Validation Visual)
          </p>
        </div>
        <span className="text-xs bg-[#0d1117] border border-[#21262d] text-[#8b949e] px-2 py-1 rounded font-mono">
          Sample: {sample.length.toLocaleString()} paths (Downsampled)
        </span>
      </div>

      <div className="h-[380px] w-full chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <XAxis
              dataKey="price"
              stroke="#8b949e"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <YAxis
              stroke="#8b949e"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => v.toFixed(3)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0d1117",
                borderColor: "#21262d",
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
              stroke="#f85149"
              strokeDasharray="4 4"
              label={{ value: `Strike ${currencySymbol}${req.strike}`, fill: "#f85149", fontSize: 10, position: "top" }}
            />
            {/* Histogram Bars */}
            <Bar dataKey="empiricalDensity" fill="#21262d" stroke="#30363d" radius={[2, 2, 0, 0]} />
            {/* Theoretical Log-Normal Density Overlay Curve */}
            <Line
              type="monotone"
              dataKey="theoreticalDensity"
              stroke="#58a6ff"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-[#8b949e] font-mono bg-[#0d1117] p-2.5 rounded border border-[#21262d] flex justify-between items-center">
        <span>
          Note: Downsampled sample capped at 5,000 terminal prices for API performance.
        </span>
        <span className="text-[#58a6ff] font-semibold">Blue Curve = Theoretical BS PDF</span>
      </div>
    </div>
  );
}
