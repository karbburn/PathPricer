"use client";

import React, { useState, useEffect } from "react";

export type PrecisionTier = "preview" | "full" | "pending" | "computing" | "error";

interface PreviewBadgeProps {
  tier: PrecisionTier;
  nSimulations: number;
  computeMs?: number;
  timestamp?: string; // Optional completion timestamp string
  className?: string;
}

/**
 * PreviewBadge — Single shared component for precision-tier visual contract.
 *
 * Five states with distinct visual weights:
 * - Pending: debounce micro-state (input not ignored)
 * - Computing: live elapsed time (not indeterminate spinner)
 * - Error: warm red/crimson
 * - Preview: muted/desaturated slate
 * - Validated: full-strength electric cyan-teal
 */
export function PreviewBadge({
  tier,
  nSimulations,
  computeMs,
  timestamp,
  className = "",
}: PreviewBadgeProps) {
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  // Live elapsed time counter when in 'computing' state
  useEffect(() => {
    if (tier !== "computing") return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 50);

    return () => {
      clearInterval(interval);
      setElapsedMs(0);
    };
  }, [tier]);

  // 1. Pending (Debounce micro-state)
  if (tier === "pending") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 text-xs font-mono animate-pulse ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
        <span className="tracking-wide">PENDING &bull; DEBOUNCING...</span>
      </div>
    );
  }

  // 2. Computing (Live Elapsed Time Counter)
  if (tier === "computing") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/80 text-cyan-300 text-xs font-mono font-bold shadow-md shadow-cyan-950/50 ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
        <span className="tracking-wide">
          COMPUTING &bull; {elapsedMs}ms
        </span>
      </div>
    );
  }

  // 3. Error State (Warm Red / Crimson Accent)
  if (tier === "error") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-700 text-red-300 text-xs font-mono font-semibold ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        <span className="tracking-wide">ERROR</span>
      </div>
    );
  }

  // 4. Validated State (Full-strength Electric Cyan-Teal Signal)
  if (tier === "full") {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950 border-2 border-cyan-400 text-cyan-300 text-xs font-mono font-extrabold shadow-lg shadow-cyan-950/60 ${className}`}
      >
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cyan-400 text-cyan-950 font-bold text-[10px]">
          ✓
        </span>
        <span className="tracking-wider uppercase">
          VALIDATED &bull; N={nSimulations.toLocaleString()}
        </span>
        {computeMs !== undefined && (
          <span className="text-cyan-400/80 font-normal border-l border-cyan-800 pl-2">
            {computeMs.toFixed(1)}ms
          </span>
        )}
        {timestamp && (
          <span className="text-cyan-500/60 text-[10px] hidden sm:inline">
            [{timestamp}]
          </span>
        )}
      </div>
    );
  }

  // 5. Preview State (Muted / Desaturated Slate Neutral)
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-400 text-xs font-mono opacity-80 hover:opacity-100 transition-opacity ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
      <span className="tracking-wide">
        PREVIEW &bull; ~N={nSimulations.toLocaleString()}
      </span>
      {computeMs !== undefined && (
        <span className="text-slate-500 text-[11px]">
          ({computeMs.toFixed(1)}ms)
        </span>
      )}
    </div>
  );
}
