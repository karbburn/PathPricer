# PathPricer — Quantitative Methodology

A comprehensive technical reference for every mathematical model, numerical method, and design decision in the PathPricer option pricing application.

---

## Table of Contents

1. [Scope](#1-scope)
2. [Geometric Brownian Motion](#2-geometric-brownian-motion)
3. [Black-Scholes-Merton (Analytical Benchmark)](#3-black-scholes-merton-analytical-benchmark)
4. [Monte Carlo Estimator — Standard](#4-monte-carlo-estimator--standard)
5. [Variance Reduction](#5-variance-reduction)
6. [Randomized Quasi-Monte Carlo (Sobol)](#6-randomized-quasi-monte-carlo-sobol)
7. [Greeks: Numerical (Finite-Difference) Estimation](#7-greeks-numerical-finite-difference-estimation)
8. [Implied Volatility Solver](#8-implied-volatility-solver)
9. [P&L Attribution](#9-pl-attribution)
10. [2D Risk Grid](#10-2d-risk-grid)
11. [Validation Methodology](#11-validation-methodology)
12. [Why Monte Carlo for a Problem Black-Scholes Already Solves](#12-why-monte-carlo-for-a-problem-black-scholes-already-solves)
13. [Assumptions and Limitations](#13-assumptions-and-limitations)
14. [Historical Volatility Estimation](#14-historical-volatility-estimation)
15. [Random Number Generation and Reproducibility](#15-random-number-generation-and-reproducibility)

---

## 1. Scope

PathPricer prices **European vanilla Call and Put options** on single-name equities (US and Indian markets) using two independent methods that are designed to agree:

1. **Black-Scholes-Merton (BSM)** — closed-form analytical benchmark providing exact prices and Greeks.
2. **Monte Carlo simulation under Geometric Brownian Motion (GBM)** — the numerical engine under test, with five estimators (Standard, Antithetic Variates, Control Variates, Combined Antithetic+CV, and Randomized Quasi-Monte Carlo).

Every other component of the application (architecture, API, frontend) is downstream of the mathematical choices documented here.

**Explicitly out of scope:** American/Bermudan exercise, stochastic volatility (Heston), local volatility (SABR/Dupire), jump-diffusion, discrete dividends, options chains, and live option market data.

---

## 2. Geometric Brownian Motion

### 2.1 Stochastic Differential Equation

The underlying stock price $S_t$ is assumed to follow:

$$dS_t = (r - q)S_t\,dt + \sigma S_t\,dW_t$$

| Symbol | Meaning |
|---|---|
| $S_t$ | Stock price at time $t$ |
| $r$ | Risk-free rate (continuously compounded, annualized) |
| $q$ | Continuous dividend yield (annualized) |
| $\sigma$ | Volatility (annualized) |
| $W_t$ | Standard Brownian motion |

### 2.2 Closed-Form Solution

Applying Itô's Lemma to $\ln S_t$ gives the exact (not Euler-discretized) solution:

$$S_T = S_0 \exp\left[\left(r - q - \tfrac{1}{2}\sigma^2\right)T + \sigma\sqrt{T}\,Z\right], \quad Z \sim N(0,1)$$

**Why the exact solution and not Euler-Maruyama discretization:** For plain GBM with constant $r$, $q$, $\sigma$, the SDE has a known closed-form solution. Euler-Maruyama would introduce avoidable discretization bias for no benefit. Euler-Maruyama is necessary only for path-dependent payoffs (Asians, barriers) or models without closed-form transition densities (Heston, local vol).

### 2.3 Path Generation for Visualization

For the simulated stock price paths chart (visualization only — not used in pricing), the path is discretized at $N_{steps}$ points using the same exact update rule applied stepwise:

$$S_{t_{i+1}} = S_{t_i} \exp\left[\left(r - q - \tfrac{1}{2}\sigma^2\right)\Delta t + \sigma\sqrt{\Delta t}\,Z_i\right], \quad \Delta t = T/N_{steps}$$

Each step is itself an exact GBM transition, so the path remains free of discretization bias. The pricing engine samples $S_T$ directly (single step to terminal time) for efficiency, since intermediate path values are irrelevant to a European payoff.

---

## 3. Black-Scholes-Merton (Analytical Benchmark)

### 3.1 Pricing Formulas (Merton 1973 Extension with Continuous Dividend Yield)

$$d_1 = \frac{\ln(S_0/K) + (r - q + \tfrac{1}{2}\sigma^2)T}{\sigma\sqrt{T}}, \qquad d_2 = d_1 - \sigma\sqrt{T}$$

$$C = S_0 e^{-qT}N(d_1) - Ke^{-rT}N(d_2)$$
$$P = Ke^{-rT}N(-d_2) - S_0 e^{-qT}N(-d_1)$$

where $N(\cdot)$ is the standard normal CDF.

### 3.2 Risk-Neutral Pricing Connection

The Black-Scholes formula can be derived via the risk-neutral expectation:

$$V_0 = e^{-rT}\mathbb{E}^{\mathbb{Q}}[\text{payoff}(S_T)]$$

Under the risk-neutral measure $\mathbb{Q}$, the discounted asset price is a martingale, and $S_T$ is log-normal. Evaluating this expectation for the call/put payoff gives the closed form above. This connection is the bridge between analytical and Monte Carlo pricing: **Monte Carlo is a numerical estimate of exactly this same expectation.**

### 3.3 Analytical Greeks (All Five)

| Greek | Call | Put |
|---|---|---|
| Delta ($\Delta$) | $e^{-qT}N(d_1)$ | $-e^{-qT}N(-d_1)$ |
| Gamma ($\Gamma$) | $\dfrac{e^{-qT}\phi(d_1)}{S_0\sigma\sqrt{T}}$ | Same (identical for calls and puts) |
| Vega ($\nu$) | $S_0 e^{-qT}\phi(d_1)\sqrt{T}$ | Same (identical for calls and puts) |
| Theta ($\Theta$) | $-\dfrac{S_0 e^{-qT}\phi(d_1)\sigma}{2\sqrt{T}} - rKe^{-rT}N(d_2) + qS_0e^{-qT}N(d_1)$ | $-\dfrac{S_0 e^{-qT}\phi(d_1)\sigma}{2\sqrt{T}} + rKe^{-rT}N(-d_2) - qS_0e^{-qT}N(-d_1)$ |
| Rho ($\rho$) | $KTe^{-rT}N(d_2)$ | $-KTe^{-rT}N(-d_2)$ |

where $\phi(\cdot)$ is the standard normal PDF. Theta is reported **per calendar day** (annualized formula divided by 365), which is the convention practitioners expect.

---

## 4. Monte Carlo Estimator — Standard

### 4.1 Estimator

$$\hat{V} = e^{-rT}\cdot\frac{1}{N}\sum_{i=1}^{N} h(S_T^{(i)})$$

where $h(S_T) = \max(S_T - K, 0)$ for calls, $\max(K - S_T, 0)$ for puts, and each $S_T^{(i)}$ is drawn independently via the exact GBM solution.

### 4.2 Standard Error and Confidence Interval

$$\widehat{SE} = \frac{s}{\sqrt{N}}, \quad s^2 = \frac{1}{N-1}\sum_{i=1}^N \left(e^{-rT}h(S_T^{(i)}) - \hat{V}\right)^2$$

$$\text{95% CI} = \hat{V} \pm 1.96\cdot\widehat{SE}$$

**Why a normal-approximation CI rather than bootstrap:** Discounted payoffs are i.i.d. with finite variance, so the Central Limit Theorem applies directly. Bootstrap confidence intervals would target the same asymptotic result at higher computational cost and are standard practice only when the CLT does not clearly apply (heavy-tailed distributions, highly skewed estimators, or very small $N$).

### 4.3 Convergence Rate

Monte Carlo error decreases as $\mathcal{O}(N^{-1/2})$ — halving the error requires quadrupling $N$. This is validated empirically by running the estimator across a geometric grid of $N$ values and confirming $\log(\widehat{SE})$ vs $\log(N)$ has slope approximately $-0.5$.

---

## 5. Variance Reduction

All four estimators below price the **same option** and converge to the **same true value**; they differ only in standard error for a given $N$ (efficiency, not bias).

### 5.1 Antithetic Variates

For each standard normal draw $Z_i$, also evaluate the payoff at $-Z_i$:

$$S_T^{(i,+)} = S_0\exp[(r-q-\tfrac12\sigma^2)T + \sigma\sqrt{T}Z_i], \quad S_T^{(i,-)} = S_0\exp[(r-q-\tfrac12\sigma^2)T - \sigma\sqrt{T}Z_i]$$

$$\hat{V}_{AV} = e^{-rT}\cdot\frac{1}{N}\sum_{i=1}^{N}\frac{h(S_T^{(i,+)}) + h(S_T^{(i,-)})}{2}$$

Uses $N$ pairs ( $2N$ underlying draws, but $N$ averaged terms). The runtime comparison across methods must account for this: standard MC at $N$ paths uses $N$ draws; antithetic at $N$ pairs uses $2N$ draws.

**Why it works:** Vanilla option payoffs are monotonic in $S_T$, so $h(S_T^{(+)})$ and $h(S_T^{(-)})$ are negatively correlated, reducing the variance of their average. Variance reduction is guaranteed for monotonic payoffs. For non-monotonic payoffs (straddles, butterflies), antithetic variates provide little-to-no benefit.

### 5.2 Control Variates

Use $S_T$ itself as the control variate, since its expectation under the risk-neutral measure is known:

$$\mathbb{E}^{\mathbb{Q}}[S_T] = S_0 e^{(r-q)T}$$

The estimator:

$$\hat{V}_{CV} = e^{-rT}\cdot\frac{1}{N}\sum_{i=1}^N\left[h(S_T^{(i)}) - \beta^*\left(S_T^{(i)} - \mathbb{E}^{\mathbb{Q}}[S_T]\right)\right]$$

The optimal coefficient is estimated from the simulated sample:

$$\beta^* = \frac{\widehat{\text{Cov}}(h(S_T), S_T)}{\widehat{\text{Var}}(S_T)}$$

**Why $S_T$ and not the Black-Scholes price as the control:** A control variate must have a known expectation independent of the quantity being estimated. Using the Black-Scholes price as a control would be circular — Black-Scholes is the benchmark against which the Monte Carlo estimate is validated, not an input to it. Using $S_T$ (Boyle, 1977) is the textbook choice: it is already generated by the simulation, its expectation is known exactly, and it is correlated with the option payoff without presupposing the answer.

**Why the coefficient is estimated rather than fixed:** The exact optimal $\beta$ depends on the covariance between the payoff and $S_T$, which has no closed form for general parameters. Estimating $\beta^*$ from the sample introduces a small amount of estimation noise, which is negligible for sample sizes used here.

### 5.3 Antithetic + Control Variates (Combined)

Apply antithetic pairing first to produce paired-averaged payoffs and paired-averaged $S_T$ values, then apply the control variate correction to those paired averages. The two techniques are composable: antithetic variates reduce variance from payoff-path correlation structure, while control variates reduce variance by exploiting a known auxiliary expectation. They target different variance components and therefore stack rather than being redundant.

### 5.4 Estimator Comparison

| Method | Paths Used | Std Error | Relative Efficiency |
|---|---|---|---|
| Black-Scholes | N/A | N/A | N/A (benchmark) |
| Standard MC | $N$ | $\widehat{SE}_{std}$ | 1.0 (reference) |
| Antithetic | $2N$ | $\widehat{SE}_{AV}$ | $\text{Var}_{std}/\text{Var}_{AV}$ |
| Control Variates | $N$ | $\widehat{SE}_{CV}$ | $\text{Var}_{std}/\text{Var}_{CV}$ |
| Antithetic + CV | $2N$ | $\widehat{SE}_{AV+CV}$ | $\text{Var}_{std}/\text{Var}_{AV+CV}$ |
| RQMC (Sobol) | $N$ | $\widehat{SE}_{RQMC}$ | $\text{Var}_{std}/\text{Var}_{RQMC}$ |

Relative Efficiency is the variance reduction factor at matched $N$ — the headline result of the entire variance-reduction feature.

---

## 6. Randomized Quasi-Monte Carlo (Sobol)

While the preceding estimators use pseudo-random draws from $N(0,1)$, RQMC replaces these with **low-discrepancy sequences** — deterministic point sets that cover the unit hypercube $[0,1]^d$ more uniformly than random sampling — then randomizes them to enable error estimation.

### 6.1 Sobol Sequences

Sobol sequences (Sobol, 1967) are base-2 digital nets where each successive point fills a gap in the coverage of previous points. For the option pricing problem (a 1-dimensional integrand), Sobol points in $[0,1]$ are transformed to standard normals via the inverse normal CDF:

$$Z_i = \Phi^{-1}(u_i), \quad u_i \in \text{Sobol sequence}$$

### 6.2 Owen Scrambling (Randomization)

Deterministic Sobol points alone cannot provide error estimates. Owen scrambling (Owen, 1997) applies a nested uniform permutation to the binary digits of each Sobol point, producing randomized points that remain low-discrepancy individually, are uniformly distributed marginally, and are independent across scramblings.

The estimator uses $M=20$ independent scrambled replications, each with $N$ paths:

$$\hat{V}_{RQMC} = \frac{1}{M}\sum_{j=1}^{M} \hat{V}_j, \quad \widehat{SE}_{RQMC} = \frac{s}{\sqrt{M}}$$

$N$ is enforced to be a power of 2, the natural regime for Sobol sequence performance (optimal equidistribution at $N=2^k$).

### 6.3 Convergence Rate

For smooth integrands, QMC achieves $\mathcal{O}(N^{-1})$ in root mean square error — asymptotically faster than standard MC's $\mathcal{O}(N^{-1/2})$. Halving the error requires doubling $N$, not quadrupling. This rate degrades with effective dimension: for $d$-dimensional integrands, $\mathcal{O}(N^{-1}(\log N)^{d-1})$.

### 6.4 CI Validity Caveat

The RQMC confidence interval uses a t-distribution on $M=20$ replications:

$$\text{95% CI} = \hat{V}_{RQMC} \pm t_{M-1, 0.975} \cdot \frac{s}{\sqrt{M}}$$

**This is not fully rigorous:** the variance *between* replications captures only scrambling noise, not the full sampling error. If the integrand has structure not adequately diversified by $M=20$ scramblings, the CI may under-cover. The RQMC point estimate should be expected to be more accurate (lower error) than standard MC at the same $N$, but the CI width should be interpreted as a heuristic measure of uncertainty rather than a strict 95% confidence statement.

---

## 7. Greeks: Numerical (Finite-Difference) Estimation

Greeks are estimated numerically via **central finite differences** on the Monte Carlo price, using **common random numbers (CRN)** across bumped and base scenarios (same seed reused across the bump pair).

$$\Delta \approx \frac{\hat{V}(S_0+h) - \hat{V}(S_0-h)}{2h}, \qquad \Gamma \approx \frac{\hat{V}(S_0+h) - 2\hat{V}(S_0) + \hat{V}(S_0-h)}{h^2}$$

Analogous central differences are used for Vega (bump $\sigma$), Theta (bump $T$, one-sided since $T$ typically only decreases), and Rho (bump $r$).

**Why common random numbers are essential:** Without CRN, finite-difference Greeks on Monte Carlo prices are dominated by simulation noise rather than the true sensitivity. Using the same random seed across the base and bumped scenarios isolates the effect of the parameter change from the random sampling variance. This is a common and easy-to-miss error.

**Bump size $h$:** A relative bump of 0.5–1% of the parameter's own value by default (e.g., $h = 0.005 \cdot S_0$ for Delta), configurable. The bump must be small enough to approximate the derivative locally but large enough not to be swamped by residual Monte Carlo noise even with CRN. This trade-off (truncation error vs. residual simulation noise) is itself a validation topic (§11.2).

---

## 8. Implied Volatility Solver

Given a market-observed option price, the implied volatility $\sigma_{imp}$ is the value of $\sigma$ that satisfies:

$$\text{BS}_{\text{price}}(S_0, K, T, r, q, \sigma, \text{type}) = P_{\text{market}}$$

This is the **inverse** of the pricing problem. There is no closed-form inverse for Black-Scholes (the formula is transcendental in $\sigma$), so numerical root-finding is required.

### 8.1 Algorithm: Newton-Raphson with Brent Fallback

**Primary method:** Newton-Raphson iteration on Vega:

$$\sigma_{n+1} = \sigma_n - \frac{\text{BS}_{\text{price}}(\sigma_n) - P_{\text{market}}}{\text{Vega}(\sigma_n)}$$

**Initialization:** Brenner-Subrahmanyam approximation (Brenner & Subrahmanyam, 1988):

$$\sigma_0 \approx \sqrt{\frac{2\pi}{T}} \cdot \frac{P_{\text{market}}}{S_0}$$

This approximation is exact for ATM options ( $S_0 = K$ ) in a zero-rate, zero-dividend world, and serves as a robust starting point for general parameters.

**Fallback — Brent's method:** Activates when Vega approaches zero. This occurs for:
- Deep ITM options (Delta $\approx \pm e^{-qT}$, Vega $\to 0$)
- Deep OTM options (price $\to 0$, Vega $\to 0$)
- Near-expiry options ($T \to 0$, Vega $\to 0$)

Brent's method does not require a derivative and is guaranteed to converge for a continuous function on a bracketed interval, making it the safe fallback when Newton-Raphson's derivative-driven step becomes unreliable.

### 8.2 Diagnostics

The solver returns: iterations used, method selected (Newton-Raphson or Brent), final absolute residual $|\text{BS}_{\text{price}}(\sigma_{final}) - P_{\text{market}}|$, and the Black-Scholes price evaluated at the solution. These diagnostics enable the frontend to display convergence quality, not just a single number.

### 8.3 Why This Matters

Implied volatility solving is the single most common numerical operation on a derivatives trading desk. Market prices are quoted in price space, but traders think in vol space. The bid-ask spread in implied vol is more informative than the spread in price (vol is comparable across strikes and expiries; price is not). All volatility surface construction, smile modeling, and relative-value trading begins with this solver.

---

## 9. P&L Attribution

P&L attribution decomposes the change in option price resulting from a scenario move into component contributions by Greek. This answers: "Did we make money because spot moved, because vol changed, or because time passed?"

### 9.1 Taylor Decomposition

$$\text{PnL} = \Delta \cdot \Delta S + \frac{1}{2}\Gamma (\Delta S)^2 + \mathcal{V} \cdot \Delta\sigma + \Theta \cdot \Delta t + \rho \cdot \Delta r + \text{residual}$$

| Term | Greek | Factor | Interpretation |
|---|---|---|---|
| $\Delta \cdot \Delta S$ | Delta | Spot change | Directional exposure |
| $\frac{1}{2}\Gamma (\Delta S)^2$ | Gamma | Spot change (squared) | Convexity — profit from large moves; always positive for long vanilla options |
| $\mathcal{V} \cdot \Delta\sigma$ | Vega | Vol change | Volatility exposure |
| $\Theta \cdot \Delta t$ | Theta | Time decay | Cost of optionality; negative for long options |
| $\rho \cdot \Delta r$ | Rho | Rate change | Interest rate exposure |
| $\varepsilon$ | — | — | Residual: cross-Greeks, higher-order terms |

### 9.2 Why a Residual Term Exists

The residual $\varepsilon$ captures everything the second-order expansion misses:
- **Vanna** ($\partial\Delta/\partial\sigma$): Delta changes when vol moves
- **Volga** ($\partial\mathcal{V}/\partial\sigma$): Vega convexity in vol space
- **Cross-Gamma** ($\partial^2 V/\partial S\partial r$, etc.): factor interactions
- **Higher-order terms**: third and above in the Taylor expansion

For small scenario moves, first-order terms (especially Delta) dominate. For large moves, Gamma and the residual become material.

### 9.3 Operational Significance

P&L attribution is how a trading desk answers "Did we make money because our view was right?" A desk long Gamma benefits from realized volatility (large spot moves regardless of direction); a desk short Vega benefits from declining implied volatility. Separating these effects is essential for risk management, performance attribution, and strategy evaluation.

---

## 10. 2D Risk Grid

A risk grid computes the option price across a **two-dimensional surface** of parameter values, typically $25 \times 25 = 625$ points.

### 10.1 Computation

Typical axis pairs and what they reveal:

| X-axis | Y-axis | Insight |
|---|---|---|
| Spot price $S$ | Volatility $\sigma$ | Combined spot-vol exposure; Gamma as curvature along spot axis |
| Strike $K$ | Expiry $T$ | Term structure of option value across strikes |
| Spot $S$ | Time to expiry $T$ | Option decay across moneyness as expiry approaches |

Every grid point is computed via the fully vectorized Black-Scholes pricer — there are **no nested Python loops**. The $25 \times 25$ surface is evaluated as a single array operation on broadcast matrices:

```python
# S_grid shape (25, 1), sigma_grid shape (1, 25)
# broadcast to (25, 25) in one vectorized call
prices = black_scholes(S_grid, K, T, r, q, sigma_grid, type)
```

### 10.2 Visualization

The grid renders as an interactive heatmap with color intensity proportional to price magnitude, hover tooltips showing exact values, and crosshair lines at the base-case parameter values.

### 10.3 Practical Use

The risk grid is the visual equivalent of a trading desk's "cube" or "surface." Curvature along the spot axis is Gamma; curvature along the vol axis is Volga. A flat surface indicates low sensitivity; a steep surface indicates high risk to that parameter.

---

## 11. Validation Methodology

Validation is a first-class feature — the difference between "a Monte Carlo pricer" and "a validated numerical pricing system."

### 11.1 Price Validation

- Monte Carlo prices (all estimators) must fall within their own reported 95% confidence interval of the Black-Scholes price at the stated $N$, across a suite of parameter combinations (deep ITM, deep OTM, ATM, short/long expiry, high/low vol).
- **Coverage check**: Run the full pipeline $M$ times (e.g., $M=200$ independent simulation runs at fixed $N$) and confirm the true (BS) price falls inside the reported 95% CI in approximately 95% of runs (±sampling tolerance). This validates that the confidence interval is calibrated, not merely that the point estimate is close.

### 11.2 Convergence Validation

- Run $\hat{V}$ and $\widehat{SE}$ across a geometric grid of $N$ (e.g., $10^2, 10^3, \ldots, 10^6$).
- Fit $\log \widehat{SE}$ vs $\log N$ via linear regression; assert slope $\approx -0.5$ within tolerance. This provides empirical confirmation of the $\mathcal{O}(N^{-1/2})$ claim.

### 11.3 Greeks Validation

- Compare finite-difference Monte Carlo Greeks against closed-form Black-Scholes Greeks across the same parameter grid, with explicit relative-error tolerances (Delta/Gamma within 1–2% at $N \geq 10^5$, looser tolerance for Theta/Rho).
- Cases where finite-difference Greeks are noisier (Gamma, which involves a second difference and amplifies noise) are documented rather than smoothed over — this demonstrates understanding of numerical methods.

### 11.4 Edge Cases

Regression tests against known closed-form limits:
- $T \to 0$: option price $\to$ intrinsic value
- $\sigma \to 0$: option price $\to$ discounted intrinsic value of the forward
- Deep ITM: Delta $\to \pm e^{-qT}$, price $\to$ forward intrinsic value
- Deep OTM: price $\to 0$, Delta $\to 0$
- **Put-Call Parity**: $C - P = S_0e^{-qT} - Ke^{-rT}$, verified against both BS and MC outputs independently

### 11.5 Statistical Error Metrics

Per-run diagnostics: Standard Error, 95% CI width, Relative Error vs. Black-Scholes. Black-Scholes is treated as ground truth for European vanilla payoffs (valid only because BS is exact for this payoff class). RMSE is reserved for the multi-run coverage check, not a single-run diagnostic.

---

## 12. Why Monte Carlo for a Problem Black-Scholes Already Solves

**The honest answer:**

For vanilla European options under GBM, Monte Carlo is **strictly worse** than Black-Scholes on every axis: it is slower, has sampling error that BS does not, and estimates a quantity BS computes exactly. This is true and should not be hedged.

**Why institutions still rely on Monte Carlo:** Monte Carlo generalizes to problems with no closed-form solution — path-dependent payoffs (Asians, barriers, lookbacks), high-dimensional payoffs (basket options, multi-asset), American/Bermudan exercise (via Longstaff-Schwartz), and models where the terminal distribution has no closed form (Heston, local vol, jump-diffusion). Black-Scholes is the exception that has a clean answer; most of derivatives pricing does not.

**What this project demonstrates:** Not "Monte Carlo is the right tool for vanilla Europeans" (it is not), but rather — the numerical machinery (variance reduction, convergence analysis, error quantification, Greeks-by-bump-and-reprice) is correctly built and validated against a case where the right answer is independently known. That validation-against-known-truth is precisely why testing Monte Carlo against Black-Scholes on the solvable case is methodologically sound before trusting the same machinery on problems with no closed form to check against.

---

## 13. Assumptions and Limitations

| Assumption | Reality | How PathPricer Handles It |
|---|---|---|
| Constant volatility | Implied vol varies by strike/expiry (volatility smile/skew) | Single $\sigma$ input (historical or manual); smile modeling (SABR/local vol) identified as future work |
| GBM / log-normal returns | Real returns exhibit fat tails and negative skew (crash risk) | GBM used; jump-diffusion (Merton) named as the standard extension |
| Constant risk-free rate | Rates have term structure and evolve stochastically | Flat $r$ input; bond curve integration identified as the natural extension |
| Continuous dividend yield | Real dividends are discrete, scheduled cash payments | Continuous $q$ approximation from trailing yield; discrete dividend modeling identified as a known gap |
| European exercise only | Most single-name US equity options are American | Scoped explicitly; Longstaff-Schwartz LSM identified as the standard extension |
| Frictionless markets | Real trading has bid-ask spreads, transaction costs, market impact | Not modeled; pricing-model vs. trading-system distinction stated plainly |
| No risk premium adjustments | Real-world drift $\neq$ risk-neutral drift | Prices under $\mathbb{Q}$ (risk-neutral measure); appropriate for pricing/hedging, not for real-world return forecasting |

---

## 14. Historical Volatility Estimation

### 14.1 Close-to-Close Estimator (Annualized)

$$\hat{\sigma} = \sqrt{252}\cdot\sqrt{\frac{1}{n-1}\sum_{i=1}^{n}\left(r_i - \bar{r}\right)^2}, \quad r_i = \ln\frac{P_i}{P_{i-1}}$$

Log returns are used (not simple returns) because log returns are additive over time and are the theoretically consistent choice given GBM assumes log-normal prices.

### 14.2 Windows

Four trailing windows are reported: 20-day, 60-day, 126-day, and 252-day realized volatility. Displaying multiple windows together is a designed feature: regime stability vs. instability is visible from how much the estimates disagree across windows.

**Why close-to-close and not range-based (Parkinson/Garman-Klass/Yang-Zhang) estimators:** Range-based estimators are more statistically efficient (lower variance for the same sample size) but require reliable high/low/open data. Close-to-close is chosen for data quality consistency — yfinance reliably provides closing prices across all US and Indian tickers, but intraday range data quality is less consistent. Efficiency gain does not matter if the input data does not reliably support it.

---

## 15. Random Number Generation and Reproducibility

### 15.1 Generator

NumPy's `Generator` API with the PCG64 bit generator (`np.random.default_rng(seed)`), not legacy `RandomState`/Mersenne Twister.

**Why PCG64/Generator (NumPy 1.17+):** Better statistical properties, cleaner seeding and streaming model, and no global mutable state. Using legacy global RNG state is a correctness hazard in a stateless, concurrently-served backend — global mutable state shared across requests is a bug. `default_rng(seed)` creates an isolated, request-scoped generator instance.

### 15.2 Reproducibility Contract

Given identical inputs (ticker snapshot, strike, expiry, vol, rate, number of paths, variance-reduction method, and seed), the pricing run is **byte-for-byte reproducible**. A shared link re-executes the identical simulation and gets the identical answer.

### 15.3 Antithetic Pairing Constraint

Antithetic variates reuse the same base draws — this is *not* implemented as two independent seeded runs, which would silently break the antithetic pairing guarantee.

---

## Interview Reference

| Question | One-Line Answer |
|---|---|
| Why Monte Carlo for something Black-Scholes already solves? | Validation infrastructure for machinery meant to generalize to unsolvable cases. |
| Why $S_T$ and not Black-Scholes price as control variate? | Black-Scholes is the benchmark, not a valid control — using it would be circular. |
| Why exact GBM sampling, not Euler-Maruyama? | No discretization error needed or wanted for terminal-only payoffs. |
| Why normal-approximation CI, not bootstrap? | CLT applies cleanly; bootstrap adds cost with no benefit here. |
| Why finite-difference Greeks need common random numbers? | Without CRN, Greeks are dominated by MC noise, not true sensitivity. |
| Why continuous dividend yield, not discrete? | Free data does not reliably support forward ex-div schedules. |
| Why close-to-close vol, not range-based? | Data quality consistency across US/Indian tickers matters more than marginal efficiency gain. |
| Why `default_rng`, not legacy RandomState? | Statistically better and avoids shared-global-state bugs in a stateless backend. |
| Why Newton-Raphson with Brent fallback for IV? | Newton-Raphson is fast near the root; Brent handles near-zero-Vega cases without a derivative. |
| Why does P&L attribution include a residual term? | Taylor expansion is exact only for infinitesimal moves; residual captures cross-Greeks and higher-order terms. |
| Why vectorize the risk grid instead of looping? | 625 cell-level loops would dominate runtime; a single broadcast array operation evaluates all points at NumPy speed. |
