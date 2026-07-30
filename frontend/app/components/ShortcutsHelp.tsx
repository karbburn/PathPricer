"use client";

import React from "react";

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ["Ctrl", "Enter"], action: "Run Full Simulation", scope: "Workspace" },
  { keys: ["Ctrl", "K"], action: "Focus Ticker Search", scope: "Global" },
  { keys: ["/"], action: "Focus Ticker Search", scope: "Global" },
  { keys: ["1", "–", "6"], action: "Switch Chart Tab", scope: "Workspace" },
  { keys: ["Ctrl", "Shift", "E"], action: "Export CSV", scope: "Workspace" },
  { keys: ["Ctrl", "Shift", "P"], action: "Export PDF", scope: "Workspace" },
  { keys: ["Ctrl", "D"], action: "Toggle Density", scope: "Global" },
  { keys: ["?"], action: "Show This Help", scope: "Global" },
  { keys: ["Esc"], action: "Close / Blur", scope: "Global" },
];

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl shadow-black/40 p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-[#6e7681] hover:text-white transition-colors p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-1">
          {shortcuts.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#21262d]/40 transition-colors"
            >
              <span className="text-xs text-[#8b949e] font-mono">{s.action}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#79c0ff] bg-[#21262d] border border-[#30363d] rounded"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-[#6e7681] mt-4 text-center font-mono">
          Press <kbd className="px-1 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[#79c0ff]">?</kbd> or <kbd className="px-1 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[#79c0ff]">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
