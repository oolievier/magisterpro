"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sun, Moon, Monitor, Palette, Check } from "lucide-react";
import { ACCENTS, useApp } from "@/app/providers";
import type { AccentName, ThemeName } from "@/lib/types";

export function ThemeControls() {
  const { state, setTheme, setAccent } = useApp();
  const [open, setOpen] = useState(false);
  const themes: { key: ThemeName; icon: typeof Sun; label: string }[] = [
    { key: "dark", icon: Moon, label: "Donker" },
    { key: "light", icon: Sun, label: "Licht" },
    { key: "system", icon: Monitor, label: "Systeem" },
  ];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="btn-ghost !p-2" title="Uiterlijk & accentkleur" aria-label="Uiterlijk instellen">
        <Palette size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="panel-raised absolute right-0 top-12 z-50 w-64 p-4"
            >
              <p className="label">Modus</p>
              <div className="grid grid-cols-3 gap-1.5">
                {themes.map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[10px] font-medium transition ${
                      state.theme === key
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="divider my-4" />
              <p className="label">Accentkleur</p>
              <div className="space-y-1.5">
                {(Object.keys(ACCENTS) as AccentName[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setAccent(key)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-white/5 ${
                      state.accent === key ? "bg-accent/[0.07] text-slate-900 dark:text-white" : "text-slate-600 dark:text-white/60"
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full ring-2 ring-white/20" style={{ background: ACCENTS[key].hex }} />
                    <span className="flex-1 font-medium">{ACCENTS[key].name}</span>
                    {state.accent === key && <Check size={14} className="text-accent" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
