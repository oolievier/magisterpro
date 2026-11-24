"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, GraduationCap, CalendarRange, Flame, Target, Sparkles, ShieldCheck, Timer, Coffee } from "lucide-react";
import { useApp } from "@/app/providers";
import { LiveLessonTracker } from "@/components/dashboard/LiveLessonTracker";
import { ActionRadar } from "@/components/dashboard/ActionRadar";
import { GradeImpactFeed } from "@/components/dashboard/GradeImpactFeed";
import { TodayChecklist } from "@/components/dashboard/TodayChecklist";
import { StatCard, Pill, ProgressBar } from "@/components/ui/Primitives";
import { examCheck, weightedAverage, formatGrade } from "@/lib/calculations/grades";
import { findFreeGaps, suggestForGap, minutesLeft } from "@/lib/calculations/planner";
import { hoursUntil, timeLabel } from "@/lib/format";

export default function DashboardPage() {
  const { data, now, state, appointments } = useApp();
  const check = examCheck(data.subjects, data.grades, state.connection.level);
  const overall = weightedAverage(data.grades);
  const weekTraffic = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - now.getDay() + (i + 6) % 7 + ((i + 6) % 7 === 0 ? -7 : 0));
    const iso = d.toISOString().slice(0, 10);
    const appts = appointments.filter((a) => a.start.slice(0, 10) === iso && !a.cancelled);
    return { iso, label: d.toLocaleDateString("nl-NL", { weekday: "short" }).replace(".", ""), count: appts.length, end: appts.length ? appts[appts.length - 1].end : null };
  });
  const gaps = findFreeGaps(appointments.filter((a) => a.start.slice(0, 10) === now.toISOString().slice(0, 10)));
  const suggestion = gaps[0] ? suggestForGap(gaps[0], data.homework, data.grades, data.subjects, state.connection.level) : null;
  const studyMinutes = state.focusSessions.reduce((s, f) => s + f.minutes, 0);
  const greet = now.getHours() < 12 ? "Goedemorgen" : now.getHours() < 18 ? "Goedemiddag" : "Goedenavond";

  return (
    <div className="space-y-7">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-medium text-accent"><Sparkles size={13} /> {greet}, {state.connection.name.split(" ")[0]}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Command Center</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Alles wat er vandaag toe doet — in één oogopslag.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/grades" className="btn-secondary"><GraduationCap size={15} /> Cijferstudio</Link>
          <Link href="/pta" className="btn-primary"><ShieldCheck size={15} /> Slaagcheck <ArrowRight size={14} /></Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Algemeen gemiddelde" value={formatGrade(overall)} hint="Gewogen over alle toetsen" icon={GraduationCap} delay={0.02} />
        <StatCard label="Slaagstatus" value={check.label} hint={`${check.deficitPoints} tekort · ${check.compensationPoints} compensatie`} icon={ShieldCheck}
          tone={check.status === "op-koers" ? "emerald" : check.status === "aandacht" ? "amber" : "rose"} delay={0.05} />
        <StatCard label="Studie-XP" value={`${studyMinutes}`} suffix="min" hint={`${Math.floor(studyMinutes / 120) + 1} level · ${new Set(state.focusSessions.map((f) => f.completedAt.slice(0, 10))).size} dagen streak`} icon={Flame} tone="amber" delay={0.08} />
        <StatCard label="Eerstvolgende les" value={appointments.find((a) => new Date(a.start) > now) ? timeLabel(appointments.find((a) => new Date(a.start) > now)!.start) : "—"} hint={`${appointments.filter((a) => a.start.slice(0, 10) === now.toISOString().slice(0, 10)).length} lessen vandaag`} icon={CalendarRange} tone="blue" delay={0.11} />
      </div>

      <LiveLessonTracker />
      <ActionRadar />

      {suggestion && gaps[0] && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel flex flex-col gap-4 border-accent/20 bg-accent/[0.04] p-5 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><Coffee size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2"><p className="text-xs font-bold uppercase tracking-wider text-accent">Tussenuur-optimizer</p><Pill tone="accent">{gaps[0].minutes} min vrij</Pill></div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{suggestion.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-white/50">{suggestion.reason}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/schedule" className="btn-secondary">Bekijk rooster</Link>
            <button onClick={() => window.dispatchEvent(new CustomEvent("magisterpro:focus", { detail: { subjectId: suggestion.subjectId } }))} className="btn-primary"><Timer size={15} /> Start focus</button>
          </div>
        </motion.div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <GradeImpactFeed />
        <div className="space-y-5">
          <TodayChecklist />
          <section className="panel p-5">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Deze week</h2><p className="text-xs text-slate-500 dark:text-white/45">Lessendichtheid per dag</p></div><Link href="/schedule" className="text-[11px] font-semibold text-accent">Rooster →</Link></div>
            <div className="flex items-end justify-between gap-1.5">
              {weekTraffic.map((d, i) => (
                <Link key={d.iso + i} href="/schedule" className="group flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-20 w-full items-end justify-center rounded-lg bg-slate-100 dark:bg-white/[0.04]">
                    <motion.div initial={{ height: 0 }} animate={{ height: `${Math.min(100, d.count * 12)}%` }} transition={{ delay: i * 0.04 }}
                      className={`w-2/3 rounded-md transition group-hover:brightness-110 ${i === (new Date().getDay() + 6) % 7 ? "bg-accent" : "bg-accent/35"}`} />
                  </div>
                  <span className="mono text-[10px] font-bold text-slate-500 dark:text-white/50">{d.count}</span>
                  <span className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30">{d.label}</span>
                </Link>
              ))}
            </div>
            <div className="divider my-4" />
            <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-white/45">Gemiddelde op koers</span><span className="mono font-bold text-emerald-400">{check.label}</span></div>
            <div className="mt-2"><ProgressBar value={Math.min(100, overall * 10)} color={overall >= 6 ? "#10b981" : "#f43f5e"} /></div>
            <Link href="/grades" className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-accent"><Target size={13} /> Bekijk slaag/zak-simulator <ArrowRight size={12} /></Link>
          </section>
        </div>
      </div>
    </div>
  );
}
