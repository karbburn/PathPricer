import { getEffectiveInputs, serializeInputs } from "@/lib/url-state";
import Link from "next/link";

interface WorkspacePageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const rawParams = await searchParams;
  const effectiveInputs = getEffectiveInputs(rawParams);
  const serialized = serializeInputs(effectiveInputs);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-white">Pricing Workspace</h1>
          <p className="text-sm text-gray-400">
            URL-driven input state engine — URL parameters are the single source of truth.
          </p>
        </div>
        <div className="text-xs bg-gray-800 px-3 py-1.5 rounded border border-gray-700 font-mono text-gray-300">
          Source of truth: <span className="text-blue-400">URL Query Params</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Parsed Inputs Display */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-400 mb-4 flex items-center justify-between">
            <span>Parsed Pricing Request</span>
            <span className="text-xs font-normal text-gray-400">Read from URL</span>
          </h2>

          <div className="space-y-2 text-sm font-mono bg-gray-950 p-4 rounded border border-gray-800 overflow-x-auto">
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-500">ticker:</span>
              <span className="text-green-400 font-bold">{effectiveInputs.ticker}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-500">market:</span>
              <span className="text-yellow-300">{effectiveInputs.market}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-500">strike:</span>
              <span className="text-white">{effectiveInputs.strike}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-500">expiry_date:</span>
              <span className="text-white">{effectiveInputs.expiry_date}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-500">option_type:</span>
              <span className="text-purple-300 uppercase">{effectiveInputs.option_type}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-500">volatility:</span>
              <span className="text-white">{(effectiveInputs.volatility * 100).toFixed(1)}% ({effectiveInputs.volatility})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-500">risk_free_rate:</span>
              <span className="text-white">{(effectiveInputs.risk_free_rate * 100).toFixed(1)}% ({effectiveInputs.risk_free_rate})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-500">n_simulations:</span>
              <span className="text-blue-300">{effectiveInputs.n_simulations.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-500">seed:</span>
              <span className="text-white">{effectiveInputs.seed}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">variance_reduction:</span>
              <span className="text-cyan-300">{effectiveInputs.variance_reduction}</span>
            </div>
          </div>
        </div>

        {/* Quick URL Test Navigation links */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-400 mb-4">Preset URL Test Scenarios</h2>
          <p className="text-xs text-gray-400 mb-4">
            Click any preset to verify that URL parameters dynamically drive parsed inputs:
          </p>

          <div className="space-y-3">
            <Link
              href="/workspace?ticker=AAPL&market=US&strike=200&expiry_date=2026-10-30&option_type=call&volatility=0.25&risk_free_rate=0.05&n_simulations=100000&seed=42&variance_reduction=all"
              className="block p-3 bg-gray-900 rounded border border-gray-700 hover:border-blue-500 transition-colors"
            >
              <div className="text-sm font-semibold text-white">AAPL $200 Call (US Market)</div>
              <div className="text-xs font-mono text-gray-400 truncate">
                /workspace?ticker=AAPL&amp;strike=200&amp;n=100000
              </div>
            </Link>

            <Link
              href="/workspace?ticker=RELIANCE&market=IN&strike=3000&expiry_date=2026-12-31&option_type=put&volatility=0.22&risk_free_rate=0.068&n_simulations=500000&seed=100&variance_reduction=antithetic_cv"
              className="block p-3 bg-gray-900 rounded border border-gray-700 hover:border-blue-500 transition-colors"
            >
              <div className="text-sm font-semibold text-white">RELIANCE ₹3000 Put (IN Market)</div>
              <div className="text-xs font-mono text-gray-400 truncate">
                /workspace?ticker=RELIANCE&amp;market=IN&amp;strike=3000&amp;vr=antithetic_cv
              </div>
            </Link>

            <Link
              href="/workspace?ticker=MSFT&market=US&strike=400&expiry_date=2027-01-15&option_type=call&volatility=0.30&risk_free_rate=0.045&n_simulations=1000000&seed=777&variance_reduction=control_variate"
              className="block p-3 bg-gray-900 rounded border border-gray-700 hover:border-blue-500 transition-colors"
            >
              <div className="text-sm font-semibold text-white">MSFT $400 Long Call (1M simulations)</div>
              <div className="text-xs font-mono text-gray-400 truncate">
                /workspace?ticker=MSFT&amp;n=1000000&amp;seed=777
              </div>
            </Link>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-700 text-xs text-gray-400">
            Serialized Query String Output:
            <div className="font-mono bg-gray-950 p-2 rounded mt-1 text-gray-300 break-all">
              {serialized}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
