# PathPricer — Frontend Client

The frontend web application for **PathPricer**, built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, and KaTeX.

It renders an interactive pricing workspace with real-time quantitative controls, 2D risk grid heatmaps, empirical convergence analysis, terminal distribution histograms, P&L attribution, implied volatility solving, and PDF report downloads.

---

## Architectural Highlights

- **App Router Architecture**: Next.js 14 client component workspace (`app/workspace/`).
- **Real-Time Interactive Workspace**:
  - `InputPanel.tsx`: Market quote header, parameter sliders, RNG seed locks, estimator dropdown (5 estimators including Randomized QMC), implied volatility solver, and P&L explain inputs.
  - `ResultsPanel.tsx`: Executive price summary, analytical vs. finite-difference Greeks, 5-estimator comparison table, P&L attribution term breakdown, and PDF/CSV download triggers.
  - `charts/`: Specialized visualization components:
    - `RiskGridHeatmap.tsx`: 2D SVG surface heatmap with hover diagnostics bar.
    - `ConvergenceChart.tsx`: Empirical log-log error decay plot ($O(N^{-1/2})$ fit).
    - `DistributionChart.tsx`: Terminal asset price $S_T$ histogram with strike marker.
    - `ComparisonChart.tsx`: Bar chart comparing 5 MC estimators against BS benchmark with 95% confidence intervals.
- **Client-Side Export**: High-resolution SVG/PNG chart rendering and client-side CSV generator (`lib/export-helpers.ts`).

---

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- `npm` (or `yarn` / `pnpm`)

### Development Server

```bash
# Install dependencies
npm install

# Start Next.js development server on http://localhost:3000
npm run dev
```

Ensure the FastAPI backend server is running on `http://localhost:8000`.

### Typechecking & Production Build

```bash
# Run TypeScript compilation check
npx tsc --noEmit

# Build production bundle
npm run build
```

