"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InputPanel } from "./InputPanel";
import { ResultsPanel } from "./ResultsPanel";
import { ChartTabContainer } from "./charts/ChartTabContainer";
import { postPriceFull, ApiError } from "@/lib/api-client";
import { getEffectiveInputs, serializeInputs } from "@/lib/url-state";
import {
  PricingFullResponse,
  PricingPreviewResponse,
  PricingRequest,
} from "@/lib/types";

function WorkspaceContent() {
  const searchParams = useSearchParams();

  // Read URL search params directly on mount/update
  const initialInputs = getEffectiveInputs(
    Object.fromEntries(searchParams.entries())
  );

  const [inputs, setInputs] = useState<PricingRequest>(initialInputs);
  const [previewResult, setPreviewResult] =
    useState<PricingPreviewResponse | null>(null);
  const [fullResult, setFullResult] = useState<PricingFullResponse | null>(null);
  const [microState, setMicroState] = useState<"pending" | "preview" | "error">(
    "pending"
  );
  const [activeTier, setActiveTier] = useState<"preview" | "full">("preview");
  const [isFullSimulating, setIsFullSimulating] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Sync inputs state when URL search params change
  useEffect(() => {
    const updated = getEffectiveInputs(
      Object.fromEntries(searchParams.entries())
    );
    setInputs(updated); // eslint-disable-line react-hooks/set-state-in-effect
  }, [searchParams]);

  // When inputs change, reset to preview tier unless full simulation is re-run
  const handleInputsChange = useCallback((nextInputs: PricingRequest) => {
    setInputs(nextInputs);
    if (activeTier === "full") {
      setActiveTier("preview");
    }
  }, [activeTier]);

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

  // Full simulation trigger - manual only
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

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Workspace Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Option Pricing Workspace
          </h1>
          <p className="text-sm text-gray-400">
            Interactive Monte Carlo simulation workspace &bull; URL search params drive all state
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
          />
        </div>

        {/* Right Column: Results & Analytics + Tabbed Charts */}
        <div className="lg:col-span-7 space-y-6">
          <ResultsPanel
            microState={microState}
            previewResult={previewResult}
            fullResult={fullResult}
            error={error}
            activeTier={activeTier}
            isFullSimulating={isFullSimulating}
          />

          <ChartTabContainer request={inputs} fullResult={fullResult} />
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-6 py-12 text-center text-gray-400 font-mono">
          Loading pricing workspace...
        </div>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}
