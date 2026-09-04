import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Model Validation & CI Benchmarks",
  description:
    "Automated CI validation report: pricing consistency tests, Greeks tolerances, variance reduction metrics, and edge-case testing.",
};

export default function ValidationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
