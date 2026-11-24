"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, Plus, RotateCcw, Trash2, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { useApp } from "@/app/providers";
import { weightedAverage, examCheck, formatGrade, round2 } from "@/lib/calculations/grades";
import { Pill } from "@/components/ui/Primitives";
import { toast } from "@/components/ui/Toaster";

export function SandboxSimulator() {
  const { data, state, addFakeGrade, removeFakeGrade, clearFakeGrades } = useApp();
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id ?? "");
  const [value, setValue] = useState(7);
  const [weight, setWeight] = useState(2);
  const [label, setLabel] = useState("Fictieve toets");

  const realCheck = useMemo(() => examCheck(data.subjects, data.grades.filter((g) => !g.fake), state.connection.level), [data.subjects, data.grades, state.connection.level]);
  const simCheck = useMemo(() => examCheck(data.subjects, data.grades, state.connection.level), [data.subjects, data.grades, state.connection.level]);
  const fakes = state.fakeGrades;
  const realAvg = weightedAverage(data.grades.filter((g) => !g.fake));
  const simAvg = weightedAverage(data.grades);

  const deltas = data.subjects.map((s) => {
    const real = weightedAverage(data.grades.filter((g) => g.subjectId === s.id && !g.fake));
    const sim = weightedAverage(data.grades.filter((g) => g.subjectId === s.id));
    return { subject: s, real, sim, delta: round2(sim - real) };
  }).filter((d) => Math.abs(d.delta) > 0.001);

  return (
    <section className="panel p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-accent/12 p-2 text-accent"><FlaskConical size={18} /></span>
          <div><h2 className="section-title">Multi-vak “Wat als…” sandbox</h2><p className="text-xs text-slate-500 dark:text-white/45">Voer meerdere fictieve toetsen tegelijk in en zie direct het effect</p></div>
        </div>
        {fakes.length > 0 && <button onClick={() => { clearFakeGrades(); toast("Sandbox gereset", "info", "Je echte cijfers zijn terug."); }} className="btn-secondary"><RotateCcw size={14} /> Reset sandbox</button>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Omschrijving</label><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bijv. PTA Herkansing" /></div>
            <div><label className="label">Vak</label><select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="label">Weging</label><select className="input mono" value={weight} onChange={(e) => setWeight(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>{w}×</option>)}</select></div>
            <div className="col-span-2">
              <div className="mb-1.5 flex justify-between"><label className="label !mb-0">Verwacht cijfer</label><span className="mono text-sm font-bold text-accent">{formatGrade(value)}</span></div>
              <input type="range" min={1} max={10} step={0.1} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" />
            </div>
          </div>
          <button onClick={() => {
            const subject = data.subjects.find((s) => s.id === subjectId)!;
            addFakeGrade({
              id: "", subjectId, value, weight, date: new Date().toISOString(), label: label || "Fictieve toets",
              type: "PTA", description: "Sandbox simulatie", fake: true,
            });
            toast("Toets toegevoegd aan sandbox", "success", `${subject.name} · ${formatGrade(value)} · ${weight}×`);
          }} className="btn-primary mt-4 w-full"><Plus size={15} /> Toets toevoegen aan simulatie</button>

          <div className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {fakes.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400 dark:border-white/10">Nog geen fictieve toetsen. Voeg er hierboven een toe.</p>}
              {fakes.map((g) => {
                const s = data.subjects.find((x) => x.id === g.subjectId);
                return (
                  <motion.div key={g.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-white/[0.08]">
                    <span className="h-2 w-2 rounded-full" style={{ background: s?.color }} />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800 dark:text-white/85">{g.label}</p><p className="text-[10px] text-slate-400">{s?.name}</p></div>
                    <span className="mono text-[11px] text-slate-400">{g.weight}×</span>
                    <span className="mono text-sm font-bold text-accent">{formatGrade(g.value)}</span>
                    <button onClick={() => removeFakeGrade(g.id)} className="text-slate-300 hover:text-rose-400 dark:text-white/20"><Trash2 size={14} /></button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/[0.08]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Echt gemiddelde</p>
              <p className="mono mt-2 text-3xl font-bold text-slate-500 dark:text-white/50">{formatGrade(realAvg)}</p>
            </div>
            <div className="rounded-2xl border border-accent/25 bg-accent/[0.05] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Na simulatie</p>
              <p className="mono mt-2 text-3xl font-bold text-slate-900 dark:text-white">{formatGrade(simAvg)}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/[0.08]">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white/80">Impact per vak <Pill tone="accent">live</Pill></p>
            {deltas.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Nog geen veranderingen.</p>}
            <div className="space-y-2">
              {deltas.map((d) => (
                <div key={d.subject.id} className="flex items-center gap-3 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.subject.color }} />
                  <span className="flex-1 truncate text-slate-600 dark:text-white/65">{d.subject.name}</span>
                  <span className="mono text-slate-400">{formatGrade(d.real)}</span>
                  <ArrowRight size={12} className="text-slate-300" />
                  <span className="mono font-bold text-slate-800 dark:text-white">{formatGrade(d.sim)}</span>
                  <span className={`mono flex w-12 items-center justify-end font-bold ${d.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {d.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{formatGrade(d.delta)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/[0.08]">
            <p className="mb-2 text-xs font-bold text-slate-700 dark:text-white/80">Slaag/zak na simulatie</p>
            <div className="flex items-center justify-between">
              <span className={`text-lg font-bold ${simCheck.status === "op-koers" ? "text-emerald-400" : simCheck.status === "aandacht" ? "text-amber-400" : "text-rose-400"}`}>{simCheck.label}</span>
              <span className="mono text-xs text-slate-400">{realCheck.label} → {simCheck.label}</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-white/45">{simCheck.summary}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
