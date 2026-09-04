import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Strategy Builder",
  description:
    "Multi-leg option strategy pricing with 10 presets (straddles, strangles, spreads, iron condors, butterflies, covered call, protective put), portfolio Greeks, payoff diagram, and breakevens.",
};

export default function StrategyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
