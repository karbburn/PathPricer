"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ErrorBar,
} from "recharts";
import { PricingFullResponse } from "@/lib/types";

interface ComparisonChartProps {
  fullResult: PricingFullResponse;
  currencySymbol: string;
}

export function ComparisonChart({ fullResult, currencySymbol }: ComparisonChartProps) {
  const bsPrice = fullResult.black_scholes.price;

  const chartData = useMemo(() => {
    return fullResult.mc_results.map((mc) => {
      // Recharts ErrorBar error range: [minus, plus] relative to price
      const errMinus = mc.price - mc.ci_lower;
      const errPlus = mc.ci_upper - mc.price;

      return {
        name:
          mc.method === "quasi_monte_carlo"
            ? "RQMC (SOBOL)"
            : mc.method.replace(/_/g, " ").toUpperCase(),
        price: Number(mc.price.toFixed(4)),
        ci_lower: Number(mc.ci_lower.toFixed(4)),
        ci_upper: Number(mc.ci_upper.toFixed(4)),
        errorRange: [Number(errMinus.toFixed(4)), Number(errPlus.toFixed(4))],
        se: Number(mc.standard_error.toFixed(4)),
      };
    });
  }, [fullResult]);

  const minP = Math.min(bsPrice, ...chartData.map((d) => d.ci_lower));
  const maxP = Math.max(bsPrice, ...chartData.map((d) => d.ci_upper));
  const padding = (maxP - minP) * 0.2 || 1.0;
  const yMin = Number((minP - padding).toFixed(2));
  const yMax = Number((maxP + padding).toFixed(2));

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#58a6ff] uppercase tracking-wider">
            MC Estimator Prices &amp; 95% Confidence Intervals vs BS Benchmark
          </h3>
          <p className="text-xs text-[#6e7681] font-mono mt-0.5">
            Error bars reflect [&plusmn;1.96 SE] confidence width &bull; Reference line = BS analytical benchmark
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-[#79c0ff] bg-[#0d1117] px-2.5 py-1 rounded border border-[#21262d]">
          BS: {currencySymbol}{bsPrice.toFixed(4)}
        </span>
      </div>

      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
            <XAxis
              dataKey="name"
              stroke="#6e7681"
              fontSize={10}
              fontFamily="monospace"
            />
            <YAxis
              stroke="#6e7681"
              fontSize={11}
              fontFamily="monospace"
              domain={[yMin, yMax]}
              tickFormatter={(v) => `${currencySymbol}${v.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0d1117",
                borderColor: "#21262d",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#e2e8f0",
              }}
              formatter={(val: unknown, name: unknown, item: { payload?: Record<string, unknown> }) => [
                `${currencySymbol}${Number(val).toFixed(4)} (SE: \u00B1${currencySymbol}${Number(item.payload?.se).toFixed(4)})`,
                "Estimator Price",
              ]}
            />

            {/* Black-Scholes Benchmark Line */}
            <ReferenceLine
              y={bsPrice}
              stroke="#58a6ff"
              strokeWidth={2}
              label={{ value: `BS Benchmark ${currencySymbol}${bsPrice.toFixed(4)}`, fill: "#58a6ff", fontSize: 11, position: "top" }}
            />

            {/* MC Estimator Price Bars with 95% CI Error Bars */}
            <Bar dataKey="price" fill="#21262d" stroke="#58a6ff" radius={[4, 4, 0, 0]} barSize={40}>
              <ErrorBar dataKey="errorRange" width={6} strokeWidth={2} stroke="#58a6ff" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-[#6e7681] font-mono bg-[#0d1117] p-2.5 rounded border border-[#21262d] flex justify-between items-center">
        <span>
          Blue Reference Line = BS Benchmark. Blue Caps = 95% Confidence Intervals.
        </span>
        <span className="text-emerald-400 font-semibold">
          Variance Reduction Narrows Error Bar Width
        </span>
      </div>
    </div>
  );
}
