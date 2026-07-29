"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { PricingRequest } from "@/lib/types";

interface PathsChartProps {
  request: PricingRequest;
}

// Pseudo-random normal generator using Box-Muller transform seeded deterministically
function makeSeededRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function randNormal(rng: () => number) {
  let u = 0,
    v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function PathsChart({ request }: PathsChartProps) {
  const numPaths = 100;
  const steps = 50;
  const T = 0.5;

  const { chartData, spotPrice, strikePrice } = useMemo(() => {
    const S0 = request.spot_override ?? 100.0;
    const K = request.strike;
    const r = request.risk_free_rate;
    const q = request.dividend_yield ?? 0.0;
    const sigma = request.volatility;

    const dt = T / steps;
    const drift = (r - q - 0.5 * sigma * sigma) * dt;
    const volSqrtDt = sigma * Math.sqrt(dt);

    const rng = makeSeededRng(request.seed);

    const pathsData: number[][] = Array.from({ length: numPaths }, () => {
      let currentS = S0;
      const path = [S0];
      for (let step = 1; step <= steps; step++) {
        const z = randNormal(rng);
        currentS = currentS * Math.exp(drift + volSqrtDt * z);
        path.push(currentS);
      }
      return path;
    });

    const data = [];
    for (let step = 0; step <= steps; step++) {
      const point: Record<string, number> = {
        time: Number(((step / steps) * T).toFixed(2)),
      };
      for (let p = 0; p < numPaths; p++) {
        point[`path${p}`] = Number(pathsData[p][step].toFixed(2));
      }
      data.push(point);
    }
    return { chartData: data, spotPrice: S0, strikePrice: K };
  }, [request]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider">
            Simulated Asset Price Paths (Stepwise GBM)
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Sample of 30 exact log-normal paths &bull; Spot: ${spotPrice.toFixed(2)} &bull; Strike: ${strikePrice.toFixed(2)}
          </p>
        </div>
        <span className="text-xs bg-slate-950 border border-slate-800 text-slate-400 px-2 py-1 rounded font-mono">
          Seed: {request.seed}
        </span>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `${v}y`}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${v}`}
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
            {/* Spot Price Reference Line */}
            <ReferenceLine
              y={spotPrice}
              stroke="#06b6d4"
              strokeDasharray="4 4"
              label={{ value: `Spot $${spotPrice}`, fill: "#06b6d4", fontSize: 10, position: "left" }}
            />
            <ReferenceLine
              y={strikePrice}
              stroke="#e11d48"
              strokeDasharray="4 4"
              label={{ value: `Strike $${strikePrice}`, fill: "#e11d48", fontSize: 10, position: "right" }}
            />
            <ReferenceLine
              x={T}
              stroke="#f59e0b"
              strokeDasharray="2 2"
              label={{ value: `Expiry (${T}y)`, fill: "#f59e0b", fontSize: 10, position: "top" }}
            />

            {/* Path Lines */}
            {Array.from({ length: numPaths }).map((_, i) => (
              <Line
                key={i}
                type="monotone"
                dataKey={`path${i}`}
                stroke={i === 0 ? "#38bdf8" : i % 2 === 0 ? "#1e293b" : "#334155"}
                strokeWidth={i === 0 ? 1.5 : 0.8}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
