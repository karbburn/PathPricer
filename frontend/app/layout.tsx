import type { Metadata } from "next";
import { Space_Grotesk, DM_Serif_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DensityProvider } from "@/lib/contexts/DensityContext";
import { Header } from "./Header";
import { MobileNav } from "./components/MobileNav";
import { ToastContainer } from "@/lib/components/Toast";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
      <body className={`antialiased ${spaceGrotesk.variable} ${dmSerifDisplay.variable} ${jetbrainsMono.variable}`}>
        <DensityProvider>
          <Header />
          <main className="min-h-[calc(100vh-93px)] bg-[#0c1018] text-slate-200 pb-16 md:pb-0">{children}</main>
          <MobileNav />
          <ToastContainer />
        </DensityProvider>
      </body>
    </html>
  );
}
