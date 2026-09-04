import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Workspace",
  description:
    "Interactive quantitative options pricing workspace: Monte Carlo simulation with 5 variance reduction estimators, Black-Scholes benchmark, analytical & FD Greeks, IV solver, and P&L attribution.",
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
