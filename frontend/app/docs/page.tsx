export default function DocsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8 pb-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white">Quantitative Methodology &amp; Documentation</h1>
        <p className="text-sm text-gray-400">
          Mathematical foundations, stochastic differential equations, and variance reduction techniques.
        </p>
      </div>

      <div className="space-y-8 text-gray-300">
        <section className="bg-gray-800/40 border border-gray-700/60 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-blue-400 mb-3">1. Geometric Brownian Motion (GBM)</h2>
          <p className="text-sm leading-relaxed mb-3">
            Asset price dynamics follow the SDE under risk-neutral measure Q:
          </p>
          <div className="bg-gray-950 p-4 rounded border border-gray-800 font-mono text-sm text-green-400 mb-3">
            dS_t = (r - q) S_t dt + σ S_t dW_t
          </div>
          <p className="text-sm leading-relaxed">
            PathPricer samples the terminal price S_T using exact log-normal solution (no Euler-Maruyama discretization error):
          </p>
          <div className="bg-gray-950 p-4 rounded border border-gray-800 font-mono text-sm text-green-400 mt-2">
            S_T = S_0 exp((r - q - 0.5 σ²) T + σ √T Z),  Z ~ N(0, 1)
          </div>
        </section>

        <section className="bg-gray-800/40 border border-gray-700/60 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-blue-400 mb-3">2. Monte Carlo Variance Reduction</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
            <li>
              <strong className="text-white">Antithetic Variates:</strong> Pairs +Z and -Z draws to generate negatively correlated payoffs.
            </li>
            <li>
              <strong className="text-white">Control Variates:</strong> Uses terminal asset price S_T as control variate with known expectation E^Q[S_T] = S_0 exp((r - q)T).
            </li>
            <li>
              <strong className="text-white">Combined Antithetic + CV:</strong> Stacks paired averages with control variate correction for maximal variance reduction.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
