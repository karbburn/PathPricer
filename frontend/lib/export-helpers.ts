/**
 * Export helpers for CSV, PNG, and PDF report downloads (Doc 7 §7).
 */

import { fetchReportPdf } from "./api-client";
import { PricingFullResponse, PricingRequest } from "./types";

/**
 * Generate and trigger a CSV download client-side from PricingFullResponse data.
 * No backend endpoint required (Doc 7 §7).
 */
export function downloadCsv(fullResult: PricingFullResponse) {
  const req = fullResult.request_echo;
  const bs = fullResult.black_scholes;

  const rows: string[][] = [
    ["PathPricer - Monte Carlo Option Pricing Results"],
    ["Generated", new Date().toISOString()],
    [],
    ["Input Parameters"],
    ["Ticker", req.ticker],
    ["Market", req.market],
    ["Option Type", req.option_type.toUpperCase()],
    ["Strike Price", req.strike.toString()],
    ["Spot Price", (req.spot_override ?? 100.0).toString()],
    ["Volatility", (req.volatility * 100).toFixed(2) + "%"],
    ["Risk-Free Rate", (req.risk_free_rate * 100).toFixed(2) + "%"],
    ["Dividend Yield", ((req.dividend_yield ?? 0.0) * 100).toFixed(2) + "%"],
    ["Simulations (N)", req.n_simulations.toString()],
    ["RNG Seed", req.seed.toString()],
    [],
    ["Black-Scholes Analytical Benchmark"],
    ["BS Price", bs.price.toFixed(4)],
    ["Delta", bs.greeks.delta.toFixed(4)],
    ["Gamma", bs.greeks.gamma.toFixed(5)],
    ["Vega", bs.greeks.vega.toFixed(4)],
    ["Theta", bs.greeks.theta.toFixed(4)],
    ["Rho", bs.greeks.rho.toFixed(4)],
    [],
    ["Monte Carlo Estimator Comparison Table"],
    ["Method", "Price", "Standard Error", "95% CI Lower", "95% CI Upper", "Runtime (ms)", "N_effective"],
  ];

  fullResult.mc_results.forEach((mc) => {
    rows.push([
      mc.method.replace("_", " ").toUpperCase(),
      mc.price.toFixed(4),
      mc.standard_error.toFixed(4),
      mc.ci_lower.toFixed(2),
      mc.ci_upper.toFixed(2),
      mc.runtime_ms.toFixed(1),
      mc.n_effective.toString(),
    ]);
  });

  rows.push([]);
  rows.push(["Finite-Difference Greeks (CRN)"]);
  rows.push(["Greek", "FD Value", "BS Value", "Difference"]);
  const fd = fullResult.greeks_fd;
  const greeks = bs.greeks;
  const fdPairs: [string, number, number][] = [
    ["Delta", fd.delta, greeks.delta],
    ["Gamma", fd.gamma, greeks.gamma],
    ["Vega", fd.vega, greeks.vega],
    ["Theta", fd.theta, greeks.theta],
    ["Rho", fd.rho, greeks.rho],
  ];
  fdPairs.forEach(([g, fdVal, bsVal]) => {
    rows.push([g, fdVal.toFixed(5), bsVal.toFixed(5), (fdVal - bsVal).toFixed(5)]);
  });

  rows.push([]);
  rows.push(["Diagnostics"]);
  rows.push(["Expected Payoff", fullResult.diagnostics.expected_payoff.toFixed(2)]);
  rows.push(["Discount Factor", fullResult.diagnostics.discount_factor.toFixed(4)]);
  rows.push(["Terminal Mean (S_T)", fullResult.diagnostics.terminal_mean.toFixed(2)]);
  rows.push(["Terminal Std (S_T)", fullResult.diagnostics.terminal_std.toFixed(2)]);
  rows.push(["Relative Error vs BS", (fullResult.diagnostics.relative_error_vs_bs * 100).toFixed(4) + "%"]);
  rows.push(["Compute Time (ms)", fullResult.compute_ms.toFixed(1)]);

  const csvContent = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `pathpricer_${req.ticker}_${req.option_type}_${req.strike}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Trigger backend PDF report generation (POST /report/pdf) and stream binary download.
 */
export async function downloadPdfReport(request: PricingRequest) {
  const blob = await fetchReportPdf(request);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `pathpricer_report_${request.ticker}_${request.strike}.pdf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export an SVG DOM element to a PNG image file download client-side.
 */
export function exportChartSvgToPng(containerElement: HTMLElement | null, filename: string) {
  if (!containerElement) return;

  const svgElement = containerElement.querySelector("svg");
  if (!svgElement) return;

  const bbox = svgElement.getBoundingClientRect();
  if (bbox.width === 0 || bbox.height === 0) return;

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = bbox.width * 2 || 1200;
  canvas.height = bbox.height * 2 || 700;

  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    // Fill dark background for financial chart
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.setAttribute("download", `${filename}.png`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  img.src = url;
}
