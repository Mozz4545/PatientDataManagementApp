"use client";

import { useEffect, useState } from "react";
import type { ToastPayload } from "@/lib/toast";

type ToastItem = ToastPayload & { id: number };

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail?.message) return;
      const id = Date.now() + Math.random();
      setToasts((items) => [...items, { id, ...detail }].slice(-3));
      window.setTimeout(() => {
        setToasts((items) => items.filter((item) => item.id !== id));
      }, 2800);
    };

    window.addEventListener("radiology-toast", onToast);
    return () => window.removeEventListener("radiology-toast", onToast);
  }, []);

  return (
    <>
      {children}
      <div className="fixed right-4 top-4 z-[80] flex w-[calc(100vw-2rem)] max-w-[360px] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-lg ${
              toast.type === "success"
                ? "border-[#99fba6] bg-[#effff1] text-[#137547]"
                : toast.type === "error"
                  ? "border-[#efabab] bg-[#fff2f2] text-[#9b111e]"
                  : "border-[#addbf4] bg-[#f1f9ff] text-[#123879]"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
