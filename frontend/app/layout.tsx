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
        <header className="border-b border-gray-800 bg-gray-950 text-white px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-xl font-bold tracking-tight text-blue-400">
                PathPricer
              </Link>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700">
                v1.0
              </span>
            </div>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="hover:text-blue-400 transition-colors">
                Market Overview
              </Link>
              <Link href="/workspace" className="hover:text-blue-400 transition-colors">
                Pricing Workspace
              </Link>
              <Link href="/validation" className="hover:text-blue-400 transition-colors">
                Validation
              </Link>
              <Link href="/docs" className="hover:text-blue-400 transition-colors">
                Documentation
              </Link>
            </nav>
          </div>
        </header>
        <main className="min-h-[calc(100vh-65px)] bg-gray-900 text-gray-100">{children}</main>
      </body>
    </html>
  );
}
