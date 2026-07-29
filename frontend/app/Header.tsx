"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDensity } from "@/lib/contexts/DensityContext";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { density, toggle } = useDensity();

  return (
    <header className="border-b border-slate-800 bg-[#0c1018] text-white px-6 py-3.5 relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <img
            src="/favicon.ico"
            alt="PathPricer"
            width={20}
            height={20}
            className="group-hover:opacity-80 transition-opacity"
          />
          <span className="text-lg font-bold tracking-tight text-white">
            Path<span className="text-amber-400">Pricer</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1 text-xs font-medium">
          <Link href="/" className="px-3 py-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Market Overview
          </Link>
          <Link href="/workspace" className="px-3 py-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Pricing Workspace
          </Link>
          <Link href="/validation" className="px-3 py-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Validation
          </Link>
          <Link href="/docs" className="px-3 py-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Documentation
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="ml-2 px-2 py-1 rounded text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors border border-slate-700"
          >
            {density === "compact" ? "Compact" : "Comfortable"}
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          aria-label="Toggle navigation"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="sm:hidden mt-3 pb-2 border-t border-slate-800 pt-3 space-y-1">
          <Link href="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Market Overview
          </Link>
          <Link href="/workspace" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Pricing Workspace
          </Link>
          <Link href="/validation" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Validation
          </Link>
          <Link href="/docs" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Documentation
          </Link>
          <button
            type="button"
            onClick={() => { toggle(); setMobileOpen(false); }}
            className="block w-full text-left px-3 py-2 text-sm font-mono rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors border border-slate-700 mt-2"
          >
            Density: {density === "compact" ? "Compact" : "Comfortable"}
          </button>
        </nav>
      )}
    </header>
  );
}
