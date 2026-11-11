"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Tone = "error" | "info";
type ToastItem = { id: number; message: string; tone: Tone };
type ToastFn = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (message, tone = "error") => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[70] flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-[10px] border bg-surface px-3.5 py-2.5 text-[13px] shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${
              t.tone === "error" ? "border-fail/40" : "border-line"
            }`}
          >
            <span
              aria-hidden
              className={`mt-[5px] size-1.5 shrink-0 rounded-full ${t.tone === "error" ? "bg-fail" : "bg-accent"}`}
            />
            <span className="min-w-0 flex-1 text-fg/90">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-mr-1 rounded-[6px] p-0.5 text-muted hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
