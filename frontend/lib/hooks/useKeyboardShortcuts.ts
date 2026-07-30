"use client";

import { useEffect, useCallback } from "react";

interface ShortcutHandlers {
  onRunSimulation?: () => void;
  onFocusTicker?: () => void;
  onSwitchChart?: (index: number) => void;
  onToggleDensity?: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
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

      // Ctrl+K or /: Focus ticker search
      if (((e.ctrlKey || e.metaKey) && e.key === "k") || e.key === "/") {
        e.preventDefault();
        handlers.onFocusTicker?.();
        return;
      }

      // 1-6: Switch chart tabs (workspace only)
      if (e.key >= "1" && e.key <= "6" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        handlers.onSwitchChart?.(parseInt(e.key) - 1);
        return;
      }

      // Ctrl+D: Toggle density
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handlers.onToggleDensity?.();
        return;
      }

      // Ctrl+Shift+E: Export CSV
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "E") {
        e.preventDefault();
        handlers.onExportCsv?.();
        return;
      }

      // Ctrl+Shift+P: Export PDF
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        handlers.onExportPdf?.();
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
