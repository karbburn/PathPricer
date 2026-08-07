# PathPricer — Frontend

Next.js 16 application with TypeScript, Tailwind CSS, and Recharts. Renders an interactive pricing workspace with real-time controls, visual analytics, and export features.

## Pages

- **Market Overview (`/`)** — 4-market toggle (US, IN, FX, CRYPTO), ticker autocomplete against the shared ticker database, preset quick tickers, historical volatility grid, manual fallback form, and a **Parity Data Quality** card that probes the options chain for quote consistency. Links into the workspace via URL params.
- **Pricing Workspace (`/workspace`)** — the full pricing, IV-solving, and P&L workflow in a 3-column resizable layout (tabs on mobile).
- **Strategy Builder (`/workspace/strategy`)** — multi-leg option strategy pricing with 10 presets (straddles, spreads, iron condors, butterflies, covered call, protective put), portfolio Greeks, payoff diagram, and breakevens.
- **Docs (`/docs`)** — interactive mathematical methodology with KaTeX rendering.

## Workspace Components

- **InputPanel** — Parameter controls, 4-market quote header, estimator selector (5 modes), RNG seed management, implied volatility solver trigger, P&L shift inputs, scenario stress-test controls
- **ResultsPanel** — Price summary, analytical vs. finite-difference Greeks comparison, 5-estimator comparison table with relative efficiency, P&L attribution breakdown, stress-test scenarios, PDF/CSV download
- **Charts** — Twelve specialized views: Asset Paths, 2D Risk Grid heatmap, SVI Vol Surface, Greeks Surface heatmap, Vol Term Structure, Heston Calibration, Model Validation, Terminal Distribution histogram, Payoff diagram, Log-log Convergence, MC-vs-BS Comparison, and **BS vs Heston Hedging Comparison** (dual histogram, stats, sample path deltas)

The workspace runs in three modes — **Pricing**, **IV Solver** (implied volatility from market price), and **P&L Explain** (Greek attribution plus scenario stress tests). The **Strategy** mode is a separate page for multi-leg pricing.

## Key Decisions

- **Two-tier compute model** — Preview ($N \leq 10$k) returns instantly; Full simulation runs all estimators. The frontend never computes prices — it only requests and displays
- **Density toggle** — Two modes (Comfortable/Compact) that adjust padding, font scale, table density, and chart dimensions
- **Mobile layout** — Tabbed workspace below `md:` breakpoint; dedicated touch event handlers for ResizablePanel drag handles
- **Keyboard shortcuts** — `Ctrl+Enter` to run, `Ctrl+D` to toggle density, `?` for help
- **URL as source of truth** — inputs are serialized into query params, so a shared link reproduces the exact run

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build + TypeScript check
```

Requires the FastAPI backend on `http://localhost:8000`.
