import type { Metadata } from "next";
import { Space_Grotesk, DM_Serif_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DensityProvider } from "@/lib/contexts/DensityContext";
import { Header } from "./Header";
import { MobileNav } from "./components/MobileNav";
import { ToastContainer } from "@/lib/components/Toast";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = "https://pathpricer.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "PathPricer — Institutional Option Pricing",
    template: "%s | PathPricer",
  },
  description:
    "European option pricing platform: Monte Carlo simulation with 5 variance reduction estimators, Black-Scholes benchmark, analytical & finite-difference Greeks, implied volatility solver, and P&L attribution.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "PathPricer",
    title: "PathPricer — Institutional Option Pricing",
    description:
      "European option pricing platform: Monte Carlo simulation with variance reduction, Black-Scholes benchmark, Greeks, and convergence diagnostics.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PathPricer — Institutional Option Pricing",
    description:
      "European option pricing: Monte Carlo + Black-Scholes, 5 estimators, Greeks, implied vol solver.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased ${spaceGrotesk.variable} ${dmSerifDisplay.variable} ${jetbrainsMono.variable}`}>
        <DensityProvider>
          <Header />
          <main className="min-h-[calc(100dvh-93px)] bg-[#0d1117] text-[#e6edf3] pb-20 md:pb-0">{children}</main>
          <MobileNav />
          <ToastContainer />
        </DensityProvider>
      </body>
    </html>
  );
}
