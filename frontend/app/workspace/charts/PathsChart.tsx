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
  currencySymbol: string;
}

function makeSeededRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function randNormal(rng: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function CustomTooltip({ active, payload, label, currencySymbol }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: number; currencySymbol: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const shown = payload.slice(0, 5);
  const remaining = payload.length - shown.length;
  return (
    <div className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 font-mono text-xs max-w-[200px]">
      <div className="text-slate-400 mb-1">t = {label}y</div>
      {shown.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-3">
          <span className="text-slate-500">{p.dataKey}</span>
          <span className="text-slate-200">{currencySymbol}{p.value.toFixed(2)}</span>
        </div>
      ))}
      {remaining > 0 && (
        <div className="text-slate-500 mt-1">+{remaining} more paths</div>
      )}
    </div>
  );
}

export function PathsChart({ request, currencySymbol }: PathsChartProps) {
  const numPaths = 30;
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
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider">
            Simulated Asset Price Paths (Stepwise GBM)
          </h3>
          <p className="text-xs text-slate-300 font-mono mt-0.5">
            Sample of {numPaths} log-normal paths &bull; Spot: {currencySymbol}{spotPrice.toFixed(2)} &bull; Strike: {currencySymbol}{strikePrice.toFixed(2)}
          </p>
        </div>
        <span className="text-xs bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded font-mono">
          Seed: {request.seed}
        </span>
      </div>

      <div className="h-[380px] w-full overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
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
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} />
            <ReferenceLine
              y={spotPrice}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: `Spot ${currencySymbol}${spotPrice}`, fill: "#f59e0b", fontSize: 10, position: "left" }}
            />
            <ReferenceLine
              y={strikePrice}
              stroke="#e11d48"
              strokeDasharray="4 4"
              label={{ value: `Strike ${currencySymbol}${strikePrice}`, fill: "#e11d48", fontSize: 10, position: "right" }}
            />
            <ReferenceLine
              x={T}
              stroke="#f59e0b"
              strokeDasharray="2 2"
              label={{ value: `Expiry (${T}y)`, fill: "#f59e0b", fontSize: 10, position: "top" }}
            />
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
