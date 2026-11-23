"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, AlertOctagon, Scale, Sigma, Lightbulb, CheckCircle2, XCircle, Info } from "lucide-react";
import { useApp } from "@/app/providers";
import { examCheck, formatGrade, deficitFor, compensationFor } from "@/lib/calculations/grades";
import { Pill, ProgressBar } from "@/components/ui/Primitives";
import Link from "next/link";

export function ExamChecker() {
  const { data, state } = useApp();
  const check = useMemo(() => examCheck(data.subjects, data.grades, state.connection.level), [data.subjects, data.grades, state.connection.level]);
  const tone = check.status === "op-koers" ? "emerald" : check.status === "aandacht" ? "amber" : "rose";

  return (
    <section className="space-y-4">
      <div className={`relative overflow-hidden rounded-2xl border p-6 ${
        check.status === "op-koers" ? "border-emerald-400/25 bg-emerald-400/[0.06]" :
        check.status === "aandacht" ? "border-amber-400/25 bg-amber-400/[0.06]" : "border-rose-400/25 bg-rose-400/[0.06]"
      }`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className={`rounded-2xl p-3 ${check.status === "op-koers" ? "bg-emerald-400/15 text-emerald-400" : check.status === "aandacht" ? "bg-amber-400/15 text-amber-400" : "bg-rose-400/15 text-rose-400"}`}>
              {check.status === "gevaar" ? <AlertOctagon size={26} /> : <ShieldCheck size={26} />}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Officiële slaag/zak-check · {state.connection.level.toUpperCase()}</p>
              <h2 className={`mt-1 text-2xl font-bold tracking-tight ${check.status === "op-koers" ? "text-emerald-500" : check.status === "aandacht" ? "text-amber-500" : "text-rose-400"}`}>{check.label}</h2>
              <p className="mt-1 max-w-xl text-xs text-slate-500 dark:text-white/50">{check.summary}</p>
            </div>
          </div>
          <div className="flex gap-5">
            <div className="text-center"><p className="mono text-2xl font-bold text-slate-900 dark:text-white">{formatGrade(check.averageRounded)}</p><p className="text-[10px] text-slate-400">gem. eindcijfer</p></div>
            <div className="text-center"><p className="mono text-2xl font-bold text-rose-400">{check.deficitPoints}</p><p className="text-[10px] text-slate-400">tekortpunten</p></div>
            <div className="text-center"><p className="mono text-2xl font-bold text-emerald-400">{check.compensationPoints}</p><p className="text-[10px] text-slate-400">compensatie</p></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-5">
          <p className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white/80"><ShieldCheck size={15} className="text-accent" /> Kernvakkenregeling</p>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-white/45">Nederlands, Engels en Wiskunde: maximaal één 5, geen 4 of lager.</p>
          <div className="space-y-2">
            {check.roundedGrades.filter((r) => r.core).map((r) => {
              const s = data.subjects.find((x) => x.id === r.subjectId)!;
              const ok = r.rounded >= 6 || (r.rounded === 5 && check.roundedGrades.filter((x) => x.core && x.rounded === 5).length === 1);
              return (
                <div key={r.subjectId} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-white/[0.08]">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-xs text-slate-700 dark:text-white/75">{s.name}</span>
                  <span className="mono text-[10px] text-slate-400">{formatGrade(r.raw)} →</span>
                  <span className={`mono text-lg font-bold ${r.rounded >= 6 ? "text-emerald-400" : r.rounded === 5 ? "text-amber-400" : "text-rose-400"}`}>{r.rounded}</span>
                  {ok ? <CheckCircle2 size={15} className="text-emerald-400" /> : <XCircle size={15} className="text-rose-400" />}
                </div>
              );
            })}
          </div>
          {check.coreIssues.length > 0 && <div className="mt-3 rounded-lg bg-rose-500/10 p-2.5 text-[11px] text-rose-400">{check.coreIssues.join(" ")}</div>}
          <Pill tone={check.coreOk ? "green" : "red"} >{check.coreOk ? "Regeling voldaan" : "Regeling geschonden"}</Pill>
        </div>

        <div className="panel p-5">
          <p className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white/80"><Scale size={15} className="text-accent" /> Tekorten & compensatie</p>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-1 rounded-xl bg-rose-500/10 p-3 text-center"><p className="mono text-xl font-bold text-rose-400">{check.deficitPoints}</p><p className="text-[10px] text-rose-400/70">tekort</p></div>
            <span className="text-slate-300">vs</span>
            <div className="flex-1 rounded-xl bg-emerald-500/10 p-3 text-center"><p className="mono text-xl font-bold text-emerald-400">{check.compensationPoints}</p><p className="text-[10px] text-emerald-400/70">compensatie</p></div>
          </div>
          <div className="space-y-2">
            <ProgressBar value={Math.min(100, (check.compensationPoints / Math.max(1, check.deficitPoints)) * 100)} color={check.balanceOk ? "#10b981" : "#f43f5e"} label="Balans" />
          </div>
          <div className="mt-4 space-y-1.5">
            {check.roundedGrades.map((r) => {
              const s = data.subjects.find((x) => x.id === r.subjectId)!;
              const def = deficitFor(r.rounded), comp = compensationFor(r.rounded);
              if (!def && !comp) return null;
              return (
                <div key={r.subjectId} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-white/50">{s.name}</span>
                  <span className={`mono font-semibold ${def ? "text-rose-400" : "text-emerald-400"}`}>{def ? `−${def}` : `+${comp}`}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400"><Info size={12} className="mt-0.5 shrink-0" /> 5 = 1 tekort, 4 = 2 tekorten. 7 = 1 compensatie, 8 = 2, 9+ = 3.</p>
        </div>

        <div className="panel p-5">
          <p className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white/80"><Lightbulb size={15} className="text-amber-400" /> Rendement-tips</p>
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]">
            <Sigma size={16} className="text-accent" />
            <div className="flex-1"><p className="text-[11px] text-slate-500 dark:text-white/45">Gemiddelde afgeronde eindcijfers</p><p className="mono text-sm font-bold text-slate-800 dark:text-white">{formatGrade(check.averageRounded)} / 6,0</p></div>
            <Pill tone={check.averageOk ? "green" : "red"}>{check.averageOk ? "voldaan" : "tekort"}</Pill>
          </div>
          {check.tips.length === 0 ? <p className="py-4 text-center text-xs text-slate-400">Geen directe aandachtspunten. Ga zo door!</p> : (
            <div className="space-y-2">
              {check.tips.map((tip, i) => {
                const s = data.subjects.find((x) => x.id === tip.subjectId)!;
                return (
                  <motion.div key={tip.subjectId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]">
                    <div className="mb-1 flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} /><span className="flex-1 text-xs font-bold text-slate-800 dark:text-white/85">{s.name}</span><Pill tone="accent">+{formatGrade(tip.gain)} rendement</Pill></div>
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-white/45">{tip.text}</p>
                  </motion.div>
                );
              })}
            </div>
          )}
          <Link href="/grades?tab=calculator" className="mt-4 block text-center text-[11px] font-semibold text-accent hover:underline">Bereken wat je moet halen →</Link>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-white/[0.08]"><p className="text-xs font-bold text-slate-700 dark:text-white/80">Alle eindcijfers (afgerond)</p></div>
        <div className="grid grid-cols-2 gap-px bg-slate-200 dark:bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-5">
          {check.roundedGrades.map((r) => {
            const s = data.subjects.find((x) => x.id === r.subjectId)!;
            return (
              <div key={r.subjectId} className="bg-white p-3 dark:bg-[#0d0d15]">
                <p className="truncate text-[10px] text-slate-400">{s.name}</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="mono text-lg font-bold text-slate-900 dark:text-white">{r.rounded}</span>
                  <span className="mono text-[10px] text-slate-400">({formatGrade(r.raw)})</span>
                </div>
                <div className="mt-1.5 flex gap-1"><span className={`h-1 flex-1 rounded-full ${r.rounded >= 6 ? "bg-emerald-400" : "bg-rose-400"}`} />{r.core && <span className="h-1 w-6 rounded-full bg-accent" />}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
