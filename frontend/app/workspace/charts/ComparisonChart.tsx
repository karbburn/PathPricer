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
}

export function ComparisonChart({ fullResult }: ComparisonChartProps) {
  const bsPrice = fullResult.black_scholes.price;

  const chartData = useMemo(() => {
    return fullResult.mc_results.map((mc) => {
      // Recharts ErrorBar error range: [minus, plus] relative to price
      const errMinus = mc.price - mc.ci_lower;
      const errPlus = mc.ci_upper - mc.price;

      return {
        name: mc.method.replace("_", " ").toUpperCase(),
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
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider">
            MC Estimator Prices &amp; 95% Confidence Intervals vs BS Benchmark
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Error bars reflect [&plusmn;1.96 SE] confidence width &bull; Reference line = BS analytical benchmark
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-cyan-300 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
          BS: ${bsPrice.toFixed(4)}
        </span>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
            <XAxis
              dataKey="name"
              stroke="#64748b"
              fontSize={10}
              fontFamily="monospace"
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              domain={[yMin, yMax]}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#090d16",
                borderColor: "#1e293b",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#e2e8f0",
              }}
              formatter={(val: unknown, name: unknown, item: { payload?: Record<string, unknown> }) => [
                `$${Number(val).toFixed(4)} (SE: ±$${Number(item.payload?.se).toFixed(4)})`,
                "Estimator Price",
              ]}
            />

            {/* Black-Scholes Benchmark Line */}
            <ReferenceLine
              y={bsPrice}
              stroke="#06b6d4"
              strokeWidth={2}
              label={{ value: `BS Benchmark $${bsPrice.toFixed(4)}`, fill: "#06b6d4", fontSize: 11, position: "top" }}
            />

            {/* MC Estimator Price Bars with 95% CI Error Bars */}
            <Bar dataKey="price" fill="#1e293b" stroke="#38bdf8" radius={[4, 4, 0, 0]} barSize={40}>
              <ErrorBar dataKey="errorRange" width={6} strokeWidth={2} stroke="#f59e0b" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-slate-500 font-mono bg-slate-950 p-2.5 rounded border border-slate-800 flex justify-between items-center">
        <span>
          Cyan Reference Line = BS Benchmark. Yellow Caps = 95% Confidence Intervals.
        </span>
        <span className="text-emerald-400 font-semibold">
          Variance Reduction Narrows Error Bar Width
        </span>
      </div>
    </div>
  );
}
