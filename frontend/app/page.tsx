"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { getMarketQuote, ApiError } from "@/lib/api-client";
import { MarketQuoteResponse, MarketRegion } from "@/lib/types";
import {
  formatCurrency,
  formatPercent,
  formatMarketCap,
  formatDateTime,
  roundClean,
} from "@/lib/formatters";
import { TickerInput } from "@/app/components/TickerInput";

const PRESET_TICKERS: Array<{ ticker: string; market: MarketRegion; name: string }> = [
  { ticker: "AAPL", market: "US", name: "Apple Inc." },
  { ticker: "MSFT", market: "US", name: "Microsoft Corp." },
  { ticker: "RELIANCE", market: "IN", name: "Reliance Industries" },
  { ticker: "TCS", market: "IN", name: "Tata Consultancy Services" },
  { ticker: "SPY", market: "US", name: "S&P 500 ETF Trust" },
];

export default function MarketOverviewPage() {
  const [tickerInput, setTickerInput] = useState<string>("");
  const [marketInput, setMarketInput] = useState<MarketRegion>("US");
  const [quote, setQuote] = useState<MarketQuoteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  const [manualSpot, setManualSpot] = useState<string>("100.00");
  const [manualVol, setManualVol] = useState<string>("0.25");
  const [manualDiv, setManualDiv] = useState<string>("0.00");

  const fetchQuote = async (ticker: string, market: MarketRegion) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMarketQuote(ticker, market);
      setQuote(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(
          new ApiError(500, {
            error: "unknown_error",
            message: "Failed to connect to backend market data service.",
          })
        );
      }
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote("AAPL", "US");
  }, []);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!tickerInput.trim()) return;
    fetchQuote(tickerInput.trim(), marketInput);
  };

  const handlePresetClick = (ticker: string, market: MarketRegion) => {
    setTickerInput(ticker);
    setMarketInput(market);
    fetchQuote(ticker, market);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white tracking-tight uppercase font-mono">
          Market Overview
        </h1>
        <p className="text-xs text-[#6e7681] font-mono mt-1">
          Underlying asset data, historical volatility, and dividend yields
        </p>
      </div>

      {/* Search Bar & Market Selector */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-4">
          {/* Market Toggle */}
          <div className="flex bg-[#0d1117] p-1 rounded border border-[#21262d] w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setMarketInput("US")}
              className={`px-4 py-2 text-xs font-semibold rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
                marketInput === "US"
                  ? "bg-[#238636] text-white"
                  : "text-[#6e7681] hover:text-white"
              }`}
            >
              US Market
            </button>
            <button
              type="button"
              onClick={() => setMarketInput("IN")}
              className={`px-4 py-2 text-xs font-semibold rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
                marketInput === "IN"
                  ? "bg-[#238636] text-white"
                  : "text-[#6e7681] hover:text-white"
              }`}
            >
              IN Market (.NS)
            </button>
          </div>

          {/* Ticker Autocomplete Input */}
          <TickerInput
            value={tickerInput}
            onChange={(val) => setTickerInput(val)}
            market={marketInput}
            onSelectTicker={(selectedTicker) => fetchQuote(selectedTicker, marketInput)}
            accentColor="#58a6ff"
          />

          {/* Fetch Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto bg-[#238636] hover:bg-[#2ea043] text-white font-semibold text-sm px-6 py-2.5 rounded transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
          >
            {loading ? "Fetching..." : "Fetch Quote"}
          </button>
        </form>

        {/* Preset Quick Tickers */}
        <div className="mt-4 pt-4 border-t border-[#21262d]/60 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#8b949e] mr-2 font-medium">Quick Presets:</span>
          {PRESET_TICKERS.map((item) => (
            <button
              key={item.ticker}
              onClick={() => handlePresetClick(item.ticker, item.market)}
              className="text-xs bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#8b949e] px-3 py-1 rounded transition-colors font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            >
              {item.ticker} ({item.market})
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-[#161b22]/50 border border-[#21262d] rounded-lg p-8 text-center animate-pulse">
          <div className="h-6 bg-[#21262d] rounded w-1/4 mx-auto mb-4"></div>
          <div className="h-12 bg-[#21262d] rounded w-1/2 mx-auto mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-20 bg-[#21262d] rounded"></div>
            <div className="h-20 bg-[#21262d] rounded"></div>
            <div className="h-20 bg-[#21262d] rounded"></div>
            <div className="h-20 bg-[#21262d] rounded"></div>
          </div>
        </div>
      )}

      {/* 404 Error State & Manual Fallback Form */}
      {!loading && error && (
        <div className="bg-[#161b22] border border-red-500/40 rounded-lg overflow-hidden mb-8">
          <div className="bg-red-950/50 px-6 py-4 border-b border-red-900/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-900/80 border border-red-700 flex items-center justify-center">
                <span className="text-red-400 text-sm font-bold">!</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-200">Market Data Unavailable</h3>
                <p className="text-xs text-red-400/80 font-mono mt-0.5">
                  {error.error}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-[#8b949e] leading-relaxed">{error.message}</p>

            {error.fallback_available && (
              <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-5 mt-4">
                <h4 className="text-xs font-bold text-[#8b949e] uppercase tracking-wider mb-2">
                  Manual Entry Available
                </h4>
                <p className="text-xs text-[#8b949e] mb-4">
                  Enter parameters manually to proceed to the Pricing Workspace for <span className="text-[#8b949e] font-mono font-bold">{error.field || tickerInput}</span>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-[#8b949e] mb-1">Spot Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={manualSpot}
                      onChange={(e) => setManualSpot(e.target.value)}
                      className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#58a6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8b949e] mb-1">Volatility</label>
                    <input
                      type="number"
                      step="0.01"
                      value={manualVol}
                      onChange={(e) => setManualVol(e.target.value)}
                      className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#58a6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8b949e] mb-1">Dividend Yield</label>
                    <input
                      type="number"
                      step="0.001"
                      value={manualDiv}
                      onChange={(e) => setManualDiv(e.target.value)}
                      className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#58a6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
                    />
                  </div>
                </div>

                <Link
                  href={`/workspace?ticker=${encodeURIComponent(
                    tickerInput
                  )}&market=${marketInput}&spot_override=${roundClean(manualSpot, 2)}&volatility=${roundClean(manualVol, 4)}&dividend_yield=${roundClean(manualDiv, 4)}`}
                  className="inline-flex items-center gap-2 bg-[#238636] hover:bg-[#2ea043] text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
                >
                  <span>Proceed to Workspace</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quote Display Grid */}
      {!loading && quote && (
        <div className="space-y-6">
          {/* Top Metric Header */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {quote.ticker}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e] font-mono">
                  {quote.market} &bull; {quote.resolved_symbol}
                </span>
                {quote.currency && (
                  <span className="text-xs px-2 py-0.5 rounded bg-[#0d1117] text-[#79c0ff] border border-[#21262d] font-mono">
                    {quote.currency}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8b949e] font-mono">
                Delayed Data (yfinance) &bull; Last Updated: {formatDateTime(quote.last_updated)}
              </p>
            </div>

            {/* Primary Spot Price & Return */}
            <div className="flex items-baseline gap-4">
              <div className="text-3xl font-extrabold text-white font-mono">
                {formatCurrency(quote.spot_price, quote.currency)}
              </div>
              <div
                className={`text-sm font-bold font-mono px-2.5 py-1 rounded ${
                  quote.daily_return >= 0
                    ? "bg-[#0d1117] text-[#3fb950] border border-[#30363d]"
                    : "bg-red-950 text-red-400 border border-red-800"
                }`}
              >
                {quote.daily_return >= 0 ? "+" : ""}
                {formatPercent(quote.daily_return)}
              </div>
            </div>

            {/* CTA Button to Workspace */}
            <Link
              href={`/workspace?ticker=${encodeURIComponent(
                quote.ticker
              )}&market=${quote.market}&spot_override=${roundClean(quote.spot_price, 2)}&volatility=${roundClean(
                quote.historical_volatility["252d"] || 0.25, 4
              )}&dividend_yield=${roundClean(quote.dividend_yield, 4)}`}
              className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold text-sm px-6 py-3 rounded-lg transition-colors shadow-lg shadow-[#0d1117]/40 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            >
              <span>Open in Pricing Workspace</span>
              <span>&rarr;</span>
            </Link>
          </div>

          {/* Data Warnings if present */}
          {quote.data_warnings && quote.data_warnings.length > 0 && (
            <div className="bg-[#161b22]/40 border border-[#30363d]/80 rounded-lg p-4 text-xs text-[#d29922] space-y-1 font-mono">
              <div className="font-bold text-[#d29922]">Data Quality Warning:</div>
              {quote.data_warnings.map((warn, i) => (
                <div key={i}>&bull; {warn}</div>
              ))}
            </div>
          )}

          {/* Historical Volatility Grid */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6">
            <h3 className="text-xs font-bold text-[#58a6ff] uppercase tracking-wider mb-4">
              Realized Historical Volatility (Close-to-Close Log Returns)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
                <span className="text-xs text-[#8b949e] font-mono block mb-1">20-Day Vol</span>
                <span className="text-xl font-bold font-mono text-white">
                  {formatPercent(quote.historical_volatility["20d"] || 0)}
                </span>
              </div>
              <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
                <span className="text-xs text-[#8b949e] font-mono block mb-1">60-Day Vol</span>
                <span className="text-xl font-bold font-mono text-white">
                  {formatPercent(quote.historical_volatility["60d"] || 0)}
                </span>
              </div>
              <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
                <span className="text-xs text-[#8b949e] font-mono block mb-1">126-Day Vol</span>
                <span className="text-xl font-bold font-mono text-white">
                  {formatPercent(quote.historical_volatility["126d"] || 0)}
                </span>
              </div>
              <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
                <span className="text-xs text-[#8b949e] font-mono block mb-1">252-Day Vol (1 Year)</span>
                <span className="text-xl font-bold font-mono text-[#58a6ff]">
                  {formatPercent(quote.historical_volatility["252d"] || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Secondary Financial Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6">
              <span className="text-xs font-bold text-[#8b949e] uppercase tracking-wider block mb-2">
                Dividend Yield (q)
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {formatPercent(quote.dividend_yield)}
              </span>
            </div>

            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6">
              <span className="text-xs font-bold text-[#8b949e] uppercase tracking-wider block mb-2">
                Market Capitalization
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {formatMarketCap(quote.market_cap)}
              </span>
            </div>

            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6">
              <span className="text-xs font-bold text-[#8b949e] uppercase tracking-wider block mb-2">
                Quote Currency
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {quote.currency}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
