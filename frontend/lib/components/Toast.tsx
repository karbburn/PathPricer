"use client";

import React, { useState, useEffect, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

let toastId = 0;
let listeners: Array<(msg: ToastMessage) => void> = [];

export function showToast(type: ToastType, text: string) {
  const msg = { id: ++toastId, type, text };
  listeners.forEach((fn) => fn(msg));
}

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 200);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bgMap = {
    success: "bg-[#0d1117]/90 border-[#3fb950] text-[#3fb950]",
    error: "bg-[#0d1117]/90 border-[#f85149] text-[#f85149]",
    info: "bg-[#21262d]/90 border-[#30363d] text-[#e6edf3]",
  };

  return (
    <div
      className={`px-4 py-3 rounded-lg border font-mono text-xs shadow-lg ${bgMap[msg.type]} ${exiting ? "animate-toast-out" : "animate-toast-in"}`}
    >
      {msg.text}
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((msg: ToastMessage) => {
    setToasts((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      listeners = listeners.filter((fn) => fn !== addToast);
    };
  }, [addToast]);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((msg) => (
        <ToastItem key={msg.id} msg={msg} onDismiss={() => dismiss(msg.id)} />
      ))}
    </div>
  );
}
