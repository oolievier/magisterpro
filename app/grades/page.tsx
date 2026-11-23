"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Calculator, FlaskConical, ShieldCheck, BarChart3, LayoutGrid, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { useApp } from "@/app/providers";
import { subjectStats, examCheck, formatGrade } from "@/lib/calculations/grades";
import { SubjectDetailModal } from "@/components/grades/SubjectDetailModal";
import { GradeCalculator } from "@/components/grades/GradeCalculator";
import { SandboxSimulator } from "@/components/grades/SandboxSimulator";
import { ExamChecker } from "@/components/grades/ExamChecker";
import { GradeAnalytics } from "@/components/grades/GradeAnalytics";
import { Pill, ProgressBar } from "@/components/ui/Primitives";

const TABS = [
  { id: "overview", label: "Vakoverzicht", icon: LayoutGrid },
  { id: "calculator", label: "Wat moet ik halen?", icon: Calculator },
  { id: "sandbox", label: "Wat als… sandbox", icon: FlaskConical },
  { id: "slaagzak", label: "Slaag/Zak-check", icon: ShieldCheck },
  { id: "analytics", label: "Analytics & records", icon: BarChart3 },
];

function GradesView() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, state, addFakeGrade } = useApp();
  const tabParam = params.get("tab");
  const [tab, setTab] = useState(tabParam ?? "overview");
  const [detailId, setDetailId] = useState<string | null>(params.get("subject"));
  const [calcSubject, setCalcSubject] = useState(params.get("subject") ?? data.subjects[0].id);

  useEffect(() => {
    if (params.get("tab")) setTab(params.get("tab")!);
    if (params.get("calc") === "1") setTab("calculator");
    if (params.get("subject")) {
      setDetailId(params.get("subject"));
      setCalcSubject(params.get("subject")!);
    }
  }, [params]);

  const selectTab = (id: string) => {
    setTab(id);
    router.replace(`/grades${id === "overview" ? "" : `?tab=${id}`}`, { scroll: false });
  };
  const check = useMemo(() => examCheck(data.subjects, data.grades, state.connection.level), [data.subjects, data.grades, state.connection.level]);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-medium text-accent">Cijferstudio Pro</p>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Cijferstudio & Slaag-simulator</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Elk cijfer, elke weging, elk scenario — tot op de komma.</p></div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10">
            <span className="text-[11px] text-slate-400">Slaagstatus</span><Pill tone={check.status === "op-koers" ? "green" : check.status === "aandacht" ? "amber" : "red"}>{check.label}</Pill>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.02]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => selectTab(t.id)} className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${tab === t.id ? "text-accent" : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80"}`}>
              {tab === t.id && <motion.span layoutId="grade-tab" className="absolute inset-0 rounded-lg bg-accent/10" />}
              <Icon size={14} className="relative" /><span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.subjects.map((subject, i) => {
            const stats = subjectStats(subject.id, data.grades, data.ptaColumns);
            const delta = stats.trend.length > 1 ? stats.trend[stats.trend.length - 1].value - stats.trend[0].value : 0;
            return (
              <motion.button key={subject.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035 }} onClick={() => setDetailId(subject.id)}
                className="panel group p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/30">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: subject.color }}>{subject.code}</span>
                    <div><p className="text-sm font-bold text-slate-900 dark:text-white">{subject.name}</p><p className="text-[10px] text-slate-400">{stats.count} cijfers · {subject.profile === "beta" ? "Bèta" : subject.profile === "talen" ? "Talen" : subject.profile === "maatschappij" ? "Maatschappij" : "Kern"}</p></div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-accent dark:text-white/20" />
                </div>
                <div className="flex items-end justify-between">
                  <div><p className="mono text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{formatGrade(stats.average)}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">afgerond: <span className="mono font-bold text-slate-600 dark:text-white/70">{formatGrade(stats.rounded)}</span></p></div>
                  <span className={`mono flex items-center gap-1 text-xs font-bold ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{delta >= 0 ? "+" : ""}{formatGrade(delta)}
                  </span>
                </div>
                <div className="mt-4"><ProgressBar value={stats.ptaProgress} color={subject.color} height={5} label="Schoolexamen afgerond" /></div>
                {stats.nextRoundGap > 0.001 && <p className="mt-3 text-[10px] text-amber-500">Nog {stats.nextRoundGap.toFixed(2)} voor afronding naar {Math.round(Math.ceil(stats.average * 2) / 2)}</p>}
              </motion.button>
            );
          })}
        </div>
      )}
      {tab === "calculator" && <GradeCalculator subjectId={calcSubject} onSubjectChange={setCalcSubject} onAddGrade={(value, weight) => {
        addFakeGrade({
          id: "", subjectId: calcSubject, value, weight, date: new Date().toISOString(),
          label: "Berekende toets", type: "PTA", fake: true,
        });
      }} />}
      {tab === "sandbox" && <SandboxSimulator />}
      {tab === "slaagzak" && <ExamChecker />}
      {tab === "analytics" && <GradeAnalytics />}

      <SubjectDetailModal subjectId={detailId} onClose={() => { setDetailId(null); if (params.get("subject")) router.replace("/grades", { scroll: false }); }} />
    </div>
  );
}

export default function GradesPage() {
  return <Suspense fallback={<div className="py-20 text-center text-sm text-slate-400">Cijferstudio laden…</div>}><GradesView /></Suspense>;
}
