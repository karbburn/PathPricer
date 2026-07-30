"use client";

import React from "react";

interface TickerItem {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  positive: boolean;
}

const presetTickers: TickerItem[] = [
  { symbol: "AAPL", price: "$245.32", change: "+3.01", changePercent: "+1.24%", positive: true },
  { symbol: "SPY", price: "$580.12", change: "+2.60", changePercent: "+0.45%", positive: true },
  { symbol: "MSFT", price: "$425.10", change: "-1.45", changePercent: "-0.34%", positive: false },
  { symbol: "RELIANCE", price: "₹2,845", change: "+25.10", changePercent: "+0.89%", positive: true },
  { symbol: "GOOGL", price: "$198.42", change: "+1.23", changePercent: "+0.62%", positive: true },
];

export function TickerStrip() {
  return (
    <div className="h-10 bg-[#0a0f1a] border-b border-slate-800 flex items-center overflow-x-auto scrollbar-thin">
      <div className="flex items-center gap-6 px-4 whitespace-nowrap">
        {presetTickers.map((ticker) => (
          <button
            key={ticker.symbol}
            className="flex items-center gap-2 text-[10px] font-mono hover:bg-slate-800/40 px-2 py-1 rounded transition-colors"
          >
            <span className="text-slate-400 font-semibold">{ticker.symbol}</span>
            <span className="text-slate-200">{ticker.price}</span>
            <span className={ticker.positive ? "text-emerald-400" : "text-red-400"}>
              {ticker.positive ? "▲" : "▼"} {ticker.changePercent}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
