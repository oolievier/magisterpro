"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, RotateCcw, TrendingUp, LockKeyhole, CalendarClock, Award, ArrowRight, Filter } from "lucide-react";
import { useApp } from "@/app/providers";
import { subjectStats, weightedAverage, examCheck, formatGrade, round2 } from "@/lib/calculations/grades";
import { ProgressBar, Pill, StatCard } from "@/components/ui/Primitives";
import { shortDate } from "@/lib/format";
import Link from "next/link";

export default function PtaPage() {
  const { data, state } = useApp();
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);

  const columns = useMemo(() => data.ptaColumns.filter((c) => filter === "all" || c.subjectId === filter)
    .sort((a, b) => a.date.localeCompare(b.date)), [data.ptaColumns, filter]);

  const ptaStats = data.subjects.map((s) => ({ subject: s, stats: subjectStats(s.id, data.grades, data.ptaColumns) }));
  const overallProgress = data.ptaColumns.length ? data.ptaColumns.filter((c) => c.gradeId).length / data.ptaColumns.length * 100 : 0;
  const lockedWeight = data.ptaColumns.filter((c) => c.gradeId && !c.retakeable).reduce((s, c) => s + c.weight, 0);
  const check = examCheck(data.subjects, data.grades, state.connection.level);

  /** Herkansingsadviseur: bereken impact van een 8 op elk herkansbaar, laag PTA-onderdeel. */
  const retakeAdvice = useMemo(() => data.ptaColumns
    .filter((c) => c.retakeable && c.gradeId)
    .map((c) => {
      const grade = data.grades.find((g) => g.id === c.gradeId)!;
      if (!grade || grade.value >= 7) return null;
      const base = weightedAverage(data.grades.filter((g) => g.subjectId === c.subjectId));
      const improved = weightedAverage(data.grades.map((g) => g.id === grade.id ? { ...g, value: 8 } : g).filter((g) => g.subjectId === c.subjectId));
      return {
        column: c, grade, before: base, after: improved,
        gain: round2(improved - base),
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x) && x!.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 4), [data.ptaColumns, data.grades]);

  const visibleColumns = showAll ? columns : columns.slice(0, 20);

  return (
    <div className="space-y-6">
      <div><p className="mb-1 text-xs font-medium text-accent">PTA & Examenkluis</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Voortgang van je schoolexamen</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Elke PTA-kolom, elke weging, elk herkansingspunt.</p></div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="SE voortgang" value={Math.round(overallProgress)} suffix="%" hint={`${data.ptaColumns.filter((c) => c.gradeId).length} van ${data.ptaColumns.length} onderdelen`} icon={ClipboardCheck} />
        <StatCard label="Vaststaand gewicht" value={lockedWeight} suffix="×" hint="niet-herkansbaar behaald" icon={LockKeyhole} tone="blue" />
        <StatCard label="Herkansingen" value={data.ptaColumns.filter((c) => c.retakeable && c.gradeId && (data.grades.find((g) => g.id === c.gradeId)?.value ?? 6) < 6).length} hint="onderdelen onder een 6" icon={RotateCcw} tone="amber" />
        <StatCard label="Slaagstatus" value={check.label} hint={`${check.compensationPoints} compensatiepunten`} icon={Award} tone={check.status === "op-koers" ? "emerald" : check.status === "gevaar" ? "rose" : "amber"} />
      </div>

      <section>
        <h2 className="section-title mb-3">PTA-voortgang per vak</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ptaStats.map(({ subject, stats }, i) => {
            const cols = data.ptaColumns.filter((c) => c.subjectId === subject.id);
            const done = cols.filter((c) => c.gradeId).length;
            return (
              <motion.div key={subject.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="panel p-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ background: subject.color }}>{subject.code}</span>
                  <p className="flex-1 truncate text-xs font-bold text-slate-800 dark:text-white/90">{subject.name}</p>
                  <span className="mono text-xs font-bold text-slate-700 dark:text-white/70">{done}/{cols.length}</span>
                </div>
                <ProgressBar value={stats.ptaProgress} color={subject.color} label={`${Math.round(stats.ptaProgress)}% van SE afgerond`} />
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                  <span>SE-gemiddelde <strong className="mono text-slate-600 dark:text-white/70">{formatGrade(stats.seAverage)}</strong></span>
                  <span>{cols.filter((c) => !c.gradeId && new Date(c.date) > new Date()).length} gepland</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-2"><ClipboardCheck size={16} className="text-accent" /><h2 className="section-title">PTA-dossier</h2></div>
          <div className="ml-auto flex items-center gap-2"><Filter size={14} className="text-slate-400" />
            <select className="input !w-auto !py-1.5 !text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Alle vakken</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 dark:bg-white/[0.02] dark:text-white/30">
              <tr><th className="px-5 py-3 font-semibold">Code</th><th className="px-3 py-3 font-semibold">Onderdeel</th><th className="px-3 py-3 font-semibold">Vak</th><th className="px-3 py-3 text-right font-semibold">Weging</th><th className="px-3 py-3 font-semibold">Herkansbaar</th><th className="px-3 py-3 font-semibold">Datum</th><th className="px-5 py-3 text-right font-semibold">Cijfer</th></tr>
            </thead>
            <tbody>
              {visibleColumns.map((c) => {
                const subject = data.subjects.find((s) => s.id === c.subjectId)!;
                const grade = data.grades.find((g) => g.id === c.gradeId);
                const future = new Date(c.date) > new Date();
                return (
                  <tr key={c.id} className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-white/[0.05] dark:hover:bg-white/[0.02]">
                    <td className="mono px-5 py-3 text-[10px] text-slate-400">{c.code}</td>
                    <td className="max-w-[240px] truncate px-3 py-3 text-slate-700 dark:text-white/80">{c.description}</td>
                    <td className="px-3 py-3"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: subject.color }} />{subject.short}</span></td>
                    <td className="mono px-3 py-3 text-right text-slate-500 dark:text-white/50">{c.weight}×</td>
                    <td className="px-3 py-3"><Pill tone={c.retakeable ? "green" : "neutral"}>{c.retakeable ? "Ja" : "Nee"}</Pill></td>
                    <td className="mono px-3 py-3 text-slate-500 dark:text-white/50">{future ? <span className="flex items-center gap-1 text-blue-400"><CalendarClock size={11} />{shortDate(c.date)}</span> : shortDate(c.date)}</td>
                    <td className="mono px-5 py-3 text-right">{grade ? <span className={`text-sm font-bold ${grade.value >= 6 ? "text-emerald-400" : "text-rose-400"}`}>{formatGrade(grade.value)}</span> : <span className="text-slate-300 dark:text-white/20">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {columns.length > 20 && <button onClick={() => setShowAll(!showAll)} className="w-full border-t border-slate-200 py-3 text-[11px] font-semibold text-accent dark:border-white/[0.08]">{showAll ? "Toon minder" : `Toon alle ${columns.length} kolommen`}</button>}
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2.5"><span className="rounded-xl bg-amber-400/12 p-2 text-amber-400"><RotateCcw size={18} /></span>
          <div><h2 className="section-title">Herkansings-Adviseur</h2><p className="text-xs text-slate-500 dark:text-white/45">Gesorteerd op rendement bij een 8 in de herkansing</p></div></div>
        {retakeAdvice.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">Geen herkansingen met direct positieve impact gevonden.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {retakeAdvice.map((a, i) => {
              const subject = data.subjects.find((s) => s.id === a.column.subjectId)!;
              return (
                <div key={a.column.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/[0.08]">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: subject.color }} /><p className="text-xs font-bold text-slate-800 dark:text-white/90">{a.column.description}</p></div>
                      <p className="mt-1 text-[10px] text-slate-400">{subject.name} · {a.column.code} · weging {a.column.weight}×</p></div>
                    {i === 0 && <Pill tone="accent">Grootste impact</Pill>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="mono text-lg font-bold text-rose-400">{formatGrade(a.grade.value)}</span>
                    <ArrowRight size={14} className="text-slate-300" />
                    <span className="mono text-lg font-bold text-emerald-400">8,0</span>
                    <span className="ml-auto flex items-center gap-1 text-xs font-bold text-accent"><TrendingUp size={13} />+{formatGrade(a.gain)} vakgemiddelde</span>
                  </div>
                  <div className="mt-3"><ProgressBar value={Math.min(100, a.after * 10)} color={subject.color} height={5} label={`Vakgemiddelde ${formatGrade(a.before)} → ${formatGrade(a.after)}`} /></div>
                </div>
              );
            })}
          </div>
        )}
        <Link href="/grades?tab=calculator" className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-accent"><Award size={13} /> Bereken wat je moet halen in de cijferstudio <ArrowRight size={12} /></Link>
      </section>
    </div>
  );
}
