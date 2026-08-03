"use client";

import { useEffect, useState } from "react";
import {
  postImpliedRate,
  postImpliedDividend,
  ApiError,
} from "@/lib/api-client";
import { ImpliedRateResponse, ImpliedDividendResponse, MarketRegion } from "@/lib/types";
import { formatPercent } from "@/lib/formatters";

interface ParityQualityCardProps {
  ticker: string;
  market: MarketRegion;
  spot: number;
  dividendYield: number;
}

interface ParityState {
  rate: ImpliedRateResponse | null;
  dividend: ImpliedDividendResponse | null;
  loading: boolean;
  unavailable: boolean;
}

export function ParityQualityCard({ ticker, market, spot, dividendYield }: ParityQualityCardProps) {
  const [state, setState] = useState<ParityState>({
    rate: null,
    dividend: null,
    loading: false,
    unavailable: false,
  });

  useEffect(() => {
    if (market !== "US" || !ticker) return;
    let cancelled = false;
    setState({ rate: null, dividend: null, loading: true, unavailable: false });
    const base = {
      ticker,
      market,
      spot_override: spot,
      risk_free_rate: 0.05,
      dividend_yield: dividendYield,
    };
    Promise.all([postImpliedRate(base), postImpliedDividend(base)])
      .then(([rate, dividend]) => {
        if (!cancelled) setState({ rate, dividend, loading: false, unavailable: false });
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError)
          setState({ rate: null, dividend: null, loading: false, unavailable: true });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, market, spot, dividendYield]);

  if (market !== "US") return null;

  const rateOk = state.rate !== null && Math.abs(state.rate.divergence) < 0.01;
  const divOk =
    state.dividend !== null &&
    (state.dividend.divergence === null || Math.abs(state.dividend.divergence) < 0.01);

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#8b949e] uppercase tracking-wider">
          Parity Data Quality
        </span>
        {state.loading && <span className="text-xs text-[#8b949e] font-mono">checking...</span>}
        {state.unavailable && !state.loading && (
          <span className="text-xs text-[#8b949e] font-mono">chain unavailable</span>
        )}
      </div>

      {state.rate && (
        <div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold font-mono ${rateOk ? "text-white" : "text-[#d29922]"}`}
            >
              {formatPercent(state.rate.implied_rate)}
            </span>
            <span className="text-[11px] text-[#8b949e] font-mono">implied rate (r)</span>
          </div>
          <span
            className={`text-[11px] font-mono block mt-0.5 ${
              rateOk ? "text-[#3fb950]" : "text-[#d29922]"
            }`}
          >
            {rateOk
              ? "\u2713 within 1% of reference"
              : `divergence ${formatPercent(state.rate.divergence)}`}
          </span>
        </div>
      )}

      {state.dividend && (
        <div className="border-t border-[#21262d]/60 pt-2">
          <div className="flex items-baseline justify-between">
            <span
              className={`text-xl font-bold font-mono ${divOk ? "text-white" : "text-[#d29922]"}`}
            >
              {formatPercent(state.dividend.implied_dividend)}
            </span>
            <span className="text-[11px] text-[#8b949e] font-mono">implied dividend (q)</span>
          </div>
          <span
            className={`text-[11px] font-mono block mt-0.5 ${
              divOk ? "text-[#3fb950]" : "text-[#d29922]"
            }`}
          >
            {state.dividend.divergence === null
              ? `no market q reported`
              : divOk
                ? `\u2713 matches reported ${formatPercent(state.dividend.market_dividend)}`
                : `divergence ${formatPercent(state.dividend.divergence)}`}
          </span>
        </div>
      )}

      {state.rate && (
        <span className="text-[11px] text-[#8b949e] font-mono block">
          ATM {state.rate.strike} &bull; T+{Math.round(state.rate.ttm * 365)}d
        </span>
      )}
    </div>
  );
}
