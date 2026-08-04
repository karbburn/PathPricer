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
import { PricingRequest, QuantSurfaceRequest, ModelValidationResponse } from "@/lib/types";
import { postModelValidate, ApiError } from "@/lib/api-client";
import { formatPrice, formatPercent } from "@/lib/formatters";
import { QuantChartShell } from "./QuantChartShell";

interface ModelValidationChartProps {
  request: PricingRequest;
}

export function ModelValidationChart({ request }: ModelValidationChartProps) {
  const [data, setData] = useState<ModelValidationResponse | null>(null);
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
      setData(await postModelValidate(req));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Error connecting to backend quant API."
      );
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  const chartData =
    data?.contracts
      .filter((c) => c.market_iv != null && c.model_iv != null)
      .map((c) => ({
        market_iv: Number((c.market_iv as number).toFixed(4)),
        model_iv: Number((c.model_iv as number).toFixed(4)),
        strike: c.strike,
        type: c.option_type,
        residual: Number(((c.model_iv as number) - (c.market_iv as number)).toFixed(6)),
      })) ?? [];

  const callData = chartData.filter((d) => d.type === "call");
  const putData = chartData.filter((d) => d.type === "put");

  const maxIv = Math.max(...chartData.map((d) => Math.max(d.market_iv, d.model_iv)), 0.05);
  const maxRes = Math.max(...chartData.map((d) => Math.abs(d.residual)), 0.01);

  return (
    <QuantChartShell
      title="Model Validation"
      subtitle="Calibrate Heston, then compare model IVs to market across the chain"
      runLabel="Validate"
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
          Click "Validate" to check the calibrated Heston model against market implied vols.
        </div>
      )}

      {data && chartData.length === 0 && (
        <div className="text-[#8b949e] font-mono text-xs p-8 text-center border border-[#21262d] rounded-lg">
          No contracts with resolvable implied vols to plot.
        </div>
      )}

      {data && chartData.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              ["Price Rel RMSE", formatPrice(data.price_rel_rmse, 4)],
              ["Price MAPE", formatPercent(data.price_mape)],
              ["IV RMSE", data.iv_rmse != null ? formatPercent(data.iv_rmse) : "—"],
              ["Parity Violation", formatPrice(data.market_parity_violation, 4)],
            ].map(([label, val]) => (
              <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-2">
                <div className="text-[10px] uppercase tracking-wider text-[#8b949e] font-bold">{label}</div>
                <div className="text-sm font-mono text-[#3fb950] font-bold">{val}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <span className={`px-2.5 py-1 rounded border ${data.parity_holds ? "bg-green-950/30 border-green-800/50 text-green-400" : "bg-amber-950/30 border-amber-800/50 text-amber-300"}`}>
              Put-Call Parity: {data.parity_holds ? "HOLDS" : "CHECK"}
            </span>
            <span className={`px-2.5 py-1 rounded border ${data.feller_condition_holds ? "bg-green-950/30 border-green-800/50 text-green-400" : "bg-amber-950/30 border-amber-800/50 text-amber-300"}`}>
              Feller: {data.feller_condition_holds ? "HOLDS" : "VIOLATED"}
            </span>
            <span className="px-2.5 py-1 rounded border border-[#21262d] text-[#8b949e]">
              {data.in_sample ? "In-Sample" : "Out-of-Sample"}
            </span>
          </div>

          <div className="h-[300px] w-full chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
                <XAxis type="number" dataKey="market_iv" name="Market IV" stroke="#8b949e" fontSize={10} fontFamily="monospace" domain={[0, maxIv]} tickFormatter={(v) => formatPercent(v)} label={{ value: "Market IV", position: "insideBottom", offset: -5, fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} />
                <YAxis type="number" dataKey="model_iv" name="Model IV" stroke="#8b949e" fontSize={10} fontFamily="monospace" domain={[0, maxIv]} tickFormatter={(v) => formatPercent(v)} label={{ value: "Model IV", angle: -90, position: "insideLeft", offset: 0, fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "#8b949e" }}
                  contentStyle={{ backgroundColor: "#0d1117", borderColor: "#21262d", fontSize: "12px", fontFamily: "monospace", color: "#e2e8f0" }}
                  formatter={(val: unknown, name: unknown, item: { payload?: { strike?: number; type?: string } }) =>
                    [`${formatPercent(Number(val))}`, name === "market_iv" ? `Market (K=${item.payload?.strike})` : `Model (${item.payload?.type})`]
                  }
                />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxIv, y: maxIv }]} stroke="#58a6ff" strokeDasharray="4 4" />
                <Scatter name="Calls" data={callData} fill="#3fb950" isAnimationActive={false} />
                <Scatter name="Puts" data={putData} fill="#f78166" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] font-mono text-[#8b949e]">
            <span><span className="inline-block w-2 h-2 rounded-full bg-[#3fb950] mr-1" />Calls</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-[#f78166] mr-1" />Puts</span>
            <span>Dashed line = perfect IV match. Points near the line mean the model reproduces market vols.</span>
          </div>

          {/* Residual plot: model_iv - market_iv per contract. */}
          <div className="h-[160px] w-full chart-container mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
                <XAxis dataKey="strike" stroke="#8b949e" fontSize={10} fontFamily="monospace" tickFormatter={(v) => v.toFixed(0)} label={{ value: "Strike", position: "insideBottom", offset: -5, fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} />
                <YAxis stroke="#8b949e" fontSize={10} fontFamily="monospace" domain={[-maxRes, maxRes]} tickFormatter={(v) => formatPercent(v)} label={{ value: "Residual (model - market)", angle: -90, position: "insideLeft", offset: 0, fill: "#8b949e", fontSize: 9, fontFamily: "monospace" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0d1117", borderColor: "#21262d", fontSize: "11px", fontFamily: "monospace", color: "#e2e8f0" }}
                  formatter={(val: unknown) => [formatPercent(Number(val)), "IV residual"]}
                />
                <ReferenceLine y={0} stroke="#21262d" />
                <Scatter name="Calls" data={callData} fill="#3fb950" isAnimationActive={false} />
                <Scatter name="Puts" data={putData} fill="#f78166" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] font-mono text-[#8b949e]">
            Residual = model implied vol - market implied vol. Points near zero mean the model reproduces market vols.
          </div>
        </>
      )}
    </QuantChartShell>
  );
}
