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
11. [Heston Stochastic Volatility Model](#11-heston-stochastic-volatility-model)
12. [SVI Volatility Surface](#12-svi-volatility-surface)
13. [Heston Calibration](#13-heston-calibration)
14. [Model Validation](#14-model-validation)
15. [Validation Methodology](#15-validation-methodology)
16. [Why Monte Carlo for a Problem Black-Scholes Already Solves](#16-why-monte-carlo-for-a-problem-black-scholes-already-solves)
17. [Assumptions and Limitations](#17-assumptions-and-limitations)
18. [Historical Volatility Estimation](#18-historical-volatility-estimation)
19. [Random Number Generation and Reproducibility](#19-random-number-generation-and-reproducibility)
20. [Design Decisions FAQ](#20-design-decisions-faq)
21. [Multi-Leg Strategy Pricing](#21-multi-leg-strategy-pricing)
22. [Scenario Stress Testing](#22-scenario-stress-testing)
23. [Put-Call Parity Data-Quality Probes](#23-put-call-parity-data-quality-probes)

---

## 1. Scope

PathPricer prices **European vanilla Call and Put options** on single-name equities (US and Indian markets), FX pairs, and cryptocurrency assets using two independent methods that are designed to agree:

1. **Black-Scholes-Merton (BSM)** — closed-form analytical benchmark providing exact prices and Greeks.
2. **Monte Carlo simulation under Geometric Brownian Motion (GBM)** — the numerical engine under test, with five estimators (Standard, Antithetic Variates, Control Variates, Combined Antithetic+CV, and Randomized Quasi-Monte Carlo).

Every other component of the application (architecture, API, frontend) is downstream of the mathematical choices documented here.

Beyond the vanilla GBM pricing engine, PathPricer fits and validates **stochastic-volatility models** against live option chains: Heston calibration (§11) and the SVI volatility surface (§12). These are documented in the same depth as the closed-form engine.

**Explicitly out of scope:** American/Bermudan exercise, local volatility (SABR/Dupire), jump-diffusion, discrete dividends, and the mechanics of live option market data (the engine consumes chains via a market-data provider but does not model their microstructure).

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

**Bump size $h$:** A relative bump of 0.5–1% of the parameter's own value by default (e.g., $h = 0.005 \cdot S_0$ for Delta), configurable. The bump must be small enough to approximate the derivative locally but large enough not to be swamped by residual Monte Carlo noise even with CRN. This trade-off (truncation error vs. residual simulation noise) is itself a validation topic (§15.2).

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

## 11. Heston Stochastic Volatility Model

The Heston (1993) model extends GBM by letting variance follow its own mean-reverting square-root process, so the implied-volatility smile/skew is *modeled* rather than assumed constant:

$$dS_t = (r - q)S_t\,dt + \sqrt{v_t}\,S_t\,dW_t^S, \qquad dv_t = \kappa(\theta_v - v_t)\,dt + \sigma_v\sqrt{v_t}\,dW_t^v$$

| Symbol | Meaning |
|---|---|
| $v_t$ | Instantaneous variance (stochastic) |
| $\kappa$ | Mean-reversion speed of variance |
| $\theta_v$ | Long-run mean of variance |
| $\sigma_v$ | Vol-of-vol |
| $\rho$ | Correlation between $dW^S$ and $dW^v$ (drives the skew) |
| $\sqrt{v_0}$ | Initial volatility (traders quote this, not $v_0$) |

The parameters must satisfy $v_0, \kappa, \theta_v, \sigma_v > 0$ and $-1 < \rho < 1$, all enforced at construction. The **Feller condition** $2\kappa\theta_v > \sigma_v^2$ keeps the variance process strictly positive; PathPricer reports whether it holds on every fitted parameter set rather than hard-constraining the optimizer (§13).

### 11.1 Pricing by Fourier Inversion

The model has no closed-form density, but the **characteristic function** of $\ln S_T$ is known in closed form. Following Gilli & Kellezi, define

$$u_j = \tfrac{1}{2} - j \quad (j=1,2), \qquad a_j = \kappa\theta_v\left[\frac{\kappa}{\sigma_v^2} - \frac{u_j\rho}{\sigma_v}\right], \qquad b_j = \kappa - \rho\sigma_v u_j$$

$$d_j = \sqrt{(\rho\sigma_v u_j - \kappa)^2 + \sigma_v^2(u_j - u_j^2)}$$

Then the Heston prices are recovered by a **Gill-Matsumoto-style** characteristic-function quadrature:

$$C = S_0e^{-qT}P_1 - Ke^{-rT}P_2, \qquad P_j = \tfrac{1}{2} + \frac{1}{\pi}\int_0^{\infty}\operatorname{Re}\left[\frac{e^{-i\phi\ln K}f_j(\phi)}{i\phi}\right]\,d\phi$$

where the two risk-neutral probabilities $P_j$ use the characteristic functions

$$f_j(\phi) = \exp\left[i\phi(r-q)T + a_j T\right]\cdot\frac{\left(\frac{1 - g_j e^{d_j T}}{1 - g_j}\right)^{-2\kappa\theta_v/\sigma_v^2}}{\left(\frac{1 - g_j e^{d_j T}}{1 - g_j}\right)^{2\kappa\theta_v/\sigma_v^2}}\cdot\frac{\text{stable factor}}{(\text{nested CF in } v_0)}$$

The integral is evaluated by **Gauss-Legendre quadrature** on a fixed node grid (nodes cached — the grid is parameter-independent, so one `lru_cache` serves every call). Puts follow from put-call parity, exact under Heston since the model is arbitrage-free.

**Numerical robustness:** the branch of $d_j$ is chosen so $\operatorname{Re}(d_j) \geq 0$, and the term $1 - g_j e^{d_jT}$ is evaluated as $\log(1 - g e^{dT}) - \log(1 - g)$ to avoid catastrophic cancellation in the deep-OTM wings. Both are verified by an extreme-parameters robustness matrix.

### 11.2 Greeks by Finite Difference with Chain Rule

Because the Heston price is deterministic (no Monte Carlo noise), finite-difference Greeks are clean and stable. Central differences bump each input and reprice. Two Greeks need a chain-rule correction because traders quote them w.r.t. **volatility** $\sigma_0 = \sqrt{v_0}$, not variance:

$$\text{vega} = 2\sqrt{v_0}\,\frac{\partial V}{\partial v_0}, \qquad \text{volga} = 4v_0\frac{\partial^2 V}{\partial v_0^2} + 2\frac{\partial V}{\partial v_0}, \qquad \text{vanna} = 2\sqrt{v_0}\,\frac{\partial^2 V}{\partial S\,\partial v_0}$$

Theta is one-sided (maturity only decreases) and reported per calendar day.

**Efficiency:** the spot and vanna bumps only change $S_0$ / $v_0$ — the characteristic-function set is fixed per $(params, T, r, q)$. Grouping all bumped prices under one CF set reduces 12 Fourier evaluations to 6.

## 12. SVI Volatility Surface

The **raw SVI** parameterization (Gatheral, 2004) describes the implied-volatility smile at a fixed expiry as a function of log-moneyness $k = \ln(K/F)$:

$$w(k) = a + b\left(\rho(k - m) + \sqrt{(k - m)^2 + \sigma^2}\right), \quad \sigma_{imp}(k) = \sqrt{\frac{w(k)}{T}}$$

| Parameter | Role |
|---|---|
| $a$ | Overall level of total variance |
| $b$ | Slope of the wings ($b \geq 0$) |
| $\rho$ | Skew / asymmetry ($-1 < \rho < 1$) |
| $m$ | Horizontal offset of the smile minimum |
| $\sigma$ | Curvature at the minimum ($\sigma > 0$) |

### 12.1 Slice Fitting

Each expiry's $(k, \sigma_{imp})$ observations are fit by **nonlinear least squares** (`scipy.optimize.least_squares`) on total variance $w = \sigma_{imp}^2 T$. Three restarts guard against local minima: the heuristic start estimates $b$ and $\rho$ from the smile wings (the linear-in-$|k|$ asymptote of $w(k)$ has slope $b(1\pm\rho)$, normalized by the *log-moneyness* distance), $a$ from the ATM level, and $m$, $\sigma$ from the minimum location. The fitted $a$ is clamped so $w_{\min} = a + b\sigma\sqrt{1-\rho^2} \geq 0$, keeping the slice arbitrage-free in strike.

### 12.2 Calendar Interpolation and Arbitrage Check

A surface is a set of slices, one per expiry, with total variance interpolated **linearly in $T$ at fixed log-moneyness** (sticky-strike); the nearest slice is used flat beyond the fitted range. A calendar-spread arbitrage exists whenever total variance *decreases* in $T$ at a fixed $k$ — such a surface is rejected at build time by checking $w(k, T_i) \geq w(k, T_{i-1})$ on a 61-point $k$-grid across consecutive expiries.

### 12.3 Butterfly (Strike) Arbitrage Check

Two conditions must both hold for a surface to be free of static arbitrage: **calendar** (no decrease in total variance with $T$, §12.2) and **butterfly** (call prices convex in strike). A butterfly arbitrage exists wherever the implied risk-neutral density is negative. From Breeden-Litzenberger, the density is proportional to the second strike derivative of the call price:

$$f(K) = e^{rT}\,\frac{\partial^2 C}{\partial K^2} \geq 0$$

On a discrete grid this is checked as $C(K-d) - 2C(K) + C(K+d) \geq 0$ for equally spaced strikes. Because $f_j$ from the fitted SVI is available in closed form, each slice's $C(K)$ can be evaluated by Black-Scholes at per-grid-point implied vols. A slice fails if its minimum butterfly value is below a small negative tolerance. Every fitted slice reports an `arb_free` flag plus the strike of the worst violation, so the frontend can badge exactly where a surface breaks — this closes the "butterfly-arb not detected" limitation of earlier versions.

### 12.4 ATM Volatility Term Structure

The same fitted slices give the volatility term structure: the at-the-money ($k=0$) implied vol at each expiry,

$$\sigma_{ATM}(T_j) = \sqrt{\frac{w_j(0)}{T_j}} = \sqrt{\frac{a_j + b_j\left(-\rho_j m_j + \sqrt{m_j^2 + \sigma_j^2}\right)}{T_j}}$$

extracted across all fitted expiries. This is the smile's ATM backbone over time and the direct input to a vol-trading view of the term structure.

### 12.5 Greeks Across the Surface

A chosen Greek (or price) can be evaluated on a strike $\times$ time-to-maturity grid where **each cell prices at the SVI implied vol for its own strike/expiry** — so the surface reflects the smile/skew rather than a flat vol. Strikes span a band around spot (default $\pm 30\%$); expiries are the fitted slices. All strikes within one expiry are evaluated in a single vectorized Black-Scholes call, keeping the whole grid a handful of array operations rather than per-cell loops.

## 13. Heston Calibration

Fits $(v_0, \kappa, \theta_v, \sigma_v, \rho)$ to observed market option prices.

### 13.1 Objective: Blended Relative + Absolute Error

A pure relative error over-penalizes deep-OTM options (tiny prices make any small absolute misprice a huge percentage), dragging the fit into the wings. PathPricer blends a **relative RMSE** with a **mean-normalized absolute RMSE** so the ATM backbone stays dominant while relative error still shapes the smile:

$$\min_p \left[ 0.5\cdot\sqrt{\frac{1}{n}\sum_i\left(\frac{V_i^{model} - V_i^{mkt}}{V_i^{mkt}}\right)^2} + 0.5\cdot\frac{\sqrt{\frac{1}{n}\sum_i\left(V_i^{model} - V_i^{mkt}\right)^2}}{\overline{V^{mkt}}} \right]$$

subject to the parameter positivity/correlation bounds. The **Feller condition** is a soft penalty (added only when violated, $10\cdot(2\kappa\theta_v - \sigma_v^2)^2$) rather than a hard constraint — the optimizer may trade Feller feasibility for fit quality, mirroring how practitioners treat it as a preference, and the result reports whether it holds.

### 13.2 Multi-Start and Determinism

`L-BFGS-B` runs from a deterministic ATM-implied-vol seed plus $n_{restarts}-1$ spread seeds. Restarts are spread **log-uniformly** ($s \leftarrow s\cdot\exp(U(-0.7, 0.7))$) because the parameters are positive scale variables — a linear spread would under- and over-sample in equal absolute terms. Seeds are reproducible (`np.random.default_rng(20240101 + i)`). Both true convergence and hitting the iteration limit (status 1) are accepted, since the latter often still holds a good local fit.

## 14. Model Validation

Validation scores a calibrated Heston model against the same market quotes it was fitted to, answering "how well does the model reproduce observed prices and vols, and are the market quotes internally consistent?"

| Metric | Definition |
|---|---|
| Price relative RMSE | $\sqrt{\frac{1}{n}\sum_i\left(\frac{V_i^{model} - V_i^{mkt}}{V_i^{mkt}}\right)^2}$ |
| Price MAPE | $\frac{1}{n}\sum_i\left|\frac{V_i^{model} - V_i^{mkt}}{V_i^{mkt}}\right| \times 100\%$ |
| IV RMSE | $\sqrt{\frac{1}{n}\sum_i\left(\sigma_i^{model} - \sigma_i^{mkt}\right)^2}$, computed only over contracts with resolvable implied vols (NaN-robust) |
| Market parity violation | Largest |put-call parity RHS − market price| across the chain |

The **model** implied vol is solved from the model price via the Black-Scholes IV solver; the **market** implied vol comes from the market price. **Market put-call parity** is checked by pricing the complement option type under the model and comparing the implied parity value against the observed quote — a large violation flags internally inconsistent market quotes rather than a bad model. Every result carries an `in_sample` flag (true when validation uses the calibration contracts, as here).

---

## 15. Validation Methodology

Validation is a first-class feature — the difference between "a Monte Carlo pricer" and "a validated numerical pricing system."

### 15.1 Price Validation

- Monte Carlo prices (all estimators) must fall within their own reported 95% confidence interval of the Black-Scholes price at the stated $N$, across a suite of parameter combinations (deep ITM, deep OTM, ATM, short/long expiry, high/low vol).
- **Coverage check**: Run the full pipeline $M$ times (e.g., $M=200$ independent simulation runs at fixed $N$) and confirm the true (BS) price falls inside the reported 95% CI in approximately 95% of runs (±sampling tolerance). This validates that the confidence interval is calibrated, not merely that the point estimate is close.

### 15.2 Convergence Validation

- Run $\hat{V}$ and $\widehat{SE}$ across a geometric grid of $N$ (e.g., $10^2, 10^3, \ldots, 10^6$).
- Fit $\log \widehat{SE}$ vs $\log N$ via linear regression; assert slope $\approx -0.5$ within tolerance. This provides empirical confirmation of the $\mathcal{O}(N^{-1/2})$ claim.

### 15.3 Greeks Validation

- Compare finite-difference Monte Carlo Greeks against closed-form Black-Scholes Greeks across the same parameter grid, with explicit relative-error tolerances (Delta/Gamma within 1–2% at $N \geq 10^5$, looser tolerance for Theta/Rho).
- Cases where finite-difference Greeks are noisier (Gamma, which involves a second difference and amplifies noise) are documented rather than smoothed over — this demonstrates understanding of numerical methods.

### 15.4 Edge Cases

Regression tests against known closed-form limits:
- $T \to 0$: option price $\to$ intrinsic value
- $\sigma \to 0$: option price $\to$ discounted intrinsic value of the forward
- Deep ITM: Delta $\to \pm e^{-qT}$, price $\to$ forward intrinsic value
- Deep OTM: price $\to 0$, Delta $\to 0$
- **Put-Call Parity**: $C - P = S_0e^{-qT} - Ke^{-rT}$, verified against both BS and MC outputs independently

### 15.5 Statistical Error Metrics

Per-run diagnostics: Standard Error, 95% CI width, Relative Error vs. Black-Scholes. Black-Scholes is treated as ground truth for European vanilla payoffs (valid only because BS is exact for this payoff class). RMSE is reserved for the multi-run coverage check, not a single-run diagnostic.

---

## 16. Why Monte Carlo for a Problem Black-Scholes Already Solves

**The honest answer:**

For vanilla European options under GBM, Monte Carlo is **strictly worse** than Black-Scholes on every axis: it is slower, has sampling error that BS does not, and estimates a quantity BS computes exactly. This is true and should not be hedged.

**Why institutions still rely on Monte Carlo:** Monte Carlo generalizes to problems with no closed-form solution — path-dependent payoffs (Asians, barriers, lookbacks), high-dimensional payoffs (basket options, multi-asset), American/Bermudan exercise (via Longstaff-Schwartz), and models where the terminal distribution has no closed form (Heston, local vol, jump-diffusion). Black-Scholes is the exception that has a clean answer; most of derivatives pricing does not.

**What this project demonstrates:** Not "Monte Carlo is the right tool for vanilla Europeans" (it is not), but rather — the numerical machinery (variance reduction, convergence analysis, error quantification, Greeks-by-bump-and-reprice) is correctly built and validated against a case where the right answer is independently known. That validation-against-known-truth is precisely why testing Monte Carlo against Black-Scholes on the solvable case is methodologically sound before trusting the same machinery on problems with no closed form to check against.

---

## 17. Assumptions and Limitations

| Assumption | Reality | How PathPricer Handles It |
|---|---|---|
| Constant volatility | Implied vol varies by strike/expiry (volatility smile/skew) | Single $\sigma$ input for the GBM engine; the quant workspace fits Heston (§11) and SVI (§12) models to the smile directly |
| GBM / log-normal returns | Real returns exhibit fat tails and negative skew (crash risk) | GBM used; jump-diffusion (Merton) named as the standard extension |
| Constant risk-free rate | Rates have term structure and evolve stochastically | Flat $r$ input; bond curve integration identified as the natural extension |
| Continuous dividend yield | Real dividends are discrete, scheduled cash payments | Continuous $q$ approximation from trailing yield; discrete dividend modeling identified as a known gap |
| European exercise only | Most single-name US equity options are American | Scoped explicitly; Longstaff-Schwartz LSM identified as the standard extension |
| Frictionless markets | Real trading has bid-ask spreads, transaction costs, market impact | Not modeled; pricing-model vs. trading-system distinction stated plainly |
| No risk premium adjustments | Real-world drift $\neq$ risk-neutral drift | Prices under $\mathbb{Q}$ (risk-neutral measure); appropriate for pricing/hedging, not for real-world return forecasting |

---

## 18. Historical Volatility Estimation

### 18.1 Close-to-Close Estimator (Annualized)

$$\hat{\sigma} = \sqrt{252}\cdot\sqrt{\frac{1}{n-1}\sum_{i=1}^{n}\left(r_i - \bar{r}\right)^2}, \quad r_i = \ln\frac{P_i}{P_{i-1}}$$

Log returns are used (not simple returns) because log returns are additive over time and are the theoretically consistent choice given GBM assumes log-normal prices.

### 18.2 Windows

Four trailing windows are reported: 20-day, 60-day, 126-day, and 252-day realized volatility. Displaying multiple windows together is a designed feature: regime stability vs. instability is visible from how much the estimates disagree across windows.

**Why close-to-close and not range-based (Parkinson/Garman-Klass/Yang-Zhang) estimators:** Range-based estimators are more statistically efficient (lower variance for the same sample size) but require reliable high/low/open data. Close-to-close is chosen for data quality consistency — yfinance reliably provides closing prices across all supported tickers (US, Indian, FX, cryptocurrency), but intraday range data quality is less consistent. Efficiency gain does not matter if the input data does not reliably support it.

---

## 19. Random Number Generation and Reproducibility

### 19.1 Generator

NumPy's `Generator` API with the PCG64 bit generator (`np.random.default_rng(seed)`), not legacy `RandomState`/Mersenne Twister.

**Why PCG64/Generator (NumPy 1.17+):** Better statistical properties, cleaner seeding and streaming model, and no global mutable state. Using legacy global RNG state is a correctness hazard in a stateless, concurrently-served backend — global mutable state shared across requests is a bug. `default_rng(seed)` creates an isolated, request-scoped generator instance.

### 19.2 Reproducibility Contract

Given identical inputs (ticker snapshot, strike, expiry, vol, rate, number of paths, variance-reduction method, and seed), the pricing run is **byte-for-byte reproducible**. A shared link re-executes the identical simulation and gets the identical answer.

### 19.3 Antithetic Pairing Constraint

Antithetic variates reuse the same base draws — this is *not* implemented as two independent seeded runs, which would silently break the antithetic pairing guarantee.

---

## 20. Design Decisions FAQ

A quick-reference summary of architectural and numerical choices made in this project — for anyone reading the code or evaluating its design.

| Question | Rationale |
|---|---|
| Why Monte Carlo for something Black-Scholes already solves? | Validation infrastructure for machinery meant to generalize to unsolvable cases (path-dependent, American, multi-asset). |
| Why $S_T$ as control variate and not the Black-Scholes price? | Black-Scholes is the benchmark being validated; using it as a control would be circular. $S_T$ has a known expectation independent of the option price. |
| Why exact GBM sampling instead of Euler-Maruyama? | The closed-form log-normal transition density eliminates discretisation bias. Euler is needed only for path-dependent payoffs or models without closed-form densities. |
| Why a normal-approximation confidence interval and not bootstrap? | The CLT applies cleanly to i.i.d. discounted payoffs with finite variance. Bootstrap targets the same result at higher computational cost. |
| Why do finite-difference Greeks need common random numbers? | Without CRN, the parameter bump is swamped by Monte Carlo noise. Reusing the same seed across the bump pair isolates the sensitivity from sampling variance. |
| Why a continuous dividend yield approximation instead of discrete? | Free market data does not reliably provide ex-dividend schedules. The continuous approximation (Merton) is standard for equity indices and trailing yields. |
| Why close-to-close volatility instead of a range-based estimator? | yfinance guarantees close prices across all supported tickers (US, Indian, FX, cryptocurrency), but intraday range data quality is inconsistent. Data reliability matters more than marginal statistical efficiency. |
| Why `default_rng(seed)` instead of legacy `RandomState`? | PCG64 has better statistical properties and avoids shared global state — a correctness hazard in a concurrent API backend. Each request gets an isolated generator. |
| Why Newton-Raphson with a Brent fallback for implied volatility? | Newton-Raphson converges quadratically near the root; Brent's method handles near-zero-Vega cases (deep ITM/OTM, near-expiry) without requiring a derivative. |
| Why does P&L attribution include a residual term? | The Taylor expansion is exact only for infinitesimal moves. The residual captures cross-Greeks (Vanna, Volga), higher-order terms, and other unmodeled effects. |
| Why vectorise the risk grid instead of looping over grid cells? | 625 cell-level Python loops would dominate runtime. A single NumPy broadcast operation evaluates all points at C speed. |
| Why RQMC (Sobol) instead of standard Monte Carlo? | For smooth integrands, RQMC converges at $\mathcal{O}(N^{-1})$ vs standard MC's $\mathcal{O}(N^{-1/2})$ — halving error requires 2× paths instead of 4×. The confidence interval is a heuristic, not a strict 95% statement. |
| Why Fourier inversion for Heston pricing? | The Heston density has no closed form, but its characteristic function does — Fourier inversion prices in milliseconds with deterministic accuracy, avoiding Monte Carlo noise in the Greeks. |
| Why report Volga/Vanna w.r.t. $\sqrt{v_0}$ not $v_0$? | Traders quote the volatility $\sigma_0 = \sqrt{v_0}$, not the variance. The chain rule $4v_0\,\partial^2V/\partial v_0^2 + 2\,\partial V/\partial v_0$ converts variance-space bumps to the quoted convention. |
| Why blend relative and absolute RMSE in calibration? | Pure relative error over-penalizes deep-OTM quotes (tiny prices, huge percentages) and drags the fit into the wings; the blend keeps the ATM backbone dominant while relative error still shapes the smile. |
| Why Feller as a soft penalty, not a hard constraint? | Hard-constraining Feller forces infeasible optimizer restarts; a soft penalty lets the fit trade feasibility against quality and reports the outcome — mirroring practitioner treatment of Feller as a preference. |
| Why reject surfaces with calendar arbitrage at build time? | Total variance decreasing in $T$ at a fixed moneyness admits a riskless calendar-spread arbitrage, so the surface would be unusable for pricing. Rejecting it keeps every returned surface economically sane. |
| Why not "verify" an implied rate/dividend by recomputing parity? | Recomputing parity from the recovered parameter is a tautology — it reproduces the spread by construction and can never fail. The meaningful checks are the positivity guard and the divergence vs. a reference. |
| Why compute strategy max profit/loss analytically instead of scanning the payoff grid? | The expiration payoff is piecewise-linear, so extrema live exactly at strike kinks and the tails. Analytic extrema are exact and correctly report unbounded (∞) outcomes, which a finite grid scan would misstate. |
| Why are the parity probes ATM-only? | ATM quotes are the most liquid and reliable, and least corrupted by deep-OTM noise — the cleanest signal for a rate/dividend estimate. |

---

## 21. Multi-Leg Strategy Pricing

A strategy is a portfolio of 1–10 legs, each a signed contract: a vanilla European call/put (priced by Black-Scholes) or a stock position (valued at its forward-carried price $Se^{-qT}$). Positive quantity is long, negative is short.

### 21.1 Per-Leg Pricing and Portfolio Greeks

Each option leg is priced with the closed-form BSM engine and its five Greeks. The **per-leg** price and Greeks are reported unsigned (an option's delta is positive even when sold); it is the **portfolio-level** Greeks that weight by signed contract quantity:

$$\Delta_{net} = \sum_i q_i \Delta_i, \qquad \Gamma_{net} = \sum_i q_i \Gamma_i, \qquad \text{etc.}$$

The net premium is the quantity-weighted sum of leg values — a positive net premium is a debit (we pay to enter), a negative one is a credit (we are paid, i.e. sold premium).

### 21.2 Expiration Payoff Diagram and Breakevens

At expiration the payoff is piecewise-linear in spot, with kinks at every strike. PathPricer evaluates it over a spot grid spanning all strikes (padded to catch every breakeven) and reports net P&L at each point: $\text{P\&L}(S_T) = \text{payoff}(S_T) - \text{net premium}$.

**Breakevens** are the spot levels where this net P&L is zero, found by linear interpolation between adjacent grid points where the payoff crosses zero.

### 21.3 Max Profit / Max Loss From the Piecewise-Linear Structure

Because the expiration payoff is piecewise-linear, its global extrema live at the strike kinks or in the tails — no grid search is needed:

- **Low tail** $(S_T \to 0)$: always finite — puts cap at quantity-weighted strike.
- **High tail** $(S_T \to \infty)$: finite only when the total call+stock slope is zero; otherwise unbounded profit (positive slope) or unbounded loss (negative slope).

Max profit is unbounded when the high-tail slope is positive (e.g. a long call); max loss is unbounded when it is negative. Otherwise both are exact maxima/minima over the finite candidate set (strike kinks plus tail values). This exact handling avoids the common error of reporting a spurious finite max when a strategy is actually open-ended.

### 21.4 Presets

The frontend ships ten presets built from these primitives — long/short straddles, strangles, bull call / bear put spreads, iron condor, iron butterfly, call butterfly, covered call, and protective put — each demonstrating a different risk/reward shape students should be able to read off the payoff diagram.

---

## 22. Scenario Stress Testing

Stress testing answers "what happens to my position if the market moves in a specific, named way?" The engine reprices a single option under each scenario using closed-form Black-Scholes and compares every result to the base price.

### 22.1 Scenario Definition

A scenario is a coordinate shift applied to the base parameters:

$$S' = \max(\epsilon, S_0 + \Delta S_{abs} + \Delta S_{pct}\cdot S_0), \qquad \sigma' = \max(\text{MIN\_SIGMA}, \sigma + \Delta\sigma), \qquad T' = \max(\text{MIN\_T}, T - \Delta T_{days}), \qquad r' = r + \Delta r$$

Named scenarios encode recognizable history — e.g. *2008 Crisis* ($-40\%$ spot, $+20$ vol pts, $+100$ bp rates), *COVID Crash*, *Vol Crush*, *Flash Crash* — while the underlying repricing is the same parameterized machinery for each. Floors keep the scenario physically valid (non-negative spot, positive vol/time).

### 22.2 Output and Interpretation

For each scenario the engine reports the shifted spot/vol, the repriced option value, and both the absolute and percentage P&L versus base. It then selects the worst and best scenarios and computes an **unrealized-risk** metric — the largest single-scenario loss as a fraction of the base price (zero when even the worst scenario is a gain):

$$\text{unrealized risk} = \max\left(0, \frac{-\text{worst P\&L}}{\text{base price}}\right)$$

Relative to P&L attribution (§9), which *decomposes* one observed move into Greek contributions, stress testing *imposes* many hypothetical moves and reads off the outcomes — the forward-looking complement to the backward-looking attribution.

---

## 23. Put-Call Parity Data-Quality Probes

Put-call parity is a no-arbitrage identity linking a call and a put at the same strike:

$$C - P = S_0e^{-qT} - Ke^{-rT}$$

If we trust one side, the relation tells us the value of the other. The data-quality probes run this in reverse: **given market prices, what rate or dividend does the market appear to be assuming?** When the quotes are internally consistent, the extracted parameter lands near a consensus value; a large divergence is a red flag on the quotes (stale mids, crossed markets, mis-priced dividends).

### 23.1 Implied Risk-Free Rate

Given the call price, put price, spot, strike, dividend yield, and time-to-maturity, solve parity for the rate:

$$r = -\frac{1}{T}\ln\left(\frac{S_0e^{-qT} - C + P}{K}\right) = -\frac{1}{T}\ln\left(\frac{\text{discounted spot} - C + P}{K}\right)$$

**Validity guard:** the numerator, the discounted-strike proxy, must be strictly positive. A non-positive value means $C - P \geq S_0e^{-qT}$ — the quotes are inconsistent/inverted far beyond any plausible single rate — so the extraction raises a `parity_inconsistent` error rather than returning a meaningless number.

### 23.2 Implied Dividend Yield

The companion probe: given a trusted rate, solve for the dividend the parity relation implies:

$$q = -\frac{1}{T}\ln\left(\frac{Ke^{-rT} + C - P}{S_0}\right)$$

with the symmetric guard that the implied discounted spot must be positive.

### 23.3 Why These Must NOT Be "Verified" by Recomputing Parity

It is tempting to "validate" an extraction by plugging the recovered $r$ or $q$ back into parity to confirm it reproduces $C - P$. This is a **tautology**: $r$ is *defined* as the value that makes the identity hold, so recomputation reproduces the spread to machine precision by construction. It can never fail and verifies nothing. The real checks are (a) the positivity guard above, which genuinely catches inconsistent quotes, and (b) the comparison of the extracted value against a reference (consensus rate, reported dividend yield), reported as a **divergence** and a human-readable warning. Earlier versions shipped the tautological self-check; it was removed in review because it could not catch any real error.

### 23.4 ATM Pair Selection

The probes operate on a single call/put pair at the strike **nearest spot** (the ATM pair). Mids are used when a valid bid/ask exists, otherwise last price. This is deliberately an ATM-only probe: ATM quotes are the most liquid, most reliable, and least contaminated by the deep-wings noise that would corrupt a rate or dividend estimate.
