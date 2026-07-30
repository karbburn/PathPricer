"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { getMarketQuote } from "@/lib/api-client";
import { MarketQuoteResponse, MarketRegion } from "@/lib/types";

interface TickerConfig {
  symbol: string;
  market: MarketRegion;
  currency: string;
}

const TICKERS: TickerConfig[] = [
  { symbol: "AAPL", market: "US", currency: "$" },
  { symbol: "SPY", market: "US", currency: "$" },
  { symbol: "MSFT", market: "US", currency: "$" },
  { symbol: "RELIANCE", market: "IN", currency: "₹" },
  { symbol: "GOOGL", market: "US", currency: "$" },
];

const REFRESH_INTERVAL = 60_000;

function formatPrice(price: number, currency: string): string {
  if (currency === "₹") {
    return `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
  return `${currency}${price.toFixed(2)}`;
}

function formatReturn(ret: number): string {
  const pct = (ret * 100).toFixed(2);
  return ret >= 0 ? `+${pct}%` : `${pct}%`;
}

export function TickerStrip() {
  const [quotes, setQuotes] = useState<(MarketQuoteResponse | null)[]>(
    () => TICKERS.map(() => null)
  );
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled(
      TICKERS.map((t) => getMarketQuote(t.symbol, t.market))
    );
    if (!mountedRef.current) return;
    setQuotes(results.map((r) => (r.status === "fulfilled" ? r.value : null)));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchAll]);

  return (
    <div className="h-10 bg-[#0d1117] border-b border-[#21262d] flex items-center overflow-x-auto" style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}>
      <div className="flex items-center gap-6 px-4 whitespace-nowrap">
        {TICKERS.map((ticker, i) => {
          const q = quotes[i];
          const positive = q ? q.daily_return >= 0 : true;
          return (
            <button
              key={ticker.symbol}
              className="flex items-center gap-2 text-[10px] font-mono hover:bg-[#21262d]/40 px-2 py-1 rounded transition-colors min-h-[44px]"
            >
              <span className="text-[#6e7681] font-semibold">{ticker.symbol}</span>
              <span className="text-[#e6edf3]">
                {q ? formatPrice(q.spot_price, ticker.currency) : "—"}
              </span>
              <span className={positive ? "text-[#3fb950]" : "text-[#f85149]"}>
                {q ? (
                  <>{positive ? "▲" : "▼"} {formatReturn(q.daily_return)}</>
                ) : (
                  "—"
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
