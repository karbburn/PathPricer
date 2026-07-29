import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { DensityProvider } from "@/lib/contexts/DensityContext";
import { Header } from "./Header";
import { ToastContainer } from "@/lib/components/Toast";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

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
      <body className={`antialiased ${spaceGrotesk.variable}`}>
        <DensityProvider>
          <Header />
          <main className="min-h-[calc(100vh-53px)] bg-[#0c1018] text-slate-200">{children}</main>
          <ToastContainer />
        </DensityProvider>
      </body>
    </html>
  );
}
