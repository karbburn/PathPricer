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
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
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
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-800/40 transition-colors"
            >
              <span className="text-xs text-slate-300 font-mono">{s.action}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-cyan-300 bg-slate-800 border border-slate-700 rounded"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-500 mt-4 text-center font-mono">
          Press <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300">?</kbd> or <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
