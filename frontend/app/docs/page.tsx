import React from "react";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

const toc = [
  { id: "gbm", label: "1. GBM" },
  { id: "bsm", label: "2. BSM & Greeks" },
  { id: "why-mc", label: "3. Why MC?" },
  { id: "mc-est", label: "4. MC Estimator" },
  { id: "var-red", label: "5. Variance Reduction" },
  { id: "qmc", label: "6. RQMC" },
  { id: "fd-greeks", label: "7. FD Greeks" },
  { id: "iv", label: "8. IV Solver" },
  { id: "pnl", label: "9. P&L Explain" },
  { id: "risk-grid", label: "10. Risk Grid" },
  { id: "assumptions", label: "11. Assumptions" },
  { id: "design", label: "12. Design FAQ" },
];

function SectionCard({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`border-b border-[#21262d]/60 pb-8 mb-8 scroll-mt-20 ${className ?? ""}`}>
      <h2 className="text-xl font-bold text-[#58a6ff] mb-4 tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Callout({ title, children, accent = "blue" }: { title: string; children: React.ReactNode; accent?: "blue" | "green" | "red" }) {
  const accentColors = { blue: "border-[#58a6ff] text-[#79c0ff]", green: "border-[#3fb950] text-[#3fb950]", red: "border-[#f85149] text-[#f85149]" };
  return (
    <div className={`border-l-4 ${accent === "blue" ? "border-[#58a6ff]" : accent === "green" ? "border-[#3fb950]" : "border-[#f85149]"} bg-[#0d1117]/50 pl-4 pr-3 py-3 space-y-1.5`}>
      <div className={`font-semibold text-xs uppercase tracking-wider ${accentColors[accent]}`}>{title}</div>
      <div className="text-sm text-[#8b949e] leading-relaxed">{children}</div>
    </div>
  );
}

function ParamGrid({ items }: { items: { sym: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
      {items.map((x) => (
        <div key={x.sym} className="bg-[#0d1117]/60 px-3 py-2 rounded border border-[#21262d]">
          <span className="font-mono text-[#79c0ff] block">{x.sym}</span>
          <span className="text-[#8b949e]">{x.desc}</span>
        </div>
      ))}
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* ── Header ── */}
      <div className="mb-8 pb-6 border-b border-[#21262d]">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          Quantitative Methodology & Mathematical Specification
        </h1>
        <p className="text-sm text-[#8b949e]">
          All mathematical models, Monte Carlo estimators, Greeks derivations, and defensible design decisions.
        </p>
      </div>

      {/* ── TOC ── */}
      <nav className="flex flex-wrap gap-x-5 gap-y-1.5 mb-10 text-sm">
        {toc.map((x) => (
          <a key={x.id} href={`#${x.id}`} className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors border-b border-transparent hover:border-[#58a6ff]">
            {x.label}
          </a>
        ))}
      </nav>

      {/* ════════════════════════════════════════════════════════════ 1. GBM */}
      <SectionCard id="gbm" title="1. The Model: Geometric Brownian Motion (GBM)">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          The underlying stock price <InlineMath math="S_t" /> evolves under the risk-neutral measure according to:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="\text{d}S_t = (r - q)S_t\,\text{d}t + \sigma S_t\,\text{d}W_t" />
        </div>

        <ParamGrid items={[
          { sym: "S_t", desc: "Stock price at t" },
          { sym: "r", desc: "Risk-free rate" },
          { sym: "q", desc: "Dividend yield" },
          { sym: "σ", desc: "Volatility (annualised)" },
          { sym: "W_t", desc: "Standard Brownian motion" },
        ]} />

        <h3 className="text-sm font-semibold text-[#e6edf3] mt-5 mb-2">Exact Closed-Form Solution</h3>
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Applying Itô&rsquo;s Lemma to <InlineMath math="\ln S_t" /> gives the exact terminal price:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="S_T = S_0 \exp\left[\left(r - q - \tfrac{1}{2}\sigma^2\right)T + \sigma\sqrt{T}\,Z\right], \quad Z \sim N(0,1)" />
        </div>

        <Callout title="Why exact GBM sampling?">
          The SDE has a known closed-form solution for constant parameters, so Euler-Maruyama discretisation would introduce unnecessary bias. Path-wise simulation for charts uses the same exact formula stepwise.
        </Callout>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 2. BSM */}
      <SectionCard id="bsm" title="2. Black-Scholes-Merton Analytical Benchmark & Greeks">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Closed-form formulas with continuous dividend yield <InlineMath math="q" /> (Merton 1973):
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="d_1 = \frac{\ln(S_0/K) + (r - q + \tfrac{1}{2}\sigma^2)T}{\sigma\sqrt{T}}, \quad d_2 = d_1 - \sigma\sqrt{T}" />
          <BlockMath math="C = S_0 e^{-qT}N(d_1) - K e^{-rT}N(d_2)" />
          <BlockMath math="P = K e^{-rT}N(-d_2) - S_0 e^{-qT}N(-d_1)" />
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Under the risk-neutral measure, the option price is the discounted expected payoff:{" "}
          <InlineMath math="V_0 = e^{-rT}\mathbb{E}^{\mathbb{Q}}[\text{payoff}(S_T)]" />.
          Monte Carlo estimates this same expectation numerically.
        </p>

        <h3 className="text-sm font-semibold text-[#e6edf3] mt-5 mb-2">Analytical Greeks</h3>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr><th className="p-2.5">Greek</th><th className="p-2.5">Call</th><th className="p-2.5">Put</th><th className="p-2.5">Meaning</th></tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
              {[
                ["Delta (Δ)", "e^{-qT}N(d_1)", "-e^{-qT}N(-d_1)", "Spot sensitivity"],
                ["Gamma (Γ)", "\\frac{e^{-qT}\\phi(d_1)}{S_0\\sigma\\sqrt{T}}", "Same", "Convexity"],
                ["Vega (ν)", "S_0 e^{-qT}\\phi(d_1)\\sqrt{T}", "Same", "Vol sensitivity"],
                ["Theta (Θ)", "\\text{Annualised} / 365", "Same", "Time decay / day"],
                ["Rho (ρ)", "K T e^{-rT} N(d_2)", "-K T e^{-rT} N(-d_2)", "Rate sensitivity"],
              ].map(([greek, call, put, meaning]) => (
                <tr key={greek}>
                  <td className="p-2.5 font-bold text-white">{greek}</td>
                  <td className="p-2.5 text-[#79c0ff]"><InlineMath math={call} /></td>
                  <td className="p-2.5 text-[#79c0ff]">{put === "Same" ? "Identical to Call" : <InlineMath math={put} />}</td>
                  <td className="p-2.5 text-[#8b949e]">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 3. Why MC */}
      <SectionCard id="why-mc" title="3. Why Monte Carlo for a Problem Black-Scholes Already Solves?">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-[#0d1117]/60 p-4 rounded border border-[#21262d]">
            <div className="font-bold text-[#f85149] mb-1">Honest Assessment</div>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              For European vanillas under GBM, Monte Carlo is <strong>strictly worse</strong> than Black-Scholes: slower, noisier, estimates what BS computes exactly.
            </p>
          </div>
          <div className="bg-[#0d1117]/60 p-4 rounded border border-[#21262d]">
            <div className="font-bold text-[#79c0ff] mb-1">Why Institutions Use MC</div>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              MC generalises where no closed form exists: path-dependent payoffs, baskets, American exercise (LSM), stochastic volatility. BS is the exception, not the rule.
            </p>
          </div>
          <div className="bg-[#0d1117]/60 p-4 rounded border border-[#21262d]">
            <div className="font-bold text-[#3fb950] mb-1">What PathPricer Demonstrates</div>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              Numerical machinery validated against known truth before applying it where truth is unknown. This is the intellectual foundation of the project.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 4. MC Standard */}
      <SectionCard id="mc-est" title="4. Monte Carlo Estimator & O(N^{-1/2}) Convergence">
        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="\hat{V} = e^{-rT}\cdot\frac{1}{N}\sum_{i=1}^{N} h(S_T^{(i)}), \quad h(S_T) = \max(S_T - K,\,0)" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="bg-[#0d1117]/60 p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Standard Error</div>
            <div className="text-sm text-[#79c0ff] font-mono"><BlockMath math="\widehat{SE} = s/\sqrt{N}" /></div>
            <div className="text-xs text-[#8b949e] mt-1">Sample std dev of i.i.d. discounted payoffs</div>
          </div>
          <div className="bg-[#0d1117]/60 p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">95% Confidence Interval</div>
            <div className="text-sm text-[#79c0ff] font-mono"><BlockMath math="\hat{V} \pm 1.96\cdot\widehat{SE}" /></div>
            <div className="text-xs text-[#8b949e] mt-1">Normal approx justified by CLT for N ≥ 10⁴</div>
          </div>
        </div>

        <Callout title="Why Normal CI?" accent="green">
          Discounted payoffs are i.i.d. with finite variance, so the CLT applies. Bootstrap targets the same asymptotics at higher cost for no benefit here.
        </Callout>

        <p className="text-sm text-[#8b949e] leading-relaxed mt-3">
          Convergence rate: <InlineMath math="\mathcal{O}(N^{-1/2})" /> — halving error requires 4× paths. Empirically validated by regressing{" "}
          <InlineMath math="\log\widehat{SE}" /> on <InlineMath math="\log N" /> across a geometric grid and confirming slope ≈ −0.5.
        </p>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 5. Variance Reduction */}
      <SectionCard id="var-red" title="5. Variance Reduction Techniques">
        <div className="space-y-3 text-sm">
          <div className="bg-[#0d1117]/40 p-4 rounded border border-[#21262d]">
            <h3 className="font-semibold text-white mb-1">5.1 Antithetic Variates</h3>
            <p className="text-xs text-[#8b949e] leading-relaxed mb-2">
              For each draw <InlineMath math="Z_i" />, also evaluate payoff at <InlineMath math="-Z_i" />. Monotonic payoffs guarantee negatively correlated pairs.
            </p>
            <div className="bg-[#0d1117]/80 px-3 py-2 rounded text-xs font-mono text-[#79c0ff] overflow-x-auto">
              <BlockMath math="\hat{V}_{AV} = e^{-rT}\cdot\frac{1}{N}\sum_{i=1}^{N}\frac{h(S_T^{(i,+)}) + h(S_T^{(i,-)})}{2}" />
            </div>
          </div>

          <div className="bg-[#0d1117]/40 p-4 rounded border border-[#21262d]">
            <h3 className="font-semibold text-white mb-1">5.2 Control Variates (S_T)</h3>
            <p className="text-xs text-[#8b949e] leading-relaxed mb-2">
              Uses <InlineMath math="S_T" /> as control with known expectation{" "}
              <InlineMath math="\mathbb{E}^{\mathbb{Q}}[S_T] = S_0 e^{(r-q)T}" /> (Boyle 1977).
            </p>
            <div className="bg-[#0d1117]/80 px-3 py-2 rounded text-xs font-mono text-[#79c0ff] overflow-x-auto">
              <BlockMath math="\hat{V}_{CV} = e^{-rT}\cdot\frac{1}{N}\sum_{i=1}^{N}\left[h(S_T^{(i)}) - \beta^*\left(S_T^{(i)} - \mathbb{E}^{\mathbb{Q}}[S_T]\right)\right]" />
            </div>
            <Callout title="Why S_T and not BS price?" accent="red">
              BS price is the benchmark being validated. Using it as a control would be circular. S_T has a known expectation independent of the option price.
            </Callout>
          </div>

          <div className="bg-[#0d1117]/40 p-4 rounded border border-[#21262d]">
            <h3 className="font-semibold text-white mb-1">5.3 Combined Antithetic + CV</h3>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              Apply antithetic pairing first, then CV correction to paired averages. The techniques target different variance components and stack without redundancy.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
                <tr><th className="p-2.5">Method</th><th className="p-2.5">Paths</th><th className="p-2.5">Std Error</th><th className="p-2.5">Rel. Efficiency</th></tr>
              </thead>
              <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
                {[
                  ["Standard MC", "N", "SE_{std}", "1.0 (ref)"],
                  ["Antithetic", "2N", "SE_{AV}", "Var_{std}/Var_{AV}"],
                  ["Control Variates", "N", "SE_{CV}", "Var_{std}/Var_{CV}"],
                  ["Antithetic + CV", "2N", "SE_{AV+CV}", "Var_{std}/Var_{AV+CV}"],
                  ["RQMC (Sobol)", "N", "SE_{RQMC}", "Var_{std}/Var_{RQMC}"],
                ].map(([method, paths, se, eff]) => (
                  <tr key={method}>
                    <td className="p-2.5 font-bold text-white">{method}</td>
                    <td className="p-2.5 text-[#8b949e]">{paths}</td>
                    <td className="p-2.5 text-[#79c0ff]">{se}</td>
                    <td className="p-2.5 text-[#8b949e]"><InlineMath math={eff} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 6. RQMC */}
      <SectionCard id="qmc" title="6. Randomized Quasi-Monte Carlo (Sobol)">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Replaces pseudo-random <InlineMath math="N(0,1)" /> draws with <strong>low-discrepancy sequences</strong> — deterministic point sets covering{" "}
          <InlineMath math="[0,1]^d" /> more uniformly than random sampling — then randomises them via Owen scrambling for error estimation.
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="Z_i = \Phi^{-1}(u_i), \quad u_i \in \text{Sobol sequence}" />
          <BlockMath math="\hat{V}_{RQMC} = \frac{1}{M}\sum_{j=1}^{M} \hat{V}_j, \quad \widehat{SE}_{RQMC} = \frac{s}{\sqrt{M}}, \quad M=20" />
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          <InlineMath math="N" /> is enforced to a power of 2 — the natural regime for Sobol optimal equidistribution. For smooth integrands, RQMC converges at{" "}
          <InlineMath math="\mathcal{O}(N^{-1})" /> vs standard MC&rsquo;s <InlineMath math="\mathcal{O}(N^{-1/2})" />: halving error requires only 2× paths, not 4×.
        </p>

        <Callout title="Honest Caveat: CI Interpretation" accent="red">
          The CI uses a t-distribution on <InlineMath math="M=20" /> replications. Variance between replications captures only scrambling noise, not full sampling error. The CI is a heuristic measure of uncertainty, not a strict 95% confidence statement.
        </Callout>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 7. FD Greeks */}
      <SectionCard id="fd-greeks" title="7. Finite-Difference Greeks (Common Random Numbers)">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Central differences on Monte Carlo prices, reusing the same seed across base and bumped scenarios:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="\Delta \approx \frac{\hat{V}(S_0+h) - \hat{V}(S_0-h)}{2h}, \quad \Gamma \approx \frac{\hat{V}(S_0+h) - 2\hat{V}(S_0) + \hat{V}(S_0-h)}{h^2}" />
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Analogous central differences for Vega (<InlineMath math="\sigma" /> bump), Theta (<InlineMath math="T" /> one-sided), and Rho (<InlineMath math="r" /> bump).
          Default bump: 0.5–1% of the parameter value.
        </p>

        <Callout title="Why Common Random Numbers?" accent="blue">
          Without CRN, finite-difference Greeks on Monte Carlo prices are dominated by simulation noise rather than true sensitivity. Same seed across the bump pair isolates the parameter change from sampling variance.
        </Callout>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 8. IV Solver */}
      <SectionCard id="iv" title="8. Implied Volatility Solver">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Given a market price, find <InlineMath math="\sigma" /> such that:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="\text{BS}_{\text{price}}(S_0, K, T, r, q, \sigma, \text{type}) = P_{\text{market}}" />
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          No closed-form inverse exists (BS is transcendental in <InlineMath math="\sigma" />), so numerical root-finding is required.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="bg-[#0d1117]/60 p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Newton-Raphson (Primary)</div>
            <div className="text-sm text-[#79c0ff] font-mono"><BlockMath math="\sigma_{n+1} = \sigma_n - \frac{\text{BS}_{\text{price}}(\sigma_n) - P_{\text{market}}}{\text{Vega}(\sigma_n)}" /></div>
          </div>
          <div className="bg-[#0d1117]/60 p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Brenner-Subrahmanyam Init</div>
            <div className="text-sm text-[#79c0ff] font-mono"><BlockMath math="\sigma_0 \approx \sqrt{2\pi/T} \cdot P_{\text{market}} / S_0" /></div>
          </div>
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          <strong>Fallback — Brent&rsquo;s method:</strong> Activates when Vega → 0 (deep ITM/OTM, near-expiry). Brent&rsquo;s method requires no derivative and is guaranteed to converge on a bracketed interval.
        </p>

        <Callout title="Why This Is the Most Common Desk Task" accent="green">
          Market prices are quoted in price space; traders think in vol space. The bid-ask spread in implied vol is informative across strikes; price is not. All volatility surface construction begins here.
        </Callout>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 9. P&L */}
      <SectionCard id="pnl" title="9. P&L Attribution (P&L Explain)">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Decomposes a scenario price change into component contributions by Greek:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="\text{PnL} = \Delta\cdot\Delta S + \tfrac{1}{2}\Gamma(\Delta S)^2 + \mathcal{V}\cdot\Delta\sigma + \Theta\cdot\Delta t + \rho\cdot\Delta r + \varepsilon" />
        </div>

        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr><th className="p-2.5">Term</th><th className="p-2.5">Greek</th><th className="p-2.5">Driver</th><th className="p-2.5">Interpretation</th></tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
              {[
                ["Δ·ΔS", "Delta", "Spot", "Directional exposure"],
                ["\\tfrac12\\Gamma(\\Delta S)^2", "Gamma", "Spot² (convexity)", "Profit from large moves; always +ve for long options"],
                ["𝒱·Δσ", "Vega", "Vol", "Volatility exposure"],
                ["Θ·Δt", "Theta", "Time", "Cost of optionality; −ve for long options"],
                ["ρ·Δr", "Rho", "Rate", "Interest rate exposure"],
                ["ε", "Residual", "Cross-terms", "Vanna, Volga, cross-Gamma, higher-order"],
              ].map(([term, greek, driver, interp]) => (
                <tr key={greek}>
                  <td className="p-2.5 font-bold text-white"><InlineMath math={term} /></td>
                  <td className="p-2.5 text-[#79c0ff]">{greek}</td>
                  <td className="p-2.5 text-[#8b949e]">{driver}</td>
                  <td className="p-2.5 text-[#8b949e]">{interp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          The residual <InlineMath math="\varepsilon" /> captures everything the second-order expansion misses: Vanna (<InlineMath math="\partial\Delta/\partial\sigma" />), Volga (<InlineMath math="\partial\mathcal{V}/\partial\sigma" />), cross-Gamma interactions, and higher-order Taylor terms. For small scenario moves, first-order terms (especially Delta) dominate.
        </p>

        <Callout title="Operational Significance">
          P&L attribution distinguishes &ldquo;we made money because spot moved our way&rdquo; from &ldquo;we made money because vol dropped.&rdquo; Essential for risk management and strategy evaluation.
        </Callout>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 10. Risk Grid */}
      <SectionCard id="risk-grid" title="10. 2D Risk Grid">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          A <InlineMath math="25 \times 25" /> surface (625 points) computed across dual parameter axes. Every cell is evaluated in a single broadcast operation — no nested Python loops:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="\text{price}_{ij} = \text{BS}_{\text{price}}(S_i, K, T, r, q, \sigma_j, \text{type}), \quad i,j = 1,\dots,25" />
        </div>

        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr><th className="p-2.5">Axis Pair</th><th className="p-2.5">What It Reveals</th></tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
              {[
                ["Spot × Vol", "Gamma as curvature along spot axis; Volga along vol axis"],
                ["Strike × Expiry", "Term structure of option value across strikes"],
                ["Spot × Time", "Option decay as expiry approaches at different moneyness"],
              ].map(([pair, reveals]) => (
                <tr key={pair}>
                  <td className="p-2.5 font-bold text-white">{pair}</td>
                  <td className="p-2.5 text-[#8b949e]">{reveals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed">
          Vectorisation via NumPy broadcasting: <InlineMath math="S_{\text{grid}}" /> shape <InlineMath math="(25,1)" />,{" "}
          <InlineMath math="\sigma_{\text{grid}}" /> shape <InlineMath math="(1,25)" /> → broadcast to <InlineMath math="(25,25)" />.
          The heatmap renders colour intensity proportional to price, with crosshairs at the base-case parameters.
        </p>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 11. Assumptions */}
      <SectionCard id="assumptions" title="11. Assumptions & Limitations">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr><th className="p-2.5">Assumption</th><th className="p-2.5">Reality</th><th className="p-2.5">Treatment</th></tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
              {[
                ["Constant volatility", "Smile/skew varies by strike & expiry", "Single σ input; SABR / local vol as future work"],
                ["GBM / log-normal returns", "Fat tails & negative skew", "GBM; Merton jump-diffusion as extension"],
                ["Constant risk-free rate", "Term structure, stochastic rates", "Flat r; bond curve integration as fix"],
                ["Continuous dividend yield", "Discrete cash payments", "Continuous q approx; discrete modeling as gap"],
                ["European exercise only", "Most US options are American", "Explicit scope; Longstaff-Schwartz LSM as fix"],
                ["Frictionless markets", "Bid-ask spreads, market impact", "Not modeled; pricing vs trading system distinction"],
                ["Risk-neutral measure Q", "Physical drift ≠ risk-neutral drift", "Priced under Q; appropriate for hedging, not forecasting"],
              ].map(([assumption, reality, treatment]) => (
                <tr key={assumption}>
                  <td className="p-2.5 font-bold text-white">{assumption}</td>
                  <td className="p-2.5 text-[#8b949e] leading-relaxed">{reality}</td>
                  <td className="p-2.5 text-[#79c0ff] leading-relaxed">{treatment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 12. Cheat Sheet */}
      <SectionCard id="design" title="12. Design Decisions FAQ">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr><th className="p-2.5">Question</th>            <th className="p-2.5">Rationale</th></tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
              {[
                ["Why MC for something BS solves?", "Validation infrastructure for machinery meant to generalise to unsolvable cases"],
                ["Why S_T as control, not BS price?", "BS is the benchmark; using it as control would be circular"],
                ["Why exact GBM sampling?", "Closed-form terminal density makes Euler bias unnecessary"],
                ["Why normal CI, not bootstrap?", "CLT applies cleanly to i.i.d. draws; bootstrap adds cost with no benefit"],
                ["Why FD Greeks need CRN?", "Without CRN, bumps are swamped by MC noise, not sensitivity"],
                ["Why continuous dividend yield?", "Free data lacks reliable ex-div schedules; explicitly named gap"],
                ["Why close-to-close vol?", "Data quality across US/IN tickers matters more than marginal efficiency"],
                ["Why default_rng not RandomState?", "PCG64 is superior; avoids shared global state in concurrent backend"],
                ["Why Newton-Raphson + Brent?", "NR fast near root; Brent handles near-zero-Vega without derivative"],
                ["Why residual in P&L explain?", "Taylor expansion exact only for infinitesimal moves; residual = cross-Greeks + higher-order"],
                ["Why vectorise the risk grid?", "625 cell-level loops dominate runtime; broadcast evaluates all at NumPy speed"],
                ["Why RQMC instead of standard MC?", "O(N^{-1}) vs O(N^{-1/2}) convergence for smooth integrands; CI is heuristic"],
              ].map(([q, a]) => (
                <tr key={q}>
                  <td className="p-2.5 font-bold text-white">{q}</td>
                  <td className="p-2.5 text-[#79c0ff] leading-relaxed">{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Footer ── */}
      <div className="text-xs text-[#484f58] text-center pt-6 border-t border-[#21262d]">
        Full mathematical specification available in the project&rsquo;s Quantitative Methodology document.
      </div>
    </div>
  );
}
