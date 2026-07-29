import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PathPricer — Institutional Option Pricing",
  description:
    "European option pricing application (Monte Carlo + Black-Scholes benchmark) with variance reduction, analytical & FD Greeks, and mathematical validation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="border-b border-slate-800 bg-[#0a0e17] text-white px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-cyan-400 group-hover:text-cyan-300 transition-colors">
                <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 7H21V11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-lg font-bold tracking-tight text-white">
                Path<span className="text-cyan-400">Pricer</span>
              </span>
            </Link>
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
            </nav>
          </div>
        </header>
        <main className="min-h-[calc(100vh-53px)] bg-[#0a0e17] text-slate-200">{children}</main>
      </body>
    </html>
  );
}
