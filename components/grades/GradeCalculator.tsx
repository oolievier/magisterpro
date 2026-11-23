"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calculator, Target, Sparkles, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { useApp } from "@/app/providers";
import { whatIf, formatGrade, weightedAverage } from "@/lib/calculations/grades";
import { Pill, ProgressBar } from "@/components/ui/Primitives";
import { toast } from "@/components/ui/Toaster";

export function GradeCalculator({ subjectId, onSubjectChange, onAddGrade }: {
  subjectId: string; onSubjectChange: (id: string) => void; onAddGrade: (value: number, weight: number) => void;
}) {
  const { data } = useApp();
  const [target, setTarget] = useState(6.5);
  const [weight, setWeight] = useState(2);
  const subject = data.subjects.find((s) => s.id === subjectId) ?? data.subjects[0];
  const grades = useMemo(() => data.grades.filter((g) => g.subjectId === subject.id), [data.grades, subject.id]);
  const avg = weightedAverage(grades);
  const result = whatIf(target, grades, weight);
  const impossible = !result.achievable;
  const easy = result.required <= 6;

  return (
    <section className="panel p-5">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="rounded-xl bg-accent/12 p-2 text-accent"><Calculator size={18} /></span>
        <div><h2 className="section-title">Wat moet ik halen?</h2><p className="text-xs text-slate-500 dark:text-white/45">Exact berekend tot op 2 decimalen</p></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div><label className="label">Vak</label>
            <select className="input" value={subject.id} onChange={(e) => onSubjectChange(e.target.value)}>
              {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between"><label className="label !mb-0">Gewenst gemiddelde</label><span className="mono text-sm font-bold text-accent">{formatGrade(target)}</span></div>
            <input type="range" min={1} max={10} step={0.1} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" />
            <div className="mt-2 flex gap-1.5">
              {[5.5, 6, 7, 8].map((p) => <button key={p} onClick={() => setTarget(p)} className={`mono flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition ${target === p ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-white/45 dark:hover:bg-white/5"}`}>{formatGrade(p)}</button>)}
            </div>
          </div>
          <div>
            <label className="label">Weging van de nieuwe toets</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((w) => <button key={w} onClick={() => setWeight(w)} className={`mono flex-1 rounded-lg border py-2 text-xs font-bold transition ${weight === w ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-white/45 dark:hover:bg-white/5"}`}>{w}×</button>)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white/45">
            Huidig gemiddelde <span className="mono font-bold text-slate-800 dark:text-white">{formatGrade(avg)}</span> over <span className="mono font-bold text-slate-800 dark:text-white">{grades.reduce((s, g) => s + g.weight, 0)}×</span> weging.
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accent"><Target size={14} /> Benodigd cijfer</div>
          <motion.p key={`${result.required}-${subject.id}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 350, damping: 22 }}
            className={`mono my-3 text-6xl font-black tracking-tighter ${impossible ? "text-rose-400" : easy ? "text-emerald-400" : "text-slate-900 dark:text-white"}`}>
            {impossible ? "—" : result.required.toFixed(2).replace(".", ",")}
          </motion.p>
          <div className="space-y-2">
            {impossible ? (
              <p className="flex items-start gap-2 text-xs text-rose-400"><AlertTriangle size={15} className="shrink-0" /> Met {weight}× weging is dit gemiddelde niet meer haalbaar. Verhoog de weging of kies een lager doel.</p>
            ) : easy ? (
              <p className="flex items-start gap-2 text-xs text-emerald-400"><CheckCircle2 size={15} className="shrink-0" /> Dit is goed haalbaar. Met een {Math.ceil(result.required * 10) / 10} zit je al op je doel.</p>
            ) : (
              <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-white/50"><Sparkles size={15} className="shrink-0 text-accent" /> Een flinke uitdaging, maar mogelijk. Plan genoeg voorbereidingstijd in.</p>
            )}
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Wat als je dit haalt?</p>
            {result.scenarios.map((s) => (
              <div key={s.grade} className="flex items-center gap-3 rounded-lg bg-white/50 px-2.5 py-1.5 text-[11px] dark:bg-white/[0.03]">
                <span className="mono w-6 font-bold text-slate-700 dark:text-white/80">{s.grade}</span>
                <div className="flex-1"><ProgressBar value={s.resultingAverage * 10} color={s.grade >= 7 ? "#10b981" : "#f59e0b"} height={4} /></div>
                <span className="mono font-semibold text-slate-700 dark:text-white/80">{formatGrade(s.resultingAverage)}</span>
                <span className={`mono w-10 text-right ${s.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{s.delta >= 0 ? "+" : ""}{formatGrade(s.delta)}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary mt-4 w-full" onClick={() => {
            if (impossible) return;
            const value = Math.min(10, Math.ceil(result.required * 10) / 10);
            onAddGrade(value, weight);
            toast("Fictief cijfer toegevoegd", "success", `${subject.name}: ${formatGrade(value)} met ${weight}× weging — bekijk de sandbox.`);
          }}><Plus size={15} /> Voeg dit cijfer toe aan de sandbox</button>
        </div>
      </div>
    </section>
  );
}
