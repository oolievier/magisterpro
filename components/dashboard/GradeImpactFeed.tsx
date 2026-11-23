"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowUpRight, PartyPopper, ChevronRight, Sparkles } from "lucide-react";
import { useApp } from "@/app/providers";
import { gradeImpact, formatGrade, weightedAverage } from "@/lib/calculations/grades";
import { shortDate } from "@/lib/format";
import { Pill } from "@/components/ui/Primitives";
import { useState } from "react";

export function GradeImpactFeed() {
  const { data } = useApp();
  const [celebrated, setCelebrated] = useState<string[]>([]);
  const recent = [...data.grades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="section-title">Nieuwe cijfers & impact</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-white/45">Direct het effect op je vakgemiddelde</p>
        </div>
        <Link href="/grades" className="text-[11px] font-semibold text-accent hover:underline">Cijferstudio →</Link>
      </div>
      <div className="space-y-2">
        {recent.map((g) => {
          const subject = data.subjects.find((s) => s.id === g.subjectId);
          const previous = data.grades.filter((x) => x.subjectId === g.subjectId && x.id !== g.id && new Date(x.date) < new Date(g.date));
          const impact = gradeImpact(g, previous);
          const avg = weightedAverage([...previous, g]);
          const isParty = g.value >= 8 && !celebrated.includes(g.id);
          return (
            <motion.div key={g.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className="group relative flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-accent/30 dark:border-white/[0.07] dark:hover:bg-white/[0.03]">
              {isParty && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.span key={i} initial={{ opacity: 1, y: 0, x: 0 }} animate={{ opacity: 0, y: -45 - Math.random() * 30, x: (Math.random() - 0.5) * 90 }}
                      transition={{ duration: 1.2, delay: 0.15 + i * 0.04 }} onAnimationComplete={() => setCelebrated((p) => [...p, g.id])}
                      className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-sm" style={{ background: ["#6366f1", "#10b981", "#f59e0b", "#ec4899"][i % 4] }} />
                  ))}
                </div>
              )}
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: subject?.color ?? "#6366f1" }}>{subject?.code}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-white/90">{g.label}</p>
                  {g.isNew && <span className="new-badge">Nieuw</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">{subject?.name} · {shortDate(g.date)} · weging {g.weight}×</p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="mono text-lg font-bold text-slate-900 dark:text-white">{formatGrade(g.value)}</span>
                  {isParty && <PartyPopper size={15} className="text-amber-400" />}
                </div>
                <p className={`mono text-[11px] font-semibold ${impact >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {impact >= 0 ? <TrendingUp size={11} className="mr-0.5 inline" /> : <TrendingDown size={11} className="mr-0.5 inline" />}
                  {impact >= 0 ? "+" : ""}{formatGrade(impact)} <span className="font-normal text-slate-400">→ {formatGrade(avg)} gem.</span>
                </p>
              </div>
              <Link href={`/grades?subject=${g.subjectId}`} className="ml-1 text-slate-300 opacity-0 transition group-hover:opacity-100 dark:text-white/30"><ArrowUpRight size={16} /></Link>
            </motion.div>
          );
        })}
      </div>
      <Link href="/grades" className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 dark:bg-white/[0.03] dark:text-white/50 dark:hover:bg-white/[0.06]">
        <Sparkles size={13} /> Analyseer alle cijfers <ChevronRight size={13} />
      </Link>
    </section>
  );
}
