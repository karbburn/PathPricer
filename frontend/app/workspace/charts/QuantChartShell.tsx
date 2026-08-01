"use client";

import React, { useState, useCallback } from "react";
import { ApiError } from "@/lib/api-client";
import { formatPrice } from "@/lib/formatters";

interface QuantChartShellProps {
  title: string;
  subtitle: string;
  runLabel: string;
  spot: number | null;
  ticker: string;
  resolvedSymbol?: string | null;
  onRun: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  warnings: string[];
  children: React.ReactNode;
}

export function QuantChartShell({
  title,
  subtitle,
  runLabel,
  spot,
  ticker,
  resolvedSymbol,
  onRun,
  isLoading,
  error,
  warnings,
  children,
}: QuantChartShellProps) {
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#21262d] pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#58a6ff] uppercase tracking-wider flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            {title}
          </h3>
          <p className="text-xs text-[#8b949e] font-mono mt-0.5">
            {ticker}
            {resolvedSymbol && resolvedSymbol !== ticker ? ` (${resolvedSymbol})` : ""}
            {spot != null ? ` · Spot ${formatPrice(spot, 2)}` : ""} · {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={isLoading}
          className="px-4 py-2 min-h-[44px] sm:min-h-0 text-xs font-mono font-bold rounded bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/40 hover:bg-[#58a6ff]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#161b22]"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
              Working…
            </span>
          ) : (
            runLabel
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-300 text-xs p-3 rounded-lg font-mono">
          <svg className="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {error}
        </div>
      )}

      {warnings.length > 0 && !error && (
        <div className="bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs p-3 rounded-lg font-mono space-y-1">
          {warnings.map((w, i) => (
            <div key={i}>
              <span className="text-amber-500 font-bold">!</span> {w}
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
