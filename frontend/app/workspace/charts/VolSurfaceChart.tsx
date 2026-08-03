"use client";

import React, { useState, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { PricingRequest, QuantSurfaceRequest, VolSurfaceResponse } from "@/lib/types";
import { postVolSurface, ApiError } from "@/lib/api-client";
import { formatPercent, formatPrice } from "@/lib/formatters";
import { QuantChartShell } from "./QuantChartShell";

interface VolSurfaceChartProps {
  request: PricingRequest;
}

export function VolSurfaceChart({ request }: VolSurfaceChartProps) {
  const [data, setData] = useState<VolSurfaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

const [maxExpiries, setMaxExpiries] = useState(3);

  const run = useCallback(async () => {
    setData(null);
    setIsLoading(true);
    setError(null);
    try {
      const req: QuantSurfaceRequest = {
        ticker: request.ticker,
        market: request.market,
        spot_override: request.spot_override,
        risk_free_rate: request.risk_free_rate,
        dividend_yield: request.dividend_yield,
        expiries: null,
        max_expiries: maxExpiries,
      };
      setData(await postVolSurface(req));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Error connecting to backend quant API."
      );
    } finally {
      setIsLoading(false);
    }
  }, [request, maxExpiries]);

  return (
    <QuantChartShell
      title="SVI Volatility Surface"
      subtitle="Fit SVI slices to market implied vols across expiries"
      runLabel="Fit Surface"
      spot={data?.spot ?? request.spot_override ?? null}
      ticker={request.ticker}
      resolvedSymbol={data?.resolved_symbol}
      onRun={run}
      isLoading={isLoading}
      error={error}
      warnings={data?.warnings ?? []}
    >
      {!data && !isLoading && (
        <div className="text-[#8b949e] font-mono text-xs p-8 text-center border border-[#21262d] rounded-lg">
          Click “Fit Surface” to fit SVI slices to the market options chain.
        </div>
      )}

      {data && data.slices.length === 0 && (
        <div className="text-[#8b949e] font-mono text-xs p-8 text-center border border-[#21262d] rounded-lg">
          No SVI slices could be fitted from the options chain.
        </div>
      )}

      {data && data.slices.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-xs font-mono mb-2">
            <label htmlFor="max-expiries" className="text-[#8b949e]">Max expiries:</label>
            <select
              id="max-expiries"
              value={maxExpiries}
              onChange={(e) => setMaxExpiries(Number(e.target.value))}
              className="bg-[#0d1117] border border-[#21262d] text-[#e2e8f0] font-mono text-xs rounded px-2 py-1"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {data.slices.map((slice) => {
          const chartData = slice.points.map((p) => ({
            strike: p.strike,
            market_iv: p.market_iv,
            fitted_iv: p.fitted_iv,
          }));
          return (
            <div key={slice.expiry} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-mono text-[#e2e8f0] font-bold">
                  Expiry {slice.expiry} · T = {slice.ttm.toFixed(3)}y
                </div>
                <div className="flex items-center gap-2">
                  {slice.butterfly_arb_free != null && (
                    <span
                      title={slice.butterfly_arb_free
                        ? "Call prices convex in strike — risk-neutral density non-negative everywhere"
                        : `Butterfly arbitrage: min butterfly value ${formatPrice(slice.min_butterfly ?? 0, 4)} at strike ${formatPrice(slice.worst_strike ?? 0, 2)}`}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        slice.butterfly_arb_free
                          ? "bg-green-950/40 border-green-800 text-green-400"
                          : "bg-red-950/40 border-red-800 text-red-400"
                      }`}
                    >
                      {slice.butterfly_arb_free ? "✓ Arb-free" : "✗ Butterfly arb"}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-[#8b949e]">
                    SVI: a={slice.svi_params.a.toFixed(4)} b={slice.svi_params.b.toFixed(4)} ρ={slice.svi_params.rho.toFixed(4)} m={slice.svi_params.m.toFixed(4)} σ={slice.svi_params.sigma.toFixed(4)}
                  </span>
                </div>
              </div>
              <div className="h-[220px] w-full chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
                    <XAxis dataKey="strike" stroke="#8b949e" fontSize={10} fontFamily="monospace" tickFormatter={(v) => v.toFixed(0)} label={{ value: "Strike", position: "insideBottom", offset: -5, fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} />
                    <YAxis stroke="#8b949e" fontSize={10} fontFamily="monospace" domain={["auto", "auto"]} tickFormatter={(v) => formatPercent(v)} label={{ value: "Implied Vol", angle: -90, position: "insideLeft", offset: 0, fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0d1117", borderColor: "#21262d", fontSize: "12px", fontFamily: "monospace", color: "#e2e8f0" }}
                      labelFormatter={(v) => `Strike ${Number(v).toFixed(2)}`}
                      formatter={(val: unknown, name: unknown) => [formatPercent(Number(val)), name === "market_iv" ? "Market IV" : "Fitted IV"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} />
                    <Scatter name="Market IV" dataKey="market_iv" fill="#58a6ff" isAnimationActive={false} />
                    <Line name="Fitted IV" dataKey="fitted_iv" stroke="#3fb950" dot={false} strokeWidth={2} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
        </>
      )}
    </QuantChartShell>
  );
}
