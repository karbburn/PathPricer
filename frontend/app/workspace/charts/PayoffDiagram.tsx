"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { PricingRequest } from "@/lib/types";

interface PayoffDiagramProps {
  request: PricingRequest;
  optionPrice: number;
  currencySymbol: string;
}

export function PayoffDiagram({ request, optionPrice, currencySymbol }: PayoffDiagramProps) {
  const S0 = request.spot_override ?? 100.0;
  const K = request.strike;
  const opt = request.option_type;

  const { chartData, breakeven } = useMemo(() => {
    const isCall = opt === "call";
    const breakevenPrice = isCall ? K + optionPrice : K - optionPrice;

    // Grid around spot and strike (50% to 150% of K)
    const minS = Math.max(0.1, K * 0.5);
    const maxS = K * 1.5;
    const steps = 60;
    const stepSize = (maxS - minS) / steps;

    const data = [];
    for (let i = 0; i <= steps; i++) {
      const spot = minS + i * stepSize;
      const grossPayoff = isCall ? Math.max(spot - K, 0) : Math.max(K - spot, 0);
      const netProfit = grossPayoff - optionPrice;

      data.push({
        spot: Number(spot.toFixed(2)),
        grossPayoff: Number(grossPayoff.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
      });
    }

    return { chartData: data, breakeven: Number(breakevenPrice.toFixed(2)) };
  }, [K, optionPrice, opt]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider">
            Deterministic Option Payoff Diagram at Expiry
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Hockey-stick payoff &bull; Strike: {currencySymbol}{K.toFixed(2)} &bull; Spot: {currencySymbol}{S0.toFixed(2)} &bull; Breakeven: {currencySymbol}{breakeven.toFixed(2)}
          </p>
        </div>
        <span className="text-xs bg-slate-950 border border-slate-800 text-emerald-400 px-2 py-1 rounded font-mono font-bold uppercase">
          {opt} Option Payoff
        </span>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <XAxis
              dataKey="spot"
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#090d16",
                borderColor: "#1e293b",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#e2e8f0",
              }}
            />
            <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
            <ReferenceLine
              x={K}
              stroke="#e11d48"
              strokeDasharray="4 4"
              label={{ value: `Strike ${currencySymbol}${K}`, fill: "#e11d48", fontSize: 10, position: "top" }}
            />
            <ReferenceLine
              x={S0}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: `Spot ${currencySymbol}${S0}`, fill: "#f59e0b", fontSize: 10, position: "left" }}
            />
            <ReferenceLine
              x={breakeven}
              stroke="#10b981"
              strokeDasharray="4 4"
              label={{ value: `Breakeven ${currencySymbol}${breakeven}`, fill: "#10b981", fontSize: 10, position: "top" }}
            />

            {/* Shaded Gross Payoff Area */}
            <Area
              type="monotone"
              dataKey="grossPayoff"
              stroke="#10b981"
              fill="#064e3b"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            {/* Net Profit Line */}
            <Line
              type="monotone"
              dataKey="netProfit"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
