"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDensity } from "@/lib/contexts/DensityContext";
import { TickerStrip } from "./components/TickerStrip";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { density, toggle } = useDensity();
  const pathname = usePathname();

  const navLink = (href: string, label: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`px-3 py-1.5 rounded transition-colors relative ${
          active
            ? "text-cyan-400 bg-slate-800/40"
            : "text-slate-400 hover:text-white hover:bg-slate-800/60"
        }`}
      >
        {label}
        {active && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-cyan-400 rounded-full" />
        )}
      </Link>
    );
  };

  return (
    <header className="border-b border-slate-800 bg-[#0c1018] text-white px-6 py-3 relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-5 h-5 rounded bg-cyan-600 flex items-center justify-center text-[10px] font-bold text-white">
            P
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Path<span className="text-cyan-400">Pricer</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1 text-xs font-medium">
          {navLink("/", "Markets")}
          {navLink("/workspace", "Workspace")}
          {navLink("/validation", "Validate")}
          {navLink("/docs", "Docs")}
          <div className="ml-2 flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700">
              ⌘K
            </span>
            <button
              type="button"
              onClick={toggle}
              className="px-2 py-1 rounded text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors border border-slate-700"
            >
              {density === "compact" ? "CMP" : "CMF"}
            </button>
          </div>
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
            Markets
          </Link>
          <Link href="/workspace" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Workspace
          </Link>
          <Link href="/validation" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Validate
          </Link>
          <Link href="/docs" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            Docs
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

      {/* Ticker Strip */}
      <TickerStrip />
    </header>
  );
}
