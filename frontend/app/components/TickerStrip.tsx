"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { getMarketQuote } from "@/lib/api-client";
import { MarketQuoteResponse, MarketRegion } from "@/lib/types";

interface TickerConfig {
  symbol: string;
  market: MarketRegion;
  currency: string;
}

const VALID_MARKETS: MarketRegion[] = ["US", "IN", "FX", "CRYPTO"];

const DEFAULT_TICKERS: TickerConfig[] = [
  { symbol: "AAPL", market: "US", currency: "$" },
  { symbol: "SPY", market: "US", currency: "$" },
  { symbol: "MSFT", market: "US", currency: "$" },
  { symbol: "RELIANCE", market: "IN", currency: "₹" },
  { symbol: "GOOGL", market: "US", currency: "$" },
  { symbol: "EURUSD", market: "FX", currency: "$" },
  { symbol: "BTC", market: "CRYPTO", currency: "$" },
];

const REFRESH_INTERVAL = 60_000;

function isValidTicker(t: unknown): t is TickerConfig {
  return (
    typeof t === "object" &&
    t !== null &&
    typeof (t as TickerConfig).symbol === "string" &&
    VALID_MARKETS.includes((t as TickerConfig).market) &&
    typeof (t as TickerConfig).currency === "string"
  );
}

function parseWatchlist(raw: string | null): TickerConfig[] {
  if (!raw) return DEFAULT_TICKERS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TICKERS;
    const valid = parsed.filter(isValidTicker);
    return valid.length > 0 ? valid : DEFAULT_TICKERS;
  } catch {
    return DEFAULT_TICKERS;
  }
}

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
  const [watchlist, setWatchlist] = useState<TickerConfig[]>(DEFAULT_TICKERS);
  const [quotes, setQuotes] = useState<Record<string, MarketQuoteResponse | null>>({});
  const fetchEpoch = useRef(0);
  const mountedRef = useRef(true);

  // Hydration: load from localStorage after mount
  useEffect(() => {
    setWatchlist(parseWatchlist(localStorage.getItem("ticker_watchlist")));
  }, []);

  const fetchAll = useCallback(async () => {
    const epoch = ++fetchEpoch.current;
    const results = await Promise.allSettled(
      watchlist.map((t) => getMarketQuote(t.symbol, t.market))
    );
    if (!mountedRef.current || epoch !== fetchEpoch.current) return;
    const next: Record<string, MarketQuoteResponse | null> = {};
    watchlist.forEach((t, i) => {
      next[t.symbol] = results[i].status === "fulfilled" ? results[i].value : null;
    });
    setQuotes(next);
  }, [watchlist]);

  // Fetch on mount + interval; skip backgrounded tabs
  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchAll();
    }, REFRESH_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchAll]);

  // Persist only — no fetch
  useEffect(() => {
    try {
      localStorage.setItem("ticker_watchlist", JSON.stringify(watchlist));
    } catch {
      // localStorage unavailable
    }
  }, [watchlist]);

  return (
    <div className="min-h-[44px] bg-[#0d1117] border-b border-[#21262d] flex items-center overflow-x-auto relative" style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}>
      <div className="flex items-center gap-6 px-4 whitespace-nowrap">
        {watchlist.map((ticker) => {
          const q = quotes[ticker.symbol];
          const positive = q ? q.daily_return >= 0 : true;
          return (
            <div
              key={ticker.symbol}
              className="flex items-center gap-2 text-[10px] font-mono px-2 py-1 rounded min-h-[44px]"
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
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0d1117] to-transparent" />
    </div>
  );
}
