# PathPricer

An interactive option pricing platform that benchmarks Monte Carlo simulation techniques against analytical Black-Scholes prices. Built with a Python quantitative engine (FastAPI, NumPy, SciPy) and a Bloomberg-style web frontend (Next.js, TypeScript, Tailwind CSS, Recharts).

---

## Executive Summary

PathPricer prices European options using five simulation methods and compares them against the exact closed-form solution. It solves for implied volatility from market prices, attributes P&L to individual risk factors (Delta, Gamma, Vega, Theta, Rho), and visualizes how option prices change across a two-dimensional risk grid. It also fits **Heston stochastic-volatility** and **SVI volatility-surface** models to live option chains, calibrating and validating them against market quotes.

The application demonstrates proficiency across three areas rarely combined in a single project:
- **Quantitative methods** — analytical pricing, Monte Carlo with variance reduction, finite-difference Greeks, root-finding, convergence analysis, stochastic-volatility pricing, surface fitting, calibration
- **Production engineering** — typed Python/FastAPI backend, Next.js 16 frontend with two-tier compute model, full test coverage
- **Real desk workflows** — P&L attribution, implied volatility solving, risk grids, Heston calibration, volatility surface construction, PDF research reports

---

## Key Features

### Pricing Engine

| Method | Description | Why It Matters |
|---|---|---|
| **Black-Scholes-Merton** | Closed-form call/put pricing with full analytical Greeks (5 greeks) | Exact benchmark — all Monte Carlo error is measured against this. $C = S_0 e^{-qT}N(d_1) - Ke^{-rT}N(d_2)$ |
| **Standard Monte Carlo** | Independent normal draws, $N$ paths | Baseline estimator; converges at $\mathcal{O}(N^{-1/2})$ — halving error requires 4× paths |
| **Antithetic Variates** | Paired $(Z, -Z)$ draws | Reduces variance for monotone payoffs; 40-60% SE reduction typical |
| **Control Variates** | Terminal price $S_T$ as control with optimal $\beta^*$ coefficient | Significant variance reduction when payoff is correlated with $S_T$ |
| **Combined Antithetic + CV** | Both techniques simultaneously | Maximum variance reduction; best-performing estimator |
| **Randomized QMC (Sobol)** | Owen-scrambled Sobol sequences, $M=20$ replications | Achieves $\mathcal{O}(N^{-1})$ convergence for smooth integrands — halving error requires only 2× paths. CI is a heuristic (see methodology) |

All Monte Carlo estimators are fully vectorized with NumPy — zero path-level Python loops.

### Implied Volatility Solver

Given a market option price, solve for $\sigma$ in:

$$\text{BS}_{\text{price}}(S_0, K, T, r, q, \sigma, \text{type}) = P_{\text{market}}$$

The inverse has no closed form (BS is transcendental in $\sigma$), so numerical root-finding is used:

- **Primary**: Newton-Raphson on Vega: $\sigma_{n+1} = \sigma_n - (\text{BS}_{\text{price}}(\sigma_n) - P_{\text{market}})\,/\,\text{Vega}(\sigma_n)$
- **Initialization**: Brenner-Subrahmanyam approximation $\sigma_0 \approx \sqrt{2\pi/T} \cdot P_{\text{market}} / S_0$ (exact for ATM options)
- **Fallback**: Brent's method when Vega → 0 (deep ITM/OTM, near-expiry)
- Diagnostics: iterations used, method chosen, final residual, and BS price at solution

This is the single most common quant trading desk task — the reverse direction of the pricing engine.

### P&L Attribution ("P&L Explain")

Decomposes the actual repriced P&L into component contributions — answering: "did we make money because spot moved, vol changed, or time passed?"

$$\text{PnL} = \Delta \cdot \Delta S + \frac{1}{2}\Gamma (\Delta S)^2 + \mathcal{V} \cdot \Delta \sigma + \Theta \cdot \Delta t + \rho \cdot \Delta r + \varepsilon$$

| Term | Factor | What It Captures |
|---|---|---|
| $\Delta \cdot \Delta S$ | Spot change | Directional exposure (the most basic P&L driver) |
| $\frac{1}{2}\Gamma (\Delta S)^2$ | Spot² (convexity) | Gamma — profit from large moves both directions |
| $\mathcal{V} \cdot \Delta\sigma$ | Vol change | Vega — volatility exposure |
| $\Theta \cdot \Delta t$ | Time decay | Theta — cost of optionality |
| $\rho \cdot \Delta r$ | Rate change | Rho — interest rate exposure |
| $\varepsilon$ | Residual | Vanna ($\partial\Delta/\partial\sigma$), Volga ($\partial\mathcal{V}/\partial\sigma$), cross-Gamma, higher-order terms |

The residual exists because the Taylor expansion is exact only for infinitesimal moves. For finite scenario shifts, it measures how much the Greeks-plus-Gamma approximation diverges from the actual repriced P&L.

### Multi-Leg Strategy Builder

Prices a portfolio of 1–10 option and stock legs under Black-Scholes and aggregates their Greeks into portfolio-level risk. A leg is a *signed* contract — positive quantity is long, negative is short — and stock legs use the forward-carried value $Se^{-qT}$ with $\Delta = 1$. The result includes:

- **Per-leg pricing** — price and all five Greeks for every contract
- **Net portfolio Greeks** — quantity-weighted sums (net Delta, Gamma, Vega, Theta, Rho)
- **Expiration payoff diagram** — net P&L across a spot grid with linearly interpolated **breakeven points**
- **Max profit / max loss** — computed exactly from the piecewise-linear payoff (kinks live at strikes; unbounded tails reported as $\infty$)

Built-in presets cover the classic structure set — long/short straddles, strangles, bull/bear spreads, iron condor, iron butterfly, call butterfly, covered call, protective put.

### Scenario Stress Test

Reprices an option under a set of named market scenarios — 2008 Crisis (−40% spot, +20 vol pts, +100 bp rates), COVID Crash, Rate Hike, Vol Crush, Slow Drift, Flash Crash — each defined as coordinate shifts in spot, vol, rate, and elapsed time. Reports the P&L impact and percentage change of every scenario against the base price, plus the worst- and best-case scenarios and an **unrealized-risk** metric (largest single-scenario loss as a fraction of base price). This is the "what breaks if the market does X" view every desk runs before committing capital.

### Put-Call Parity Data-Quality Probes

Inverts the parity relation $C - P = S_0e^{-qT} - Ke^{-rT}$ to check whether live market quotes are internally consistent:

- **Implied rate** — given the ATM call/put mid prices, spot, strike, and a dividend assumption, solve for the rate $r$ the market is pricing in
- **Implied dividend** — given a trusted rate, solve for the dividend yield $q$ the market implies

When quotes are consistent, these land near consensus values; a large divergence flags stale mids, crossed markets, or mis-priced dividends. The home page surfaces this as a **Parity Data Quality** card (works only for US equity chains), and the parity math is reused in the SVI/Heston validation paths.

### 2D Risk Grid

Computes a $25 \times 25$ surface grid (625 points) across dual parameter axes (Spot $\times$ Vol, Strike $\times$ Expiry). Every cell is evaluated as a single broadcast array operation — **no nested Python loops** — by taking advantage of NumPy broadcasting:

```
S_grid shape (25, 1), sigma_grid shape (1, 25) → broadcast to (25, 25) in one call
```

Rendered as an interactive heatmap with hover diagnostics. Curvature along the spot axis is Gamma; curvature along the vol axis is Volga. A flat surface indicates low sensitivity; steep indicates high risk to that parameter.

### Heston Stochastic Volatility

Prices European options under the Heston (1993) model, where variance follows its own mean-reverting square-root process. Pricing uses **Fourier inversion** of the closed-form characteristic function, evaluated by Gauss-Legendre quadrature. Greeks (including second-order Volga and Vanna) come from central finite differences on the deterministic price, with a chain-rule correction since Volga/Vanna are reported w.r.t. the initial volatility $\sqrt{v_0}$:

$$\text{volga} = 4v_0\frac{\partial^2 V}{\partial v_0^2} + 2\frac{\partial V}{\partial v_0}, \qquad \text{vanna} = 2\sqrt{v_0}\frac{\partial^2 V}{\partial S\,\partial v_0}$$

Vectorized pricing groups strikes by expiry so one characteristic-function set serves many strikes — a 12-evaluation Greek bump reduces to 6.

### SVI Volatility Surface

Builds a **Gatheral raw SVI** implied-volatility surface from live option chains. At each expiry the total implied variance is

$$w(k) = a + b\left(\rho(k - m) + \sqrt{(k - m)^2 + \sigma^2}\right), \quad k = \ln(K/F)$$

with each slice fit by nonlinear least squares (three restarts) and total variance interpolated linearly in $T$ at fixed log-moneyness. Two arbitrage checks guard the surface: a **calendar-arbitrage check** rejects surfaces where total variance decreases with time to maturity, and a **butterfly (strike) arbitrage check** verifies call prices are convex in strike (equivalently, the implied risk-neutral density is non-negative) on every fitted slice. An ATM volatility **term structure** is extracted from the same fit — the smile's ATM backbone across expiries.

### Heston Calibration

Fits the five Heston parameters $(v_0, \kappa, \theta_v, \sigma_v, \rho)$ to observed market option prices via `L-BFGS-B`. The objective blends a **relative** RMSE (shape the smile) with a **mean-normalized absolute** RMSE (keep the ATM backbone dominant), plus a soft **Feller condition** penalty. A deterministic multi-start with log-uniform seeds ($\text{default\_rng}(20240101+i)$) mitigates local minima.

### Model Validation

Scores a calibrated Heston model against the same market quotes it was fitted to: price relative RMSE, price MAPE, implied-vol RMSE (NaN-robust), and a **market put-call parity** consistency check across the chain, alongside the Feller feasibility flag.

### Market Data & Reports

- Multi-tier yfinance fallback for US, Indian, FX, and cryptocurrency markets
- Historical volatility across 4 windows (20d, 60d, 126d, 252d)
- PDF research report via ReportLab with embedded convergence plot
- CSV export and SVG/PNG chart downloads
- Ticker database auto-updated daily via GitHub Actions from Wikipedia (S&P 500, Nifty 50) and CoinGecko (top 25 crypto by market cap); FX majors/minors are curated

### Market Overview

Research any underlying across four market regions — **US**, **Indian** (.NS suffix auto-appended), **FX** (major/minor pairs), and **CRYPTO** (top coins by market cap). Features ticker autocomplete backed by 700+ tickers, an historical volatility grid (20d/60d/126d/252d), and a manual fallback form when market data is unavailable.

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
│   ├── engine/           # black_scholes, monte_carlo, greeks, implied_vol,
│   │                     # pnl_explain, risk_grid, strategy, stress_test,
│   │                     # heston, heston_calibration, vol_surface,
│   │                     # greeks_surface, butterfly_arb, model_validation,
│   │                     # implied_rate, implied_dividend, volatility
│   ├── api/              # REST routers (pricing, market, quant, report, validation)
│   ├── core/             # Config, RNG factory, rate providers
│   ├── schemas/          # Pydantic models (preview/full structurally distinct)
│   └── report/           # ReportLab PDF generator
├── frontend/             # Next.js 16, React 19, TypeScript, Tailwind CSS
│   ├── workspace/        # InputPanel, ResultsPanel, Charts (Recharts)
│   ├── workspace/strategy/  # Multi-leg Strategy Builder + payoff chart
│   └── components/       # Shared UI, MobileNav, Keyboard shortcuts
└── tests/                # pytest cases + engine self-checks
```

### Why These Decisions Matter

- **Vectorized engine** (no path-level Python loops): ensures performance at scale and avoids NumPy anti-patterns common in quant prototypes
- **Common Random Numbers**: noise-cancelling design for Greeks — arguably more sophisticated than the Greeks themselves
- **Density toggle** (Compact/Comfortable): adjusts padding, font scale, table density, chart heights across the workspace
- **Keyboard shortcuts**: `Ctrl+Enter` runs the simulation, `Ctrl+D` toggles density, `?` opens the help overlay
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
| `/api/v1/price/implied-vol` | `POST` | Solve $\sigma$ from market price (Newton-Raphson / Brent) |
| `/api/v1/price/pnl-explain` | `POST` | Decompose P&L into Greek contributions |
| `/api/v1/price/risk-grid` | `POST` | $25 \times 25$ surface across 2 parameter axes |
| `/api/v1/price/strategy` | `POST` | Multi-leg strategy pricing, portfolio Greeks, payoff/breakevens |
| `/api/v1/price/stress-test` | `POST` | Reprice under named market scenarios; worst-case loss |
| `/api/v1/market/quote` | `GET` | Live market quote, historical vol, dividend yield |
| `/api/v1/market/options` | `GET` | Options chain (US equities) |
| `/api/v1/market/history` | `GET` | Historical OHLCV bars |
| `/api/v1/market/implied-rate` | `POST` | Parity-probe: risk-free rate implied by ATM call/put pair |
| `/api/v1/market/implied-dividend` | `POST` | Parity-probe: dividend yield implied by ATM call/put pair |
| `/api/v1/report/pdf` | `POST` | Downloadable PDF research report |
| `/api/v1/validation/summary` | `GET` | CI validation artifact |
| `/api/v1/quant/vol-surface` | `POST` | Fit SVI implied-vol surface to market options chain |
| `/api/v1/quant/vol-term-structure` | `POST` | ATM implied vol across expiries (from the SVI fit) |
| `/api/v1/quant/greeks-surface` | `POST` | A chosen Greek across strikes × expiries on the SVI surface |
| `/api/v1/quant/heston-calibrate` | `POST` | Calibrate Heston params to market option prices |
| `/api/v1/quant/model-validate` | `POST` | Validate calibrated Heston model vs market chain |

---

## Testing & Verification

The test suite covers:
- **pytest API smoke tests** across the pricing, quant (vol-surface, Heston calibration, model validation) and market endpoints
- **Engine self-checks** (`python -m app.engine.test_*`): closed-form benchmark prices, finite-difference volga cross-check, parameter-recovery calibration, SVI parameter recovery, butterfly-arb detection, put-call parity extraction, and good-fit/mis-specified model validation
- **Edge case coverage**: zero/negative volatility, past expiry, invalid option types, large $N$, deep ITM/OTM, extreme Heston parameters
- **Put-call parity**: residual verification as a structural consistency check, plus implied-rate/implied-dividend recovery from parity
- **Convergence slope**: empirical $n^{-1/2}$ regression on Monte Carlo standard error
- **CI coverage**: stub for statistical coverage verification
- **Preview vs. full distinctness**: schema-level enforcement check

```bash
pytest                              # API smoke tests
python -m app.engine.test_heston    # engine self-checks (per module)
cd frontend && npm run build        # TypeScript + production build
```

---

## Why This Matters

For a quant interviewing desk: P&L attribution and implied volatility solving are daily workflows, not academic exercises. This project implements those workflows end-to-end — analytical pricing, Monte Carlo simulation, root-finding, Greeks, calibration — in a single coherent application.

For a general audience: Options are everywhere in finance — from employee stock grants to pension fund hedging. This application makes the pricing mechanics visible and interactive, showing how professional trading desks evaluate risk and value financial instruments.

---

For a detailed walkthrough of every mathematical model, numerical method, and design decision, see [Quantitative Methodology](quantitative-methodology.md).
