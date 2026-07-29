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

import { computeAtmStrike, roundClean } from "@/lib/formatters";

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
}: InputPanelProps) {
  const [inputs, setInputs] = useState<PricingRequest>(initialInputs);
  const [seedLocked, setSeedLocked] = useState<boolean>(false);
  const [fetchingMarket, setFetchingMarket] = useState<boolean>(false);
  const { density } = useDensity();

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
    try {
      const quote = await getMarketQuote(inputs.ticker, inputs.market);
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
    } catch {
      // Ignore market fetch failure — manual spot override remains
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
      className={`bg-slate-900 border border-slate-800 rounded-xl shadow-xl space-y-6 ${
        density === "compact" ? "p-4" : "p-6"
      }`}
    >
      {/* Mode Selector Tabs */}
      {onWorkspaceModeChange && (
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => onWorkspaceModeChange("pricing")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap px-2 ${
              workspaceMode === "pricing"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Option Pricing
          </button>
          <button
            type="button"
            onClick={() => onWorkspaceModeChange("implied_vol")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap px-2 ${
              workspaceMode === "implied_vol"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Implied Volatility
          </button>
          <button
            type="button"
            onClick={() => onWorkspaceModeChange("pnl_explain")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap px-2 ${
              workspaceMode === "pnl_explain"
                ? "bg-teal-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            P&amp;L Explain
          </button>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-lg font-bold text-white tracking-wide">
          {workspaceMode === "implied_vol"
            ? "IV Solver Inputs"
            : workspaceMode === "pnl_explain"
            ? "P&L Explain Base & Shift"
            : "Pricing Inputs"}
        </h2>
        <span className="text-xs text-slate-300 font-mono">
          {workspaceMode === "pricing" ? "Preview Auto-Debounced (~200ms)" : "Scenario Simulation"}
        </span>
      </div>


      {/* 1. Underlying Ticker & Market Selection */}
      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">
          Underlying Asset
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 flex gap-2">
            <TickerInput
              value={inputs.ticker}
              onChange={(val) => updateField("ticker", val)}
              market={inputs.market}
              placeholder="Ticker (e.g. AAPL)"
              accentColor="cyan"
            />
            <button
              type="button"
              onClick={handleMarketFetch}
              disabled={fetchingMarket}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {fetchingMarket ? "Syncing..." : "Sync Market"}
            </button>
          </div>

          <div className="flex bg-slate-950 p-1 rounded border border-slate-700">
            <button
              type="button"
              onClick={() => updateField("market", "US")}
              className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                inputs.market === "US"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              US
            </button>
            <button
              type="button"
              onClick={() => updateField("market", "IN")}
              className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                inputs.market === "IN"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              IN (.NS)
            </button>
          </div>
        </div>

        {/* Spot Price Override */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Spot Price (S₀)</label>
            <input
              type="number"
              step="0.01"
              value={inputs.spot_override ?? ""}
              onChange={(e) =>
                updateField("spot_override", e.target.value ? roundClean(Number(e.target.value), 2) : null)
              }
              placeholder="Market default"
              className="w-full bg-slate-950 border border-slate-700/50 rounded px-3 py-1.5 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Dividend Yield (q)</label>
            <input
              type="number"
              step="0.001"
              value={inputs.dividend_yield ?? 0}
              onChange={(e) => updateField("dividend_yield", roundClean(Number(e.target.value), 4))}
              className="w-full bg-slate-950 border border-slate-700/50 rounded px-3 py-1.5 text-sm text-white font-mono"
            />
            {(!inputs.dividend_yield || inputs.dividend_yield === 0) && (
              <p className="text-[10px] text-amber-400/90 mt-1 font-mono flex items-center gap-1">
                <span>⚠️</span> Dividend yield 0.0% (defaulted/no payout)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Option Type & Strike Price */}
      <div className="space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Contract Terms
          </label>
          <div className="flex bg-slate-950 p-1 rounded border border-slate-700">
            <button
              type="button"
              onClick={() => updateField("option_type", "call")}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                inputs.option_type === "call"
                  ? "bg-green-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              CALL
            </button>
            <button
              type="button"
              onClick={() => updateField("option_type", "put")}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                inputs.option_type === "put"
                  ? "bg-red-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              PUT
            </button>
          </div>
        </div>

        {/* Strike Price Dual Input (Slider + Box) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-300">Strike Price (K)</label>
            <input
              type="number"
              step={strikeStep}
              value={inputs.strike}
              onChange={(e) => updateField("strike", Number(e.target.value))}
              className="w-24 bg-slate-950 border border-slate-700/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
            />
          </div>
          <input
            type="range"
            min={minStrike}
            max={maxStrike}
            step={strikeStep}
            value={inputs.strike}
            onChange={(e) => updateField("strike", Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Expiry Date */}
        <div>
          <label className="block text-xs text-slate-300 mb-1">Expiration Date</label>
          <input
            type="date"
            value={inputs.expiry_date}
            onChange={(e) => updateField("expiry_date", e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/50 rounded px-3 py-2 text-sm text-white font-mono"
          />
        </div>
      </div>

      {/* 3. Market Risk Parameters */}
      <div className="space-y-3 pt-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">
          {workspaceMode === "implied_vol" ? "Target Market Price & Rates" : "Risk & Volatility Parameters"}
        </label>

        {workspaceMode === "implied_vol" ? (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-purple-300">
                Market Option Price (V_mkt)
              </label>
            </div>
            <input
              type="number"
              step="0.05"
              min="0.01"
              value={marketPrice}
              onChange={(e) => onMarketPriceChange && onMarketPriceChange(Number(e.target.value))}
              className="w-full bg-slate-950 border border-purple-500/60 focus:border-purple-400 rounded px-3 py-2 text-sm font-mono text-white font-bold"
              placeholder="e.g. 5.25"
            />
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-300">
                Volatility (σ): {(inputs.volatility * 100).toFixed(1)}%
              </label>
              <input
                type="number"
                step="0.01"
                value={inputs.volatility}
                onChange={(e) => updateField("volatility", roundClean(Number(e.target.value), 4))}
                className="w-24 bg-slate-950 border border-slate-700/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
              />
            </div>
            <input
              type="range"
              min="0.01"
              max="2.00"
              step="0.01"
              value={inputs.volatility}
              onChange={(e) => updateField("volatility", roundClean(Number(e.target.value), 4))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        )}

        {/* Risk-Free Rate Dual Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-300">
              Risk-Free Rate (r): {(inputs.risk_free_rate * 100).toFixed(1)}%
            </label>
            <input
              type="number"
              step="0.005"
              value={inputs.risk_free_rate}
              onChange={(e) => updateField("risk_free_rate", roundClean(Number(e.target.value), 4))}
              className="w-24 bg-slate-950 border border-slate-700/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
            />
          </div>
          <input
            type="range"
            min="-0.02"
            max="0.20"
            step="0.0025"
            value={inputs.risk_free_rate}
            onChange={(e) => updateField("risk_free_rate", roundClean(Number(e.target.value), 4))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>
      </div>

      {/* 4. Simulation Engine Controls (Pricing Mode Only) */}
      {workspaceMode === "pricing" && (
        <div className="space-y-3 pt-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">
            Simulation Controls
          </label>

          {/* N Simulations Presets */}
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Simulations (N): {inputs.n_simulations.toLocaleString()}
            </label>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {[10000, 50000, 100000, 500000, 1000000].map((nVal) => (
                <button
                  key={nVal}
                  type="button"
                  onClick={() => updateField("n_simulations", nVal)}
                  className={`py-1 text-xs font-mono rounded transition-colors ${
                    inputs.n_simulations === nVal
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
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
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Variance Reduction Selector */}
          <div>
            <label className="block text-xs text-slate-300 mb-1">Variance Reduction Method</label>
            <select
              value={inputs.variance_reduction}
              onChange={(e) =>
                updateField("variance_reduction", e.target.value as VarianceReductionMethod)
              }
              className="w-full bg-slate-950 border border-slate-700/50 rounded px-3 py-2 text-xs font-mono text-white"
            >
              <option value="all">All 4 Estimators (Standard / Anti / CV / Combined)</option>
              <option value="standard">Standard Monte Carlo</option>
              <option value="antithetic">Antithetic Variates</option>
              <option value="control_variate">Control Variates (S_T)</option>
              <option value="antithetic_cv">Combined Antithetic + CV</option>
            </select>
          </div>

          {/* Seed Control (Randomize + Lock Button) */}
          <div>
            <label className="block text-xs text-slate-300 mb-1">RNG Seed</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={inputs.seed}
                disabled={seedLocked}
                onChange={(e) => updateField("seed", Number(e.target.value))}
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-white disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleRandomizeSeed}
                disabled={seedLocked}
                className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded font-mono disabled:opacity-50"
              >
                Randomize
              </button>
              <button
                type="button"
                onClick={() => setSeedLocked(!seedLocked)}
                className={`text-xs px-3 py-1.5 rounded font-mono border transition-colors ${
                  seedLocked
                    ? "bg-amber-950 border-amber-700 text-amber-300"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
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
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <label className="block text-xs font-bold uppercase tracking-wider text-teal-400">
            Hypothetical Scenario Shifts
          </label>

          {/* Spot Shift (dS) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-300">
                Spot Shift (ΔS): {pnlShift.d_spot >= 0 ? `+${pnlShift.d_spot}` : pnlShift.d_spot}
              </label>
              <input
                type="number"
                step="0.5"
                value={pnlShift.d_spot}
                onChange={(e) =>
                  onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_spot: Number(e.target.value) })
                }
                className="w-24 bg-slate-950 border border-teal-500/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
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
              className="w-full accent-teal-500 cursor-pointer"
            />
          </div>

          {/* Volatility Shift (d_vol) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-300">
                Volatility Shift (Δσ): {(pnlShift.d_vol * 100).toFixed(1)}%
              </label>
              <input
                type="number"
                step="0.005"
                value={pnlShift.d_vol}
                onChange={(e) =>
                  onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_vol: roundClean(Number(e.target.value), 4) })
                }
                className="w-24 bg-slate-950 border border-teal-500/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
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
              className="w-full accent-teal-500 cursor-pointer"
            />
          </div>

          {/* Elapsed Days (d_days) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-300">
                Time Elapsed (Δt): {pnlShift.d_days} days
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="180"
                value={pnlShift.d_days}
                onChange={(e) =>
                  onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_days: Math.max(0, Number(e.target.value)) })
                }
                className="w-24 bg-slate-950 border border-teal-500/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
              />
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={pnlShift.d_days}
              onChange={(e) =>
                onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_days: Number(e.target.value) })
              }
              className="w-full accent-teal-500 cursor-pointer"
            />
          </div>

          {/* Rate Shift (d_rate) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-300">
                Rate Shift (Δr): {(pnlShift.d_rate * 10000).toFixed(0)} bps
              </label>
              <input
                type="number"
                step="0.001"
                value={pnlShift.d_rate}
                onChange={(e) =>
                  onPnLShiftChange && onPnLShiftChange({ ...pnlShift, d_rate: roundClean(Number(e.target.value), 4) })
                }
                className="w-24 bg-slate-950 border border-teal-500/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
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
              className="w-full accent-teal-500 cursor-pointer"
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
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm py-3.5 px-4 rounded-lg shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span>{isSolvingIv ? "Solving Volatility..." : "⚡ Solve Implied Volatility"}</span>
          </button>
        ) : workspaceMode === "pnl_explain" ? (
          <button
            type="button"
            disabled={isCalculatingPnL}
            onClick={onCalculatePnLExplain}
            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm py-3.5 px-4 rounded-lg shadow-lg shadow-teal-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span>{isCalculatingPnL ? "Calculating P&L Attribution..." : "📊 Explain P&L Attribution"}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isFullSimulating}
              onClick={() => onRunFullSimulation(inputs)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3.5 px-4 rounded-lg shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{isFullSimulating ? "Simulating..." : "▶ Run Full Simulation"}</span>
              <span className="text-xs font-mono text-blue-200">(N={inputs.n_simulations.toLocaleString()})</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-1.5 font-mono">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px]">Ctrl</kbd>
              {" + "}
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px]">Enter</kbd>
            </p>
          </>
        )}
      </div>
    </div>
  );

}
