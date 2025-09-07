"use client";
import { createContext, useContext, useState, useCallback } from "react";

type Toast = { id: number; message: string };
const ToastContext = createContext<{ notify: (msg: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id != id)), 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] mx-auto grid w-full max-w-md gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto rounded-xl border bg-white px-4 py-3 text-sm shadow dark:border-white/10 dark:bg-neutral-900">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
