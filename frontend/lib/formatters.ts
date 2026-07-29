/**
 * Utility functions for formatting numbers, currency, percentages, and dates in UI.
 */

export function formatCurrency(
  value: number,
  currency: string = "USD",
  decimals: number = 2
): string {
  const symbolMap: Record<string, string> = {
    USD: "$",
    INR: "₹",
    EUR: "€",
    GBP: "£",
  };
  const symbol = symbolMap[currency.toUpperCase()] || `${currency} `;
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatMarketCap(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "N/A";
  }
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  return `$${value.toLocaleString()}`;
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toUTCString().replace("GMT", "UTC");
  } catch {
    return isoString;
  }
}
