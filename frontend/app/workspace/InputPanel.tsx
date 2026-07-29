"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { postPricePreview, getMarketQuote, ApiError } from "@/lib/api-client";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { serializeInputs } from "@/lib/url-state";
import {
  MarketRegion,
  OptionType,
  PricingPreviewResponse,
  PricingRequest,
  VarianceReductionMethod,
} from "@/lib/types";

interface TickerEntry {
  ticker: string;
  name: string;
  market: MarketRegion;
}

const TICKER_DATABASE: TickerEntry[] = [
  // US Stocks
  { ticker: "AAPL", name: "Apple Inc.", market: "US" },
  { ticker: "MSFT", name: "Microsoft Corp.", market: "US" },
  { ticker: "GOOGL", name: "Alphabet Inc.", market: "US" },
  { ticker: "AMZN", name: "Amazon.com Inc.", market: "US" },
  { ticker: "NVDA", name: "NVIDIA Corp.", market: "US" },
  { ticker: "META", name: "Meta Platforms Inc.", market: "US" },
  { ticker: "TSLA", name: "Tesla Inc.", market: "US" },
  { ticker: "BRK.B", name: "Berkshire Hathaway", market: "US" },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", market: "US" },
  { ticker: "V", name: "Visa Inc.", market: "US" },
  { ticker: "JNJ", name: "Johnson & Johnson", market: "US" },
  { ticker: "WMT", name: "Walmart Inc.", market: "US" },
  { ticker: "MA", name: "Mastercard Inc.", market: "US" },
  { ticker: "PG", name: "Procter & Gamble", market: "US" },
  { ticker: "UNH", name: "UnitedHealth Group", market: "US" },
  { ticker: "HD", name: "Home Depot Inc.", market: "US" },
  { ticker: "DIS", name: "Walt Disney Co.", market: "US" },
  { ticker: "PYPL", name: "PayPal Holdings", market: "US" },
  { ticker: "NFLX", name: "Netflix Inc.", market: "US" },
  { ticker: "ADBE", name: "Adobe Inc.", market: "US" },
  { ticker: "CRM", name: "Salesforce Inc.", market: "US" },
  { ticker: "INTC", name: "Intel Corp.", market: "US" },
  { ticker: "AMD", name: "Advanced Micro Devices", market: "US" },
  { ticker: "CSCO", name: "Cisco Systems", market: "US" },
  { ticker: "QCOM", name: "Qualcomm Inc.", market: "US" },
  { ticker: "ORCL", name: "Oracle Corp.", market: "US" },
  { ticker: "IBM", name: "IBM Corp.", market: "US" },
  { ticker: "KO", name: "Coca-Cola Co.", market: "US" },
  { ticker: "PEP", name: "PepsiCo Inc.", market: "US" },
  { ticker: "NKE", name: "Nike Inc.", market: "US" },
  { ticker: "BA", name: "Boeing Co.", market: "US" },
  { ticker: "MCD", name: "McDonald's Corp.", market: "US" },
  { ticker: "SBUX", name: "Starbucks Corp.", market: "US" },
  { ticker: "COST", name: "Costco Wholesale", market: "US" },
  { ticker: "MRK", name: "Merck & Co.", market: "US" },
  { ticker: "PFE", name: "Pfizer Inc.", market: "US" },
  { ticker: "ABT", name: "Abbott Laboratories", market: "US" },
  { ticker: "CVX", name: "Chevron Corp.", market: "US" },
  { ticker: "XOM", name: "Exxon Mobil Corp.", market: "US" },
  { ticker: "GE", name: "General Electric", market: "US" },
  { ticker: "CAT", name: "Caterpillar Inc.", market: "US" },
  { ticker: "AMGN", name: "Amgen Inc.", market: "US" },
  { ticker: "GILD", name: "Gilead Sciences", market: "US" },
  { ticker: "GM", name: "General Motors", market: "US" },
  { ticker: "F", name: "Ford Motor Co.", market: "US" },
  { ticker: "LLY", name: "Eli Lilly & Co.", market: "US" },
  { ticker: "AVGO", name: "Broadcom Inc.", market: "US" },
  { ticker: "TXN", name: "Texas Instruments", market: "US" },
  { ticker: "BAC", name: "Bank of America", market: "US" },
  { ticker: "WFC", name: "Wells Fargo & Co.", market: "US" },
  { ticker: "C", name: "Citigroup Inc.", market: "US" },
  { ticker: "GS", name: "Goldman Sachs Group", market: "US" },
  { ticker: "MS", name: "Morgan Stanley", market: "US" },
  { ticker: "BLK", name: "BlackRock Inc.", market: "US" },
  { ticker: "AXP", name: "American Express", market: "US" },
  { ticker: "HON", name: "Honeywell International", market: "US" },
  { ticker: "LOW", name: "Lowe's Companies", market: "US" },
  { ticker: "TGT", name: "Target Corp.", market: "US" },
  { ticker: "UPS", name: "United Parcel Service", market: "US" },
  { ticker: "FDX", name: "FedEx Corp.", market: "US" },
  { ticker: "UNP", name: "Union Pacific Corp.", market: "US" },
  { ticker: "NEE", name: "NextEra Energy", market: "US" },
  { ticker: "COP", name: "ConocoPhillips", market: "US" },
  { ticker: "LMT", name: "Lockheed Martin", market: "US" },
  { ticker: "RTX", name: "RTX Corp.", market: "US" },
  { ticker: "T", name: "AT&T Inc.", market: "US" },
  { ticker: "VZ", name: "Verizon Communications", market: "US" },
  { ticker: "BKNG", name: "Booking Holdings", market: "US" },
  { ticker: "UBER", name: "Uber Technologies", market: "US" },
  { ticker: "ABNB", name: "Airbnb Inc.", market: "US" },
  { ticker: "NOW", name: "ServiceNow Inc.", market: "US" },
  { ticker: "AMAT", name: "Applied Materials", market: "US" },
  { ticker: "MU", name: "Micron Technology", market: "US" },
  { ticker: "DHR", name: "Danaher Corp.", market: "US" },
  { ticker: "ISRG", name: "Intuitive Surgical", market: "US" },
  { ticker: "MDT", name: "Medtronic PLC", market: "US" },
  { ticker: "MO", name: "Altria Group", market: "US" },
  { ticker: "TMO", name: "Thermo Fisher Scientific", market: "US" },
  { ticker: "SPGI", name: "S&P Global Inc.", market: "US" },
  { ticker: "SCHW", name: "Charles Schwab Corp.", market: "US" },
  { ticker: "AMT", name: "American Tower Corp.", market: "US" },
  // US ETFs
  { ticker: "SPY", name: "SPDR S&P 500 ETF", market: "US" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", market: "US" },
  { ticker: "IWM", name: "iShares Russell 2000", market: "US" },
  { ticker: "DIA", name: "SPDR Dow Jones ETF", market: "US" },
  { ticker: "GLD", name: "SPDR Gold Shares", market: "US" },
  { ticker: "SLV", name: "iShares Silver Trust", market: "US" },
  { ticker: "TLT", name: "iShares 20+ Year Treasury", market: "US" },
  { ticker: "VTI", name: "Vanguard Total Stock Market", market: "US" },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", market: "US" },
  { ticker: "XLF", name: "Financial Sector ETF", market: "US" },
  { ticker: "XLK", name: "Technology Sector ETF", market: "US" },
  { ticker: "XLV", name: "Healthcare Sector ETF", market: "US" },
  { ticker: "XLE", name: "Energy Sector ETF", market: "US" },
  { ticker: "XLU", name: "Utilities Sector ETF", market: "US" },
  { ticker: "XLI", name: "Industrial Sector ETF", market: "US" },
  { ticker: "XLP", name: "Consumer Staples ETF", market: "US" },
  { ticker: "XLY", name: "Consumer Discretionary ETF", market: "US" },
  { ticker: "BND", name: "Vanguard Total Bond Market", market: "US" },
  { ticker: "VXUS", name: "Vanguard Total International", market: "US" },
  { ticker: "EEM", name: "iShares Emerging Markets", market: "US" },
  { ticker: "ARKK", name: "ARK Innovation ETF", market: "US" },
  { ticker: "SMH", name: "VanEck Semiconductor ETF", market: "US" },
  { ticker: "ICLN", name: "Global Clean Energy ETF", market: "US" },
  // Indian Stocks
  { ticker: "RELIANCE", name: "Reliance Industries", market: "IN" },
  { ticker: "TCS", name: "Tata Consultancy Services", market: "IN" },
  { ticker: "HDFCBANK", name: "HDFC Bank", market: "IN" },
  { ticker: "INFY", name: "Infosys Ltd.", market: "IN" },
  { ticker: "ICICIBANK", name: "ICICI Bank", market: "IN" },
  { ticker: "HINDUNILVR", name: "Hindustan Unilever", market: "IN" },
  { ticker: "ITC", name: "ITC Ltd.", market: "IN" },
  { ticker: "SBIN", name: "State Bank of India", market: "IN" },
  { ticker: "BHARTIARTL", name: "Bharti Airtel", market: "IN" },
  { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", market: "IN" },
  { ticker: "BAJFINANCE", name: "Bajaj Finance", market: "IN" },
  { ticker: "LT", name: "Larsen & Toubro", market: "IN" },
  { ticker: "WIPRO", name: "Wipro Ltd.", market: "IN" },
  { ticker: "AXISBANK", name: "Axis Bank", market: "IN" },
  { ticker: "MARUTI", name: "Maruti Suzuki", market: "IN" },
  { ticker: "TITAN", name: "Titan Company", market: "IN" },
  { ticker: "ASIANPAINT", name: "Asian Paints", market: "IN" },
  { ticker: "NTPC", name: "NTPC Ltd.", market: "IN" },
  { ticker: "ONGC", name: "Oil & Natural Gas Corp.", market: "IN" },
  { ticker: "POWERGRID", name: "Power Grid Corp.", market: "IN" },
  { ticker: "SUNPHARMA", name: "Sun Pharmaceutical", market: "IN" },
  { ticker: "ULTRACEMCO", name: "UltraTech Cement", market: "IN" },
  { ticker: "HCLTECH", name: "HCL Technologies", market: "IN" },
  { ticker: "TATAMOTORS", name: "Tata Motors", market: "IN" },
  { ticker: "NESTLEIND", name: "Nestlé India", market: "IN" },
  { ticker: "M&M", name: "Mahindra & Mahindra", market: "IN" },
  { ticker: "TATASTEEL", name: "Tata Steel", market: "IN" },
  { ticker: "INDUSINDBK", name: "IndusInd Bank", market: "IN" },
  { ticker: "BAJAJFINSV", name: "Bajaj Finserv", market: "IN" },
  { ticker: "DRREDDY", name: "Dr. Reddy's Labs", market: "IN" },
  { ticker: "CIPLA", name: "Cipla Ltd.", market: "IN" },
  { ticker: "HEROMOTOCO", name: "Hero MotoCorp", market: "IN" },
  { ticker: "EICHERMOT", name: "Eicher Motors", market: "IN" },
  { ticker: "BRITANNIA", name: "Britannia Industries", market: "IN" },
  { ticker: "HDFCLIFE", name: "HDFC Life Insurance", market: "IN" },
  { ticker: "SBILIFE", name: "SBI Life Insurance", market: "IN" },
  { ticker: "BPCL", name: "Bharat Petroleum", market: "IN" },
  { ticker: "HINDALCO", name: "Hindalco Industries", market: "IN" },
  { ticker: "DIVISLAB", name: "Divi's Laboratories", market: "IN" },
  { ticker: "COALINDIA", name: "Coal India Ltd.", market: "IN" },
  { ticker: "ADANIPORTS", name: "Adani Ports & SEZ", market: "IN" },
  { ticker: "GRASIM", name: "Grasim Industries", market: "IN" },
  { ticker: "JSWSTEEL", name: "JSW Steel", market: "IN" },
  { ticker: "TATACONSUM", name: "Tata Consumer Products", market: "IN" },
  { ticker: "HDFC", name: "Housing Development Finance", market: "IN" },
  { ticker: "DABUR", name: "Dabur India Ltd.", market: "IN" },
  { ticker: "MARICO", name: "Marico Ltd.", market: "IN" },
  { ticker: "PIDILITIND", name: "Pidilite Industries", market: "IN" },
  { ticker: "HAVELLS", name: "Havells India Ltd.", market: "IN" },
  { ticker: "GODREJCP", name: "Godrej Consumer Products", market: "IN" },
  { ticker: "BERGERPAINT", name: "Berger Paints India", market: "IN" },
  { ticker: "LUPIN", name: "Lupin Ltd.", market: "IN" },
  { ticker: "BIOCON", name: "Biocon Ltd.", market: "IN" },
  { ticker: "TORNTPHARM", name: "Torrent Pharmaceuticals", market: "IN" },
  { ticker: "PAGEIND", name: "Page Industries", market: "IN" },
  { ticker: "COLPAL", name: "Colgate-Palmolive India", market: "IN" },
  { ticker: "PEL", name: "Piramal Enterprises", market: "IN" },
  { ticker: "IRCTC", name: "Indian Railway Catering", market: "IN" },
  { ticker: "HAL", name: "Hindustan Aeronautics", market: "IN" },
  { ticker: "BEL", name: "Bharat Electronics Ltd.", market: "IN" },
  { ticker: "VEDL", name: "Vedanta Ltd.", market: "IN" },
  { ticker: "PAYTM", name: "One97 Communications", market: "IN" },
  { ticker: "ZOMATO", name: "Zomato Ltd.", market: "IN" },
  { ticker: "NYKAA", name: "FSN E-Commerce Nykaa", market: "IN" },
  { ticker: "IEX", name: "Indian Energy Exchange", market: "IN" },
  { ticker: "TVSMOTOR", name: "TVS Motor Company", market: "IN" },
  { ticker: "BANKBARODA", name: "Bank of Baroda", market: "IN" },
  { ticker: "CANBK", name: "Canara Bank", market: "IN" },
  { ticker: "PNB", name: "Punjab National Bank", market: "IN" },
  { ticker: "MUTHOOTFIN", name: "Muthoot Finance", market: "IN" },
  { ticker: "MOTILALOFS", name: "Motilal Oswal Financial", market: "IN" },
  { ticker: "ANGELONE", name: "Angel One Ltd.", market: "IN" },
  { ticker: "CDSL", name: "Central Depository Services", market: "IN" },
  { ticker: "IRFC", name: "Indian Railway Finance", market: "IN" },
  { ticker: "HINDZINC", name: "Hindustan Zinc", market: "IN" },
  { ticker: "TRENT", name: "Trent Ltd.", market: "IN" },
  { ticker: "ASTRAL", name: "Astral Ltd.", market: "IN" },
  { ticker: "APOLLOHOSP", name: "Apollo Hospitals", market: "IN" },
  { ticker: "DLF", name: "DLF Ltd.", market: "IN" },
  { ticker: "GODREJPROP", name: "Godrej Properties", market: "IN" },
  { ticker: "JINDALSTEL", name: "Jindal Steel & Power", market: "IN" },
  { ticker: "ABBOTINDIA", name: "Abbott India Ltd.", market: "IN" },
  { ticker: "MCDOWELL-N", name: "United Spirits Ltd.", market: "IN" },
  { ticker: "SYNGENE", name: "Syngene International", market: "IN" },
  { ticker: "TRIDENT", name: "Trident Ltd.", market: "IN" },
  { ticker: "SAIL", name: "Steel Authority of India", market: "IN" },
  { ticker: "BHEL", name: "Bharat Heavy Electricals", market: "IN" },
];

interface InputPanelProps {
  initialInputs: PricingRequest;
  onInputsChange: (inputs: PricingRequest) => void;
  onPreviewSuccess: (result: PricingPreviewResponse) => void;
  onPreviewError: (error: ApiError | null) => void;
  onRunFullSimulation: (inputs: PricingRequest) => void;
  isFullSimulating: boolean;
  onMicroStateChange: (state: "pending" | "preview" | "error") => void;
}

export function InputPanel({
  initialInputs,
  onInputsChange,
  onPreviewSuccess,
  onPreviewError,
  onRunFullSimulation,
  isFullSimulating,
  onMicroStateChange,
}: InputPanelProps) {
  const [inputs, setInputs] = useState<PricingRequest>(initialInputs);
  const [seedLocked, setSeedLocked] = useState<boolean>(false);
  const [fetchingMarket, setFetchingMarket] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce preview-triggering inputs (~200ms)
  const debouncedInputs = useDebounce(inputs, 200);

  // Request sequence ref & AbortController ref to prevent out-of-order race conditions
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to update a field in state and notify parent / update URL
  const updateField = <K extends keyof PricingRequest>(
    field: K,
    value: PricingRequest[K]
  ) => {
    setInputs((prev) => {
      const next = { ...prev, [field]: value };
      onInputsChange(next);

      // Update URL search query string dynamically without full page reload
      if (typeof window !== "undefined") {
        const queryStr = serializeInputs(next);
        const newUrl = `${window.location.pathname}?${queryStr}`;
        window.history.replaceState(null, "", newUrl);
      }
      return next;
    });
  };

  // Filtered ticker suggestions for autocomplete
  const filteredTickers = useMemo(() => {
    const q = inputs.ticker.toUpperCase().trim();
    if (!q) return [];
    return TICKER_DATABASE.filter(
      (t) => t.market === inputs.market && t.ticker.startsWith(q)
    ).slice(0, 10);
  }, [inputs.ticker, inputs.market]);

  const selectTicker = useCallback(
    (ticker: string) => {
      updateField("ticker", ticker);
      setShowDropdown(false);
      setActiveIndex(-1);
    },
    [updateField]
  );

  const handleTickerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || filteredTickers.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filteredTickers.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : filteredTickers.length - 1
          );
          break;
        case "Enter":
          if (activeIndex >= 0 && activeIndex < filteredTickers.length) {
            e.preventDefault();
            selectTicker(filteredTickers[activeIndex].ticker);
          }
          break;
        case "Escape":
          setShowDropdown(false);
          setActiveIndex(-1);
          break;
      }
    },
    [showDropdown, filteredTickers, activeIndex, selectTicker]
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-fetch market quote when ticker or market changes
  const handleMarketFetch = async () => {
    if (!inputs.ticker.trim()) return;
    setFetchingMarket(true);
    try {
      const quote = await getMarketQuote(inputs.ticker, inputs.market);
      setInputs((prev) => {
        const next: PricingRequest = {
          ...prev,
          spot_override: quote.spot_price,
          volatility: quote.historical_volatility["252d"] || prev.volatility,
          dividend_yield: quote.dividend_yield,
        };
        onInputsChange(next);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `?${serializeInputs(next)}`);
        }
        return next;
      });
    } catch {
      // Ignore market fetch failure — manual spot override remains
    } finally {
      setFetchingMarket(false);
    }
  };

  // Preview Tier Debounce & Abort Effect
  useEffect(() => {
    // Increment request ID counter for this update
    requestIdRef.current += 1;
    const currentReqId = requestIdRef.current;

    // Abort previous in-flight preview request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Notify parent of pending micro-state
    onMicroStateChange("pending");

    // Preview request payload (capped N simulations for preview tier: max 20,000)
    const previewPayload: PricingRequest = {
      ...debouncedInputs,
      n_simulations: Math.min(debouncedInputs.n_simulations, 10000),
    };

    postPricePreview(previewPayload, controller.signal)
      .then((data) => {
        // Race condition check: ignore if superseded or aborted
        if (requestIdRef.current !== currentReqId || controller.signal.aborted) {
          return;
        }
        onPreviewSuccess(data);
        onPreviewError(null);
        onMicroStateChange("preview");
      })
      .catch((err) => {
        if (requestIdRef.current !== currentReqId || controller.signal.aborted) {
          return;
        }
        if (err instanceof ApiError) {
          onPreviewError(err);
        }
        onMicroStateChange("error");
      });

    return () => {
      controller.abort();
    };
  }, [debouncedInputs, onMicroStateChange, onPreviewError, onPreviewSuccess]);

  const handleRandomizeSeed = () => {
    if (seedLocked) return;
    const newSeed = Math.floor(Math.random() * 1000000);
    updateField("seed", newSeed);
  };

  return (
    <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-700 pb-3">
        <h2 className="text-lg font-bold text-white tracking-tight">
          Pricing Inputs
        </h2>
        <span className="text-xs text-gray-400 font-mono">
          Preview Auto-Debounced (~200ms)
        </span>
      </div>

      {/* 1. Underlying Ticker & Market Selection */}
      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-blue-400">
          Underlying Asset
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div ref={containerRef} className="sm:col-span-2 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputs.ticker}
                onChange={(e) => {
                  updateField("ticker", e.target.value.toUpperCase());
                  setShowDropdown(true);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleTickerKeyDown}
                onFocus={() => setShowDropdown(true)}
                placeholder="Ticker (e.g. AAPL)"
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white font-mono"
              />
              {showDropdown && filteredTickers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-950 border border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                  {filteredTickers.map((entry, idx) => (
                    <div
                      key={entry.ticker}
                      onMouseDown={() => selectTicker(entry.ticker)}
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                        idx === activeIndex
                          ? "bg-blue-900/60 text-white"
                          : "text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      <div>
                        <span className="font-mono font-bold text-sm">{entry.ticker}</span>
                        <span className="text-xs text-gray-500 ml-2">{entry.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">{entry.market}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleMarketFetch}
              disabled={fetchingMarket}
              className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {fetchingMarket ? "Syncing..." : "Sync Market"}
            </button>
          </div>

          <div className="flex bg-gray-950 p-1 rounded border border-gray-700">
            <button
              type="button"
              onClick={() => updateField("market", "US")}
              className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                inputs.market === "US"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              US
            </button>
            <button
              type="button"
              onClick={() => updateField("market", "IN")}
              className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                inputs.market === "IN"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              IN (.NS)
            </button>
          </div>
        </div>

        {/* Spot Price Override */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Spot Price ($S_0$)</label>
            <input
              type="number"
              step="0.01"
              value={inputs.spot_override ?? ""}
              onChange={(e) =>
                updateField("spot_override", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Market default"
              className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Dividend Yield ($q$)</label>
            <input
              type="number"
              step="0.001"
              value={inputs.dividend_yield ?? 0}
              onChange={(e) => updateField("dividend_yield", Number(e.target.value))}
              className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-sm text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* 2. Option Type & Strike Price */}
      <div className="space-y-3 pt-3 border-t border-gray-700/60">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-blue-400">
            Contract Terms
          </label>
          <div className="flex bg-gray-950 p-1 rounded border border-gray-700">
            <button
              type="button"
              onClick={() => updateField("option_type", "call")}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                inputs.option_type === "call"
                  ? "bg-green-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              CALL
            </button>
            <button
              type="button"
              onClick={() => updateField("option_type", "put")}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                inputs.option_type === "put"
                  ? "bg-red-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              PUT
            </button>
          </div>
        </div>

        {/* Strike Price Dual Input (Slider + Box) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-300">Strike Price ($K$)</label>
            <input
              type="number"
              step="0.5"
              value={inputs.strike}
              onChange={(e) => updateField("strike", Number(e.target.value))}
              className="w-24 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-right text-white"
            />
          </div>
          <input
            type="range"
            min="10"
            max="1000"
            step="1"
            value={inputs.strike}
            onChange={(e) => updateField("strike", Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Expiry Date */}
        <div>
          <label className="block text-xs text-gray-300 mb-1">Expiration Date</label>
          <input
            type="date"
            value={inputs.expiry_date}
            onChange={(e) => updateField("expiry_date", e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white font-mono"
          />
        </div>
      </div>

      {/* 3. Market Risk Parameters (Vol & Rate) */}
      <div className="space-y-3 pt-3 border-t border-gray-700/60">
        <label className="block text-xs font-bold uppercase tracking-wider text-blue-400">
          Risk &amp; Volatility Parameters
        </label>

        {/* Volatility Dual Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-300">
              Volatility ($\sigma$): {(inputs.volatility * 100).toFixed(1)}%
            </label>
            <input
              type="number"
              step="0.01"
              value={inputs.volatility}
              onChange={(e) => updateField("volatility", Number(e.target.value))}
              className="w-24 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-right text-white"
            />
          </div>
          <input
            type="range"
            min="0.01"
            max="2.00"
            step="0.01"
            value={inputs.volatility}
            onChange={(e) => updateField("volatility", Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Risk-Free Rate Dual Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-300">
              Risk-Free Rate ($r$): {(inputs.risk_free_rate * 100).toFixed(1)}%
            </label>
            <input
              type="number"
              step="0.005"
              value={inputs.risk_free_rate}
              onChange={(e) => updateField("risk_free_rate", Number(e.target.value))}
              className="w-24 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-right text-white"
            />
          </div>
          <input
            type="range"
            min="-0.02"
            max="0.20"
            step="0.0025"
            value={inputs.risk_free_rate}
            onChange={(e) => updateField("risk_free_rate", Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>
      </div>

      {/* 4. Simulation Engine Controls */}
      <div className="space-y-3 pt-3 border-t border-gray-700/60">
        <label className="block text-xs font-bold uppercase tracking-wider text-blue-400">
          Simulation Controls
        </label>

        {/* N Simulations Presets */}
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Simulations ($N$): {inputs.n_simulations.toLocaleString()}
          </label>
          <div className="grid grid-cols-5 gap-1 mb-2">
            {[10000, 50000, 100000, 500000, 1000000].map((nVal) => (
              <button
                key={nVal}
                type="button"
                onClick={() => updateField("n_simulations", nVal)}
                className={`py-1 text-[10px] font-mono rounded transition-colors ${
                  inputs.n_simulations === nVal
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-gray-950 text-gray-400 hover:text-white border border-gray-800"
                }`}
              >
                {nVal >= 1000000 ? `${nVal / 1000000}M` : `${nVal / 1000}k`}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1000"
            max="2000000"
            step="5000"
            value={inputs.n_simulations}
            onChange={(e) => updateField("n_simulations", Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Variance Reduction Selector */}
        <div>
          <label className="block text-xs text-gray-300 mb-1">Variance Reduction Method</label>
          <select
            value={inputs.variance_reduction}
            onChange={(e) =>
              updateField("variance_reduction", e.target.value as VarianceReductionMethod)
            }
            className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs font-mono text-white"
          >
            <option value="all">All 4 Estimators (Standard / Anti / CV / Combined)</option>
            <option value="standard">Standard Monte Carlo</option>
            <option value="antithetic">Antithetic Variates</option>
            <option value="control_variate">Control Variates (S_T)</option>
            <option value="antithetic_cv">Combined Antithetic + CV</option>
          </select>
        </div>

        {/* Seed Control (Randomize + Lock Button) */}
        <div>
          <label className="block text-xs text-gray-300 mb-1">RNG Seed</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={inputs.seed}
              disabled={seedLocked}
              onChange={(e) => updateField("seed", Number(e.target.value))}
              className="flex-1 bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-xs font-mono text-white disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleRandomizeSeed}
              disabled={seedLocked}
              className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded font-mono disabled:opacity-50"
            >
              🎲 Randomize
            </button>
            <button
              type="button"
              onClick={() => setSeedLocked(!seedLocked)}
              className={`text-xs px-3 py-1.5 rounded font-mono border transition-colors ${
                seedLocked
                  ? "bg-amber-950 border-amber-700 text-amber-300"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              {seedLocked ? "🔒 Locked" : "🔓 Unlocked"}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Primary CTA: Run Full Simulation Button */}
      <div className="pt-4">
        <button
          type="button"
          disabled={isFullSimulating}
          onClick={() => onRunFullSimulation(inputs)}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3.5 px-4 rounded-lg shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <span>{isFullSimulating ? "Simulating..." : "▶ Run Full Simulation"}</span>
          <span className="text-xs font-mono text-blue-200">(N={inputs.n_simulations.toLocaleString()})</span>
        </button>
      </div>
    </div>
  );
}
