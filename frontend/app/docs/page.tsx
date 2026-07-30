import React from "react";

export default function DocsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
      {/* Document Header */}
      <div className="border-b border-[#21262d] pb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          Quantitative Methodology &amp; Mathematical Specification
        </h1>
        <p className="text-sm text-[#8b949e]">
          Single source of truth for all mathematical models, Monte Carlo variance-reduction algorithms, Greeks derivations, and defensible architectural decisions.
        </p>
      </div>

      {/* 1. Geometric Brownian Motion */}
      <section className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-[#58a6ff] flex items-center gap-2">
          <span>1. The Model: Geometric Brownian Motion (GBM)</span>
        </h2>

        <p className="text-sm text-[#8b949e] leading-relaxed">
          The underlying stock price S_t follows the risk-neutral Stochastic Differential Equation (SDE):
        </p>

        <div className="bg-[#0d1117] p-4 rounded-md border border-[#21262d] font-mono text-sm text-[#79c0ff] flex justify-center">
          dS_t = (r - q) S_t dt + σ S_t dW_t
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-[#8b949e] py-2">
          <div className="bg-[#0d1117]/60 p-2.5 rounded border border-[#21262d]">
            <span className="text-[#8b949e] block">S_t</span> Stock price at time t
          </div>
          <div className="bg-[#0d1117]/60 p-2.5 rounded border border-[#21262d]">
            <span className="text-[#8b949e] block">r</span> Risk-free rate (annualized)
          </div>
          <div className="bg-[#0d1117]/60 p-2.5 rounded border border-[#21262d]">
            <span className="text-[#8b949e] block">q</span> Continuous dividend yield
          </div>
          <div className="bg-[#0d1117]/60 p-2.5 rounded border border-[#21262d]">
            <span className="text-[#8b949e] block">σ</span> Volatility (annualized)
          </div>
        </div>

        <h3 className="text-sm font-bold text-slate-200 pt-2">Exact Closed-Form Solution</h3>
        <p className="text-sm text-[#8b949e] leading-relaxed">
          Applying Itô&apos;s Lemma to ln(S_t) yields the exact (non-discretized) terminal price solution:
        </p>

        <div className="bg-[#0d1117] p-4 rounded-md border border-[#21262d] font-mono text-sm text-emerald-400 flex justify-center">
          S_T = S_0 exp[(r - q - 0.5 σ²) T + σ √T Z], Z ~ N(0, 1)
        </div>

        <div className="bg-[#0d1117]/80 border-l-4 border-[#58a6ff] p-4 text-xs text-[#8b949e] space-y-2">
          <div className="font-bold text-[#79c0ff]">Why exact solution and not Euler-Maruyama discretization?</div>
          <p className="leading-relaxed">
            For plain GBM with constant parameters, the exact terminal log-normal density is known in closed form, eliminating all discretization bias. Euler-Maruyama is required for path-dependent options (Asians, barriers) or models without closed-form transition densities (Heston). Using Euler here would introduce unnecessary bias for zero benefit.
          </p>
        </div>
      </section>

      {/* 2. Why Monte Carlo for a Solved Problem? */}
      <section className="bg-[#0d1117]/40 border-2 border-[#58a6ff]/80 rounded-lg p-6 space-y-4 shadow-xl shadow-[#0d1117]/30">
        <div className="flex items-center justify-between border-b border-[#161b22]/80 pb-3">
          <h2 className="text-xl font-extrabold text-[#79c0ff] tracking-tight flex items-center gap-2">
            <span>2. Why Monte Carlo for a Problem Black-Scholes Already Solves?</span>
          </h2>
          <span className="text-xs px-2.5 py-0.5 rounded bg-[#161b22] text-[#79c0ff] border border-[#30363d] font-mono font-bold">
            Core Intellectual Claim
          </span>
        </div>

        <p className="text-sm text-slate-200 font-semibold leading-relaxed">
          This is the single most important conceptual question in PathPricer: why build Monte Carlo simulation for European vanilla options when Black-Scholes is exact and instant?
        </p>

        <div className="space-y-3 text-sm text-[#8b949e] leading-relaxed">
          <div className="bg-[#161b22]/90 p-4 rounded border border-[#21262d]">
            <h4 className="font-bold text-rose-400 mb-1">The Honest Assessment:</h4>
            <p className="text-xs text-[#8b949e]">
              For vanilla European options under GBM, Monte Carlo is <strong>strictly worse</strong> than Black-Scholes on every axis that matters in production: it is slower, introduces sampling noise, and estimates a quantity Black-Scholes computes exactly in closed form.
            </p>
          </div>

          <div className="bg-[#161b22]/90 p-4 rounded border border-[#21262d]">
            <h4 className="font-bold text-[#79c0ff] mb-1">Why Institutions Still Depend on Monte Carlo:</h4>
            <p className="text-xs text-[#8b949e]">
              Monte Carlo generalizes to real-world problems with <strong>no closed-form solution</strong>: path-dependent payoffs (Asians, barriers), high-dimensional basket options, American/Bermudan exercise (via Longstaff-Schwartz), and stochastic volatility/jump models (Heston, SABR, Dupire). Black-Scholes is the rare exception with an exact formula; most derivatives pricing has none.
            </p>
          </div>

          <div className="bg-[#161b22]/90 p-4 rounded border border-[#21262d]">
            <h4 className="font-bold text-emerald-400 mb-1">What PathPricer Demonstrates:</h4>
            <p className="text-xs text-[#8b949e]">
              PathPricer builds and validates numerical machinery — variance reduction, empirical convergence rate tracking (O(N⁻¹/²)), confidence interval calibration, and finite-difference Greeks with CRN — against a case where <strong>ground truth is independently known</strong>. Validating simulation infrastructure against known analytical truth is the prerequisite for trusting that same machinery on unsolvable problems.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Black-Scholes-Merton Analytical Benchmark & Greeks */}
      <section className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-[#58a6ff]">
          3. Black-Scholes-Merton Analytical Benchmark &amp; Greeks
        </h2>

        <p className="text-sm text-[#8b949e] leading-relaxed">
          Closed-form formulas incorporating continuous dividend yield q (Merton 1973 extension):
        </p>

        <div className="bg-[#0d1117] p-4 rounded-md border border-[#21262d] font-mono text-xs text-[#79c0ff] space-y-2">
          <div>d1 = [ln(S0/K) + (r - q + 0.5 σ²) T] / (σ √T)</div>
          <div>d2 = d1 - σ √T</div>
          <div className="pt-2 text-emerald-400 font-bold">
            Call = S0 e^(-qT) N(d1) - K e^(-rT) N(d2)
          </div>
          <div className="text-emerald-400 font-bold">
            Put = K e^(-rT) N(-d2) - S0 e^(-qT) N(-d1)
          </div>
        </div>

        <h3 className="text-sm font-bold text-slate-200 pt-2">Analytical Greeks Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr>
                <th className="p-2.5">Greek</th>
                <th className="p-2.5">Call Formula</th>
                <th className="p-2.5">Put Formula</th>
                <th className="p-2.5">Convention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              <tr>
                <td className="p-2.5 font-bold text-white">Delta (&Delta;)</td>
                <td className="p-2.5 text-[#79c0ff]">e^(-qT) N(d1)</td>
                <td className="p-2.5 text-[#79c0ff]">-e^(-qT) N(-d1)</td>
                <td className="p-2.5 text-[#8b949e]">Directional spot sensitivity</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-white">Gamma (&Gamma;)</td>
                <td className="p-2.5 text-[#79c0ff]">e^(-qT) &phi;(d1) / (S0 &sigma; &radic;T)</td>
                <td className="p-2.5 text-[#79c0ff]">Identical to Call</td>
                <td className="p-2.5 text-[#8b949e]">Convexity (curvature)</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-white">Vega (&nu;)</td>
                <td className="p-2.5 text-[#79c0ff]">S0 e^(-qT) &phi;(d1) &radic;T</td>
                <td className="p-2.5 text-[#79c0ff]">Identical to Call</td>
                <td className="p-2.5 text-[#8b949e]">Volatility sensitivity</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-white">Theta (&theta;)</td>
                <td className="p-2.5 text-[#79c0ff]">Annualized / 365</td>
                <td className="p-2.5 text-[#79c0ff]">Annualized / 365</td>
                <td className="p-2.5 text-[#8b949e]">Reported per calendar day</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-white">Rho (&rho;)</td>
                <td className="p-2.5 text-[#79c0ff]">K T e^(-rT) N(d2)</td>
                <td className="p-2.5 text-[#79c0ff]">-K T e^(-rT) N(-d2)</td>
                <td className="p-2.5 text-[#8b949e]">Interest rate sensitivity</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Monte Carlo Estimator & Convergence Rate */}
      <section className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-[#58a6ff]">
          4. Monte Carlo Estimator &amp; O(N⁻¹/²) Convergence
        </h2>

        <div className="bg-[#0d1117] p-4 rounded-md border border-[#21262d] font-mono text-sm text-[#79c0ff] flex justify-center">
          V̂ = e^(-rT) &bull; (1/N) &sum; h(S_T^(i)), h(S_T) = max(S_T - K, 0)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <span className="text-[#8b949e] font-bold block mb-1">Standard Error (SE):</span>
            <div className="text-[#79c0ff] text-sm">SE = s / &radic;N</div>
            <p className="text-[#8b949e] text-xs mt-2">
              Sample variance s&sup2; computed over i.i.d. discounted payoffs.
            </p>
          </div>

          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <span className="text-[#8b949e] font-bold block mb-1">95% Confidence Interval:</span>
            <div className="text-[#79c0ff] text-sm">95% CI = V̂ &plusmn; 1.96 &bull; SE</div>
            <p className="text-[#8b949e] text-xs mt-2">
              Normal-approximation CI justified by Central Limit Theorem (CLT).
            </p>
          </div>
        </div>

        <div className="bg-[#0d1117]/80 border-l-4 border-emerald-500 p-4 text-xs text-[#8b949e] space-y-1">
          <div className="font-bold text-emerald-400">Why Normal-Approximation CI and not Bootstrap?</div>
          <p className="leading-relaxed">
            Discounted payoffs e^(-rT) h(S_T^(i)) are i.i.d. with finite variance, so the Central Limit Theorem applies cleanly for N &ge; 10⁴. Bootstrap CIs would target the same asymptotic result at much higher compute cost without improving accuracy.
          </p>
        </div>
      </section>

      {/* 5. Variance Reduction Techniques */}
      <section className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-[#58a6ff]">
          5. Variance Reduction Techniques
        </h2>

        <div className="space-y-4 text-sm text-[#8b949e]">
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <h3 className="font-bold text-white mb-1">5.1 Antithetic Variates</h3>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              For each standard normal draw +Z_i, also evaluate payoff at -Z_i. Monotonic option payoffs guarantee negative correlation between paired paths, reducing variance of their average.
            </p>
          </div>

          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <h3 className="font-bold text-white mb-1">5.2 Control Variates (Terminal Asset Price S_T)</h3>
            <p className="text-xs text-[#8b949e] leading-relaxed mb-2">
              Uses terminal asset price S_T as control variate with known expectation E^Q[S_T] = S0 e^((r-q)T) (Boyle 1977).
            </p>
            <div className="font-mono text-xs text-[#79c0ff] bg-[#161b22] p-2 rounded">
              V̂_CV = e^(-rT) &bull; (1/N) &sum; [ h(S_T^(i)) - &beta;* (S_T^(i) - E[S_T]) ]
            </div>
            <p className="text-xs text-[#8b949e] mt-2 font-mono">
              Why S_T and NOT BS price as control? BS price is the benchmark being validated, so using it as a control would be circular. S_T has a known expectation independent of the option price.
            </p>
          </div>

          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <h3 className="font-bold text-white mb-1">5.3 Combined Antithetic + Control Variates</h3>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              Applies antithetic pairing first, then applies control variate correction to paired averages. Stacked techniques achieve maximal variance reduction without redundancy.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Assumptions & Limitations Table */}
      <section className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
          <h2 className="text-xl font-bold text-[#58a6ff]">
            6. Assumptions &amp; Limitations Table
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr>
                <th className="p-3">Model Assumption</th>
                <th className="p-3">Market Reality</th>
                <th className="p-3">v1 Treatment in PathPricer</th>
                <th className="p-3">Future Fix / Institutional Extension</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              <tr>
                <td className="p-3 font-bold text-white">Constant Volatility</td>
                <td className="p-3 text-[#8b949e]">Implied vol varies by strike &amp; expiry (smile/skew)</td>
                <td className="p-3 text-[#79c0ff]">Single &sigma; input (historical or manual)</td>
                <td className="p-3 text-emerald-400">SABR / Local Volatility (Dupire)</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">GBM / Log-Normal Returns</td>
                <td className="p-3 text-[#8b949e]">Real returns exhibit fat tails &amp; negative skew</td>
                <td className="p-3 text-[#79c0ff]">GBM log-normal exact sampling</td>
                <td className="p-3 text-emerald-400">Merton Jump-Diffusion / Heston</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Constant Risk-Free Rate</td>
                <td className="p-3 text-[#8b949e]">Rates have term structure &amp; evolve stochastically</td>
                <td className="p-3 text-[#79c0ff]">Flat r rate input</td>
                <td className="p-3 text-emerald-400">BondFactor Yield Curve Provider Hook</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Continuous Dividend Yield</td>
                <td className="p-3 text-[#8b949e]">Real dividends are discrete cash payments</td>
                <td className="p-3 text-[#79c0ff]">Continuous q yield approximation</td>
                <td className="p-3 text-emerald-400">Scheduled Ex-Dividend Escrow Modeling</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">European Exercise Only</td>
                <td className="p-3 text-[#8b949e]">Most US single-name equity options are American</td>
                <td className="p-3 text-[#79c0ff]">Explicit scope limitation</td>
                <td className="p-3 text-emerald-400">Longstaff-Schwartz LSM Monte Carlo</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Frictionless Markets</td>
                <td className="p-3 text-[#8b949e]">Real trading has bid-ask spreads &amp; market impact</td>
                <td className="p-3 text-[#79c0ff]">Not modeled in pricing engine</td>
                <td className="p-3 text-emerald-400">Pricing Model vs Execution System distinction</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Risk-Neutral Measure Q</td>
                <td className="p-3 text-[#8b949e]">Physical measure drift &ne; risk-neutral drift</td>
                <td className="p-3 text-[#79c0ff]">Priced strictly under risk-neutral measure Q</td>
                <td className="p-3 text-emerald-400">Appropriate for pricing/hedging, not forecasting</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Design Decisions & Interview Prep Cheat Sheet */}
      <section className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-[#58a6ff]">
          7. Summary of Defensible Design Decisions (Interview Prep Cheat Sheet)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr>
                <th className="p-3">Interview Question</th>
                <th className="p-3">One-Line Defensible Answer</th>
                <th className="p-3">Mathematical Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              <tr>
                <td className="p-3 font-bold text-white">Why MC for a problem BS solves?</td>
                <td className="p-3 text-[#79c0ff]">Validation infrastructure for machinery meant to generalize to unsolvable cases</td>
                <td className="p-3 text-[#8b949e]">Testing MC against BS on solvable case validates code before applying to path-dependent/American options</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why S_T and not BS price as control?</td>
                <td className="p-3 text-[#79c0ff]">BS price is the benchmark; using it as control would be circular</td>
                <td className="p-3 text-[#8b949e]">S_T has a known expectation E^Q[S_T] = S0 e^(r-q)T independent of option price</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why exact GBM sampling, not Euler?</td>
                <td className="p-3 text-[#79c0ff]">No discretization error needed or wanted for European terminal payoffs</td>
                <td className="p-3 text-[#8b949e]">Log-normal transition density is known in closed form; Euler adds bias</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why normal CI, not Bootstrap?</td>
                <td className="p-3 text-[#79c0ff]">CLT applies cleanly to i.i.d. finite-variance draws; bootstrap adds cost with no benefit</td>
                <td className="p-3 text-[#8b949e]">Sample size N &ge; 10k guarantees sample mean is asymptotically normal</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why FD Greeks need CRN?</td>
                <td className="p-3 text-[#79c0ff]">Without CRN, finite-difference bumps are swamped by MC simulation noise</td>
                <td className="p-3 text-[#8b949e]">Reusing same random seed across bump pair cancels path noise</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why continuous dividend yield?</td>
                <td className="p-3 text-[#79c0ff]">Free market data lacks reliable ex-dividend schedules; explicitly named gap</td>
                <td className="p-3 text-[#8b949e]">Merton continuous approximation is standard for equity index &amp; trailing yields</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why close-to-close vol, not range?</td>
                <td className="p-3 text-[#79c0ff]">Data quality consistency across US/IN tickers matters more than marginal efficiency</td>
                <td className="p-3 text-[#8b949e]">Close price is guaranteed across all exchanges; intraday range data is noisy</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why default_rng, not RandomState?</td>
                <td className="p-3 text-[#79c0ff]">PCG64 is statistically superior and avoids shared global state in backend</td>
                <td className="p-3 text-[#8b949e]">Request-scoped isolated generator prevents race conditions in API server</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
