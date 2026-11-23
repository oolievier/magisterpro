"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label, value, suffix, hint, icon: Icon, tone = "accent", delay = 0,
}: {
  label: string; value: string | number; suffix?: string; hint?: string; icon?: LucideIcon;
  tone?: "accent" | "emerald" | "amber" | "rose" | "blue"; delay?: number;
}) {
  const tones = {
    accent: "bg-accent/12 text-accent",
    emerald: "bg-emerald-500/12 text-emerald-400",
    amber: "bg-amber-500/12 text-amber-400",
    rose: "bg-rose-500/12 text-rose-400",
    blue: "bg-blue-500/12 text-blue-400",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }} className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/40">{label}</p>
        {Icon && <span className={`rounded-lg p-1.5 ${tones[tone]}`}><Icon size={15} /></span>}
      </div>
      <p className="mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}<span className="ml-0.5 text-sm font-medium text-slate-400">{suffix}</span>
      </p>
      {hint && <p className="mt-1 text-[11px] text-slate-400 dark:text-white/35">{hint}</p>}
    </motion.div>
  );
}

export function ProgressBar({ value, color, height = 6, label }: { value: number; color?: string; height?: number; label?: string }) {
  return (
    <div>
      {label && <div className="mb-1.5 flex justify-between text-[11px]"><span className="text-slate-500 dark:text-white/45">{label}</span><span className="mono font-semibold text-slate-700 dark:text-white/70">{Math.round(value)}%</span></div>}
      <div className="w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]" style={{ height }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full" style={{ background: color ?? "rgb(var(--accent))" }} />
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 120, stroke = 9, color, children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200 dark:text-white/[0.08]" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? "rgb(var(--accent))"} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(100, value) / 100) }}
          transition={{ duration: 0.9, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "red" | "amber" | "blue" | "accent" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-white/50",
    green: "bg-emerald-500/12 text-emerald-500",
    red: "bg-rose-500/12 text-rose-400",
    amber: "bg-amber-500/12 text-amber-500",
    blue: "bg-blue-500/12 text-blue-400",
    accent: "bg-accent/12 text-accent",
  };
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="section-title">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-white/45">{description}</p>}
      </div>
      {action}
    </div>
  );
}
