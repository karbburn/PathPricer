# PathPricer — Frontend

Next.js 16 application with TypeScript, Tailwind CSS, and Recharts. Renders an interactive pricing workspace with real-time controls, visual analytics, and export features.

## Workspace Components

- **InputPanel** — Parameter controls, 4-market quote header (US/IN/FX/CRYPTO) with preset tickers, estimator selector (5 modes), RNG seed management, implied volatility solver trigger, P&L shift inputs
- **ResultsPanel** — Price summary, analytical vs. finite-difference Greeks comparison, 5-estimator comparison table with relative efficiency, P&L attribution breakdown, PDF/CSV download
- **Charts** — Six specialized views: Paths, Terminal Distribution histogram, Payoff diagram, Log-log Convergence, MC-vs-BS Comparison, 2D Risk Grid heatmap

## Market Overview Page

Separate research page (`/`) with a 4-market toggle (US, IN, FX, CRYPTO), ticker autocomplete against the shared ticker database, preset quick tickers (AAPL, MSFT, RELIANCE, TCS, EURUSD, BTC), an historical volatility grid, and a manual fallback form. Links into the Pricing Workspace via URL params.

## Key Decisions

- **Two-tier compute model** — Preview ($N \leq 10$k) returns instantly; Full simulation runs all estimators. The frontend never computes prices — it only requests and displays
- **Density toggle** — Two modes (Comfortable/Compact) that adjust padding, font scale, table density, and chart dimensions
- **Mobile layout** — Tabbed workspace below `md:` breakpoint; dedicated touch event handlers for ResizablePanel drag handles
- **Keyboard shortcuts** — `Ctrl+Enter` to run, `Ctrl+D` to toggle density, `?` for help

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build + TypeScript check
```

Requires the FastAPI backend on `http://localhost:8000`.
