"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { getMarketQuote } from "@/lib/api-client";
import { MarketQuoteResponse, MarketRegion } from "@/lib/types";

interface TickerConfig {
  symbol: string;
  market: MarketRegion;
  currency: string;
}

const DEFAULT_TICKERS: TickerConfig[] = [
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
  const [watchlist, setWatchlist] = useState<TickerConfig[]>(() => {
    if (typeof window === "undefined") return DEFAULT_TICKERS;
    try {
      const saved = localStorage.getItem("ticker_watchlist");
      return saved ? JSON.parse(saved) : DEFAULT_TICKERS;
    } catch {
      return DEFAULT_TICKERS;
    }
  });

  const [quotes, setQuotes] = useState<(MarketQuoteResponse | null)[]>(() => watchlist.map(() => null));
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled(
      watchlist.map((t) => getMarketQuote(t.symbol, t.market))
    );
    if (!mountedRef.current) return;
    setQuotes(results.map((r) => (r.status === "fulfilled" ? r.value : null)));
  }, [watchlist]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();
    try {
      localStorage.setItem("ticker_watchlist", JSON.stringify(watchlist));
    } catch {
      // localStorage unavailable
    }
  }, [watchlist]);

  return (
    <div className="h-10 bg-[#0d1117] border-b border-[#21262d] flex items-center overflow-x-auto relative" style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}>
      <div className="flex items-center gap-6 px-4 whitespace-nowrap">
        {watchlist.map((ticker, i) => {
          const q = quotes[i];
          const positive = q ? q.daily_return >= 0 : true;
          return (
            <button
              key={ticker.symbol}
              className="flex items-center gap-2 text-[10px] font-mono hover:bg-[#21262d]/40 px-2 py-1 rounded transition-colors min-h-[44px]"
            >
              <span className="text-[#8b949e] font-semibold">{ticker.symbol}</span>
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
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0d1117] to-transparent" />
    </div>
  );
}
