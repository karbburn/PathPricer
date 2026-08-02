"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

type Direction = "horizontal" | "vertical";

interface ResizableContextValue {
  direction: Direction;
  panelSizes: number[];
  minSizes: number[];
  maxSizes: number[];
  setPanelSize: (index: number, size: number) => void;
}

const ResizableContext = createContext<ResizableContextValue>({
  direction: "horizontal",
  panelSizes: [],
  minSizes: [],
  maxSizes: [],
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
  const panels = childArray.filter(
    (c): c is React.ReactElement => React.isValidElement(c) && c.type === ResizablePanel
  );
  const panelCount = panels.length;

  const minSizes: number[] = [];
  const maxSizes: number[] = [];
  const defaultSizes: number[] = [];
  panels.forEach((panel) => {
    const props = panel.props as { index: number; defaultSize?: number; minSize?: number; maxSize?: number };
    minSizes[props.index] = props.minSize ?? 20;
    maxSizes[props.index] = props.maxSize ?? 80;
    defaultSizes[props.index] = props.defaultSize ?? 100 / Math.max(1, panelCount);
  });
  for (let i = 0; i < panelCount; i++) {
    if (minSizes[i] === undefined) minSizes[i] = 20;
    if (maxSizes[i] === undefined) maxSizes[i] = 80;
    if (defaultSizes[i] === undefined) defaultSizes[i] = 100 / Math.max(1, panelCount);
  }

  const [panelSizes, setPanelSizes] = useState<number[]>(() => [...defaultSizes]);

  const setPanelSize = useCallback((index: number, size: number) => {
    setPanelSizes((prev) => {
      const next = [...prev];
      next[index] = size;
      return next;
    });
  }, []);

  return (
    <ResizableContext.Provider value={{ direction, panelSizes, minSizes, maxSizes, setPanelSize }}>
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
  const { direction, panelSizes, minSizes, maxSizes, setPanelSize } = useContext(ResizableContext);
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef(0);
  const startSize = useRef(0);
  const neighborStart = useRef(0);
  const minLeft = useRef(20);
  const maxLeft = useRef(80);
  const minRight = useRef(20);
  const maxRight = useRef(80);
  const containerRef = useRef<HTMLDivElement>(null);

  const beginDrag = useCallback(() => {
    startSize.current = panelSizes[index] ?? 50;
    neighborStart.current = panelSizes[index + 1] ?? 100 - startSize.current;
    minLeft.current = minSizes[index] ?? 20;
    maxLeft.current = maxSizes[index] ?? 80;
    minRight.current = minSizes[index + 1] ?? 20;
    maxRight.current = maxSizes[index + 1] ?? 80;
  }, [panelSizes, index, minSizes, maxSizes]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startPos.current = direction === "horizontal" ? e.clientX : e.clientY;
      beginDrag();
    },
    [direction, beginDrag]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startPos.current = direction === "horizontal"
        ? e.touches[0].clientX
        : e.touches[0].clientY;
      beginDrag();
    },
    [direction, beginDrag]
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
      const pairTotal = startSize.current + neighborStart.current;
      const lo = Math.max(minLeft.current, pairTotal - maxRight.current);
      const hi = Math.min(maxLeft.current, pairTotal - minRight.current);
      const newSize = Math.min(Math.max(startSize.current + deltaPercent, lo), hi);
      setPanelSize(index, newSize);
      setPanelSize(index + 1, pairTotal - newSize);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const currentPos = direction === "horizontal"
        ? e.touches[0].clientX
        : e.touches[0].clientY;
      const delta = currentPos - startPos.current;
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const containerSize = direction === "horizontal"
        ? container.getBoundingClientRect().width
        : container.getBoundingClientRect().height;
      const deltaPercent = (delta / containerSize) * 100;
      const pairTotal = startSize.current + neighborStart.current;
      const lo = Math.max(minLeft.current, pairTotal - maxRight.current);
      const hi = Math.min(maxLeft.current, pairTotal - minRight.current);
      const newSize = Math.min(Math.max(startSize.current + deltaPercent, lo), hi);
      setPanelSize(index, newSize);
      setPanelSize(index + 1, pairTotal - newSize);
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleTouchEnd = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, direction, index, setPanelSize, panelSizes]);

  return (
    <div
      ref={containerRef}
      className={`group relative flex items-center justify-center shrink-0 ${
        direction === "horizontal" ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"
      } ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ touchAction: isDragging ? "none" : "auto" }}
    >
      {/* Invisible wider touch target */}
      <div
        className={`absolute ${
          direction === "horizontal"
            ? "left-1/2 -translate-x-1/2 w-3 h-full"
            : "top-1/2 -translate-y-1/2 h-3 w-full"
        }`}
      />
      {/* Visible thin handle */}
      <div
        className={`absolute inset-0 transition-colors ${
          isDragging ? "bg-[#58a6ff]/30" : "bg-[#30363d]/40 group-hover:bg-[#58a6ff]/20"
        }`}
      />
    </div>
  );
}
