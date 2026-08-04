"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MarketRegion } from "@/lib/types";
import { filterTickers, TickerEntry } from "@/lib/ticker-data";

const MARKET_PLACEHOLDERS: Record<MarketRegion, string> = {
  US: "Ticker (e.g. AAPL, MSFT)",
  IN: "Ticker (e.g. RELIANCE, TCS)",
  FX: "Pair (e.g. EURUSD, USDJPY)",
  CRYPTO: "Coin (e.g. BTC, ETH)",
};

interface TickerInputProps {
  value: string;
  onChange: (value: string) => void;
  market: MarketRegion;
  onSelectTicker?: (ticker: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function TickerInput({
  value,
  onChange,
  market,
  onSelectTicker,
  placeholder,
  className = "",
  inputClassName = "",
}: TickerInputProps) {
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [touchActiveIndex, setTouchActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestions: TickerEntry[] = useMemo(() => {
    return filterTickers(value, market, 10);
  }, [value, market]);

  const selectItem = useCallback(
    (item: TickerEntry) => {
      onChange(item.ticker);
      if (onSelectTicker) {
        onSelectTicker(item.ticker);
      }
      setShowDropdown(false);
      setActiveIndex(-1);
    },
    [onChange, onSelectTicker]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "ArrowDown") {
        setShowDropdown(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          selectItem(suggestions[activeIndex]);
        } else if (suggestions.length > 0) {
          selectItem(suggestions[0]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll("[data-ticker-item]");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className={`relative flex-1 w-full ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setShowDropdown(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (value.trim()) setShowDropdown(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || MARKET_PLACEHOLDERS[market]}
        aria-label="Ticker symbol"
        className={`w-full bg-[#0d1117] border border-[#30363d] rounded px-4 py-2.5 text-sm text-white font-mono placeholder:text-[#8b949e] focus:outline-none focus:border-[#58a6ff] transition-colors ${inputClassName}`}
      />

      {market === "IN" && (
        <span className="absolute -bottom-4 right-1 text-[10px] text-[#8b949e] font-mono pointer-events-none">
          .NS auto-appended
        </span>
      )}

      {/* Autocomplete Dropdown List */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#0d1117] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-[#21262d]/60"
        >
          {suggestions.map((item, idx) => (
            <button
              key={`${item.ticker}-${idx}`}
              type="button"
              data-ticker-item
              onClick={() => selectItem(item)}
              onTouchEnd={() => selectItem(item)}
              onTouchStart={() => setTouchActiveIndex(idx)}
              onTouchCancel={() => setTouchActiveIndex(-1)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors text-xs font-mono ${
                idx === activeIndex || idx === touchActiveIndex
                  ? "bg-[#21262d] text-white"
                  : "text-[#8b949e] hover:bg-[#161b22]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-white font-mono bg-[#161b22] px-1.5 py-0.5 rounded border border-[#21262d]">
                  {item.ticker}
                </span>
                <span className="text-[#8b949e] truncate max-w-[200px] sm:max-w-[280px]">
                  {item.name}
                </span>
              </div>
              <span className="text-[10px] text-[#8b949e] uppercase">{item.market}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
