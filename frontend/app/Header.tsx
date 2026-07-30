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
            ? "text-[#58a6ff] bg-[#21262d]/40"
            : "text-[#6e7681] hover:text-white hover:bg-[#21262d]"
        }`}
      >
        {label}
        {active && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#58a6ff] rounded-full" />
        )}
      </Link>
    );
  };

  return (
    <header className="border-b border-slate-800 bg-[#0d1117] text-white px-6 py-3 relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <img src="/favicon.ico" alt="PathPricer" className="w-5 h-5 rounded" />
          <span className="text-lg font-bold tracking-tight text-white">
            Path<span className="text-[#58a6ff]">Pricer</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1 text-xs font-medium">
          {navLink("/", "Markets")}
          {navLink("/workspace", "Workspace")}
          {navLink("/validation", "Validate")}
          {navLink("/docs", "Docs")}
          <div className="ml-2 flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-[#6e7681] bg-[#21262d]/60 px-1.5 py-0.5 rounded border border-[#30363d]">
              ⌘K
            </span>
            <button
              type="button"
              onClick={toggle}
              className="px-2 py-1 rounded text-xs font-mono text-[#6e7681] hover:text-white hover:bg-[#21262d] transition-colors border border-[#30363d]"
            >
              {density === "compact" ? "CMP" : "CMF"}
            </button>
          </div>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden p-2 rounded text-[#6e7681] hover:text-white hover:bg-[#21262d] transition-colors"
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
          <Link href="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-[#6e7681] hover:text-white hover:bg-[#21262d] transition-colors">
            Markets
          </Link>
          <Link href="/workspace" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-[#6e7681] hover:text-white hover:bg-[#21262d] transition-colors">
            Workspace
          </Link>
          <Link href="/validation" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-[#6e7681] hover:text-white hover:bg-[#21262d] transition-colors">
            Validate
          </Link>
          <Link href="/docs" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded text-[#6e7681] hover:text-white hover:bg-[#21262d] transition-colors">
            Docs
          </Link>
          <button
            type="button"
            onClick={() => { toggle(); setMobileOpen(false); }}
            className="block w-full text-left px-3 py-2 text-sm font-mono rounded text-[#6e7681] hover:text-white hover:bg-[#21262d] transition-colors border border-[#30363d] mt-2"
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
