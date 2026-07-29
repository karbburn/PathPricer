"use client";

import React, { useState } from "react";
import { PathsChart } from "./PathsChart";
import { TerminalDistributionChart } from "./TerminalDistributionChart";
import { PayoffDiagram } from "./PayoffDiagram";
import { ConvergenceChart } from "./ConvergenceChart";
import { ComparisonChart } from "./ComparisonChart";
import { PricingFullResponse, PricingRequest } from "@/lib/types";

interface ChartTabContainerProps {
  request: PricingRequest;
  fullResult: PricingFullResponse | null;
}

type ChartTab = "paths" | "distribution" | "payoff" | "convergence" | "comparison";

export function ChartTabContainer({ request, fullResult }: ChartTabContainerProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>("paths");

  const bsPrice = fullResult ? fullResult.black_scholes.price : 10.0;

  return (
    <div className="space-y-4">
      {/* Client-side tab switching - no route changes */}
      <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("paths")}
          className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap ${
            activeTab === "paths"
              ? "bg-cyan-600 text-white shadow"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          Asset Paths
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("distribution")}
          className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap ${
            activeTab === "distribution"
              ? "bg-cyan-600 text-white shadow"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          Terminal Distribution
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payoff")}
          className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap ${
            activeTab === "payoff"
              ? "bg-cyan-600 text-white shadow"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          Payoff Diagram
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("convergence")}
          className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap ${
            activeTab === "convergence"
              ? "bg-cyan-600 text-white shadow"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          Empirical Convergence
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("comparison")}
          className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap ${
            activeTab === "comparison"
              ? "bg-cyan-600 text-white shadow"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          MC vs BS Comparison
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "paths" && <PathsChart request={request} />}

      {activeTab === "distribution" && (
        fullResult ? (
          <TerminalDistributionChart fullResult={fullResult} />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-500 font-mono text-sm">
            Run full simulation to view downsampled terminal distribution histogram &amp; BS theoretical density overlay.
          </div>
        )
      )}

      {activeTab === "payoff" && <PayoffDiagram request={request} optionPrice={bsPrice} />}

      {activeTab === "convergence" && (
        fullResult ? (
          <ConvergenceChart fullResult={fullResult} />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-500 font-mono text-sm">
            Run full simulation to view log-log empirical convergence scatter &amp; fitted slope regression.
          </div>
        )
      )}

      {activeTab === "comparison" && (
        fullResult ? (
          <ComparisonChart fullResult={fullResult} />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-500 font-mono text-sm">
            Run full simulation to view MC estimator prices with 95% CI error bars.
          </div>
        )
      )}
    </div>
  );
}
