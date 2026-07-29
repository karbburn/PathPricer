import type { Metadata } from "next";
import "./globals.css";
import { DensityProvider } from "@/lib/contexts/DensityContext";
import { Header } from "./Header";

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
        <DensityProvider>
          <Header />
          <main className="min-h-[calc(100vh-53px)] bg-[#0a0e17] text-slate-200">{children}</main>
        </DensityProvider>
      </body>
    </html>
  );
}
