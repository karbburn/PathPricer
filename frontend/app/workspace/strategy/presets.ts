import { StrategyLeg } from "@/lib/types";

export interface StrategyPreset {
  name: string;
  description: string;
  build: (spot: number) => Omit<StrategyLeg, "expiry_date" | "volatility" | "risk_free_rate" | "dividend_yield">[];
}

const leg = (
  option_type: "call" | "put" | "stock",
  strike: number | null,
  quantity: number
) => ({ option_type, strike, quantity });

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    name: "Long Straddle",
    description: "+1 ATM call, +1 ATM put. Profits from large moves either way.",
    build: (spot) => [
      leg("call", spot, 1),
      leg("put", spot, 1),
    ],
  },
  {
    name: "Short Straddle",
    description: "-1 ATM call, -1 ATM put. Collects premium; profits when spot stays flat.",
    build: (spot) => [
      leg("call", spot, -1),
      leg("put", spot, -1),
    ],
  },
  {
    name: "Long Strangle",
    description: "+1 OTM call, +1 OTM put. Cheaper than straddle; needs bigger move.",
    build: (spot) => [
      leg("call", spot * 1.1, 1),
      leg("put", spot * 0.9, 1),
    ],
  },
  {
    name: "Bull Call Spread",
    description: "+1 ATM call, -1 OTM call. Directional with capped loss.",
    build: (spot) => [
      leg("call", spot, 1),
      leg("call", spot * 1.15, -1),
    ],
  },
  {
    name: "Bear Put Spread",
    description: "+1 ATM put, -1 OTM put. Directional short with capped loss.",
    build: (spot) => [
      leg("put", spot, 1),
      leg("put", spot * 0.85, -1),
    ],
  },
  {
    name: "Iron Condor",
    description: "Short inner straddle-like strangle, long outer wings. Max profit at the center.",
    build: (spot) => [
      leg("put", spot * 0.9, -1),
      leg("put", spot * 0.8, 1),
      leg("call", spot * 1.1, -1),
      leg("call", spot * 1.2, 1),
    ],
  },
  {
    name: "Iron Butterfly",
    description: "Short ATM straddle with long OTM wings. Tighter wings than condor.",
    build: (spot) => [
      leg("call", spot, -1),
      leg("put", spot, -1),
      leg("call", spot * 1.15, 1),
      leg("put", spot * 0.85, 1),
    ],
  },
  {
    name: "Call Butterfly",
    description: "Long wings, short 2x middle. Profits when spot pins at the middle.",
    build: (spot) => [
      leg("call", spot * 0.9, 1),
      leg("call", spot, -2),
      leg("call", spot * 1.1, 1),
    ],
  },
  {
    name: "Covered Call",
    description: "Long stock, short OTM call. Income trade, caps upside.",
    build: (spot) => [
      leg("stock", null, 1),
      leg("call", spot * 1.1, -1),
    ],
  },
  {
    name: "Protective Put",
    description: "Long stock, long ATM put. Insurance against a crash.",
    build: (spot) => [
      leg("stock", null, 1),
      leg("put", spot, 1),
    ],
  },
];
