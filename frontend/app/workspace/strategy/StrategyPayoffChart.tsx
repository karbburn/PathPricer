"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { StrategyResponse } from "@/lib/types";

interface StrategyPayoffChartProps {
  result: StrategyResponse;
  spot: number;
  currencySymbol: string;
}

export function StrategyPayoffChart({ result, spot, currencySymbol }: StrategyPayoffChartProps) {
  const chartData = useMemo(
    () =>
      result.payoff_spots.map((s, i) => ({
        spot: Number(s.toFixed(2)),
        payoff: Number(result.payoff_values[i].toFixed(2)),
      })),
    [result]
  );

  const breakevens = useMemo(() => result.breakevens.map((b) => Number(b.toFixed(2))), [result]);

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#58a6ff] uppercase tracking-wider">
            Strategy Payoff at Expiry
          </h3>
          <p className="text-xs text-[#8b949e] font-mono mt-0.5">
            Net P&L vs spot &bull; Spot: {currencySymbol}{spot.toFixed(2)} &bull;{" "}
            {result.is_credit ? "Credit" : "Debit"}: {currencySymbol}{Math.abs(result.net_premium).toFixed(2)}
            {breakevens.length > 0 &&
              ` &bull; Breakevens: ${breakevens.map((b) => `${currencySymbol}${b}`).join(", ")}`}
          </p>
        </div>
        <span
          className={`text-xs bg-[#0d1117] border border-[#21262d] px-2 py-1 rounded font-mono font-bold uppercase ${
            result.net_premium > 0 ? "text-[#f0883e]" : "text-[#3fb950]"
          }`}
        >
          {result.is_credit ? "Credit" : "Debit"} {result.legs.length} legs
        </span>
      </div>

      <div className="h-[380px] w-full chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <XAxis
              dataKey="spot"
              stroke="#8b949e"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <YAxis
              stroke="#8b949e"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0d1117",
                borderColor: "#21262d",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#e2e8f0",
              }}
              formatter={(value) => `${currencySymbol}${Number(value).toFixed(2)}`}
            />
            <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
            <ReferenceLine
              x={spot}
              stroke="#58a6ff"
              strokeDasharray="4 4"
              label={{ value: `Spot ${currencySymbol}${spot.toFixed(2)}`, fill: "#58a6ff", fontSize: 10, position: "left" }}
            />
            {breakevens.map((b, i) => (
              <ReferenceLine
                key={i}
                x={b}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: `${currencySymbol}${b}`, fill: "#10b981", fontSize: 10, position: "top" }}
              />
            ))}
            <ReferenceArea
              y1={0}
              y2={Math.max(...chartData.map((d) => d.payoff), 1)}
              fill="#064e3b"
              fillOpacity={0.15}
              ifOverflow="visible"
            />
            <ReferenceArea
              y1={Math.min(...chartData.map((d) => d.payoff), -1)}
              y2={0}
              fill="#7a1f1f"
              fillOpacity={0.15}
              ifOverflow="visible"
            />
            <Area
              type="linear"
              dataKey="payoff"
              stroke="#58a6ff"
              fill="#58a6ff"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
