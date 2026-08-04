import React from "react";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import { Lightbulb, CheckCircle2, AlertTriangle } from "lucide-react";

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
  { id: "heston", label: "11. Heston Model" },
  { id: "svi", label: "12. SVI Surface" },
  { id: "calibration", label: "13. Calibration" },
  { id: "validation", label: "14. Model Validation" },
  { id: "assumptions", label: "15. Assumptions" },
  { id: "design", label: "16. Design FAQ" },
  { id: "strategy", label: "17. Strategy Engine" },
  { id: "stress", label: "18. Stress Testing" },
  { id: "parity", label: "19. Parity Probes" },
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
  const config = {
    blue: {
      border: "border-[#388bfd]/30 hover:border-[#388bfd]/50",
      bg: "bg-gradient-to-r from-[#388bfd]/10 via-[#161b22]/90 to-[#161b22]",
      badgeBg: "bg-[#388bfd]/15 border-[#388bfd]/30 text-[#79c0ff]",
      titleColor: "text-[#79c0ff]",
      Icon: Lightbulb,
    },
    green: {
      border: "border-[#3fb950]/30 hover:border-[#3fb950]/50",
      bg: "bg-gradient-to-r from-[#238636]/10 via-[#161b22]/90 to-[#161b22]",
      badgeBg: "bg-[#238636]/15 border-[#3fb950]/30 text-[#56d364]",
      titleColor: "text-[#56d364]",
      Icon: CheckCircle2,
    },
    red: {
      border: "border-[#f85149]/30 hover:border-[#f85149]/50",
      bg: "bg-gradient-to-r from-[#da3633]/10 via-[#161b22]/90 to-[#161b22]",
      badgeBg: "bg-[#da3633]/15 border-[#f85149]/30 text-[#ff7b72]",
      titleColor: "text-[#ff7b72]",
      Icon: AlertTriangle,
    },
  }[accent];

  const IconComponent = config.Icon;

  return (
    <div className={`my-4 rounded-xl border ${config.border} ${config.bg} p-4 transition-all duration-200 shadow-sm relative overflow-hidden group`}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`p-1.5 rounded-lg border ${config.badgeBg} flex items-center justify-center shrink-0`}>
          <IconComponent className="w-3.5 h-3.5" />
        </div>
        <span className={`font-semibold text-xs uppercase tracking-wider ${config.titleColor}`}>
          {title}
        </span>
      </div>
      <div className="text-sm text-[#8b949e] leading-relaxed pl-8">
        {children}
      </div>
    </div>
  );
}

function ParamGrid({ items }: { items: { sym: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
      {items.map((x) => (
        <div key={x.sym} className="bg-[#0d1117] px-3 py-2 rounded border border-[#21262d]">
          <span className="font-mono text-[#79c0ff] block">{x.sym}</span>
          <span className="text-[#8b949e]">{x.desc}</span>
        </div>
      ))}
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="relative max-w-7xl mx-auto px-6 md:pl-10 md:pr-6 py-8 sm:py-12">
      {/* ── Header ── */}
      <div className="mb-8 pb-6 border-b border-[#21262d]">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          Quantitative Methodology & Mathematical Specification
        </h1>
        <p className="text-sm text-[#8b949e]">
          All mathematical models, Monte Carlo estimators, Greeks derivations, stochastic-volatility pricing, and defensible design decisions.
        </p>
      </div>

      {/* ── Mobile TOC (horizontal scroll) ── */}
      <nav className="md:hidden flex flex-nowrap gap-2 mb-8 text-xs overflow-x-auto pb-3 -mx-6 px-6 border-b border-[#21262d]/60">
        {toc.map((x) => (
          <a
            key={x.id}
            href={`#${x.id}`}
            className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full bg-[#161b22] border border-[#21262d] text-[#c9d1d9] hover:text-[#58a6ff] hover:border-[#58a6ff]/50 transition-all font-medium active:scale-95"
          >
            {x.label}
          </a>
        ))}
      </nav>

      {/* ── Layout: sidebar TOC + content ── */}
      <div className="flex gap-8">
        {/* Desktop TOC — sticky left sidebar */}
        <nav className="hidden md:block sticky top-24 self-start shrink-0 w-48 max-h-[calc(100vh-8rem)] overflow-y-auto pl-2">
          <ul className="space-y-1.5 text-sm border-l border-[#21262d] pl-3">
            {toc.map((x) => (
              <li key={x.id}>
                <a href={`#${x.id}`} className="block py-0.5 text-[#8b949e] hover:text-[#58a6ff] transition-colors">
                  {x.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 max-w-4xl">

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
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-bold text-[#f85149] mb-1">Honest Assessment</div>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              For European vanillas under GBM, Monte Carlo is <strong>strictly worse</strong> than Black-Scholes: slower, noisier, estimates what BS computes exactly.
            </p>
          </div>
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-bold text-[#79c0ff] mb-1">Why Institutions Use MC</div>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              MC generalises where no closed form exists: path-dependent payoffs, baskets, American exercise (LSM), stochastic volatility. BS is the exception, not the rule.
            </p>
          </div>
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
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
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Standard Error</div>
            <div className="text-sm text-[#79c0ff] font-mono"><BlockMath math="\widehat{SE} = s/\sqrt{N}" /></div>
            <div className="text-xs text-[#8b949e] mt-1">Sample std dev of i.i.d. discounted payoffs</div>
          </div>
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
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
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <h3 className="font-semibold text-white mb-1">5.1 Antithetic Variates</h3>
            <p className="text-xs text-[#8b949e] leading-relaxed mb-2">
              For each draw <InlineMath math="Z_i" />, also evaluate payoff at <InlineMath math="-Z_i" />. Monotonic payoffs guarantee negatively correlated pairs.
            </p>
            <div className="bg-[#161b22] px-3 py-2 rounded text-xs font-mono text-[#79c0ff] overflow-x-auto">
              <BlockMath math="\hat{V}_{AV} = e^{-rT}\cdot\frac{1}{N}\sum_{i=1}^{N}\frac{h(S_T^{(i,+)}) + h(S_T^{(i,-)})}{2}" />
            </div>
          </div>

          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <h3 className="font-semibold text-white mb-1">5.2 Control Variates (S_T)</h3>
            <p className="text-xs text-[#8b949e] leading-relaxed mb-2">
              Uses <InlineMath math="S_T" /> as control with known expectation{" "}
              <InlineMath math="\mathbb{E}^{\mathbb{Q}}[S_T] = S_0 e^{(r-q)T}" /> (Boyle 1977).
            </p>
            <div className="bg-[#161b22] px-3 py-2 rounded text-xs font-mono text-[#79c0ff] overflow-x-auto">
              <BlockMath math="\hat{V}_{CV} = e^{-rT}\cdot\frac{1}{N}\sum_{i=1}^{N}\left[h(S_T^{(i)}) - \beta^*\left(S_T^{(i)} - \mathbb{E}^{\mathbb{Q}}[S_T]\right)\right]" />
            </div>
            <Callout title="Why S_T and not BS price?" accent="red">
              BS price is the benchmark being validated. Using it as a control would be circular. S_T has a known expectation independent of the option price.
            </Callout>
          </div>

          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
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
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Newton-Raphson (Primary)</div>
            <div className="text-sm text-[#79c0ff] font-mono"><BlockMath math="\sigma_{n+1} = \sigma_n - \frac{\text{BS}_{\text{price}}(\sigma_n) - P_{\text{market}}}{\text{Vega}(\sigma_n)}" /></div>
          </div>
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
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

      {/* ════════════════════════════════════════════════════════════ 11. Heston */}
      <SectionCard id="heston" title="11. Heston Stochastic Volatility Model">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          The Heston (1993) model lets variance follow its own mean-reverting square-root process, so the volatility smile/skew is <strong>modeled</strong> rather than assumed constant:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="dS_t = (r - q)S_t\,dt + \sqrt{v_t}\,S_t\,dW_t^S, \qquad dv_t = \kappa(\theta_v - v_t)\,dt + \sigma_v\sqrt{v_t}\,dW_t^v" />
        </div>

        <ParamGrid items={[
          { sym: "v_t", desc: "Instantaneous variance" },
          { sym: "κ", desc: "Mean-reversion speed" },
          { sym: "θ_v", desc: "Long-run variance" },
          { sym: "σ_v", desc: "Vol-of-vol" },
          { sym: "ρ", desc: "Spot/vol correlation (skew)" },
          { sym: "√v₀", desc: "Initial volatility (quoted)" },
        ]} />

        <h3 className="text-sm font-semibold text-[#e6edf3] mt-5 mb-2">Pricing by Fourier Inversion</h3>
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          The Heston density has no closed form, but the <strong>characteristic function</strong> of <InlineMath math="\ln S_T" /> does. Prices come from integrating two risk-neutral probabilities:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="C = S_0 e^{-qT} P_1 - K e^{-rT} P_2, \qquad P_j = \tfrac{1}{2} + \frac{1}{\pi}\int_0^{\infty}\operatorname{Re}\left[\frac{e^{-i\phi\ln K} f_j(\phi)}{i\phi}\right]d\phi" />
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Evaluated by <strong>Gauss-Legendre quadrature</strong> on a fixed node grid (the nodes are parameter-independent and cached). Puts follow from put-call parity, exact under Heston. Two numerical guards matter: the branch of <InlineMath math="d_j" /> is chosen so <InlineMath math="\operatorname{Re}(d_j) \geq 0" />, and the term <InlineMath math="1 - g_j e^{d_j T}" /> is computed in log space to avoid catastrophic cancellation in the deep-OTM wings.
        </p>

        <h3 className="text-sm font-semibold text-[#e6edf3] mt-5 mb-2">Greeks &amp; the Volatility Chain Rule</h3>
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Because the Heston price is deterministic (no Monte Carlo noise), central finite differences are clean. Volga and Vanna are reported w.r.t. the volatility <InlineMath math="\sigma_0 = \sqrt{v_0}" />, requiring a chain-rule correction:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="\text{volga} = 4v_0\frac{\partial^2 V}{\partial v_0^2} + 2\frac{\partial V}{\partial v_0}, \qquad \text{vanna} = 2\sqrt{v_0}\,\frac{\partial^2 V}{\partial S\,\partial v_0}" />
        </div>

        <Callout title="Efficiency" accent="blue">
          The spot and vanna bumps only change <InlineMath math="S_0" /> / <InlineMath math="v_0" /> — one characteristic-function set serves all bumped prices, cutting 12 Fourier evaluations to 6.
        </Callout>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 12. SVI */}
      <SectionCard id="svi" title="12. SVI Volatility Surface">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          The <strong>raw SVI</strong> parameterization (Gatheral, 2004) describes the implied-vol smile at a fixed expiry as a function of log-moneyness <InlineMath math="k = \ln(K/F)" />:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="w(k) = a + b\left(\rho(k - m) + \sqrt{(k - m)^2 + \sigma^2}\right), \qquad \sigma_{imp}(k) = \sqrt{\frac{w(k)}{T}}" />
        </div>

        <ParamGrid items={[
          { sym: "a", desc: "Total variance level" },
          { sym: "b", desc: "Wing slope (b ≥ 0)" },
          { sym: "ρ", desc: "Skew (−1 < ρ < 1)" },
          { sym: "m", desc: "Smile minimum offset" },
          { sym: "σ", desc: "Curvature at minimum" },
        ]} />

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Each expiry&rsquo;s <InlineMath math="(k, \sigma_{imp})" /> points are fit by <strong>nonlinear least squares</strong> on total variance <InlineMath math="w = \sigma_{imp}^2 T" />, from three restarts. The fitted <InlineMath math="a" /> is clamped so <InlineMath math="w_{\min} = a + b\sigma\sqrt{1-\rho^2} \geq 0" />, keeping the slice arbitrage-free in strike.
        </p>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          A surface is a set of slices with total variance interpolated <strong>linearly in <InlineMath math="T" /> at fixed log-moneyness</strong> (sticky-strike). A <strong>calendar-arbitrage check</strong> rejects any surface where total variance decreases with time to maturity at a fixed moneyness — such a surface would admit a riskless calendar-spread arbitrage.
        </p>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          A second guard checks <strong>butterfly (strike) arbitrage</strong>: call prices must be convex in strike, equivalently the implied risk-neutral density must be non-negative. On a discrete strike grid this is{" "}
          <InlineMath math="C(K-d) - 2C(K) + C(K+d) \geq 0" />. Each fitted slice reports an <InlineMath math="\text{arb\_free}" /> flag plus the strike of the worst violation, so the chart can badge exactly where a surface breaks.
        </p>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          The same fit yields the <strong>ATM volatility term structure</strong> — the at-the-money implied vol at every expiry{" "}
          <InlineMath math="\sigma_{ATM}(T) = \sqrt{w(0)/T}" /> — and a <strong>Greeks surface</strong>: any Greek priced across strikes × expiries where each cell uses the SVI implied vol for its own strike, so the surface reflects the smile rather than a flat vol.
        </p>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 13. Calibration */}
      <SectionCard id="calibration" title="13. Heston Calibration">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Fits <InlineMath math="(v_0, \kappa, \theta_v, \sigma_v, \rho)" /> to observed market option prices by minimizing a <strong>blended</strong> objective via <InlineMath math="\text{L-BFGS-B}" />:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="\min_p \left[ 0.5\,\text{rel-RMSE} + 0.5\,\frac{\text{abs-RMSE}}{\overline{V^{mkt}}} \right] + \underbrace{10\,(2\kappa\theta_v - \sigma_v^2)^2}_{\text{Feller penalty, only if violated}}" />
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          A pure relative error over-penalizes deep-OTM options (tiny prices make any small misprice a huge percentage), dragging the fit into the wings. Blending in the mean-normalized absolute error keeps the ATM backbone dominant while relative error still shapes the smile.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Feller as a Soft Penalty</div>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              Hard-constraining <InlineMath math="2\kappa\theta_v > \sigma_v^2" /> forces infeasible optimizer restarts. A soft penalty lets the fit trade feasibility against quality — and reports whether Feller holds, as practitioners do.
            </p>
          </div>
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Deterministic Multi-Start</div>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              <InlineMath math="n" /> restarts from an ATM-implied-vol seed plus <strong>log-uniformly</strong> spread seeds (<InlineMath math="s \leftarrow s\cdot e^{U(-0.7,0.7)}" />) — right for positive scale parameters. Reproducible via <InlineMath math="\text{default\_rng}(20240101+i)" />.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 14. Validation */}
      <SectionCard id="validation" title="14. Model Validation">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Scores a calibrated Heston model against the same market quotes it was fitted to, answering &ldquo;how well does the model reproduce observed prices/vols, and are the market quotes internally consistent?&rdquo;
        </p>

        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr><th className="p-2.5">Metric</th><th className="p-2.5">Definition</th></tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
              {[
                ["Price Rel RMSE", "\\sqrt{\\tfrac{1}{n}\\sum_i\\left(\\tfrac{V_i^{m} - V_i^{k}}{V_i^{k}}\\right)^2}"],
                ["Price MAPE", "\\tfrac{1}{n}\\sum_i\\left|\\tfrac{V_i^{m} - V_i^{k}}{V_i^{k}}\\right| \\times 100\\%"],
                ["IV RMSE", "NaN-robust: over contracts with resolvable implied vols only"],
                ["Market parity violation", "Largest |put-call parity RHS − market price| across the chain"],
              ].map(([metric, def]) => (
                <tr key={metric}>
                  <td className="p-2.5 font-bold text-white">{metric}</td>
                  <td className="p-2.5 text-[#79c0ff]">{def.startsWith("\\") ? <InlineMath math={def} /> : def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Callout title="Market put-call parity" accent="green">
          The complement option type is priced under the model and the implied parity value compared against the observed quote. A large violation flags <strong>internally inconsistent market quotes</strong>, not a bad model.
        </Callout>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 15. Assumptions */}
      <SectionCard id="assumptions" title="15. Assumptions & Limitations">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#21262d]">
              <tr><th className="p-2.5">Assumption</th><th className="p-2.5">Reality</th><th className="p-2.5">Treatment</th></tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] text-[#e6edf3]">
              {[
                ["Constant volatility", "Smile/skew varies by strike & expiry", "Single σ input for GBM; the quant workspace fits Heston & SVI models to the smile"],
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

      {/* ════════════════════════════════════════════════════════════ 16. Cheat Sheet */}
      <SectionCard id="design" title="16. Design Decisions FAQ">
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
                ["Why close-to-close vol?", "Data quality across US, Indian, FX, and cryptocurrency tickers matters more than marginal efficiency"],
                ["Why default_rng not RandomState?", "PCG64 is superior; avoids shared global state in concurrent backend"],
                ["Why Newton-Raphson + Brent?", "NR fast near root; Brent handles near-zero-Vega without derivative"],
                ["Why residual in P&L explain?", "Taylor expansion exact only for infinitesimal moves; residual = cross-Greeks + higher-order"],
                ["Why vectorise the risk grid?", "625 cell-level loops dominate runtime; broadcast evaluates all at NumPy speed"],
                ["Why RQMC instead of standard MC?", "O(N^{-1}) vs O(N^{-1/2}) convergence for smooth integrands; CI is heuristic"],
                ["Why Fourier inversion for Heston?", "No closed-form density, but the characteristic function is closed form — fast, deterministic, no MC noise in Greeks"],
                ["Why Volga w.r.t. √v₀, not v₀?", "Traders quote volatility; chain rule 4v₀·V″ + 2·V′ converts variance bumps"],
                ["Why blend relative + absolute RMSE in calibration?", "Pure relative over-penalizes deep-OTM; the blend keeps ATM dominant while the smile stays shaped"],
                ["Why reject calendar arbitrage at build?", "Total variance decreasing in T admits a riskless spread; rejecting keeps surfaces economically sane"],
                ["Why not verify an implied rate by recomputing parity?", "It is a tautology — the parameter is defined as the parity-solver; it reproduces the spread by construction and never fails"],
                ["Why analytic max profit/loss for strategies?", "Expiration payoff is piecewise-linear; extrema are exact at kinks/tails, and unbounded (∞) is reported correctly"],
                ["Why are parity probes ATM-only?", "ATM quotes are the most liquid and least corrupted by deep-OTM noise — the cleanest rate/dividend signal"],
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

      {/* ════════════════════════════════════════════════════════════ 17. Strategy */}
      <SectionCard id="strategy" title="17. Multi-Leg Strategy Engine">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          A strategy is a portfolio of 1–10 <strong>signed</strong> legs — a long has positive quantity, a short negative. Each option leg is priced by closed-form Black-Scholes; stock legs are valued at the forward-carried price{" "}
          <InlineMath math="Se^{-qT}" /> with <InlineMath math="\Delta = 1" />.
        </p>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Portfolio Greeks are quantity-weighted sums of the per-leg Greeks. The <strong>net premium</strong> is the signed sum of leg values: positive = debit (we pay to enter), negative = credit (we were paid).
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="\Delta_{net} = \sum_i q_i \Delta_i, \quad \text{P\&L}(S_T) = \underbrace{\text{payoff}(S_T)}_{\text{piecewise-linear in spot}} - \text{net premium}" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Breakevens</div>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              The spot levels where net P&L = 0, found by linear interpolation across the payoff grid's zero crossings.
            </p>
          </div>
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Max Profit / Loss</div>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              Exact: the payoff is piecewise-linear, so extrema live at strike kinks and the tails. Unbounded (∞) is reported when the high-tail slope is nonzero — a finite grid scan would misstate this.
            </p>
          </div>
        </div>

        <Callout title="Presets" accent="green">
          Ten presets cover the classic structures — long/short straddles, strangles, bull/bear spreads, iron condor, iron butterfly, call butterfly, covered call, protective put — each with a distinct risk/reward shape visible on the payoff diagram.
        </Callout>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 18. Stress */}
      <SectionCard id="stress" title="18. Scenario Stress Testing">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Reprices an option under named market scenarios — <strong>2008 Crisis</strong> (−40% spot, +20 vol pts, +100 bp rates), <strong>COVID Crash</strong>, <strong>Vol Crush</strong>, <strong>Flash Crash</strong> — each defined as coordinate shifts in spot, vol, rate, and elapsed time:
        </p>

        <div className="bg-[#0d1117] px-4 py-3 rounded border border-[#21262d] mb-4 overflow-x-auto">
          <BlockMath math="S' = \max(\epsilon, S_0 + \Delta S_{abs} + \Delta S_{pct}\cdot S_0), \quad \sigma' = \max(\text{MIN\_SIGMA}, \sigma + \Delta\sigma)" />
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Every scenario reports its repriced option value plus absolute and percentage P&L versus the base price. The engine selects the worst/best scenarios and computes an <strong>unrealized-risk</strong> metric — the largest single-scenario loss as a fraction of the base price.
        </p>

        <Callout title="Stress vs. P&L Explain" accent="blue">
          P&L attribution (§9) decomposes one observed move into Greek contributions. Stress testing imposes many hypothetical moves and reads off the outcomes — the forward-looking complement to the backward-looking attribution.
        </Callout>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════ 19. Parity */}
      <SectionCard id="parity" title="19. Put-Call Parity Data-Quality Probes">
        <p className="text-sm text-[#8b949e] leading-relaxed mb-3">
          Put-call parity is the no-arbitrage identity <InlineMath math="C - P = S_0 e^{-qT} - K e^{-rT}" />. The probes run it <strong>in reverse</strong>: given market prices, what rate or dividend is the market implicitly assuming? Consistent quotes land near consensus values; a large divergence flags stale mids, crossed markets, or mis-priced dividends.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Implied Rate</div>
            <div className="text-sm text-[#79c0ff] font-mono"><BlockMath math="r = -\frac{1}{T}\ln\left(\frac{S_0 e^{-qT} - C + P}{K}\right)" /></div>
            <div className="text-xs text-[#8b949e] mt-1">Guarded: non-positive discounted strike ⇒ quotes inconsistent ⇒ parity_inconsistent error</div>
          </div>
          <div className="bg-[#0d1117] p-4 rounded border border-[#21262d]">
            <div className="font-semibold text-[#8b949e] text-xs mb-1 uppercase tracking-wider">Implied Dividend</div>
            <div className="text-sm text-[#79c0ff] font-mono"><BlockMath math="q = -\frac{1}{T}\ln\left(\frac{K e^{-rT} + C - P}{S_0}\right)" /></div>
            <div className="text-xs text-[#8b949e] mt-1">Given a trusted rate, recovers the dividend the market is pricing in</div>
          </div>
        </div>

        <Callout title="Why the extracted value is never re-verified against parity" accent="red">
          Plugging the recovered <InlineMath math="r" /> or <InlineMath math="q" /> back into parity is a <strong>tautology</strong> — the parameter is defined as the value that makes the identity hold, so recomputation reproduces the spread by construction and can never fail. The real checks are the positivity guard and the divergence versus a reference rate/dividend. The probes are ATM-only because ATM quotes are the most liquid and least corrupted by deep-OTM noise.
        </Callout>
      </SectionCard>

      {/* ── Footer ── */}
      <div className="text-xs text-[#484f58] text-center pt-6 border-t border-[#21262d]">
        Full mathematical specification available in the project&rsquo;s Quantitative Methodology document.
      </div>

        </div>{/* end content */}
      </div>{/* end flex */}
    </div>
  );
}
