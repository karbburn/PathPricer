"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Density = "compact" | "comfortable";

interface DensityContextValue {
  density: Density;
  toggle: () => void;
}

const DensityContext = createContext<DensityContextValue>({
  density: "comfortable",
  toggle: () => {},
});

export function useDensity() {
  return useContext(DensityContext);
}

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensity] = useState<Density>("comfortable");

  useEffect(() => {
    const stored = localStorage.getItem("pathpricer-density");
    if (stored === "compact" || stored === "comfortable") {
      setDensity(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const toggle = () => {
    setDensity((prev) => {
      const next = prev === "compact" ? "comfortable" : "compact";
      localStorage.setItem("pathpricer-density", next);
      return next;
    });
  };

  return (
    <DensityContext.Provider value={{ density, toggle }}>
      {children}
    </DensityContext.Provider>
  );
}
