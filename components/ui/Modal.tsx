"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function Modal({
  open, onClose, title, subtitle, children, wide = false,
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-black/65 p-4 py-[6vh] backdrop-blur-sm"
          onMouseDown={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`panel-raised w-full ${wide ? "max-w-4xl" : "max-w-lg"} overflow-hidden`}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/[0.08]">
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
                {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-white/45">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="btn-ghost !p-1.5" aria-label="Sluiten"><X size={17} /></button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
