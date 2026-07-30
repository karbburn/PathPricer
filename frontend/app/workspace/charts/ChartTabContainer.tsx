"use client";

import React, { useState, useRef } from "react";
import { PathsChart } from "./PathsChart";
import { TerminalDistributionChart } from "./TerminalDistributionChart";
import { PayoffDiagram } from "./PayoffDiagram";
import { ConvergenceChart } from "./ConvergenceChart";
import { ComparisonChart } from "./ComparisonChart";
import { RiskGridHeatmap } from "./RiskGridHeatmap";
import { exportChartSvgToPng } from "@/lib/export-helpers";
import { PricingFullResponse, PricingRequest, MarketRegion } from "@/lib/types";

interface ChartTabContainerProps {
  request: PricingRequest;
  fullResult: PricingFullResponse | null;
}

type ChartTab = "paths" | "distribution" | "payoff" | "convergence" | "comparison" | "risk_grid";

const CURRENCY_SYMBOL: Record<MarketRegion, string> = { US: "$", IN: "\u20B9" };

export function ChartTabContainer({ request, fullResult }: ChartTabContainerProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>("paths");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const currencySymbol = CURRENCY_SYMBOL[request.market];

  const bsPrice = fullResult ? fullResult.black_scholes.price : 10.0;

  const handleExportPng = () => {
    exportChartSvgToPng(chartRef.current, `pathpricer_${activeTab}_chart`);
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation Header with PNG Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0d1117] p-1.5 rounded-lg border border-[#21262d]">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("paths")}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
              activeTab === "paths"
                ? "bg-[#58a6ff]/20 text-[#58a6ff] shadow border border-[#58a6ff]/40"
                : "text-[#6e7681] hover:text-white hover:bg-[#161b22]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Asset Paths
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("risk_grid")}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
              activeTab === "risk_grid"
                ? "bg-[#58a6ff]/20 text-[#58a6ff] shadow border border-[#58a6ff]/40"
                : "text-[#6e7681] hover:text-white hover:bg-[#161b22]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Risk Grid Heatmap
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("distribution")}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
              activeTab === "distribution"
                ? "bg-[#58a6ff]/20 text-[#58a6ff] shadow border border-[#58a6ff]/40"
                : "text-[#6e7681] hover:text-white hover:bg-[#161b22]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="12" width="3" height="9"/><rect x="14" y="7" width="3" height="14"/></svg>
            Terminal Distribution
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("payoff")}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
              activeTab === "payoff"
                ? "bg-[#58a6ff]/20 text-[#58a6ff] shadow border border-[#58a6ff]/40"
                : "text-[#6e7681] hover:text-white hover:bg-[#161b22]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            Payoff Diagram
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("convergence")}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
              activeTab === "convergence"
                ? "bg-[#58a6ff]/20 text-[#58a6ff] shadow border border-[#58a6ff]/40"
                : "text-[#6e7681] hover:text-white hover:bg-[#161b22]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            Empirical Convergence
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("comparison")}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
              activeTab === "comparison"
                ? "bg-[#58a6ff]/20 text-[#58a6ff] shadow border border-[#58a6ff]/40"
                : "text-[#6e7681] hover:text-white hover:bg-[#161b22]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="8 7 4 3 0 7"/><polyline points="16 17 20 21 24 17"/><circle cx="4" cy="3" r="1"/><circle cx="20" cy="21" r="1"/></svg>
            MC vs BS
          </button>
        </div>

        {/* Per-Chart PNG Export Button (Doc 7 §7) */}
        <button
          type="button"
          onClick={handleExportPng}
          className="px-3 py-1.5 text-xs font-mono font-semibold rounded bg-[#161b22] border border-[#21262d] text-[#6e7681] hover:text-white hover:border-[#58a6ff] transition-colors flex items-center justify-center gap-1.5 self-end sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export PNG</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div ref={chartRef}>
        {activeTab === "paths" && <PathsChart request={request} currencySymbol={currencySymbol} />}
        {activeTab === "risk_grid" && <RiskGridHeatmap request={request} />}

        {activeTab === "distribution" && (
          fullResult ? (
            <TerminalDistributionChart fullResult={fullResult} currencySymbol={currencySymbol} />
          ) : (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center text-[#6e7681] font-mono text-sm">
              Run full simulation to view downsampled terminal distribution histogram &amp; BS theoretical density overlay.
            </div>
          )
        )}

        {activeTab === "payoff" && <PayoffDiagram request={request} optionPrice={bsPrice} currencySymbol={currencySymbol} />}

        {activeTab === "convergence" && (
          fullResult ? (
            <ConvergenceChart fullResult={fullResult} />
          ) : (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center text-[#6e7681] font-mono text-sm">
              Run full simulation to view log-log empirical convergence scatter &amp; fitted slope regression.
            </div>
          )
        )}

        {activeTab === "comparison" && (
          fullResult ? (
            <ComparisonChart fullResult={fullResult} currencySymbol={currencySymbol} />
          ) : (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center text-[#6e7681] font-mono text-sm">
              Run full simulation to view MC estimator prices with 95% CI error bars.
            </div>
          )
        )}
      </div>
    </div>
  );
}
