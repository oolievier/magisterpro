"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { TrendingUp, Activity, ClipboardList, Trophy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Pill, ProgressBar, StatCard } from "@/components/ui/Primitives";
import { subjectStats, formatGrade, weightedAverage } from "@/lib/calculations/grades";
import { shortDate } from "@/lib/format";
import { useApp } from "@/app/providers";

export function SubjectDetailModal({ subjectId, onClose }: { subjectId: string | null; onClose: () => void }) {
  const { data } = useApp();
  const subject = data.subjects.find((s) => s.id === subjectId);
  const stats = useMemo(() => subject ? subjectStats(subject.id, data.grades, data.ptaColumns) : null, [subject, data.grades, data.ptaColumns]);
  if (!subject || !stats) return null;

  const grades = data.grades.filter((g) => g.subjectId === subject.id).sort((a, b) => b.date.localeCompare(a.date));
  const distribution = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
    n: String(n), count: grades.filter((g) => Math.round(g.value) === n).length,
  }));

  return (
    <Modal open={Boolean(subjectId)} onClose={onClose} title={`${subject.name} — cijferdossier`} subtitle={subject.description} wide>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gemiddelde" value={formatGrade(stats.average)} hint={`${stats.count} cijfers · ${stats.totalWeight}× weging`} />
        <StatCard label="Schoolexamen" value={formatGrade(stats.seAverage)} tone="blue" hint="PTA + REP" />
        <StatCard label="Voortgang" value={formatGrade(stats.progressAverage)} tone="emerald" hint="SO + opdrachten" />
        <StatCard label="PTA afgerond" value={Math.round(stats.ptaProgress)} suffix="%" tone="amber" hint="van het schoolexamen" />
      </div>

      {stats.nextRoundGap > 0.001 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-xs text-amber-600 dark:text-amber-300">
          <Trophy size={15} className="mt-0.5 shrink-0" />
          <span>Nog <strong className="mono">{stats.nextRoundGap.toFixed(2)}</strong> tekort voor een {Math.ceil(stats.average * 2) / 2} — dat wordt op je rapport afgerond tot een <strong className="mono">{Math.round(Math.ceil(stats.average * 2) / 2)}</strong>!</span>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="panel p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white/80"><TrendingUp size={15} className="text-accent" /> Trendlijn van je gemiddelde</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-white/10" />
                <XAxis dataKey="date" tickFormatter={(v: string) => shortDate(v)} tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={{ background: "#111119", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(v) => shortDate(String(v))} formatter={(v) => [formatGrade(Number(v)), "Gemiddelde"]} />
                <Line type="monotone" dataKey="value" stroke={subject.color} strokeWidth={2.5} dot={{ r: 3, fill: subject.color }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white/80"><Activity size={15} className="text-accent" /> Distributie van je cijfers</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-white/10" vertical={false} />
                <XAxis dataKey="n" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} width={22} />
                <Tooltip contentStyle={{ background: "#111119", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>{distribution.map((d, i) => <Cell key={i} fill={Number(d.n) >= 6 ? subject.color : "#f43f5e"} fillOpacity={Number(d.n) >= 6 ? 0.85 : 0.55} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-5 panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/[0.08]">
          <ClipboardList size={15} className="text-accent" /><p className="text-xs font-bold text-slate-700 dark:text-white/80">Alle cijfers</p>
          <span className="mono ml-auto text-[10px] text-slate-400">spreiding {stats.spread.toFixed(1)}</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 dark:bg-[#14141e] dark:text-white/30">
              <tr><th className="px-4 py-2 font-semibold">Datum</th><th className="px-3 py-2 font-semibold">Omschrijving</th><th className="px-3 py-2 font-semibold">Type</th><th className="px-3 py-2 text-right font-semibold">Weging</th><th className="px-4 py-2 text-right font-semibold">Cijfer</th></tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.id} className="border-t border-slate-100 dark:border-white/[0.05]">
                  <td className="mono whitespace-nowrap px-4 py-2.5 text-slate-500 dark:text-white/45">{shortDate(g.date)}</td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-white/80">{g.label}{g.isNew && <span className="new-badge ml-2">Nieuw</span>}</td>
                  <td className="px-3 py-2.5"><Pill tone={g.type === "PTA" ? "accent" : g.type === "REP" ? "blue" : "neutral"}>{g.type}</Pill></td>
                  <td className="mono px-3 py-2.5 text-right text-slate-400">{g.weight}×</td>
                  <td className={`mono px-4 py-2.5 text-right text-sm font-bold ${g.value >= 6 ? "text-emerald-400" : "text-rose-400"}`}>{formatGrade(g.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4"><ProgressBar value={stats.ptaProgress} label="Voortgang schoolexamen" color={subject.color} /></div>
    </Modal>
  );
}
