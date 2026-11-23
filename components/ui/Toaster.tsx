"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastTone = "success" | "warning" | "info";

interface Toast { id: number; message: string; detail?: string; tone: ToastTone }

export function toast(message: string, tone: ToastTone = "success", detail?: string) {
  window.dispatchEvent(new CustomEvent("magisterpro:toast", { detail: { message, tone, detail } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Omit<Toast, "id">;
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { ...detail, id }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
    };
    window.addEventListener("magisterpro:toast", handler);
    return () => window.removeEventListener("magisterpro:toast", handler);
  }, []);

  const icons = { success: CheckCircle2, warning: AlertTriangle, info: Info };
  const colors = {
    success: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    warning: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    info: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  };

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-6">
      <AnimatePresence>
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.96 }}
              layout
              className="panel-raised pointer-events-auto flex items-start gap-3 p-3.5"
            >
              <span className={`rounded-lg border p-1.5 ${colors[t.tone]}`}><Icon size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white/90">{t.message}</p>
                {t.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-white/45">{t.detail}</p>}
              </div>
              <button onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))} className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><X size={14} /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
