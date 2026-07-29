import Link from "next/link";

export default function ValidationPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8 pb-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white">Validation Suite</h1>
        <p className="text-sm text-gray-400">
          Static, pre-computed CI calibration artifacts and empirical regression proofs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800/60 border border-gray-700 p-6 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
            200-Trial Coverage
          </h3>
          <div className="text-3xl font-extrabold text-green-400 mb-2">95.5%</div>
          <p className="text-xs text-gray-400">
            Nominal 95.0% confidence interval calibration verified across 200 independent simulation runs.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 p-6 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Convergence Slope
          </h3>
          <div className="text-3xl font-extrabold text-blue-400 mb-2">-0.497</div>
          <p className="text-xs text-gray-400">
            Empirical log-log regression proof of O(N⁻¹/²) theoretical convergence rate (R² = 0.998).
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 p-6 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Edge-Case Suite
          </h3>
          <div className="text-3xl font-extrabold text-purple-400 mb-2">18 / 18</div>
          <p className="text-xs text-gray-400">
            All analytical edge cases (T&rarr;0, &sigma;&rarr;0, deep ITM/OTM, put-call parity) passing in CI.
          </p>
        </div>
      </div>
    </div>
  );
}
