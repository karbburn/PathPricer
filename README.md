# PathPricer

**PathPricer** is an institutional-grade European option pricing application built with a Python (FastAPI + NumPy/SciPy) quantitative engine and a Next.js (TypeScript + TailwindCSS + Recharts) interactive web application.

It benchmarks Monte Carlo simulation techniques—including 4 variance reduction estimators and a 5th Randomized Quasi-Monte Carlo (RQMC) estimator—against analytical Black-Scholes-Merton closed-form solutions and finite-difference Greeks.

---

## Key Features

### 1. Black-Scholes-Merton Analytical Engine
- Closed-form European call and put option pricing under continuous dividend yield $q$.
- Complete set of analytical Greeks:
  - **Delta ($\Delta$)**: First-order spot sensitivity
  - **Gamma ($\Gamma$)**: Second-order spot sensitivity
  - **Vega ($\mathcal{V}$)**: Volatility sensitivity per 1% change
  - **Theta ($\Theta$)**: Time decay per calendar day ($\frac{1}{365}$)
  - **Rho ($\rho$)**: Interest rate sensitivity per 1% change

### 2. Monte Carlo Engine & Variance Reduction (5 Estimators)
- Full NumPy vectorization with zero path-level Python loops for optimal numerical performance.
- Terminal path sampling under Geometric Brownian Motion (GBM):
  $$S_T = S_0 \exp\left(\left(r - q - \frac{1}{2}\sigma^2\right)T + \sigma \sqrt{T} Z\right)$$
- **5 Supported Estimator Schemes**:
  1. **Standard Monte Carlo**: Independent standard normal pseudo-random draws.
  2. **Antithetic Variates**: Negated draw pairs $(Z, -Z)$ reducing variance for monotonic payoff integrands.
  3. **Control Variates**: Terminal asset price $S_T$ as control variate with analytical expectation $\mathbb{E}[S_T] = S_0 e^{(r-q)T}$ and optimal coefficient $\beta^* = \frac{\text{Cov}(\hat{V}, S_T)}{\text{Var}(S_T)}$.
  4. **Combined Antithetic + Control Variates**: Dual-boosted variance reduction.
  5. **Randomized Quasi-Monte Carlo (RQMC / Sobol)**: Low-discrepancy Owen-scrambled Sobol sequence (`scipy.stats.qmc.Sobol`) with $M=20$ independent replications and power-of-2 enforcement ($N = 2^{\lceil \log_2 N \rceil}$), providing statistically valid Central Limit Theorem (CLT) standard errors and faster convergence ($\mathcal{O}(N^{-1})$).

### 3. Numerical Finite-Difference Greeks (Common Random Numbers)
- Estimates numerical sensitivities via central finite differences under **Common Random Numbers (CRN)**.
- Reuses identical random draw sequences ($Z$) across base and bumped scenarios ($S_0 \pm h_S, \sigma \pm h_{\sigma}, r \pm h_r, T - h_T$), canceling simulation noise and isolating true partial derivatives.

### 4. Implied Volatility Solver
- Solves for implied volatility $\sigma$ given market option prices:
  $$\text{BS}_{\text{price}}(S_0, K, T, r, q, \sigma, \text{type}) = P_{\text{market}}$$
- **Primary Solver**: Newton-Raphson on Vega ($\sigma_{n+1} = \sigma_n - \frac{\text{BS}(\sigma_n) - P}{\mathcal{V}(\sigma_n)}$) initialized with Brenner-Subrahmanyam closed-form estimate ($\sigma_0 \approx \sqrt{\frac{2\pi}{T}} \cdot \frac{C}{S_0}$).
- **Fallback Solver**: Automatic failover to Brent's root-finding method on low vega ($\mathcal{V} < 10^{-6}$) or non-convergence.

### 5. P&L Explain & Greek Attribution
- Evaluates actual repriced P&L against 1st and 2nd order Taylor series predictions:
  $$\Delta \text{PnL}_{\text{predicted}} = \Delta \cdot \Delta S + \frac{1}{2}\Gamma (\Delta S)^2 + \mathcal{V} \cdot \Delta \sigma + \Theta_{\text{day}} \cdot \Delta t + \rho \cdot \Delta r$$
- Calculates unexplained higher-order residual (capturing cross-Greek interactions like Vanna, Volga, and cross-Gamma).

### 6. 2D Risk Grid Surface & Heatmap
- Computes $25 \times 25$ surface grid across dual parameter axes (Spot $\times$ Volatility, Strike $\times$ Expiry, or custom pairs).
- Powered by array-vectorized pricers (`price_vectorized` & `price_and_greeks_vectorized`).
- Rendered as an interactive SVG/CSS heatmap with custom presets, color scales, and cell hover diagnostics.

### 7. Live Market Data Provider
- Integrates `yfinance` with multi-tier download fallback for both **US Market** (e.g. `AAPL`, `MSFT`, `SPY`) and **Indian Market** (.NS tickers e.g. `RELIANCE.NS`, `TCS.NS`, `DRREDDY.NS`).
- Calculates trailing historical volatility across 20-day, 60-day, 126-day, and 252-day windows.
- Extracts dividend yields and supports manual spot/volatility/rate overrides.

### 8. Institutional Research Reports & Export Features
- **PDF Report**: Generates a research-note PDF via ReportLab featuring executive summaries, input parameters, Black-Scholes benchmark, 5-estimator comparison table, embedded log-log convergence plot (matplotlib), finite-difference Greeks, and diagnostics.
- **CSV Export**: Downloads complete scenario parameters, pricing results, and Greeks client-side.
- **Chart Exports**: One-click SVG/PNG high-resolution chart downloads.

---

## Quantitative Methodology & Formulas

### Black-Scholes-Merton Call & Put Prices
$$d_1 = \frac{\ln(S_0 / K) + \left(r - q + \frac{1}{2}\sigma^2\right)T}{\sigma \sqrt{T}}, \quad d_2 = d_1 - \sigma \sqrt{T}$$

$$\text{Call} = S_0 e^{-q T} N(d_1) - K e^{-r T} N(d_2)$$

$$\text{Put} = K e^{-r T} N(-d_2) - S_0 e^{-q T} N(-d_1)$$

### Analytical Greeks

| Greek | Call Formula | Put Formula |
| :--- | :--- | :--- |
| **Delta ($\Delta$)** | $e^{-q T} N(d_1)$ | $-e^{-q T} N(-d_1)$ |
| **Gamma ($\Gamma$)** | $\frac{e^{-q T} N'(d_1)}{S_0 \sigma \sqrt{T}}$ | $\frac{e^{-q T} N'(d_1)}{S_0 \sigma \sqrt{T}}$ |
| **Vega ($\mathcal{V}$)** | $S_0 e^{-q T} N'(d_1) \sqrt{T}$ | $S_0 e^{-q T} N'(d_1) \sqrt{T}$ |
| **Theta ($\Theta$)** | $-\frac{S_0 \sigma e^{-q T} N'(d_1)}{2\sqrt{T}} + q S_0 e^{-q T} N(d_1) - r K e^{-r T} N(d_2)$ | $-\frac{S_0 \sigma e^{-q T} N'(d_1)}{2\sqrt{T}} - q S_0 e^{-q T} N(-d_1) + r K e^{-r T} N(-d_2)$ |
| **Rho ($\rho$)** | $K T e^{-r T} N(d_2)$ | $-K T e^{-r T} N(-d_2)$ |

---

## Tech Stack & Project Architecture

```text
PathPricer/
├── backend/                  # FastAPI Quantitative Application
│   ├── app/
│   │   ├── api/              # REST API Routers (pricing, market, report, validation)
│   │   ├── core/             # Configuration, RNG factory, & rate providers
│   │   ├── engine/           # Vectorized quantitative pricing engines
│   │   │   ├── black_scholes.py
│   │   │   ├── monte_carlo.py
│   │   │   ├── greeks.py
│   │   │   ├── implied_vol.py
│   │   │   ├── pnl_explain.py
│   │   │   ├── risk_grid.py
│   │   │   └── volatility.py
│   │   ├── providers/        # yfinance MarketDataService & RateProvider
│   │   ├── report/           # ReportLab PDF report generator
│   │   └── schemas/          # Pydantic request/response schemas
│   └── main.py               # FastAPI entry point & CORS configuration
├── frontend/                 # Next.js 14 Web Application
│   ├── app/
│   │   ├── components/       # UI Components (TickerInput, Header, Nav)
│   │   └── workspace/        # Interactive Workspace panels & charts
│   │       ├── charts/       # Heatmap, Convergence, Distribution, & Comparison charts
│   │       ├── InputPanel.tsx
│   │       └── ResultsPanel.tsx
│   └── lib/                  # TypeScript types, API client, & formatters
└── tests/                    # Pytest suite (69 test cases)
```

### Stack Components
- **Backend Framework**: Python 3.10+ | FastAPI | Pydantic v2 | Uvicorn
- **Quantitative & Numerical Libraries**: NumPy | SciPy | ReportLab | Matplotlib
- **Frontend Framework**: Next.js 14 (App Router) | React 18 | TypeScript | Tailwind CSS
- **Visualization Libraries**: Recharts | Lucide React | KaTeX

---

## API Reference

### Key Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/market/quote` | `GET` | Fetch market quote, historical volatility, and dividend yield |
| `/api/v1/price/preview` | `POST` | Fast Preview tier pricing (<50ms, N $\le$ 10k) |
| `/api/v1/price/full` | `POST` | Full Simulation tier pricing (5 estimators, Greeks, convergence, PDF readiness) |
| `/api/v1/price/implied-volatility` | `POST` | Solve implied volatility using Newton-Raphson / Brent |
| `/api/v1/price/pnl-explain` | `POST` | P&L attribution and Taylor-series Greek decomposition |
| `/api/v1/price/risk-grid` | `POST` | Vectorized $25 \times 25$ 2D surface grid computation |
| `/api/v1/report/pdf` | `POST` | Generate and download research-note PDF report |
| `/api/v1/validation/summary` | `GET` | Serve static CI-time validation & coverage summary |

---

## Local Development & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ and `npm`

### 1. Backend Setup

```bash
# Navigate to backend root
cd backend

# Create & activate virtual environment (optional)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

Backend API documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests

### Backend Test Suite (Pytest)

```bash
# Run all Python unit and integration tests from project root
pytest
```

### Frontend Typecheck

```bash
# Run TypeScript compilation check
cd frontend
npx tsc --noEmit
```

