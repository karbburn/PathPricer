"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { postPricePreview, getMarketQuote, ApiError } from "@/lib/api-client";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { serializeInputs } from "@/lib/url-state";
import { useDensity } from "@/lib/contexts/DensityContext";
import {
  MarketRegion,
  PricingPreviewResponse,
  PricingRequest,
  VarianceReductionMethod,
  PnLShift,
} from "@/lib/types";
import { TickerInput } from "@/app/components/TickerInput";

import { computeAtmStrike, roundClean, clampNum, formatPrice } from "@/lib/formatters";

interface InputPanelProps {
  initialInputs: PricingRequest;
  onInputsChange: (inputs: PricingRequest) => void;
  onPreviewSuccess: (result: PricingPreviewResponse) => void;
  onPreviewError: (error: ApiError | null) => void;
  onRunFullSimulation: (inputs: PricingRequest) => void;
  isFullSimulating: boolean;
  onMicroStateChange: (state: "pending" | "preview" | "error") => void;
  workspaceMode?: "pricing" | "implied_vol" | "pnl_explain";
  onWorkspaceModeChange?: (mode: "pricing" | "implied_vol" | "pnl_explain") => void;
  marketPrice?: number;
  onMarketPriceChange?: (price: number) => void;
  onSolveImpliedVol?: () => void;
  isSolvingIv?: boolean;
  pnlShift?: PnLShift;
  onPnLShiftChange?: (shift: PnLShift) => void;
  onCalculatePnLExplain?: () => void;
  isCalculatingPnL?: boolean;
  priceBounds?: { lower: number; upper: number } | null;
}

export function InputPanel({
  initialInputs,
  onInputsChange,
  onPreviewSuccess,
  onPreviewError,
  onRunFullSimulation,
  isFullSimulating,
  onMicroStateChange,
  workspaceMode = "pricing",
  onWorkspaceModeChange,
  marketPrice = 5.0,
  onMarketPriceChange,
  onSolveImpliedVol,
  isSolvingIv = false,
  pnlShift = { d_spot: 0, d_vol: 0, d_days: 0, d_rate: 0 },
  onPnLShiftChange,
  onCalculatePnLExplain,
  isCalculatingPnL = false,
  priceBounds = null,
}: InputPanelProps) {
  const [inputs, setInputs] = useState<PricingRequest>(initialInputs);
  const [seedLocked, setSeedLocked] = useState<boolean>(false);
  const [fetchingMarket, setFetchingMarket] = useState<boolean>(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketWarnings, setMarketWarnings] = useState<string[]>([]);
  const { density } = useDensity();

  const isMarketPriceOob = useMemo(() => {
    if (!priceBounds) return false;
    return marketPrice <= priceBounds.lower || marketPrice >= priceBounds.upper;
  }, [priceBounds, marketPrice]);

  // Dynamic strike bounds scaled to spot price level
  const currentSpot = inputs.spot_override ?? 100;
  const minStrike = Math.max(1, Math.floor(currentSpot * 0.25));
  const maxStrike = Math.ceil(currentSpot * 1.75);
  const strikeStep = currentSpot >= 1000 ? 5 : currentSpot >= 100 ? 1 : 0.5;

  // Debounce preview-triggering inputs (~200ms)
  const debouncedInputs = useDebounce(inputs, 200);

  // Request sequence ref & AbortController ref to prevent out-of-order race conditions
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to update a field in state and notify parent / update URL
  const updateField = useCallback(
    <K extends keyof PricingRequest>(field: K, value: PricingRequest[K]) => {
      setInputs((prev) => {
        const next = { ...prev, [field]: value };
        onInputsChange(next);

        // Update URL search query string dynamically without full page reload
        if (typeof window !== "undefined") {
          const queryStr = serializeInputs(next);
          const newUrl = `${window.location.pathname}?${queryStr}`;
          window.history.replaceState(null, "", newUrl);
        }
        return next;
      });
    },
    [onInputsChange]
  );

  // Auto-fetch market quote when ticker or market changes
  const handleMarketFetch = async () => {
    if (!inputs.ticker.trim()) return;
    setFetchingMarket(true);
    setMarketError(null);
    try {
      const quote = await getMarketQuote(inputs.ticker, inputs.market);
      setMarketWarnings(quote.data_warnings || []);
      setInputs((prev) => {
        const cleanSpot = roundClean(quote.spot_price, 2);
        const cleanVol = roundClean(quote.historical_volatility["252d"] || prev.volatility, 4);
        const cleanDiv = roundClean(quote.dividend_yield, 4);
        const atmStrike = computeAtmStrike(cleanSpot);

        const next: PricingRequest = {
          ...prev,
          spot_override: cleanSpot,
          volatility: cleanVol,
          dividend_yield: cleanDiv,
          strike: atmStrike,
        };
        onInputsChange(next);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `?${serializeInputs(next)}`);
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Failed to fetch market quote.";
      setMarketError(`Quote sync failed for ${inputs.ticker.trim().toUpperCase()}: ${message}`);
      setMarketWarnings([]);
    } finally {
      setFetchingMarket(false);
    }
  };

  // Preview Tier Debounce & Abort Effect
  useEffect(() => {
    if (workspaceMode !== "pricing") return;

    // Increment request ID counter for this update
    requestIdRef.current += 1;
    const currentReqId = requestIdRef.current;

    // Abort previous in-flight preview request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Notify parent of pending micro-state
    onMicroStateChange("pending");

    // Preview request payload (capped N simulations for preview tier: max 20,000)
    const previewPayload: PricingRequest = {
      ...debouncedInputs,
      n_simulations: Math.min(debouncedInputs.n_simulations, 10000),
    };

    postPricePreview(previewPayload, controller.signal)
      .then((data) => {
        // Race condition check: ignore if superseded or aborted
        if (requestIdRef.current !== currentReqId || controller.signal.aborted) {
          return;
        }
        onPreviewSuccess(data);
        onPreviewError(null);
        onMicroStateChange("preview");
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        if (requestIdRef.current !== currentReqId) return;
        onPreviewError(err as ApiError);
        onMicroStateChange("error");
      });

    return () => {
      controller.abort();
    };
  }, [debouncedInputs, onPreviewSuccess, onPreviewError, onMicroStateChange, workspaceMode]);

  const handleRandomizeSeed = () => {
    if (seedLocked) return;
    const newSeed = Math.floor(Math.random() * 1000000);
    updateField("seed", newSeed);
  };

  return (
    <div
      className={`card bg-[#161b22] border border-[#21262d] rounded-xl shadow-xl space-y-6 ${
        density === "compact" ? "p-4" : "p-6"
      }`}
    >
      {/* Mode Selector Tabs */}
      {onWorkspaceModeChange && (
        <div className="flex bg-[#0d1117] p-1 rounded-lg border border-[#21262d] gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => onWorkspaceModeChange("pricing")}
            className={`flex-1 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 text-xs font-bold rounded-md transition-all whitespace-nowrap px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
              workspaceMode === "pricing"
                ? "bg-[#238636] text-white shadow"
                : "text-[#8b949e] hover:text-white"
            }`}
          >
            Option Pricing
          </button>
          <button
            type="button"
            onClick={() => onWorkspaceModeChange("implied_vol")}
            className={`flex-1 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 text-xs font-bold rounded-md transition-all whitespace-nowrap px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
              workspaceMode === "implied_vol"
                ? "bg-[#238636] text-white shadow"
                : "text-[#8b949e] hover:text-white"
            }`}
          >
            Implied Volatility
          </button>
          <button
            type="button"
            onClick={() => onWorkspaceModeChange("pnl_explain")}
            className={`flex-1 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 text-xs font-bold rounded-md transition-all whitespace-nowrap px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
              workspaceMode === "pnl_explain"
                ? "bg-[#238636] text-white shadow"
                : "text-[#8b949e] hover:text-white"
            }`}
          >
            P&amp;L Explain
          </button>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
        <h2 className="text-lg font-bold text-white tracking-wide">
          {workspaceMode === "implied_vol"
            ? "IV Solver Inputs"
            : workspaceMode === "pnl_explain"
            ? "P&L Explain Base & Shift"
            : "Pricing Inputs"}
        </h2>
        <span className="text-xs text-[#8b949e] font-mono">
          {workspaceMode === "pricing" ? "Preview Auto-Debounced (~200ms)" : "Scenario Simulation"}
        </span>
      </div>


      {/* 1. Underlying Ticker & Market Selection */}
      <div className="section space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#58a6ff]">
          Underlying Asset
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 flex gap-2">
            <TickerInput
              value={inputs.ticker}
              onChange={(val) => updateField("ticker", val)}
              market={inputs.market}
            />
            <button
              type="button"
              onClick={handleMarketFetch}
              disabled={fetchingMarket}
              className="bg-[#30363d] hover:bg-[#3a424b] text-white text-xs px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded font-semibold transition-colors disabled:opacity-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            >
              {fetchingMarket ? "Syncing..." : "Sync Market"}
            </button>
          </div>

          <div className="flex bg-[#0d1117] p-1 rounded border border-[#30363d]">
            {(["US", "IN", "FX", "CRYPTO"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateField("market", m)}
                className={`flex-1 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-semibold rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
                  inputs.market === m
                    ? "bg-[#238636] text-white"
                    : "text-[#8b949e] hover:text-white"
                }`}
              >
                {m === "US" ? "US" : m === "IN" ? "IN (.NS)" : m === "FX" ? "FX" : "CRYPTO"}
              </button>
            ))}
          </div>
        </div>

        {marketError && (
          <p className="text-[11px] text-[#f85149] font-mono mt-1" role="alert">
            {marketError}
          </p>
        )}

        {marketWarnings.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {marketWarnings.map((w) => (
              <p key={w} className="text-[11px] text-[#d29922] font-mono">
                {w}
              </p>
            ))}
          </div>
        )}

        {/* Spot Price Override */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className={inputs.market === "CRYPTO" ? "col-span-2" : ""}>
            <label className="block text-xs text-[#8b949e] mb-1">Spot Price (S₀)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={inputs.spot_override ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value);
                updateField(
                  "spot_override",
                  e.target.value.trim() === "" || !Number.isFinite(v)
                    ? null
                    : Math.max(0.01, roundClean(v, 2))
                );
              }}
              placeholder="Market default"
              aria-label="Spot price (S₀)"
              className="input-field w-full bg-[#0d1117] border border-[#30363d]/50 rounded px-3 py-1.5 text-sm text-white font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            />
          </div>
          {inputs.market !== "CRYPTO" && (
            <div>
              <label className="block text-xs text-[#8b949e] mb-1">
                {inputs.market === "FX" ? "Foreign Rate (r_f)" : "Dividend Yield (q)"}
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                max="1"
                value={inputs.dividend_yield ?? 0}
                onChange={(e) => updateField("dividend_yield", roundClean(clampNum(e.target.value, 0, 1.0, inputs.dividend_yield ?? 0), 4))}
                aria-label={inputs.market === "FX" ? "Foreign rate (r_f)" : "Dividend yield (q)"}
                className="input-field w-full bg-[#0d1117] border border-[#30363d]/50 rounded px-3 py-1.5 text-sm text-white font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              />
              {(!inputs.dividend_yield || inputs.dividend_yield === 0) && (
                <p className="text-[10px] text-[#58a6ff]/90 mt-1 font-mono flex items-center gap-1">
                  <span className="text-[#d29922]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                  {inputs.market === "FX" ? "Foreign rate 0.0% (defaulted)" : "Dividend yield 0.0% (defaulted/no payout)"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Option Type & Strike Price */}
      <div className="section space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[#58a6ff]">
            Contract Terms
          </label>
          <div className="flex bg-[#0d1117] p-1 rounded border border-[#30363d]">
            <button
              type="button"
              onClick={() => updateField("option_type", "call")}
              className={`px-3 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-bold rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
                inputs.option_type === "call"
                  ? "bg-[#30363d] text-white"
                  : "text-[#8b949e] hover:text-white"
              }`}
            >
              CALL
            </button>
            <button
              type="button"
              onClick={() => updateField("option_type", "put")}
              className={`px-3 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-bold rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
                inputs.option_type === "put"
                  ? "bg-[#30363d] text-white"
                  : "text-[#8b949e] hover:text-white"
              }`}
            >
              PUT
            </button>
          </div>
        </div>

        {/* Strike Price Dual Input (Slider + Box) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-[#8b949e]">Strike Price (K)</label>
              <input
                type="number"
                step={strikeStep}
                min={minStrike}
                max={maxStrike}
                value={inputs.strike}
                onChange={(e) => updateField("strike", clampNum(e.target.value, minStrike, maxStrike, inputs.strike))}
                aria-label="Strike price (K)"
                className="input-field w-24 bg-[#0d1117] border border-[#30363d]/50 rounded px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-mono text-right text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              />
          </div>
          <input
            type="range"
            min={minStrike}
            max={maxStrike}
            step={strikeStep}
            value={inputs.strike}
            onChange={(e) => updateField("strike", Number(e.target.value))}
            aria-label="Strike price (K)"
            className="w-full accent-[#58a6ff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
          />
        </div>

        {/* Expiry Date */}
        <div>
          <label className="block text-xs text-[#8b949e] mb-1">Expiration Date</label>
          <input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={inputs.expiry_date}
            onChange={(e) => {
              const next = e.target.value;
              const todayStr = new Date().toISOString().slice(0, 10);
              if (next && next <= todayStr) return;
              updateField("expiry_date", next);
            }}
            aria-label="Expiration date"
            className="input-field w-full bg-[#0d1117] border border-[#30363d]/50 rounded px-3 py-2 text-sm text-white font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
          />
        </div>
      </div>

      {/* 3. Market Risk Parameters */}
      <div className="section space-y-3 pt-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#58a6ff]">
          {workspaceMode === "implied_vol" ? "Target Market Price & Rates" : "Risk & Volatility Parameters"}
        </label>

        {workspaceMode === "implied_vol" ? (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-[#79c0ff]">
                Market Option Price (V_mkt)
              </label>
            </div>
            <input
              type="number"
              step="0.05"
              min="0.01"
              value={marketPrice}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                onMarketPriceChange && onMarketPriceChange(Number.isFinite(parsed) ? parsed : 0);
              }}
              className={`input-field w-full bg-[#0d1117] rounded px-3 py-2 text-sm font-mono text-white font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
                isMarketPriceOob
                  ? "border border-[#d29922]/70 focus:border-[#d29922] focus-visible:ring-[#d29922]/60"
                  : "border border-[#58a6ff]/60 focus:border-[#58a6ff] focus-visible:ring-[#58a6ff]/60"
              }`}
              placeholder="e.g. 5.25"
            />
            {priceBounds && (
              <div className="mt-1.5 space-y-1">
                <p className="text-[11px] text-[#8b949e] font-mono">
                  Valid range: {formatPrice(priceBounds.lower, 2)} – {formatPrice(priceBounds.upper, 2)}
                </p>
                {isMarketPriceOob && (
                  <p className="text-[11px] text-[#d29922] font-mono">
                    Outside theoretical bounds — the IV solver cannot find a solution at this price.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[#8b949e]">
                Volatility (σ): {(inputs.volatility * 100).toFixed(1)}%
              </label>
              <input
                type="number"
                step="0.01"
                min="0.001"
                max="5"
                value={inputs.volatility}
                onChange={(e) => updateField("volatility", roundClean(clampNum(e.target.value, 0.001, 5.0, inputs.volatility), 4))}
                aria-label="Volatility (σ)"
                className="input-field w-24 bg-[#0d1117] border border-[#30363d]/50 rounded px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-mono text-right text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              />
            </div>
          </div>
        )}

        {/* Risk-Free Rate Dual Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-[#8b949e]">
                Risk-Free Rate (r): {(inputs.risk_free_rate * 100).toFixed(1)}%
              </label>
              <input
                type="number"
                step="0.005"
                min="-0.02"
                max="0.20"
                value={inputs.risk_free_rate}
                onChange={(e) => updateField("risk_free_rate", roundClean(clampNum(e.target.value, -0.02, 0.20, inputs.risk_free_rate), 4))}
                aria-label="Risk-free rate (r)"
                className="input-field w-24 bg-[#0d1117] border border-[#30363d]/50 rounded px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-mono text-right text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              />
          </div>
            <input
              type="range"
              min="-0.02"
              max="0.20"
              step="0.0025"
              value={inputs.risk_free_rate}
              onChange={(e) => updateField("risk_free_rate", roundClean(Number(e.target.value), 4))}
              aria-label="Risk-free rate (r)"
              className="w-full accent-[#58a6ff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            />
        </div>
      </div>

      {/* 4. Simulation Engine Controls (Pricing Mode Only) */}
      {workspaceMode === "pricing" && (
        <div className="section space-y-3 pt-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#58a6ff]">
            Simulation Controls
          </label>

          {/* N Simulations Presets */}
          <div>
            <label className="block text-xs text-[#8b949e] mb-1">
              Simulations (N): {inputs.n_simulations.toLocaleString()}
            </label>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {[10000, 50000, 100000, 500000, 1000000].map((nVal) => (
                <button
                  key={nVal}
                  type="button"
                  onClick={() => updateField("n_simulations", nVal)}
                  className={`py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-mono rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
                    inputs.n_simulations === nVal
                      ? "bg-[#238636] text-white font-bold"
                      : "bg-[#0d1117] text-[#8b949e] hover:text-white border border-[#21262d]"
                  }`}
                >
                  {nVal >= 1000000 ? `${nVal / 1000000}M` : `${nVal / 1000}k`}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="1000"
              max="2000000"
              step="5000"
              value={inputs.n_simulations}
              onChange={(e) => updateField("n_simulations", Number(e.target.value))}
              aria-label="Number of simulations (N)"
              className="w-full accent-[#58a6ff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            />
          </div>

          {/* Variance Reduction Selector */}
          <div>
            <label className="block text-xs text-[#8b949e] mb-1">Variance Reduction Method</label>
            <select
              value={inputs.variance_reduction}
              onChange={(e) =>
                updateField("variance_reduction", e.target.value as VarianceReductionMethod)
              }
              aria-label="Variance reduction method"
              className="input-field w-full bg-[#0d1117] border border-[#30363d]/50 rounded px-3 py-2 text-xs font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            >
              <option value="all">All 5 Estimators (Standard / Anti / CV / Combined / RQMC)</option>
              <option value="standard">Standard Monte Carlo</option>
              <option value="antithetic">Antithetic Variates</option>
              <option value="control_variate">Control Variates (S_T)</option>
              <option value="antithetic_cv">Combined Antithetic + CV</option>
              <option value="quasi_monte_carlo">Randomized QMC (Sobol)</option>
            </select>
          </div>

          {/* Seed Control (Randomize + Lock Button) */}
          <div>
            <label className="block text-xs text-[#8b949e] mb-1">RNG Seed</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={inputs.seed}
                disabled={seedLocked}
                onChange={(e) => updateField("seed", Number(e.target.value))}
                aria-label="RNG seed"
                className="input-field flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-xs font-mono text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              />
              <button
                type="button"
                onClick={handleRandomizeSeed}
                disabled={seedLocked}
                className="bg-[#30363d] hover:bg-[#3a424b] text-white text-xs px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded font-mono disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              >
                Randomize
              </button>
              <button
                type="button"
                onClick={() => setSeedLocked(!seedLocked)}
                className={`text-xs px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded font-mono border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
                  seedLocked
                    ? "bg-[#161b22] border-[#30363d] text-[#d29922]"
                    : "bg-[#161b22] border-[#30363d] text-[#8b949e] hover:text-white"
                }`}
              >
                {seedLocked ? "Locked" : "Unlocked"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Scenario Shift Parameters (P&L Explain Mode Only) */}
      {workspaceMode === "pnl_explain" && (
        <div className="section space-y-3 pt-3 border-t border-[#21262d]">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#58a6ff]">
            Hypothetical Scenario Shifts
          </label>

          {/* Spot Shift (dS) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[#8b949e]">
                Spot Shift (ΔS): {pnlShift.d_spot >= 0 ? `+${pnlShift.d_spot}` : pnlShift.d_spot}
              </label>
              <input
                type="number"
                step="0.5"
                value={pnlShift.d_spot}
                onChange={(e) =>
                  onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_spot: Number(e.target.value) })
                }
                aria-label="Spot shift (ΔS)"
                className="input-field w-24 bg-[#0d1117] border border-[#58a6ff]/50 rounded px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-mono text-right text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              />
            </div>
            <input
              type="range"
              min={-Math.round(currentSpot * 0.3)}
              max={Math.round(currentSpot * 0.3)}
              step="0.5"
              value={pnlShift.d_spot}
              onChange={(e) =>
                onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_spot: Number(e.target.value) })
              }
              aria-label="Spot shift (ΔS)"
              className="w-full accent-[#58a6ff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            />
          </div>

          {/* Volatility Shift (d_vol) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[#8b949e]">
                Volatility Shift (Δσ): {(pnlShift.d_vol * 100).toFixed(1)}%
              </label>
              <input
                type="number"
                step="0.005"
                value={pnlShift.d_vol}
                onChange={(e) =>
                  onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_vol: roundClean(Number(e.target.value), 4) })
                }
                aria-label="Volatility shift (Δσ)"
                className="input-field w-24 bg-[#0d1117] border border-[#58a6ff]/50 rounded px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-mono text-right text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              />
            </div>
            <input
              type="range"
              min="-0.20"
              max="0.20"
              step="0.005"
              value={pnlShift.d_vol}
              onChange={(e) =>
                onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_vol: roundClean(Number(e.target.value), 4) })
              }
              aria-label="Volatility shift (Δσ)"
              className="w-full accent-[#58a6ff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            />
          </div>

          {/* Elapsed Days (d_days) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[#8b949e]">
                Time Elapsed (Δt): {pnlShift.d_days} days
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="180"
                value={pnlShift.d_days}
                onChange={(e) =>
                  onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_days: Math.min(180, Math.max(0, Number(e.target.value))) })
                }
                aria-label="Time elapsed (Δt)"
                className="input-field w-24 bg-[#0d1117] border border-[#58a6ff]/50 rounded px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-mono text-right text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              />
            </div>
            <input
              type="range"
              min="0"
              max="180"
              step="1"
              value={pnlShift.d_days}
              onChange={(e) =>
                onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_days: Number(e.target.value) })
              }
              aria-label="Time elapsed (Δt)"
              className="w-full accent-[#58a6ff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            />
          </div>

          {/* Rate Shift (d_rate) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[#8b949e]">
                Rate Shift (Δr): {(pnlShift.d_rate * 10000).toFixed(0)} bps
              </label>
              <input
                type="number"
                step="0.001"
                min="-0.05"
                max="0.05"
                value={pnlShift.d_rate}
                onChange={(e) =>
                  onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_rate: roundClean(Math.min(0.05, Math.max(-0.05, Number(e.target.value))), 4) })
                }
                aria-label="Rate shift (Δr)"
                className="input-field w-24 bg-[#0d1117] border border-[#58a6ff]/50 rounded px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-xs font-mono text-right text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              />
            </div>
            <input
              type="range"
              min="-0.05"
              max="0.05"
              step="0.001"
              value={pnlShift.d_rate}
              onChange={(e) =>
                onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_rate: roundClean(Number(e.target.value), 4) })
              }
              aria-label="Rate shift (Δr)"
              className="w-full accent-[#58a6ff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            />
          </div>
        </div>
      )}

      {/* 5. Primary CTA */}
      <div className="pt-4">
        {workspaceMode === "implied_vol" ? (
          <button
            type="button"
            disabled={isSolvingIv}
            onClick={onSolveImpliedVol}
            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold text-sm py-3.5 px-4 rounded-lg shadow-lg shadow-[#0d1117]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
          >
            <span>{isSolvingIv ? "Solving Volatility..." : <><svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Solve Implied Volatility</>}</span>
          </button>
        ) : workspaceMode === "pnl_explain" ? (
          <button
            type="button"
            disabled={isCalculatingPnL}
            onClick={onCalculatePnLExplain}
            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold text-sm py-3.5 px-4 rounded-lg shadow-lg shadow-[#0d1117]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
          >
            <span>{isCalculatingPnL ? "Calculating P&L Attribution..." : <><svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg> Explain P&L Attribution</>}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isFullSimulating}
              onClick={() => onRunFullSimulation(inputs)}
              className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold text-sm py-3.5 px-4 rounded-lg shadow-lg shadow-[#0d1117]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
            >
              <span>{isFullSimulating ? "Simulating..." : "▶ Run Full Simulation"}</span>
              <span className="text-xs font-mono text-white">(N={inputs.n_simulations.toLocaleString()})</span>
            </button>
            <p className="text-[11px] text-[#8b949e] text-center mt-1.5 font-mono">
              <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[#b1bac4] text-[10px]">Ctrl</kbd>
              {" + "}
              <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[#b1bac4] text-[10px]">Enter</kbd>
            </p>
          </>
        )}
      </div>
    </div>
  );

}
