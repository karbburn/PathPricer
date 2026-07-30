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
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#58a6ff] uppercase tracking-wider">
            Deterministic Option Payoff Diagram at Expiry
          </h3>
          <p className="text-xs text-[#6e7681] font-mono mt-0.5">
            Hockey-stick payoff &bull; Strike: {currencySymbol}{K.toFixed(2)} &bull; Spot: {currencySymbol}{S0.toFixed(2)} &bull; Breakeven: {currencySymbol}{breakeven.toFixed(2)}
          </p>
        </div>
        <span className="text-xs bg-[#0d1117] border border-[#21262d] text-[#3fb950] px-2 py-1 rounded font-mono font-bold uppercase">
          {opt} Option Payoff
        </span>
      </div>

      <div className="h-[380px] w-full chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <XAxis
              dataKey="spot"
              stroke="#6e7681"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <YAxis
              stroke="#6e7681"
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
            />
            <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
            <ReferenceLine
              x={K}
              stroke="#f85149"
              strokeDasharray="4 4"
              label={{ value: `Strike ${currencySymbol}${K}`, fill: "#f85149", fontSize: 10, position: "top" }}
            />
            <ReferenceLine
              x={S0}
              stroke="#58a6ff"
              strokeDasharray="4 4"
              label={{ value: `Spot ${currencySymbol}${S0}`, fill: "#58a6ff", fontSize: 10, position: "left" }}
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
              stroke="#58a6ff"
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
