import React from "react";

export default function DocsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
      {/* Document Header */}
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          Quantitative Methodology &amp; Mathematical Specification
        </h1>
        <p className="text-sm text-slate-400">
          Single source of truth for all mathematical models, Monte Carlo variance-reduction algorithms, Greeks derivations, and defensible architectural decisions.
        </p>
      </div>

      {/* 1. Geometric Brownian Motion */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
          <span>1. The Model: Geometric Brownian Motion (GBM)</span>
        </h2>

        <p className="text-sm text-slate-300 leading-relaxed">
          The underlying stock price S_t follows the risk-neutral Stochastic Differential Equation (SDE):
        </p>

        <div className="bg-slate-950 p-4 rounded-md border border-slate-800 font-mono text-sm text-cyan-300 flex justify-center">
          dS_t = (r - q) S_t dt + σ S_t dW_t
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-slate-300 py-2">
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block">S_t</span> Stock price at time t
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block">r</span> Risk-free rate (annualized)
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block">q</span> Continuous dividend yield
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block">σ</span> Volatility (annualized)
          </div>
        </div>

        <h3 className="text-sm font-bold text-slate-200 pt-2">Exact Closed-Form Solution</h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          Applying Itô&apos;s Lemma to ln(S_t) yields the exact (non-discretized) terminal price solution:
        </p>

        <div className="bg-slate-950 p-4 rounded-md border border-slate-800 font-mono text-sm text-emerald-400 flex justify-center">
          S_T = S_0 exp[(r - q - 0.5 σ²) T + σ √T Z], Z ~ N(0, 1)
        </div>

        <div className="bg-slate-950/80 border-l-4 border-cyan-500 p-4 text-xs text-slate-300 space-y-2">
          <div className="font-bold text-cyan-300">Why exact solution and not Euler-Maruyama discretization?</div>
          <p className="leading-relaxed">
            For plain GBM with constant parameters, the exact terminal log-normal density is known in closed form, eliminating all discretization bias. Euler-Maruyama is required for path-dependent options (Asians, barriers) or models without closed-form transition densities (Heston). Using Euler here would introduce unnecessary bias for zero benefit.
          </p>
        </div>
      </section>

      {/* 2. Why Monte Carlo for a Solved Problem? */}
      <section className="bg-cyan-950/40 border-2 border-cyan-500/80 rounded-lg p-6 space-y-4 shadow-xl shadow-cyan-950/30">
        <div className="flex items-center justify-between border-b border-cyan-900/80 pb-3">
          <h2 className="text-xl font-extrabold text-cyan-300 tracking-tight flex items-center gap-2">
            <span>💡 2. Why Monte Carlo for a Problem Black-Scholes Already Solves?</span>
          </h2>
          <span className="text-xs px-2.5 py-0.5 rounded bg-cyan-900 text-cyan-200 border border-cyan-700 font-mono font-bold">
            Core Intellectual Claim
          </span>
        </div>

        <p className="text-sm text-slate-200 font-semibold leading-relaxed">
          This is the single most important conceptual question in PathPricer: why build Monte Carlo simulation for European vanilla options when Black-Scholes is exact and instant?
        </p>

        <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <div className="bg-slate-900/90 p-4 rounded border border-slate-800">
            <h4 className="font-bold text-rose-400 mb-1">The Honest Assessment:</h4>
            <p className="text-xs text-slate-300">
              For vanilla European options under GBM, Monte Carlo is <strong>strictly worse</strong> than Black-Scholes on every axis that matters in production: it is slower, introduces sampling noise, and estimates a quantity Black-Scholes computes exactly in closed form.
            </p>
          </div>

          <div className="bg-slate-900/90 p-4 rounded border border-slate-800">
            <h4 className="font-bold text-cyan-300 mb-1">Why Institutions Still Depend on Monte Carlo:</h4>
            <p className="text-xs text-slate-300">
              Monte Carlo generalizes to real-world problems with <strong>no closed-form solution</strong>: path-dependent payoffs (Asians, barriers), high-dimensional basket options, American/Bermudan exercise (via Longstaff-Schwartz), and stochastic volatility/jump models (Heston, SABR, Dupire). Black-Scholes is the rare exception with an exact formula; most derivatives pricing has none.
            </p>
          </div>

          <div className="bg-slate-900/90 p-4 rounded border border-slate-800">
            <h4 className="font-bold text-emerald-400 mb-1">What PathPricer Demonstrates:</h4>
            <p className="text-xs text-slate-300">
              PathPricer builds and validates numerical machinery — variance reduction, empirical convergence rate tracking (O(N⁻¹/²)), confidence interval calibration, and finite-difference Greeks with CRN — against a case where <strong>ground truth is independently known</strong>. Validating simulation infrastructure against known analytical truth is the prerequisite for trusting that same machinery on unsolvable problems.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Black-Scholes-Merton Analytical Benchmark & Greeks */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-cyan-400">
          3. Black-Scholes-Merton Analytical Benchmark &amp; Greeks
        </h2>

        <p className="text-sm text-slate-300 leading-relaxed">
          Closed-form formulas incorporating continuous dividend yield q (Merton 1973 extension):
        </p>

        <div className="bg-slate-950 p-4 rounded-md border border-slate-800 font-mono text-xs text-cyan-300 space-y-2">
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
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
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
                <td className="p-2.5 text-cyan-300">e^(-qT) N(d1)</td>
                <td className="p-2.5 text-cyan-300">-e^(-qT) N(-d1)</td>
                <td className="p-2.5 text-slate-400">Directional spot sensitivity</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-white">Gamma (&Gamma;)</td>
                <td className="p-2.5 text-cyan-300">e^(-qT) &phi;(d1) / (S0 &sigma; &radic;T)</td>
                <td className="p-2.5 text-cyan-300">Identical to Call</td>
                <td className="p-2.5 text-slate-400">Convexity (curvature)</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-white">Vega (&nu;)</td>
                <td className="p-2.5 text-cyan-300">S0 e^(-qT) &phi;(d1) &radic;T</td>
                <td className="p-2.5 text-cyan-300">Identical to Call</td>
                <td className="p-2.5 text-slate-400">Volatility sensitivity</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-white">Theta (&theta;)</td>
                <td className="p-2.5 text-cyan-300">Annualized / 365</td>
                <td className="p-2.5 text-cyan-300">Annualized / 365</td>
                <td className="p-2.5 text-slate-400">Reported per calendar day</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-white">Rho (&rho;)</td>
                <td className="p-2.5 text-cyan-300">K T e^(-rT) N(d2)</td>
                <td className="p-2.5 text-cyan-300">-K T e^(-rT) N(-d2)</td>
                <td className="p-2.5 text-slate-400">Interest rate sensitivity</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Monte Carlo Estimator & Convergence Rate */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-cyan-400">
          4. Monte Carlo Estimator &amp; O(N⁻¹/²) Convergence
        </h2>

        <div className="bg-slate-950 p-4 rounded-md border border-slate-800 font-mono text-sm text-cyan-300 flex justify-center">
          V̂ = e^(-rT) &bull; (1/N) &sum; h(S_T^(i)), h(S_T) = max(S_T - K, 0)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-slate-950 p-4 rounded border border-slate-800">
            <span className="text-slate-400 font-bold block mb-1">Standard Error (SE):</span>
            <div className="text-cyan-300 text-sm">SE = s / &radic;N</div>
            <p className="text-slate-500 text-[11px] mt-2">
              Sample variance s&sup2; computed over i.i.d. discounted payoffs.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded border border-slate-800">
            <span className="text-slate-400 font-bold block mb-1">95% Confidence Interval:</span>
            <div className="text-cyan-300 text-sm">95% CI = V̂ &plusmn; 1.96 &bull; SE</div>
            <p className="text-slate-500 text-[11px] mt-2">
              Normal-approximation CI justified by Central Limit Theorem (CLT).
            </p>
          </div>
        </div>

        <div className="bg-slate-950/80 border-l-4 border-emerald-500 p-4 text-xs text-slate-300 space-y-1">
          <div className="font-bold text-emerald-400">Why Normal-Approximation CI and not Bootstrap?</div>
          <p className="leading-relaxed">
            Discounted payoffs e^(-rT) h(S_T^(i)) are i.i.d. with finite variance, so the Central Limit Theorem applies cleanly for N &ge; 10⁴. Bootstrap CIs would target the same asymptotic result at much higher compute cost without improving accuracy.
          </p>
        </div>
      </section>

      {/* 5. Variance Reduction Techniques */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-cyan-400">
          5. Variance Reduction Techniques
        </h2>

        <div className="space-y-4 text-sm text-slate-300">
          <div className="bg-slate-950 p-4 rounded border border-slate-800">
            <h3 className="font-bold text-white mb-1">5.1 Antithetic Variates</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              For each standard normal draw +Z_i, also evaluate payoff at -Z_i. Monotonic option payoffs guarantee negative correlation between paired paths, reducing variance of their average.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded border border-slate-800">
            <h3 className="font-bold text-white mb-1">5.2 Control Variates (Terminal Asset Price S_T)</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              Uses terminal asset price S_T as control variate with known expectation E^Q[S_T] = S0 e^((r-q)T) (Boyle 1977).
            </p>
            <div className="font-mono text-xs text-cyan-300 bg-slate-900 p-2 rounded">
              V̂_CV = e^(-rT) &bull; (1/N) &sum; [ h(S_T^(i)) - &beta;* (S_T^(i) - E[S_T]) ]
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-mono">
              Why S_T and NOT BS price as control? BS price is the benchmark being validated, so using it as a control would be circular. S_T has a known expectation independent of the option price.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded border border-slate-800">
            <h3 className="font-bold text-white mb-1">5.3 Combined Antithetic + Control Variates</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Applies antithetic pairing first, then applies control variate correction to paired averages. Stacked techniques achieve maximal variance reduction without redundancy.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Assumptions & Limitations Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-xl font-bold text-cyan-400">
            6. Assumptions &amp; Limitations Table
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
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
                <td className="p-3 text-slate-400">Implied vol varies by strike &amp; expiry (smile/skew)</td>
                <td className="p-3 text-cyan-300">Single &sigma; input (historical or manual)</td>
                <td className="p-3 text-emerald-400">SABR / Local Volatility (Dupire)</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">GBM / Log-Normal Returns</td>
                <td className="p-3 text-slate-400">Real returns exhibit fat tails &amp; negative skew</td>
                <td className="p-3 text-cyan-300">GBM log-normal exact sampling</td>
                <td className="p-3 text-emerald-400">Merton Jump-Diffusion / Heston</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Constant Risk-Free Rate</td>
                <td className="p-3 text-slate-400">Rates have term structure &amp; evolve stochastically</td>
                <td className="p-3 text-cyan-300">Flat r rate input</td>
                <td className="p-3 text-emerald-400">BondFactor Yield Curve Provider Hook</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Continuous Dividend Yield</td>
                <td className="p-3 text-slate-400">Real dividends are discrete cash payments</td>
                <td className="p-3 text-cyan-300">Continuous q yield approximation</td>
                <td className="p-3 text-emerald-400">Scheduled Ex-Dividend Escrow Modeling</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">European Exercise Only</td>
                <td className="p-3 text-slate-400">Most US single-name equity options are American</td>
                <td className="p-3 text-cyan-300">Explicit scope limitation</td>
                <td className="p-3 text-emerald-400">Longstaff-Schwartz LSM Monte Carlo</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Frictionless Markets</td>
                <td className="p-3 text-slate-400">Real trading has bid-ask spreads &amp; market impact</td>
                <td className="p-3 text-cyan-300">Not modeled in pricing engine</td>
                <td className="p-3 text-emerald-400">Pricing Model vs Execution System distinction</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Risk-Neutral Measure Q</td>
                <td className="p-3 text-slate-400">Physical measure drift &ne; risk-neutral drift</td>
                <td className="p-3 text-cyan-300">Priced strictly under risk-neutral measure Q</td>
                <td className="p-3 text-emerald-400">Appropriate for pricing/hedging, not forecasting</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Design Decisions & Interview Prep Cheat Sheet */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-cyan-400">
          7. Summary of Defensible Design Decisions (Interview Prep Cheat Sheet)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Interview Question</th>
                <th className="p-3">One-Line Defensible Answer</th>
                <th className="p-3">Mathematical Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              <tr>
                <td className="p-3 font-bold text-white">Why MC for a problem BS solves?</td>
                <td className="p-3 text-cyan-300">Validation infrastructure for machinery meant to generalize to unsolvable cases</td>
                <td className="p-3 text-slate-400">Testing MC against BS on solvable case validates code before applying to path-dependent/American options</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why S_T and not BS price as control?</td>
                <td className="p-3 text-cyan-300">BS price is the benchmark; using it as control would be circular</td>
                <td className="p-3 text-slate-400">S_T has a known expectation E^Q[S_T] = S0 e^(r-q)T independent of option price</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why exact GBM sampling, not Euler?</td>
                <td className="p-3 text-cyan-300">No discretization error needed or wanted for European terminal payoffs</td>
                <td className="p-3 text-slate-400">Log-normal transition density is known in closed form; Euler adds bias</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why normal CI, not Bootstrap?</td>
                <td className="p-3 text-cyan-300">CLT applies cleanly to i.i.d. finite-variance draws; bootstrap adds cost with no benefit</td>
                <td className="p-3 text-slate-400">Sample size N &ge; 10k guarantees sample mean is asymptotically normal</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why FD Greeks need CRN?</td>
                <td className="p-3 text-cyan-300">Without CRN, finite-difference bumps are swamped by MC simulation noise</td>
                <td className="p-3 text-slate-400">Reusing same random seed across bump pair cancels path noise</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why continuous dividend yield?</td>
                <td className="p-3 text-cyan-300">Free market data lacks reliable ex-dividend schedules; explicitly named gap</td>
                <td className="p-3 text-slate-400">Merton continuous approximation is standard for equity index &amp; trailing yields</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why close-to-close vol, not range?</td>
                <td className="p-3 text-cyan-300">Data quality consistency across US/IN tickers matters more than marginal efficiency</td>
                <td className="p-3 text-slate-400">Close price is guaranteed across all exchanges; intraday range data is noisy</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-white">Why default_rng, not RandomState?</td>
                <td className="p-3 text-cyan-300">PCG64 is statistically superior and avoids shared global state in backend</td>
                <td className="p-3 text-slate-400">Request-scoped isolated generator prevents race conditions in API server</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
