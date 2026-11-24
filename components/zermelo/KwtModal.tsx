"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, UserRound, Users, AlertTriangle, CheckCircle2, Filter, ArrowRight, Sparkles, RefreshCw } from "lucide-react";
import { useApp } from "@/app/providers";
import { Modal } from "@/components/ui/Modal";
import { Pill, ProgressBar } from "@/components/ui/Primitives";
import { conflictsFor } from "@/lib/calculations/planner";
import { weightedAverage, formatGrade } from "@/lib/calculations/grades";
import { timeLabel, shortDate, relativeDeadline } from "@/lib/format";
import { zermelo } from "@/lib/api/zermelo";
import { toast } from "@/components/ui/Toaster";
import type { ChoiceGroup } from "@/lib/types";

export function KwtModal({ group, onClose }: { group: ChoiceGroup | null; onClose: () => void }) {
  const { data, state, enroll, unenroll, appointments } = useApp();
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [onlyFree, setOnlyFree] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = group ? state.enrollments[group.id] : undefined;
  const lowSubjects = useMemo(() => data.subjects.filter((s) => weightedAverage(data.grades.filter((g) => g.subjectId === s.id)) < 6).map((s) => s.id), [data.subjects, data.grades]);

  const options = useMemo(() => {
    if (!group) return [];
    return group.options
      .filter((o) => {
        const text = `${o.title} ${o.description} ${o.location} ${data.subjects.find((s) => s.id === o.subjectId)?.name ?? ""} ${data.teachers.find((t) => t.id === o.teacherId)?.name ?? ""}`.toLowerCase();
        return text.includes(query.toLowerCase()) && (subjectFilter === "all" || o.subjectId === subjectFilter) && (!onlyFree || o.enrolled < o.capacity);
      })
      .sort((a, b) => {
        const aRec = a.subjectId && lowSubjects.includes(a.subjectId) ? 1 : 0;
        const bRec = b.subjectId && lowSubjects.includes(b.subjectId) ? 1 : 0;
        return bRec - aRec || a.enrolled / a.capacity - b.enrolled / b.capacity;
      });
  }, [group, query, subjectFilter, onlyFree, data.subjects, data.teachers, lowSubjects]);

  const doEnroll = async (optionId: string) => {
    if (!group) return;
    const option = group.options.find((o) => o.id === optionId)!;
    const conflicts = conflictsFor(option, appointments);
    if (conflicts.length) {
      toast("Conflict met je reguliere rooster", "warning", `Overlapt met ${conflicts[0].title} (${timeLabel(conflicts[0].start)}).`);
      return;
    }
    if (option.enrolled >= option.capacity && optionId !== current) {
      toast("Deze keuzeles zit vol", "warning", "Kies een andere optie of zet je op de wachtlijst via school.");
      return;
    }
    if (!state.connection.zermeloToken) {
      toast("Zermelo niet gekoppeld", "warning", "Koppel eerst je Zermelo-account via Instellingen.");
      return;
    }
    setBusy(true);
    const res = await zermelo.enroll(
      { subdomain: state.connection.zermeloSubdomain, token: state.connection.zermeloToken },
      group.id, optionId
    );
    if (!res.ok) { setBusy(false); toast("Inschrijven via Zermelo mislukt", "warning", res.error); return; }
    enroll(group.id, optionId);
    setBusy(false);
    toast("Ingeschreven via Zermelo", "success", `${option.title} · ${option.location} · capaciteit bijgewerkt.`);
  };

  const doUnenroll = async () => {
    if (!group || !current) return;
    if (!state.connection.zermeloToken) {
      toast("Zermelo niet gekoppeld", "warning", "Koppel eerst je Zermelo-account via Instellingen.");
      return;
    }
    setBusy(true);
    const res = await zermelo.unenroll(
      { subdomain: state.connection.zermeloSubdomain, token: state.connection.zermeloToken },
      group.id
    );
    if (!res.ok) { setBusy(false); toast("Uitschrijven mislukt", "warning", res.error); return; }
    unenroll(group.id);
    setBusy(false);
    toast("Uitgeschreven", "info", "De plek is weer vrijgegeven in Zermelo.");
  };

  return (
    <Modal open={Boolean(group)} onClose={onClose} title={group?.title ?? "Zermelo keuzelessen"} subtitle={group ? `${shortDate(group.start)} · ${timeLabel(group.start)}–${timeLabel(group.end)} · ${group.mandatory ? "verplicht" : "vrijwillig"} · kiestijd sluit ${relativeDeadline(group.deadline)}` : ""} wide>
      {group && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input !pl-9" placeholder="Zoek op vak, docent of lokaal…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="input !w-auto" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="all">Alle vakken</option>
              {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => setOnlyFree(!onlyFree)} className={`btn ${onlyFree ? "bg-emerald-500/15 text-emerald-400" : "btn-secondary"}`}><Filter size={14} /> Alleen plek vrij</button>
            {current && <button onClick={doUnenroll} disabled={busy} className="btn-secondary text-rose-400"><RefreshCw size={14} /> Uitschrijven</button>}
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/[0.05] p-3 text-[11px] text-slate-600 dark:text-white/60">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
            <span><strong className="text-slate-800 dark:text-white/90">Slimme suggestie:</strong> keuzelessen voor vakken waar je onder de 6 staat ({
              lowSubjects.map((id) => data.subjects.find((s) => s.id === id)?.short).filter(Boolean).join(", ") || "geen"
            }) staan bovenaan. Capaciteit wordt live bijgewerkt bij in- en uitschrijven.</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {options.length === 0 && <p className="col-span-2 py-10 text-center text-xs text-slate-400">Geen keuzelessen gevonden met deze filters.</p>}
            {options.map((o, i) => {
              const subject = data.subjects.find((s) => s.id === o.subjectId);
              const teacher = data.teachers.find((t) => t.id === o.teacherId);
              const conflicts = conflictsFor(o, appointments);
              const full = o.enrolled >= o.capacity;
              const selected = current === o.id;
              const recommended = o.subjectId && lowSubjects.includes(o.subjectId);
              return (
                <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className={`relative rounded-2xl border p-4 transition ${selected ? "border-accent bg-accent/[0.06]" : "border-slate-200 dark:border-white/[0.08]"}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white" style={{ background: subject?.color ?? "#64748b" }}>{subject?.code ?? o.kind.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 dark:text-white/90">{o.title}</p>
                          {recommended && <Pill tone="accent">Aanbevolen</Pill>}
                          {selected && <Pill tone="green">Ingeschreven</Pill>}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400">{o.description}</p>
                      </div>
                    </div>
                    <Pill tone={o.kind === "steun" ? "blue" : o.kind === "stilte" ? "neutral" : "accent"}>{o.kind}</Pill>
                  </div>
                  <div className="my-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-white/45">
                    <span className="flex items-center gap-1"><MapPin size={12} className="text-accent" /><span className="mono">{o.location}</span></span>
                    <span className="flex items-center gap-1"><UserRound size={12} className="text-accent" />{teacher?.name ?? "Begeleiding"}</span>
                    <span className="mono">{timeLabel(o.start)}–{timeLabel(o.end)}</span>
                  </div>
                  <div className="mb-3"><ProgressBar value={(o.enrolled / o.capacity) * 100} color={full ? "#f43f5e" : o.enrolled / o.capacity > 0.8 ? "#f59e0b" : "#10b981"}
                    label={`${o.enrolled}/${o.capacity} plekken bezet`} height={5} /></div>
                  {conflicts.length > 0 && (
                    <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-rose-500/10 p-2 text-[10px] text-rose-400"><AlertTriangle size={12} className="mt-0.5 shrink-0" />Conflict: {conflicts.map((c) => c.title).join(", ")}</div>
                  )}
                  <button disabled={busy || (full && !selected)} onClick={() => doEnroll(o.id)}
                    className={`w-full ${selected ? "btn-secondary text-emerald-400" : conflicts.length ? "btn-secondary text-rose-400" : "btn-primary"}`}>
                    {selected ? <><CheckCircle2 size={14} /> Gekozen — opnieuw bevestigen</> : full ? <><Users size={14} /> Vol</> : <><ArrowRight size={14} /> Inschrijven via Zermelo</>}
                  </button>
                </motion.div>
              );
            })}
          </div>
          <p className="text-center text-[10px] text-slate-400">Bron: Zermelo Portal API v3 · live koppeling</p>
        </div>
      )}
    </Modal>
  );
}
