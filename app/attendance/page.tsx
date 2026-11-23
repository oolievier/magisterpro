"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ShieldCheck, HeartPulse, CalendarX2, Clock3, Ban, Trophy, MapPin, TrendingUp,
  Sparkles, PartyPopper, Activity, Award,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { StatCard, ProgressRing, Pill } from "@/components/ui/Primitives";
import { shortDate } from "@/lib/format";
import { formatGrade, weightedAverage, monthlyTrend } from "@/lib/calculations/grades";

const TYPE_LABELS: Record<string, string> = {
  ziek: "Ziek", geoorloofd: "Geoorloofd", ongeoorloofd: "Ongeoorloofd", "te-laat": "Te laat", uitval: "Lesuitval",
};
const TYPE_COLORS: Record<string, string> = {
  ziek: "#f43f5e", geoorloofd: "#10b981", ongeoorloofd: "#f59e0b", "te-laat": "#8b5cf6", uitval: "#06b6d4",
};

export default function AttendancePage() {
  const { data, state } = useApp();
  const [tab, setTab] = useState<"overview" | "wrapped">("overview");

  const counts = useMemo(() => {
    const c: Record<string, number> = { ziek: 0, geoorloofd: 0, ongeoorloofd: 0, "te-laat": 0, uitval: 0 };
    data.absences.forEach((a) => { c[a.type] += 1; });
    return c;
  }, [data.absences]);
  const totalEvents = Object.values(counts).reduce((s, n) => s + n, 0);
  const attended = data.stats.lessonsAttended;
  const missed = data.absences.filter((a) => a.type !== "uitval").reduce((s, a) => s + a.durationMinutes / 55, 0);
  const percentage = attended / (attended + missed) * 100;
  const pie = Object.entries(counts).filter(([, n]) => n > 0).map(([name, value]) => ({ name: TYPE_LABELS[name], value, color: TYPE_COLORS[name] }));
  const trend = useMemo(() => monthlyTrend(data.grades, data.subjects), [data.grades, data.subjects]);
  const overall = weightedAverage(data.grades);
  const favorite = data.subjects.find((s) => s.id === data.stats.mostCancelledSubjectId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="mb-1 text-xs font-medium text-accent">Aanwezigheid & statistieken</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Aanwezigheid & Jaaroverzicht</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Van verzuim tot je persoonlijke schooljaar-wrapped.</p></div>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <button onClick={() => setTab("overview")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === "overview" ? "bg-accent/12 text-accent" : "text-slate-500 dark:text-white/45"}`}>Aanwezigheid</button>
          <button onClick={() => setTab("wrapped")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === "wrapped" ? "bg-accent/12 text-accent" : "text-slate-500 dark:text-white/45"}`}><PartyPopper size={13} /> Wrapped</button>
        </div>
      </div>

      {tab === "overview" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <div className="panel flex flex-col items-center p-6">
              <p className="mb-5 text-xs font-bold uppercase tracking-wider text-slate-400">Aanwezigheidspercentage</p>
              <ProgressRing value={percentage} size={180} stroke={14} color="#10b981">
                <span className="mono text-4xl font-black text-slate-900 dark:text-white">{percentage.toFixed(1)}</span>
                <span className="text-xs text-slate-400">procent</span>
              </ProgressRing>
              <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500 dark:text-white/45">{attended} lessen gevolgd · {Math.round(missed)} lessen gemist</p>
              <Pill tone="green"><ShieldCheck size={11} /> Ruim voldoende</Pill>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Gevolgde lessen" value={attended} hint="dit schooljaar" icon={Activity} />
              <StatCard label="Uitgevallen uren" value={data.stats.lessonsCancelled} hint="docent of rooster" icon={CalendarX2} tone="blue" />
              <StatCard label="Ziek gemeld" value={counts.ziek} hint="geoorloofd afwezig" icon={HeartPulse} tone="rose" />
              <StatCard label="Geoorloofd verzuim" value={counts.geoorloofd} hint="tandarts, topsport" icon={ShieldCheck} tone="emerald" />
              <StatCard label="Ongeoorloofd" value={counts.ongeoorloofd} hint="aandachtspunt" icon={Ban} tone="amber" />
              <StatCard label="Te-laat meldingen" value={counts["te-laat"]} hint="registraties" icon={Clock3} tone="blue" />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <p className="mb-4 text-xs font-bold text-slate-800 dark:text-white/85">Verzuim naar categorie</p>
              <div className="h-60"><ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                  {pie.map((p) => <Cell key={p.name} fill={p.color} />)}</Pie>
                  <Tooltip contentStyle={{ background: "#111119", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, fontSize: 12 }} />
                </PieChart></ResponsiveContainer></div>
              <div className="flex flex-wrap justify-center gap-3">{pie.map((p) => <span key={p.name} className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-white/50"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name} <strong className="mono text-slate-700 dark:text-white/80">{p.value}</strong></span>)}</div>
            </div>
            <div className="panel p-5">
              <p className="mb-4 text-xs font-bold text-slate-800 dark:text-white/85">Cijferontwikkeling per maand</p>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-white/10" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} width={22} />
                  <Tooltip contentStyle={{ background: "#111119", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                  <Bar dataKey="average" fill="rgb(var(--accent))" radius={[5, 5, 0, 0]} fillOpacity={0.8} /></BarChart>
              </ResponsiveContainer></div>
            </div>
          </div>

          <section className="panel overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-white/[0.08]"><p className="text-xs font-bold text-slate-800 dark:text-white/85">Verzuimlogboek</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 dark:bg-white/[0.02]"><tr><th className="px-5 py-2.5">Datum</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Reden</th><th className="px-3 py-2.5">Vak</th><th className="px-3 py-2.5 text-right">Duur</th><th className="px-5 py-2.5 text-right">Status</th></tr></thead>
              <tbody>{[...data.absences].sort((a, b) => b.date.localeCompare(a.date)).map((a) => (
                <tr key={a.id} className="border-t border-slate-100 dark:border-white/[0.05]">
                  <td className="mono px-5 py-2.5 text-slate-500 dark:text-white/50">{shortDate(a.date)}</td>
                  <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[a.type] }} />{TYPE_LABELS[a.type]}</span></td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-white/70">{a.reason}</td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-white/50">{data.subjects.find((s) => s.id === a.subjectId)?.short ?? "—"}</td>
                  <td className="mono px-3 py-2.5 text-right text-slate-500 dark:text-white/50">{a.durationMinutes} min</td>
                  <td className="px-5 py-2.5 text-right"><Pill tone={a.approved ? "green" : "amber"}>{a.approved ? "Goedgekeurd" : "Openstaand"}</Pill></td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        </>
      ) : (
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/20 via-fuchsia-500/10 to-cyan-500/10 p-8 sm:p-12">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-accent"><Sparkles size={14} /> Schooljaar Wrapped</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">Wat een jaar, {state.connection.name.split(" ")[0]}.</h2>
              <p className="mt-3 max-w-xl text-sm text-slate-600 dark:text-white/60">Je hebt {data.stats.lessonsAttended} lessen overleefd, {data.grades.length} cijfers verzameld en je staat gemiddeld op een {formatGrade(overall)}. Hier is je jaar in cijfers.</p>
            </div>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Lessen overleefd" value={data.stats.lessonsAttended} hint="en ze bijna allemaal gehaald" icon={Activity} delay={0.02} />
            <StatCard label="Favoriete lokaal" value={data.stats.favoriteLocation} hint="je tweede thuis" icon={MapPin} tone="blue" delay={0.05} />
            <StatCard label="Vaakst uitgevallen" value={favorite?.short ?? "—"} hint={favorite?.name ?? ""} icon={CalendarX2} tone="amber" delay={0.08} />
            <StatCard label="Beste toetsdag" value={data.stats.bestWeekday} hint="gemiddeld je hoogste cijfer" icon={Trophy} tone="emerald" delay={0.11} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="panel p-6">
              <Award size={22} className="mb-4 text-amber-400" />
              <p className="mono text-4xl font-black text-slate-900 dark:text-white">{formatGrade(overall)}</p>
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-white/65">Gemiddeld cijfer over het hele jaar</p>
              <p className="mt-3 text-[11px] text-slate-400">Dat is {overall >= 6 ? "boven" : "onder"} de grens van een 6,0. Je zit {state.connection.level.toUpperCase()}.</p>
            </div>
            <div className="panel p-6">
              <TrendingUp size={22} className="mb-4 text-emerald-400" />
              <p className="mono text-4xl font-black text-slate-900 dark:text-white">+{formatGrade(Math.max(0, (trend[trend.length - 1]?.average ?? 0) - (trend[0]?.average ?? 0)))}</p>
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-white/65">Gemiddelde cijferstijging</p>
              <p className="mt-3 text-[11px] text-slate-400">Van {formatGrade(trend[0]?.average ?? 0)} in {trend[0]?.month} naar {formatGrade(trend[trend.length - 1]?.average ?? 0)} in {trend[trend.length - 1]?.month}.</p>
            </div>
            <div className="panel p-6">
              <PartyPopper size={22} className="mb-4 text-rose-400" />
              <p className="mono text-4xl font-black text-slate-900 dark:text-white">{data.grades.filter((g) => g.value >= 8).length}</p>
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-white/65">Cijfers van 8 of hoger</p>
              <p className="mt-3 text-[11px] text-slate-400">Elk daarvan is een bevestiging dat je harde werk loont.</p>
            </div>
          </div>
          <p className="text-center text-[11px] text-slate-400">Deel je wrapped met vrienden — MagisterPro houdt je data natuurlijk gewoon lokaal.</p>
        </div>
      )}
    </div>
  );
}
