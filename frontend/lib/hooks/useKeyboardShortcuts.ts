"use client";

import { useEffect, useCallback } from "react";

interface ShortcutHandlers {
  onRunSimulation?: () => void;
  onToggleDensity?: () => void;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Ctrl+Enter: Run simulation (always works, even in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handlers.onRunSimulation?.();
        return;
      }

      // Escape: Close dropdowns, blur inputs
      if (e.key === "Escape") {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // Skip remaining shortcuts if focused on an input
      if (isInput) return;

      // Ctrl+D: Toggle density
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handlers.onToggleDensity?.();
        return;
      }

      // ?: Show help overlay
      if (e.key === "?") {
        e.preventDefault();
        handlers.onShowHelp?.();
        return;
      }
    },
    [handlers]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
