"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InputPanel } from "./InputPanel";
import { ResultsPanel } from "./ResultsPanel";
import { ExportControls } from "./ExportControls";
import { ChartTabContainer } from "./charts/ChartTabContainer";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/app/components/ResizablePanel";
import { ShortcutsHelp } from "@/app/components/ShortcutsHelp";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useDensity } from "@/lib/contexts/DensityContext";
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
  const [showHelp, setShowHelp] = useState(false);
  const { toggle: toggleDensity } = useDensity();

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

  // Keyboard shortcuts via shared hook
  const handleRunShortcut = useCallback(() => {
    if (workspaceMode === "pricing" && !isFullSimulating) {
      handleRunFullSimulation(inputs);
    } else if (workspaceMode === "implied_vol" && !isSolvingIv) {
      handleSolveImpliedVol();
    } else if (workspaceMode === "pnl_explain" && !isCalculatingPnL) {
      handleCalculatePnLExplain();
    }
  }, [workspaceMode, isFullSimulating, isSolvingIv, isCalculatingPnL, inputs, marketPrice, pnlShift]);

  useKeyboardShortcuts({
    onRunSimulation: handleRunShortcut,
    onToggleDensity: toggleDensity,
    onShowHelp: () => setShowHelp(true),
  });

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
    <div className="max-w-[1600px] mx-auto px-4 py-4">
      {/* Workspace Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white tracking-tight uppercase font-mono">
            {workspaceMode === "implied_vol" ? "IV Solver" : workspaceMode === "pnl_explain" ? "P&L Explain" : "Pricing"}
          </h1>
          {inputs.ticker && (
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700">
              {inputs.ticker} · {inputs.market}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">Ctrl+Enter → Run</span>
        </div>
      </div>

      {/* 3-Column Resizable Workspace */}
      <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-180px)]">
        {/* Left: Inputs */}
        <ResizablePanel index={0} defaultSize={25} minSize={18} maxSize={40}>
          <div className="pr-2 h-full overflow-y-auto">
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
        </ResizablePanel>

        <ResizableHandle index={0} />

        {/* Center: Results */}
        <ResizablePanel index={1} defaultSize={45} minSize={30} maxSize={60}>
          <div className="px-2 h-full overflow-y-auto">
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
              <ExportControls fullResult={fullResult} request={inputs} />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle index={1} />

        {/* Right: Charts */}
        <ResizablePanel index={2} defaultSize={30} minSize={20} maxSize={50}>
          <div className="pl-2 h-full overflow-y-auto">
            {workspaceMode === "pricing" ? (
              <ChartTabContainer request={inputs} fullResult={fullResult} />
            ) : (
              <div className="flex items-center justify-center h-64 text-sm text-slate-500 font-mono">
                Charts available in Pricing mode
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <ShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
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
