"use client";

import React, { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { exportChartSvgToPng } from "@/lib/export-helpers";
import { PricingFullResponse, PricingRequest } from "@/lib/types";
import { marketCurrencySymbol } from "@/lib/formatters";

const PathsChart = dynamic(() => import("./PathsChart").then(m => m.PathsChart), { ssr: false });
const RiskGridHeatmap = dynamic(() => import("./RiskGridHeatmap").then(m => m.RiskGridHeatmap), { ssr: false });
const VolSurfaceChart = dynamic(() => import("./VolSurfaceChart").then(m => m.VolSurfaceChart), { ssr: false });
const GreeksSurfaceHeatmap = dynamic(() => import("./GreeksSurfaceHeatmap").then(m => m.GreeksSurfaceHeatmap), { ssr: false });
const VolTermStructureChart = dynamic(() => import("./VolTermStructureChart").then(m => m.VolTermStructureChart), { ssr: false });
const HestonCalibrationChart = dynamic(() => import("./HestonCalibrationChart").then(m => m.HestonCalibrationChart), { ssr: false });
const ModelValidationChart = dynamic(() => import("./ModelValidationChart").then(m => m.ModelValidationChart), { ssr: false });
const TerminalDistributionChart = dynamic(() => import("./TerminalDistributionChart").then(m => m.TerminalDistributionChart), { ssr: false });
const PayoffDiagram = dynamic(() => import("./PayoffDiagram").then(m => m.PayoffDiagram), { ssr: false });
const ConvergenceChart = dynamic(() => import("./ConvergenceChart").then(m => m.ConvergenceChart), { ssr: false });
const ComparisonChart = dynamic(() => import("./ComparisonChart").then(m => m.ComparisonChart), { ssr: false });

function ChartLoader() {
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center text-[#8b949e] font-mono text-sm">
      Loading chart…
    </div>
  );
}

interface ChartTabContainerProps {
  request: PricingRequest;
  fullResult: PricingFullResponse | null;
}

type ChartTab = "paths" | "distribution" | "payoff" | "convergence" | "comparison" | "risk_grid" | "vol_surface" | "greeks_surface" | "vol_term_structure" | "heston_calibration" | "model_validation";

const TAB_LABELS: Record<ChartTab, { label: string; shortLabel?: string }> = {
  paths: { label: "Asset Paths" },
  risk_grid: { label: "Risk Grid Heatmap" },
  vol_surface: { label: "Vol Surface" },
  greeks_surface: { label: "Greeks Surface" },
  vol_term_structure: { label: "Vol Term Structure" },
  heston_calibration: { label: "Heston Calib" },
  model_validation: { label: "Model Valid" },
  distribution: { label: "Terminal Distribution", shortLabel: "Terminal Dist" },
  payoff: { label: "Payoff Diagram" },
  convergence: { label: "Empirical Convergence" },
  comparison: { label: "MC vs BS" },
};

const TAB_ICONS: Record<ChartTab, React.ReactNode> = {
  paths: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  risk_grid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  vol_surface: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12c2-4 5-6 8-6s6 2 8 6"/><path d="M3 17c2-3 5-4 8-4s6 1 8 4"/></svg>,
  greeks_surface: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  vol_term_structure: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="20" x2="21" y2="20"/><line x1="3" y1="20" x2="7" y2="10"/><line x1="7" y1="10" x2="12" y2="15"/><line x1="12" y1="15" x2="16" y2="6"/><line x1="16" y1="6" x2="21" y2="20"/></svg>,
  heston_calibration: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="20" x2="20" y2="4"/><path d="M8 20h12"/></svg>,
  model_validation: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  distribution: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="12" width="3" height="9"/><rect x="14" y="7" width="3" height="14"/></svg>,
  payoff: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  convergence: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  comparison: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="8 7 4 3 0 7"/><polyline points="16 17 20 21 24 17"/><circle cx="4" cy="3" r="1"/><circle cx="20" cy="21" r="1"/></svg>,
};

export function ChartTabContainer({ request, fullResult }: ChartTabContainerProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>("paths");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const currencySymbol = marketCurrencySymbol(request.market, request.ticker);

  const bsPrice = fullResult ? fullResult.black_scholes.price : null;

  const handleExportPng = () => {
    exportChartSvgToPng(chartRef.current, `pathpricer_${activeTab}_chart`);
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation Header with PNG Export Action */}
      <div
        role="tablist"
        aria-label="Charts"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0d1117] p-1.5 rounded-lg border border-[#21262d]"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(Object.keys(TAB_LABELS) as ChartTab[]).map((tab) => {
            const active = activeTab === tab;
            const { label, shortLabel } = TAB_LABELS[tab];
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`chart-panel-${tab}`}
                id={`chart-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117] ${
                  active
                    ? "bg-[#58a6ff]/20 text-[#58a6ff] shadow border border-[#58a6ff]/40"
                    : "text-[#8b949e] hover:text-white hover:bg-[#161b22]"
                }`}
              >
                {TAB_ICONS[tab]}
                {shortLabel ? (
                  <>
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </>
                ) : (
                  label
                )}
              </button>
            );
          })}
        </div>

        {/* Per-Chart PNG Export Button */}
        <button
          type="button"
          onClick={handleExportPng}
          className="px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-xs font-mono font-semibold rounded bg-[#161b22] border border-[#21262d] text-[#8b949e] hover:text-white hover:border-[#58a6ff] transition-colors flex items-center justify-center gap-1.5 self-end sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export PNG</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div
        ref={chartRef}
        role="tabpanel"
        id={`chart-panel-${activeTab}`}
        aria-labelledby={`chart-tab-${activeTab}`}
      >
        {activeTab === "paths" && <PathsChart request={request} currencySymbol={currencySymbol} />}
        {activeTab === "risk_grid" && <RiskGridHeatmap request={request} />}
        {activeTab === "vol_surface" && <VolSurfaceChart request={request} />}
        {activeTab === "greeks_surface" && <GreeksSurfaceHeatmap request={request} />}
        {activeTab === "vol_term_structure" && <VolTermStructureChart request={request} />}
        {activeTab === "heston_calibration" && <HestonCalibrationChart request={request} />}
        {activeTab === "model_validation" && <ModelValidationChart request={request} />}

        {activeTab === "distribution" && (
          fullResult ? (
            <TerminalDistributionChart fullResult={fullResult} currencySymbol={currencySymbol} />
          ) : (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center text-[#8b949e] font-mono text-sm">
              Run full simulation to view downsampled terminal distribution histogram &amp; BS theoretical density overlay.
            </div>
          )
        )}

        {activeTab === "payoff" && (
          fullResult && bsPrice !== null ? (
            <PayoffDiagram request={request} optionPrice={bsPrice} currencySymbol={currencySymbol} />
          ) : (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center text-[#8b949e] font-mono text-sm">
              Run full simulation to view the payoff diagram with a real option premium.
            </div>
          )
        )}

        {activeTab === "convergence" && (
          fullResult ? (
            <ConvergenceChart fullResult={fullResult} />
          ) : (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center text-[#8b949e] font-mono text-sm">
              Run full simulation to view log-log empirical convergence scatter &amp; fitted slope regression.
            </div>
          )
        )}

        {activeTab === "comparison" && (
          fullResult ? (
            <ComparisonChart fullResult={fullResult} currencySymbol={currencySymbol} />
          ) : (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center text-[#8b949e] font-mono text-sm">
              Run full simulation to view MC estimator prices with 95% CI error bars.
            </div>
          )
        )}
      </div>
    </div>
  );
}
