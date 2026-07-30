# PathPricer

An interactive option pricing platform that benchmarks Monte Carlo simulation techniques against analytical Black-Scholes prices. Built with a Python quantitative engine (FastAPI, NumPy, SciPy) and a Bloomberg-style web frontend (Next.js, TypeScript, Tailwind CSS, Recharts).

---

## Executive Summary

PathPricer prices European options using five simulation methods and compares them against the exact closed-form solution. It solves for implied volatility from market prices, attributes P&L to individual risk factors (Delta, Gamma, Vega, Theta, Rho), and visualizes how option prices change across a two-dimensional risk grid.

The application demonstrates proficiency across three areas rarely combined in a single project:
- **Quantitative methods** — analytical pricing, Monte Carlo with variance reduction, finite-difference Greeks, root-finding, convergence analysis
- **Production engineering** — typed Python/FastAPI backend, Next.js 16 frontend with two-tier compute model, full test coverage
- **Real desk workflows** — P&L attribution, implied volatility solving, risk grids, PDF research reports

---

## Key Features

### Pricing Engine

| Method | Description | Why It Matters |
|---|---|---|
| **Black-Scholes-Merton** | Closed-form call/put pricing with full analytical Greeks (5 greeks) | Exact benchmark — all Monte Carlo error is measured against this |
| **Standard Monte Carlo** | Independent normal draws, $N$ paths | Baseline estimator; converges at $\mathcal{O}(N^{-1/2})$ |
| **Antithetic Variates** | Paired $(Z, -Z)$ draws | Reduces variance for monotone payoffs; 40-60% SE reduction typical |
| **Control Variates** | Terminal price $S_T$ as control with optimal $\beta^*$ coefficient | Significant variance reduction when payoff is correlated with $S_T$ |
| **Combined Antithetic + CV** | Both techniques simultaneously | Maximum variance reduction; best-performing estimator |
| **Randomized QMC (Sobol)** | Owen-scrambled Sobol sequences, $M=20$ replications | Achieves $\mathcal{O}(N^{-1})$ convergence for smooth low-dimensional integrands; requires honest caveat that standard CI is not strictly valid (see docs) |

All Monte Carlo estimators are fully vectorized with NumPy — zero path-level Python loops.

### Implied Volatility Solver

Given a market option price, solve for the volatility implied by that price:

$$\text{BS}_{\text{price}}(S_0, K, T, r, q, \sigma, \text{type}) = P_{\text{market}}$$

- **Primary**: Newton-Raphson on Vega with Brenner-Subrahmanyam initialization
- **Fallback**: Brent's method when Vega approaches zero (deep ITM/OTM, near-expiry)
- Diagnostics: returns iterations used, method chosen, final residual, and BS price at solution

This is the single most common quant trading desk task — the reverse direction of the pricing engine.

### P&L Attribution ("P&L Explain")

Decomposes the actual repriced P&L of a scenario move into component contributions:

$$\text{PnL} = \Delta \cdot \Delta S + \frac{1}{2}\Gamma (\Delta S)^2 + \mathcal{V} \cdot \Delta \sigma + \Theta \cdot \Delta t + \rho \cdot \Delta r + \text{residual}$$

- First-order terms: Delta (directional spot), Vega (volatility shift), Theta (time decay), Rho (rate change)
- Second-order term: Gamma (convexity) —  captures the curvature that Delta alone misses
- Residual: unexplained higher-order effects (Vanna, Volga, cross-Gamma interactions)
- Demonstrates why Greeks matter operationally — not just theoretical sensitivities

### 2D Risk Grid

Computes a $25 \times 25$ surface grid across dual parameter axes (e.g. Spot $\times$ Volatility, Strike $\times$ Expiry) using the vectorized pricer. Rendered as an interactive heatmap with hover diagnostics — Gamma appears visually as curvature along the spot axis.

### Market Data & Reports

- Multi-tier yfinance fallback for US and Indian equities
- Historical volatility across 4 windows (20d, 60d, 126d, 252d)
- PDF research report via ReportLab with embedded convergence plot
- CSV export and SVG/PNG chart downloads

---

## Architecture & Key Decisions

The application uses a **two-tier compute model** that distinguishes preview requests from full simulation at every layer — API schema, backend logic, frontend state:

| Tier | Latency | Max Paths | Returns |
|---|---|---|---|
| **Preview** | $<50$ms | $10$k | Single Black-Scholes price + MC estimate |
| **Full** | $2-30$s | $1$M (5 estimators) | All prices, Greeks, convergence data, P&L, risk grid |

The frontend **never computes a price, Greek, or diagnostic** — it only requests and displays. This enforces separation of concerns and keeps the backend the sole source of numerical truth.

```
PathPricer/
├── backend/              # FastAPI (Python 3.12, NumPy, SciPy)
│   ├── engine/           # black_scholes, monte_carlo, greeks,
│   │                     # implied_vol, pnl_explain, risk_grid, volatility
│   ├── api/              # REST routers
│   ├── core/             # Config, RNG factory, rate providers
│   ├── schemas/          # Pydantic models (preview/full structurally distinct)
│   └── report/           # ReportLab PDF generator
├── frontend/             # Next.js 16, React 19, TypeScript, Tailwind CSS
│   ├── workspace/        # InputPanel, ResultsPanel, Charts (Recharts)
│   └── components/       # Shared UI, MobileNav, Keyboard shortcuts
└── tests/                # 69 pytest cases
```

### Why These Decisions Matter

- **Vectorized engine** (no path-level Python loops): ensures performance at scale and avoids NumPy anti-patterns common in quant prototypes
- **Common Random Numbers**: noise-cancelling design for Greeks — arguably more sophisticated than the Greeks themselves
- **Density toggle** (Compact/Comfortable): adjusts padding, font scale, table density, chart heights across the workspace
- **Platform-aware shortcuts**: `⌘K` on macOS, `Ctrl+K` on Windows for ticker search
- **Mobile layout**: tabbed workspace below `md:` with touch event handlers for resize handles

---

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/price/preview` | `POST` | Fast preview ($N \leq 10$k, $<50$ms) — single BS + MC estimate |
| `/api/v1/price/full` | `POST` | Full simulation — 5 estimators, Greeks, convergence, PDF-ready |
| `/api/v1/price/implied-volatility` | `POST` | Solve $\sigma$ from market price (Newton-Raphson / Brent) |
| `/api/v1/price/pnl-explain` | `POST` | Decompose P&L into Greek contributions |
| `/api/v1/price/risk-grid` | `POST` | $25 \times 25$ surface across 2 parameter axes |
| `/api/v1/market/quote` | `GET` | Live market quote, historical vol, dividend yield |
| `/api/v1/report/pdf` | `POST` | Downloadable PDF research report |
| `/api/v1/validation/summary` | `GET` | CI validation artifact |

---

## Testing & Verification

The test suite covers:
- **69 pytest cases** across pricing, Greeks, implied volatility, P&L, risk grid, API endpoints, and edge cases
- **Edge case coverage**: zero/negative volatility, past expiry, invalid option types, large $N$, deep ITM/OTM
- **Put-call parity**: residual verification as a structural consistency check
- **Convergence slope**: empirical $n^{-1/2}$ regression on Monte Carlo standard error
- **CI coverage**: stub for statistical coverage verification
- **Preview vs. full distinctness**: schema-level enforcement check

```bash
pytest                              # 69 tests
cd frontend && npm run build        # TypeScript + production build
```

---

## Why This Matters

For a quant interviewing desk: P&L attribution and implied volatility solving are daily workflows, not academic exercises. The ability to combine analytical, simulation, and numerical methods (pricing, Greeks, root-finding) in one coherent application demonstrates the skills that differentiate a mathematics background from a trading-floor background.

For a general audience: Options are everywhere in finance — from employee stock grants to pension fund hedging. This application makes the pricing mechanics visible and interactive, showing how professional trading desks evaluate risk and value financial instruments.
