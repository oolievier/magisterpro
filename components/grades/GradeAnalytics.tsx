"use client";

import { useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, Radar as RadarIcon, Medal, Flame, Target, Activity } from "lucide-react";
import { useApp } from "@/app/providers";
import { monthlyTrend, profileAverages, gradeRecords, formatGrade, subjectStats } from "@/lib/calculations/grades";
import { shortDate } from "@/lib/format";
import { StatCard, Pill } from "@/components/ui/Primitives";

const tooltipStyle = { background: "#111119", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, fontSize: 12 };

export function GradeAnalytics() {
  const { data } = useApp();
  const trend = useMemo(() => monthlyTrend(data.grades, data.subjects), [data.grades, data.subjects]);
  const profiles = useMemo(() => profileAverages(data.grades, data.subjects), [data.grades, data.subjects]);
  const records = useMemo(() => gradeRecords(data.grades, data.subjects), [data.grades, data.subjects]);
  const bars = useMemo(() => data.subjects
    .map((s) => ({ subject: s, stats: subjectStats(s.id, data.grades) }))
    .filter(({ stats }) => stats.count > 0 && Number.isFinite(stats.average))
    .map(({ subject: s, stats }) => ({ name: s.short, value: Number(stats.average.toFixed(2)), color: s.color }))
    .sort((a, b) => b.value - a.value), [data.subjects, data.grades]);

  return (
    <section className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5">
          <p className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white/80"><TrendingUp size={15} className="text-accent" /> Gemiddelde ontwikkeling dit schooljaar</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs><linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.35} /><stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-white/10" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatGrade(Number(v)), "Gemiddelde"]} />
                <Area type="monotone" dataKey="average" stroke="rgb(var(--accent))" strokeWidth={2.5} fill="url(#area-grad)" dot={{ r: 3 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-5">
          <p className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white/80"><RadarIcon size={15} className="text-accent" /> Profielvergelijking</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={profiles} outerRadius="72%">
                <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-white/10" />
                <PolarAngleAxis dataKey="profile" tick={{ fontSize: 11, fill: "#999" }} />
                <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatGrade(Number(v)), "Gemiddelde"]} />
                <Radar dataKey="average" stroke="rgb(var(--accent))" fill="rgb(var(--accent))" fillOpacity={0.28} strokeWidth={2.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <p className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white/80"><Activity size={15} className="text-accent" /> Vakken gerangschikt op gemiddelde</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-white/10" horizontal={false} />
              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} width={45} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,.04)" }} formatter={(v) => [formatGrade(Number(v)), "Gemiddelde"]} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>{bars.map((b, i) => <Cell key={i} fill={b.color} fillOpacity={0.85} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white/90"><Medal size={17} className="text-amber-400" /> Cijfer-Recordboek</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Hoogste cijfer ooit" value={records.highest ? formatGrade(records.highest.grade.value) : "—"} hint={records.highest ? `${records.highest.subject?.name} · ${records.highest.grade.label}` : "Geen data"} icon={Medal} tone="amber" />
          <StatCard label="Grootste comeback" value={records.comeback ? `+${formatGrade(records.comeback.delta)}` : "—"} hint={records.comeback ? `${data.subjects.find((s) => s.id === records.comeback!.subjectId)?.name}: ${formatGrade(records.comeback.from)} → ${formatGrade(records.comeback.to)}` : "Geen data"} icon={Flame} tone="rose" />
          <StatCard label="Meest constante vak" value={records.consistent ? data.subjects.find((s) => s.id === records.consistent!.subjectId)?.short ?? "—" : "—"} hint={records.consistent ? `Spreiding slechts ${formatGrade(records.consistent.spread)}` : "Geen data"} icon={Target} tone="emerald" />
          <StatCard label="Beste toetsdag" value={records.bestWeekday} hint="Gemiddeld hoogste cijfer" icon={TrendingUp} tone="blue" />
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><Pill tone="accent">Tip</Pill> Plan je lastige toetsen op je beste dag en gebruik de sandbox om te ontdekken waar je het meeste rendement hebt.</div>
    </section>
  );
}
