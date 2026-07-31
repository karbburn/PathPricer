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
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161b22]/90 border border-[#30363d] text-[#8b949e] text-xs font-mono animate-pulse ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-[#8b949e]"></span>
        <span className="tracking-wide">PENDING &bull; DEBOUNCING...</span>
      </div>
    );
  }

  // 2. Computing (Live Elapsed Time Counter)
  if (tier === "computing") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161b22]/80 border border-[#d29922]/80 text-[#d29922] text-xs font-mono font-bold shadow-md shadow-[#0d1117]/50 ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-[#d29922]"></span>
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
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0d1117]/90 border-2 border-[#58a6ff] text-[#79c0ff] text-xs font-mono font-extrabold shadow-lg shadow-[#0d1117]/60 ${className}`}
      >
        <span className="inline-flex items-center justify-center w-4 h-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#58a6ff]">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span className="tracking-wider uppercase">
          VALIDATED &bull; N={nSimulations.toLocaleString()}
        </span>
        {computeMs !== undefined && (
          <span className="text-[#79c0ff]/80 font-normal border-l border-[#21262d] pl-2">
            {computeMs.toFixed(1)}ms
          </span>
        )}
        {timestamp && (
          <span className="text-[#58a6ff]/60 text-xs hidden sm:inline">
            [{timestamp}]
          </span>
        )}
      </div>
    );
  }

  // 5. Preview State (Muted / Desaturated Slate Neutral)
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161b22]/90 border border-[#21262d] text-[#9aa5b1] text-xs font-mono opacity-80 hover:opacity-100 transition-opacity ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#9aa5b1]"></span>
      <span className="tracking-wide">
        PREVIEW &bull; ~N={nSimulations.toLocaleString()}
      </span>
      {computeMs !== undefined && (
        <span className="text-[#9aa5b1] text-xs">
          ({computeMs.toFixed(1)}ms)
        </span>
      )}
    </div>
  );
}
