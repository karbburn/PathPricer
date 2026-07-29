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
} from "@/lib/formatters";

const PRESET_TICKERS: Array<{ ticker: string; market: MarketRegion; name: string }> = [
  { ticker: "AAPL", market: "US", name: "Apple Inc." },
  { ticker: "MSFT", market: "US", name: "Microsoft Corp." },
  { ticker: "RELIANCE", market: "IN", name: "Reliance Industries" },
  { ticker: "TCS", market: "IN", name: "Tata Consultancy Services" },
  { ticker: "SPY", market: "US", name: "S&P 500 ETF Trust" },
];

export default function MarketOverviewPage() {
  const [tickerInput, setTickerInput] = useState<string>("AAPL");
  const [marketInput, setMarketInput] = useState<MarketRegion>("US");
  const [quote, setQuote] = useState<MarketQuoteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Manual fallback input state for 404 / resolution failures
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
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMarketQuote("AAPL", "US");
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
    })();
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
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          Market Overview
        </h1>
        <p className="text-sm text-gray-400">
          Inspect underlying asset market data, historical volatility windows, and dividend yields before pricing options.
        </p>
      </div>

      {/* Search Bar & Market Selector */}
      <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-6 mb-8">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-4">
          {/* Market Toggle */}
          <div className="flex bg-gray-900 p-1 rounded border border-gray-700 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setMarketInput("US")}
              className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                marketInput === "US"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              US Market
            </button>
            <button
              type="button"
              onClick={() => setMarketInput("IN")}
              className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                marketInput === "IN"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              IN Market (.NS)
            </button>
          </div>

          {/* Ticker Input */}
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              placeholder="Enter ticker (e.g. RELIANCE, AAPL, MSFT)"
              className="w-full bg-gray-950 border border-gray-700 rounded px-4 py-2.5 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {marketInput === "IN" && (
              <span className="absolute right-3 top-3 text-xs text-gray-500 font-mono">
                Auto-appends .NS
              </span>
            )}
          </div>

          {/* Fetch Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-2.5 rounded transition-colors disabled:opacity-50"
          >
            {loading ? "Fetching..." : "Fetch Quote"}
          </button>
        </form>

        {/* Preset Quick Tickers */}
        <div className="mt-4 pt-4 border-t border-gray-700/60 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 mr-2 font-medium">Quick Presets:</span>
          {PRESET_TICKERS.map((item) => (
            <button
              key={item.ticker}
              onClick={() => handlePresetClick(item.ticker, item.market)}
              className="text-xs bg-gray-900 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1 rounded transition-colors font-mono"
            >
              {item.ticker} ({item.market})
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-8 text-center animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/4 mx-auto mb-4"></div>
          <div className="h-12 bg-gray-700 rounded w-1/2 mx-auto mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
          </div>
        </div>
      )}

      {/* 404 Error State & Manual Fallback Form */}
      {!loading && error && (
        <div className="bg-slate-900 border border-red-500/40 rounded-lg overflow-hidden mb-8">
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
            <p className="text-sm text-slate-300 leading-relaxed">{error.message}</p>

            {error.fallback_available && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 mt-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Manual Entry Available
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Enter parameters manually to proceed to the Pricing Workspace for <span className="text-slate-400 font-mono font-bold">{error.field || tickerInput}</span>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Spot Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={manualSpot}
                      onChange={(e) => setManualSpot(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Volatility</label>
                    <input
                      type="number"
                      step="0.01"
                      value={manualVol}
                      onChange={(e) => setManualVol(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Dividend Yield</label>
                    <input
                      type="number"
                      step="0.001"
                      value={manualDiv}
                      onChange={(e) => setManualDiv(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <Link
                  href={`/workspace?ticker=${encodeURIComponent(
                    tickerInput
                  )}&market=${marketInput}&spot_override=${manualSpot}&volatility=${manualVol}&dividend_yield=${manualDiv}`}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
                >
                  <span>Proceed to Workspace</span>
                  <span className="text-blue-300">&rarr;</span>
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
          <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {quote.ticker}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 font-mono">
                  {quote.market} &bull; {quote.resolved_symbol}
                </span>
                {quote.currency && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                    {quote.currency}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono">
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
                    ? "bg-green-950 text-green-400 border border-green-800"
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
              )}&market=${quote.market}&spot_override=${quote.spot_price}&volatility=${
                quote.historical_volatility["252d"] || 0.25
              }&dividend_yield=${quote.dividend_yield}`}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-lg transition-colors shadow-lg shadow-blue-900/40 flex items-center gap-2"
            >
              <span>Open in Pricing Workspace</span>
              <span>&rarr;</span>
            </Link>
          </div>

          {/* Data Warnings if present */}
          {quote.data_warnings && quote.data_warnings.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-800/80 rounded-lg p-4 text-xs text-amber-300 space-y-1 font-mono">
              <div className="font-bold text-amber-200">Data Quality Warning:</div>
              {quote.data_warnings.map((warn, i) => (
                <div key={i}>&bull; {warn}</div>
              ))}
            </div>
          )}

          {/* Historical Volatility Grid */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-6">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-4">
              Realized Historical Volatility (Close-to-Close Log Returns)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-950 p-4 rounded border border-gray-800">
                <span className="text-xs text-gray-500 font-mono block mb-1">20-Day Vol</span>
                <span className="text-xl font-bold font-mono text-white">
                  {formatPercent(quote.historical_volatility["20d"] || 0)}
                </span>
              </div>
              <div className="bg-gray-950 p-4 rounded border border-gray-800">
                <span className="text-xs text-gray-500 font-mono block mb-1">60-Day Vol</span>
                <span className="text-xl font-bold font-mono text-white">
                  {formatPercent(quote.historical_volatility["60d"] || 0)}
                </span>
              </div>
              <div className="bg-gray-950 p-4 rounded border border-gray-800">
                <span className="text-xs text-gray-500 font-mono block mb-1">126-Day Vol</span>
                <span className="text-xl font-bold font-mono text-white">
                  {formatPercent(quote.historical_volatility["126d"] || 0)}
                </span>
              </div>
              <div className="bg-gray-950 p-4 rounded border border-gray-800">
                <span className="text-xs text-gray-500 font-mono block mb-1">252-Day Vol (1 Year)</span>
                <span className="text-xl font-bold font-mono text-blue-400">
                  {formatPercent(quote.historical_volatility["252d"] || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Secondary Financial Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-6">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Dividend Yield (q)
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {formatPercent(quote.dividend_yield)}
              </span>
            </div>

            <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-6">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Market Capitalization
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {formatMarketCap(quote.market_cap)}
              </span>
            </div>

            <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-6">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
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
