"use client";

import { useState, useCallback } from "react";
import { postStrategy, ApiError } from "@/lib/api-client";
import {
  StrategyLeg,
  StrategyLegResult,
  StrategyResponse,
} from "@/lib/types";
import { StrategyPayoffChart } from "./StrategyPayoffChart";
import { STRATEGY_PRESETS } from "./presets";

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

function blankLeg(): EditableLeg {
  return {
    option_type: "call",
    strike: "100",
    quantity: "1",
  };
}

interface EditableLeg {
  option_type: "call" | "put" | "stock";
  strike: string;
  quantity: string;
}

function WorkspaceStrategyContent() {
  const [spot, setSpot] = useState<string>("100");
  const [expiryDate, setExpiryDate] = useState<string>(defaultExpiry());
  const [volatility, setVolatility] = useState<string>("0.25");
  const [riskFreeRate, setRiskFreeRate] = useState<string>("0.05");
  const [dividendYield, setDividendYield] = useState<string>("0.0");
  const [legs, setLegs] = useState<EditableLeg[]>([
    { option_type: "call", strike: "100", quantity: "1" },
    { option_type: "put", strike: "100", quantity: "1" },
  ]);
  const [result, setResult] = useState<StrategyResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const applyPreset = (presetIndex: number) => {
    const preset = STRATEGY_PRESETS[presetIndex];
    const s = parseFloat(spot) || 100;
    setLegs(
      preset.build(s).map((l) => ({
        option_type: l.option_type,
        strike: l.strike == null ? "" : l.strike.toFixed(2),
        quantity: l.quantity.toString(),
      }))
    );
  };

  const updateLeg = (index: number, patch: Partial<EditableLeg>) => {
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const buildRequest = useCallback((): StrategyLeg[] | null => {
    const s = parseFloat(spot);
    if (!isFinite(s) || s <= 0) return null;
    const legsOut: StrategyLeg[] = [];
    for (const l of legs) {
      const qty = parseFloat(l.quantity);
      if (!isFinite(qty)) return null;
      const strike = l.option_type === "stock" ? null : parseFloat(l.strike);
      if (l.option_type !== "stock" && (!isFinite(strike ?? NaN) || (strike ?? 0) <= 0)) return null;
      legsOut.push({
        option_type: l.option_type,
        strike,
        quantity: qty,
        expiry_date: expiryDate,
        volatility: parseFloat(volatility) || 0.25,
        risk_free_rate: parseFloat(riskFreeRate) || 0.05,
        dividend_yield: parseFloat(dividendYield) || 0.0,
      });
    }
    return legsOut;
  }, [spot, legs, expiryDate, volatility, riskFreeRate, dividendYield]);

  const runStrategy = async () => {
    const s = parseFloat(spot);
    const requestLegs = buildRequest();
    if (!requestLegs || requestLegs.length === 0) {
      setError(new ApiError(400, { error: "invalid_input", message: "Enter valid legs and spot." }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await postStrategy({ spot: s, legs: requestLegs });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(500, { error: "strategy_failed", message: "Strategy pricing failed." }));
    } finally {
      setLoading(false);
    }
  };

  const legResultFor = (i: number): StrategyLegResult | undefined => result?.legs.find((l) => l.leg_index === i);

  const inputCls = "bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#58a6ff] w-full";
  const labelCls = "text-[10px] font-mono text-[#8b949e] uppercase tracking-wider mb-1 block";

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#21262d]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white tracking-tight uppercase font-mono">
            Strategy Builder
          </h1>
          <span className="text-[10px] font-mono text-[#8b949e] bg-[#21262d]/60 px-2 py-0.5 rounded border border-[#30363d]">
            multi-leg · BSM
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#8b949e]">Ctrl+Enter → Run</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Inputs */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#8b949e] uppercase tracking-wider">Underlying & Model</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Spot</label>
                <input className={inputCls} type="number" value={spot} onChange={(e) => setSpot(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Expiry</label>
                <input className={inputCls} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Volatility</label>
                <input className={inputCls} type="number" step="0.01" value={volatility} onChange={(e) => setVolatility(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Rate (r)</label>
                <input className={inputCls} type="number" step="0.001" value={riskFreeRate} onChange={(e) => setRiskFreeRate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Dividend (q)</label>
                <input className={inputCls} type="number" step="0.001" value={dividendYield} onChange={(e) => setDividendYield(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[#8b949e] uppercase tracking-wider">Legs</h2>
              <span className="text-[10px] font-mono text-[#8b949e]">{legs.length}/10</span>
            </div>
            <div className="space-y-2">
              {legs.map((l, i) => {
                const lr = legResultFor(i);
                return (
                  <div key={i} className="bg-[#0d1117] border border-[#21262d] rounded p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        className={inputCls}
                        value={l.option_type}
                        onChange={(e) => updateLeg(i, { option_type: e.target.value as EditableLeg["option_type"] })}
                      >
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                        <option value="stock">Stock</option>
                      </select>
                      <button
                        onClick={() => setLegs((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-[#f85149] text-xs font-mono px-2 hover:bg-[#21262d] rounded"
                        aria-label="Remove leg"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Strike</label>
                        <input
                          className={inputCls}
                          type="number"
                          disabled={l.option_type === "stock"}
                          value={l.strike}
                          onChange={(e) => updateLeg(i, { strike: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Qty</label>
                        <input
                          className={inputCls}
                          type="number"
                          value={l.quantity}
                          onChange={(e) => updateLeg(i, { quantity: e.target.value })}
                        />
                      </div>
                    </div>
                    {lr && (
                      <span className="text-[10px] font-mono text-[#8b949e]">
                        px {lr.price.toFixed(2)} · Δ {lr.delta.toFixed(3)} · Γ {lr.gamma.toFixed(4)} · ν {lr.vega.toFixed(3)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => legs.length < 10 && setLegs((prev) => [...prev, blankLeg()])}
                className="flex-1 bg-[#21262d] hover:bg-[#30363d] text-[#e2e8f0] text-xs font-mono py-1.5 rounded border border-[#30363d] transition-colors"
              >
                + Add leg
              </button>
              <button
                onClick={() => setLegs([blankLeg()])}
                className="bg-[#21262d] hover:bg-[#30363d] text-[#e2e8f0] text-xs font-mono py-1.5 px-3 rounded border border-[#30363d] transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5 space-y-2">
            <h2 className="text-xs font-bold text-[#8b949e] uppercase tracking-wider">Presets</h2>
            <div className="grid grid-cols-2 gap-2">
              {STRATEGY_PRESETS.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(i)}
                  className="text-left bg-[#0d1117] border border-[#21262d] hover:border-[#58a6ff] hover:bg-[#21262d]/40 rounded px-2.5 py-2 transition-colors"
                >
                  <span className="text-xs font-mono text-white block">{p.name}</span>
                  <span className="text-[10px] text-[#8b949e] font-mono leading-tight block mt-0.5">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runStrategy}
            disabled={loading}
            className="w-full bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-sm font-mono py-2.5 rounded border border-[#238636] transition-colors"
          >
            {loading ? "Pricing..." : "▶ Price Strategy"}
          </button>

          {error && (
            <div className="bg-[#3d1d1d] border border-[#f85149]/40 text-[#f85149] text-xs font-mono p-3 rounded">
              {error.message}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-8 space-y-4">
          {result ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: result.is_credit ? "Credit" : "Debit", value: result.net_premium, color: result.is_credit ? "text-[#3fb950]" : "text-[#f0883e]" },
                  { label: "Δ Delta", value: result.net_delta, color: "text-white" },
                  { label: "Γ Gamma", value: result.net_gamma, color: "text-white" },
                  { label: "ν Vega", value: result.net_vega, color: "text-white" },
                  { label: "Θ Theta", value: result.net_theta, color: "text-white" },
                  { label: "ρ Rho", value: result.net_rho, color: "text-white" },
                ].map((m) => (
                  <div key={m.label} className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                    <span className={`text-lg font-bold font-mono ${m.color} block`}>
                      {m.value < 0 ? "-" : ""}
                      {Math.abs(m.value).toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-[#8b949e] uppercase tracking-wider">{m.label}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
                  <span className="text-[10px] font-mono text-[#8b949e] uppercase tracking-wider">Max Profit</span>
                  <span className={`text-xl font-bold font-mono block mt-1 ${result.max_profit === null ? "text-[#3fb950]" : "text-[#3fb950]"}`}>
                    {result.max_profit === null ? "∞" : result.max_profit.toFixed(2)}
                  </span>
                </div>
                <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
                  <span className="text-[10px] font-mono text-[#8b949e] uppercase tracking-wider">Max Loss</span>
                  <span className="text-xl font-bold font-mono block mt-1 text-[#f85149]">
                    {result.max_loss === null ? "∞" : result.max_loss.toFixed(2)}
                  </span>
                </div>
              </div>

              <StrategyPayoffChart result={result} spot={parseFloat(spot) || 100} currencySymbol="$" />

              <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-5">
                <h2 className="text-xs font-bold text-[#8b949e] uppercase tracking-wider mb-3">Leg Pricing</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-[#8b949e] border-b border-[#21262d]">
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Strike</th>
                        <th className="py-2 pr-3">Qty</th>
                        <th className="py-2 pr-3">TTM (y)</th>
                        <th className="py-2 pr-3 text-right">Price</th>
                        <th className="py-2 pr-3 text-right">Δ</th>
                        <th className="py-2 pr-3 text-right">Γ</th>
                        <th className="py-2 pr-3 text-right">ν</th>
                        <th className="py-2 text-right">Θ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.legs.map((l) => (
                        <tr key={l.leg_index} className="border-b border-[#21262d]/50 text-[#e2e8f0]">
                          <td className="py-2 pr-3 text-[#8b949e]">{l.leg_index + 1}</td>
                          <td className="py-2 pr-3">{l.option_type}</td>
                          <td className="py-2 pr-3">{l.strike === null ? "—" : l.strike.toFixed(2)}</td>
                          <td className="py-2 pr-3">{l.quantity}</td>
                          <td className="py-2 pr-3">{l.ttm.toFixed(2)}</td>
                          <td className="py-2 pr-3 text-right">{l.price.toFixed(2)}</td>
                          <td className="py-2 pr-3 text-right">{l.delta.toFixed(3)}</td>
                          <td className="py-2 pr-3 text-right">{l.gamma.toFixed(4)}</td>
                          <td className="py-2 pr-3 text-right">{l.vega.toFixed(3)}</td>
                          <td className="py-2 text-right">{l.theta.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg flex items-center justify-center h-96">
              <span className="text-sm text-[#8b949e] font-mono">
                Build a strategy or pick a preset, then hit “Price Strategy”.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StrategyPage() {
  return <WorkspaceStrategyContent />;
}
