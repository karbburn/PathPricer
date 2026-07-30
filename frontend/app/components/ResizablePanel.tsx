"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

type Direction = "horizontal" | "vertical";

interface ResizableContextValue {
  direction: Direction;
  panelSizes: number[];
  setPanelSize: (index: number, size: number) => void;
}

const ResizableContext = createContext<ResizableContextValue>({
  direction: "horizontal",
  panelSizes: [],
  setPanelSize: () => {},
});

export function ResizablePanelGroup({
  children,
  direction = "horizontal",
  className = "",
}: {
  children: React.ReactNode;
  direction?: Direction;
  className?: string;
}) {
  const childArray = React.Children.toArray(children);
  const panelCount = childArray.filter(
    (c) => React.isValidElement(c) && c.type === ResizablePanel
  ).length;

  const defaultSizes = Array(panelCount).fill(100 / panelCount);
  const [panelSizes, setPanelSizes] = useState(defaultSizes);

  const setPanelSize = useCallback((index: number, size: number) => {
    setPanelSizes((prev) => {
      const next = [...prev];
      next[index] = size;
      return next;
    });
  }, []);

  return (
    <ResizableContext.Provider value={{ direction, panelSizes, setPanelSize }}>
      <div
        className={`flex ${direction === "horizontal" ? "flex-row" : "flex-col"} ${className}`}
        style={{ height: "100%", width: "100%" }}
      >
        {children}
      </div>
    </ResizableContext.Provider>
  );
}

export function ResizablePanel({
  children,
  defaultSize = 100,
  minSize = 20,
  maxSize = 80,
  index,
  className = "",
}: {
  children: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  index: number;
  className?: string;
}) {
  const { panelSizes } = useContext(ResizableContext);
  const size = panelSizes[index] ?? defaultSize;

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{
        flex: `${size} 1 0%`,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

export function ResizableHandle({
  index,
  className = "",
}: {
  index: number;
  className?: string;
}) {
  const { direction, panelSizes, setPanelSize } = useContext(ResizableContext);
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef(0);
  const startSize = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startPos.current = direction === "horizontal" ? e.clientX : e.clientY;
      startSize.current = panelSizes[index] ?? 50;
    },
    [direction, panelSizes, index]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const containerSize = direction === "horizontal"
        ? container.getBoundingClientRect().width
        : container.getBoundingClientRect().height;
      const deltaPercent = (delta / containerSize) * 100;
      const newSize = Math.max(20, Math.min(80, startSize.current + deltaPercent));
      setPanelSize(index, newSize);
      setPanelSize(index + 1, 100 - newSize + (panelSizes[index + 1] ?? 50));
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, direction, index, setPanelSize, panelSizes]);

  return (
    <div
      ref={containerRef}
      className={`group relative flex items-center justify-center shrink-0 ${
        direction === "horizontal" ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"
      } ${className}`}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`absolute inset-0 transition-colors ${
          isDragging ? "bg-cyan-500/30" : "bg-slate-700/40 group-hover:bg-cyan-500/20"
        }`}
      />
    </div>
  );
}
