"use client";

import { useEffect, useState } from "react";
import { postImpliedRate, ApiError } from "@/lib/api-client";
import { ImpliedRateResponse, MarketRegion } from "@/lib/types";
import { formatPercent } from "@/lib/formatters";

interface ImpliedRateCardProps {
  ticker: string;
  market: MarketRegion;
  spot: number;
  dividendYield: number;
}

export function ImpliedRateCard({ ticker, market, spot, dividendYield }: ImpliedRateCardProps) {
  const [data, setData] = useState<ImpliedRateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [unavailable, setUnavailable] = useState<boolean>(false);

  useEffect(() => {
    if (market !== "US" || !ticker) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setUnavailable(false);
    postImpliedRate({
      ticker,
      market,
      spot_override: spot,
      risk_free_rate: 0.05,
      dividend_yield: dividendYield,
    })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, market, spot, dividendYield]);

  if (market !== "US") return null;

  const divergenceOk = data !== null && Math.abs(data.divergence) < 0.01;

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6">
      <span className="text-xs font-bold text-[#8b949e] uppercase tracking-wider block mb-2">
        Implied Risk-Free Rate
      </span>
      {loading && <span className="text-sm text-[#8b949e] font-mono">Checking parity...</span>}
      {unavailable && !loading && (
        <span className="text-xs text-[#8b949e] font-mono">
          Options chain unavailable &mdash; no parity check
        </span>
      )}
      {data && !loading && (
        <>
          <span
            className={`text-2xl font-bold font-mono block ${
              divergenceOk ? "text-white" : "text-[#d29922]"
            }`}
          >
            {formatPercent(data.implied_rate)}
          </span>
          <span className="text-[11px] text-[#8b949e] font-mono block mt-1">
            ATM {data.strike} &bull; T+{Math.round(data.ttm * 365)}d
          </span>
          <span
            className={`text-[11px] font-mono mt-1 block ${
              divergenceOk ? "text-[#3fb950]" : "text-[#d29922]"
            }`}
          >
            {divergenceOk
              ? "\u2713 within 1% of reference"
              : `divergence ${formatPercent(data.divergence)} vs reference`}
          </span>
        </>
      )}
    </div>
  );
}
