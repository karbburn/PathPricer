"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InputPanel } from "./InputPanel";
import { ResultsPanel } from "./ResultsPanel";
import { ExportControls } from "./ExportControls";
import { ChartTabContainer } from "./charts/ChartTabContainer";
import { postPriceFull, postImpliedVol, postPnLExplain, ApiError } from "@/lib/api-client";
import { getEffectiveInputs, serializeInputs } from "@/lib/url-state";
import {
  ImpliedVolRequest,
  ImpliedVolResponse,
  PnLShift,
  PnLExplainRequest,
  PnLExplainResponse,
  PricingFullResponse,
  PricingPreviewResponse,
  PricingRequest,
} from "@/lib/types";

function WorkspaceContent() {
  const searchParams = useSearchParams();

  const inputs = getEffectiveInputs(
    Object.fromEntries(searchParams.entries())
  );

  const [workspaceMode, setWorkspaceMode] = useState<"pricing" | "implied_vol" | "pnl_explain">("pricing");
  const [marketPrice, setMarketPrice] = useState<number>(5.0);
  const [impliedVolResult, setImpliedVolResult] = useState<ImpliedVolResponse | null>(null);
  const [isSolvingIv, setIsSolvingIv] = useState<boolean>(false);

  const [pnlShift, setPnLShift] = useState<PnLShift>({
    d_spot: 5.0,
    d_vol: 0.02,
    d_days: 3,
    d_rate: 0.0025,
  });
  const [pnlExplainResult, setPnLExplainResult] = useState<PnLExplainResponse | null>(null);
  const [isCalculatingPnL, setIsCalculatingPnL] = useState<boolean>(false);

  const [previewResult, setPreviewResult] =
    useState<PricingPreviewResponse | null>(null);
  const [fullResult, setFullResult] = useState<PricingFullResponse | null>(null);
  const [microState, setMicroState] = useState<"pending" | "preview" | "error">(
    "pending"
  );
  const [activeTier, setActiveTier] = useState<"preview" | "full">("preview");
  const [isFullSimulating, setIsFullSimulating] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  const handleWorkspaceModeChange = (mode: "pricing" | "implied_vol" | "pnl_explain") => {
    setWorkspaceMode(mode);
    setError(null);
  };

  // Reset to preview tier when URL params change (unless full sim was just run)
  const handleInputsChange = () => {
    if (activeTier === "full") {
      setActiveTier("preview");
    }
  };

  const handlePreviewSuccess = useCallback(
    (result: PricingPreviewResponse) => {
      setPreviewResult(result);
    },
    []
  );

  const handlePreviewError = useCallback((err: ApiError | null) => {
    setError(err);
  }, []);

  const handleMicroStateChange = useCallback(
    (state: "pending" | "preview" | "error") => {
      setMicroState(state);
    },
    []
  );

  // Keyboard shortcut: Ctrl+Enter triggers full simulation / IV solve / PnL explain
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (workspaceMode === "pricing" && !isFullSimulating) {
          handleRunFullSimulation(inputs);
        } else if (workspaceMode === "implied_vol" && !isSolvingIv) {
          handleSolveImpliedVol();
        } else if (workspaceMode === "pnl_explain" && !isCalculatingPnL) {
          handleCalculatePnLExplain();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputs, isFullSimulating, workspaceMode, isSolvingIv, marketPrice, pnlShift, isCalculatingPnL]);

  // Full Simulation Trigger Handler (Doc 7 §6 — Never automatic)
  const handleRunFullSimulation = async (targetInputs: PricingRequest) => {
    setIsFullSimulating(true);
    setError(null);

    // Update URL query string with exact run inputs
    if (typeof window !== "undefined") {
      const queryStr = serializeInputs(targetInputs);
      window.history.replaceState(null, "", `?${queryStr}`);
    }

    try {
      const data = await postPriceFull(targetInputs);
      setFullResult(data);
      setActiveTier("full");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(
          new ApiError(500, {
            error: "simulation_failed",
            message: "Full Monte Carlo simulation run failed.",
          })
        );
      }
    } finally {
      setIsFullSimulating(false);
    }
  };

  // Implied Volatility Solver Trigger Handler (Discrete solve-on-demand)
  const handleSolveImpliedVol = async () => {
    setIsSolvingIv(true);
    setError(null);

    try {
      const ivReq: ImpliedVolRequest = {
        ticker: inputs.ticker,
        market: inputs.market,
        spot_override: inputs.spot_override,
        strike: inputs.strike,
        expiry_date: inputs.expiry_date,
        option_type: inputs.option_type,
        market_price: marketPrice,
        risk_free_rate: inputs.risk_free_rate,
        dividend_yield: inputs.dividend_yield,
      };
      const data = await postImpliedVol(ivReq);
      setImpliedVolResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(
          new ApiError(500, {
            error: "implied_vol_failed",
            message: "Implied volatility calculation failed.",
          })
        );
      }
    } finally {
      setIsSolvingIv(false);
    }
  };

  // P&L Explain Trigger Handler
  const handleCalculatePnLExplain = async () => {
    setIsCalculatingPnL(true);
    setError(null);

    try {
      const pnlReq: PnLExplainRequest = {
        ticker: inputs.ticker,
        market: inputs.market,
        spot_override: inputs.spot_override,
        strike: inputs.strike,
        expiry_date: inputs.expiry_date,
        option_type: inputs.option_type,
        volatility: inputs.volatility,
        risk_free_rate: inputs.risk_free_rate,
        dividend_yield: inputs.dividend_yield,
        shift: pnlShift,
      };
      const data = await postPnLExplain(pnlReq);
      setPnLExplainResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(
          new ApiError(500, {
            error: "pnl_explain_failed",
            message: "P&L explain calculation failed.",
          })
        );
      }
    } finally {
      setIsCalculatingPnL(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Workspace Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Option Pricing Workspace
          </h1>
          <p className="text-sm text-slate-300">
            {workspaceMode === "implied_vol"
              ? "Implied Volatility Solver — Solve Black-Scholes Volatility from Option Price"
              : "Interactive Monte Carlo simulation workspace"}
          </p>
        </div>
      </div>

      {/* Primary Workspace Grid: Input Panel (left) vs Results & Analytics (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Inputs Panel */}
        <div className="lg:col-span-5">
          <InputPanel
            initialInputs={inputs}
            onInputsChange={handleInputsChange}
            onPreviewSuccess={handlePreviewSuccess}
            onPreviewError={handlePreviewError}
            onRunFullSimulation={handleRunFullSimulation}
            isFullSimulating={isFullSimulating}
            onMicroStateChange={handleMicroStateChange}
            workspaceMode={workspaceMode}
            onWorkspaceModeChange={handleWorkspaceModeChange}
            marketPrice={marketPrice}
            onMarketPriceChange={setMarketPrice}
            onSolveImpliedVol={handleSolveImpliedVol}
            isSolvingIv={isSolvingIv}
            pnlShift={pnlShift}
            onPnLShiftChange={setPnLShift}
            onCalculatePnLExplain={handleCalculatePnLExplain}
            isCalculatingPnL={isCalculatingPnL}
          />
        </div>

        {/* Right Column: Results & Analytics + Export Suite + Tabbed Charts */}
        <div className="lg:col-span-7 space-y-6">
          <ResultsPanel
            microState={microState}
            previewResult={previewResult}
            fullResult={fullResult}
            error={error}
            activeTier={activeTier}
            isFullSimulating={isFullSimulating}
            market={inputs.market}
            workspaceMode={workspaceMode}
            impliedVolResult={impliedVolResult}
            isSolvingIv={isSolvingIv}
            pnlExplainResult={pnlExplainResult}
            isCalculatingPnL={isCalculatingPnL}
          />

          {workspaceMode === "pricing" && (
            <>
              <ExportControls fullResult={fullResult} request={inputs} />
              <ChartTabContainer request={inputs} fullResult={fullResult} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-4">
          <div className="animate-shimmer h-8 w-64 rounded" />
          <div className="animate-shimmer h-4 w-96 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 animate-shimmer h-[400px] rounded-lg" />
            <div className="lg:col-span-7 animate-shimmer h-[400px] rounded-lg" />
          </div>
        </div>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}
