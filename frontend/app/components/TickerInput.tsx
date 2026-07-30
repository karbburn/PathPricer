"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MarketRegion } from "@/lib/types";
import { filterTickers, TickerEntry } from "@/lib/ticker-data";

interface TickerInputProps {
  value: string;
  onChange: (value: string) => void;
  market: MarketRegion;
  onSelectTicker?: (ticker: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  accentColor?: "cyan" | "amber";
}

export function TickerInput({
  value,
  onChange,
  market,
  onSelectTicker,
  placeholder = "Enter ticker (e.g. RELIANCE, AAPL, MSFT)",
  className = "",
  inputClassName = "",
  accentColor = "amber",
}: TickerInputProps) {
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
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
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll("[data-ticker-item]");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const focusBorderClass =
    accentColor === "cyan" ? "focus:border-cyan-500" : "focus:border-cyan-500";

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
        placeholder={placeholder}
        className={`w-full bg-slate-950 border border-slate-700 rounded px-4 py-2.5 text-sm text-white font-mono placeholder:text-slate-500 focus:outline-none transition-colors ${focusBorderClass} ${inputClassName}`}
      />

      {market === "IN" && (
        <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono pointer-events-none">
          Auto-appends .NS
        </span>
      )}

      {/* Autocomplete Dropdown List */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-800/60"
        >
          {suggestions.map((item, idx) => (
            <button
              key={`${item.ticker}-${idx}`}
              type="button"
              data-ticker-item
              onClick={() => selectItem(item)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors text-xs font-mono ${
                idx === activeIndex
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-white font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  {item.ticker}
                </span>
                <span className="text-slate-400 truncate max-w-[200px] sm:max-w-[280px]">
                  {item.name}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 uppercase">{item.market}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
