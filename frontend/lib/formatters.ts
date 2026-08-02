/**
 * Shared Numeric Formatting Helpers.
 *
 * Ensures consistent number formatting across UI, reports, and data grids,
 * preventing silent formatting path divergence.
 */

/**
 * Format currency or price to clean fixed decimal representation without raw float noise.
 * Default precision is 2 decimals (e.g., 1275.90), or 4 decimals for option prices/Greeks.
 */
export function formatPrice(val: number | null | undefined, decimals: number = 2): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format raw decimal float to percentage representation (e.g. 0.25 -> "25.0%").
 */
export function formatPercent(val: number | null | undefined, decimals: number = 1): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return `${(val * 100).toFixed(decimals)}%`;
}

/**
 * Format numbers cleanly to avoid IEEE-754 floating point artifacts in input controls.
 */
export function roundClean(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Clamp a raw input string to a valid numeric range.
 * Empty or non-finite input falls back to `fallback` so a parameter can never
 * be pushed outside its slider/solver bounds.
 */
export function clampNum(raw: string, min: number, max: number, fallback: number): number {
  const v = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export function formatCurrency(val: number | null | undefined, currency: string = "$", decimals: number = 2): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const formatted = val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${currency}\u2009${formatted}`;
}

export function formatMarketCap(val: number | null | undefined, currency: string = "$"): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  if (val >= 1e12) return `${currency}${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `${currency}${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `${currency}${(val / 1e6).toFixed(2)}M`;
  return `${currency}${val.toLocaleString()}`;
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    const local = d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
    const utcTime = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
    return `${local} (${utcTime} UTC)`;
  } catch {
    return isoString;
  }
}

/**
 * Time to expiry in years (ACT/365) for a YYYY-MM-DD expiry string.
 * Uses date-only deltas to mirror the backend's `delta.days / 365.0`.
 */
export function yearsToExpiry(expiryDate: string): number {
  const exp = new Date(`${expiryDate}T00:00:00`);
  const today = new Date();
  const expStart = Date.UTC(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const todayStart = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return (expStart - todayStart) / (86_400_000 * 365);
}

/**
 * Black-Scholes arbitrage-free price bounds for a European vanilla option.
 * Mirrors the backend bounds check in implied_vol.py: a solvable market price
 * satisfies `lower < price < upper` strictly. Returns null when bounds are
 * undefined (non-positive spot/strike or non-positive time to expiry).
 */
export function computePriceBounds(
  spot: number,
  strike: number,
  r: number,
  q: number,
  tte: number,
  type: "call" | "put"
): { lower: number; upper: number } | null {
  if (!(tte > 0) || !(spot > 0) || !(strike > 0)) return null;
  const discountedSpot = spot * Math.exp(-q * tte);
  const discountedStrike = strike * Math.exp(-r * tte);
  if (type === "call") {
    return { lower: Math.max(0, discountedSpot - discountedStrike), upper: discountedSpot };
  }
  return { lower: Math.max(0, discountedStrike - discountedSpot), upper: discountedStrike };
}

/**
 * Calculate At-The-Money (ATM) strike price rounded to realistic strike intervals based on spot level.
 */
export function computeAtmStrike(spot: number): number {
  if (spot <= 0) return 100;
  if (spot < 25) return roundClean(spot, 1);
  if (spot < 100) return Math.round(spot);
  if (spot < 500) return Math.round(spot / 5) * 5;
  if (spot < 2000) return Math.round(spot / 10) * 10;
  if (spot < 5000) return Math.round(spot / 25) * 25;
  return Math.round(spot / 50) * 50;
}
