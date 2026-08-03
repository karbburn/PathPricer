"use client";

import React, { useState, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import { PricingRequest, QuantSurfaceRequest, TermStructureResponse } from "@/lib/types";
import { postVolTermStructure, ApiError } from "@/lib/api-client";
import { formatPercent } from "@/lib/formatters";
import { QuantChartShell } from "./QuantChartShell";

interface VolTermStructureChartProps {
  request: PricingRequest;
}

export function VolTermStructureChart({ request }: VolTermStructureChartProps) {
  const [data, setData] = useState<TermStructureResponse | null>(null);
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
        max_expiries: 6,
      };
      setData(await postVolTermStructure(req));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Error connecting to backend quant API."
      );
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  const chartData = (data?.points ?? []).map((p) => ({
    ttm: p.ttm,
    atm_vol: p.atm_vol,
    expiry: p.expiry,
  }));

  return (
    <QuantChartShell
      title="Vol Term Structure"
      subtitle="ATM implied vol at each expiry from fitted SVI slices"
      runLabel="Fit Term Structure"
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
          Click “Fit Term Structure” to plot ATM implied vol against time to expiry.
        </div>
      )}

      {data && data.points.length === 0 && (
        <div className="text-[#8b949e] font-mono text-xs p-8 text-center border border-[#21262d] rounded-lg">
          No SVI slices could be fitted from the options chain.
        </div>
      )}

      {data && data.points.length > 0 && (
        <div className="h-[260px] w-full chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
              <XAxis dataKey="ttm" stroke="#8b949e" fontSize={10} fontFamily="monospace" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => v.toFixed(2)} label={{ value: "Time to Expiry (yrs)", position: "insideBottom", offset: -5, fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} />
              <YAxis stroke="#8b949e" fontSize={10} fontFamily="monospace" domain={["auto", "auto"]} tickFormatter={(v) => formatPercent(v)} label={{ value: "ATM Implied Vol", angle: -90, position: "insideLeft", offset: 0, fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0d1117", borderColor: "#21262d", fontSize: "12px", fontFamily: "monospace", color: "#e2e8f0" }}
                labelFormatter={(v) => `T = ${Number(v).toFixed(3)}y`}
                formatter={(val: unknown, _name: unknown, item: unknown) => {
                  const entry = (item as { payload?: { expiry?: string } }).payload;
                  return [formatPercent(Number(val)), entry?.expiry ?? "ATM IV"];
                }}
              />
              <Line name="ATM Implied Vol" dataKey="atm_vol" stroke="#58a6ff" strokeWidth={2} dot={{ r: 4, fill: "#58a6ff", strokeWidth: 0 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </QuantChartShell>
  );
}
