"use client";

import React, { useState, useCallback } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { PricingRequest, QuantSurfaceRequest, HestonCalibrationResponse } from "@/lib/types";
import { postHestonCalibrate, ApiError } from "@/lib/api-client";
import { formatPrice, formatPercent } from "@/lib/formatters";
import { QuantChartShell } from "./QuantChartShell";

interface HestonCalibrationChartProps {
  request: PricingRequest;
}

function ParamsTable({ data }: { data: HestonCalibrationResponse }) {
  const p = data.params;
  const rows: Array<[string, string]> = [
    ["v₀ (initial variance)", p.v0.toFixed(4)],
    ["κ (mean reversion)", p.kappa.toFixed(4)],
    ["θ (long-run variance)", p.theta_v.toFixed(4)],
    ["σᵥ (vol of vol)", p.sigma_v.toFixed(4)],
    ["ρ (spot/vol correlation)", p.rho.toFixed(4)],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {rows.map(([label, val]) => (
        <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-2 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#8b949e] font-bold">{label}</div>
          <div className="text-sm font-mono text-[#79c0ff] font-bold">{val}</div>
        </div>
      ))}
      <div
        className={`rounded-lg p-2 text-center border ${
          data.feller_condition_holds
            ? "bg-green-950/30 border-green-800/50 text-green-400"
            : "bg-amber-950/30 border-amber-800/50 text-amber-300"
        }`}
      >
        <div className="text-[9px] uppercase tracking-wider font-bold">Feller 2κθ&gt;σ²</div>
        <div className="text-sm font-mono font-bold">{data.feller_condition_holds ? "HOLDS" : "VIOLATED"}</div>
      </div>
    </div>
  );
}

export function HestonCalibrationChart({ request }: HestonCalibrationChartProps) {
  const [data, setData] = useState<HestonCalibrationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        max_expiries: 3,
      };
      setData(await postHestonCalibrate(req));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Error connecting to backend quant API."
      );
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  const chartData =
    data?.contracts.map((c) => ({
      market: Number(c.market_price.toFixed(4)),
      model: Number(c.model_price.toFixed(4)),
      strike: c.strike,
      type: c.option_type,
    })) ?? [];

  const callData = chartData.filter((d) => d.type === "call");
  const putData = chartData.filter((d) => d.type === "put");

  const maxP = Math.max(...chartData.map((d) => Math.max(d.market, d.model)), 1);

  return (
    <QuantChartShell
      title="Heston Calibration"
      subtitle="Fit Heston stochastic volatility params to market option prices"
      runLabel="Calibrate"
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
          Click “Calibrate” to fit Heston parameters to the nearest market expiry.
        </div>
      )}

      {data && data.contracts.length === 0 && (
        <div className="text-[#8b949e] font-mono text-xs p-8 text-center border border-[#21262d] rounded-lg">
          Calibration produced no contracts — check the moneyness and price filters.
        </div>
      )}

      {data && data.contracts.length > 0 && (
        <>
          <ParamsTable data={data} />

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["RMSE", formatPrice(data.rmse, 4)],
              ["MAPE", formatPercent(data.mape)],
              ["Max Abs Err", formatPrice(data.max_abs_error, 4)],
            ].map(([label, val]) => (
              <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-2">
                <div className="text-[9px] uppercase tracking-wider text-[#8b949e] font-bold">{label}</div>
                <div className="text-sm font-mono text-[#3fb950] font-bold">{val}</div>
              </div>
            ))}
          </div>

          <div className="h-[300px] w-full chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
                <XAxis type="number" dataKey="market" name="Market Price" stroke="#8b949e" fontSize={10} fontFamily="monospace" domain={[0, maxP]} tickFormatter={(v) => v.toFixed(2)} label={{ value: "Market Price", position: "insideBottom", offset: -5, fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} />
                <YAxis type="number" dataKey="model" name="Model Price" stroke="#8b949e" fontSize={10} fontFamily="monospace" domain={[0, maxP]} tickFormatter={(v) => v.toFixed(2)} label={{ value: "Model Price", angle: -90, position: "insideLeft", offset: 0, fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "#8b949e" }}
                  contentStyle={{ backgroundColor: "#0d1117", borderColor: "#21262d", fontSize: "12px", fontFamily: "monospace", color: "#e2e8f0" }}
                  formatter={(val: unknown, name: unknown, item: { payload?: { strike?: number; type?: string } }) =>
                    [`${Number(val).toFixed(4)}`, name === "market" ? `Market (K=${item.payload?.strike})` : `Model (${item.payload?.type})`]
                  }
                />
                <ReferenceLine y={0} stroke="#21262d" />
                <ReferenceLine x={0} stroke="#21262d" />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxP, y: maxP }]} stroke="#58a6ff" strokeDasharray="4 4" />
                <Scatter name="Calls" data={callData} fill="#3fb950" isAnimationActive={false} />
                <Scatter name="Puts" data={putData} fill="#f78166" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] font-mono text-[#8b949e]">
            <span><span className="inline-block w-2 h-2 rounded-full bg-[#3fb950] mr-1" />Calls</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-[#f78166] mr-1" />Puts</span>
            <span>Dashed line = perfect fit (model price = market price). Each dot is one option contract.</span>
          </div>
        </>
      )}
    </QuantChartShell>
  );
}
