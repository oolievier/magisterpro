"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListTodo, Columns3, CalendarRange, Plus, ChevronDown, CheckCircle2, Circle,
  Clock3, Timer, Ban, X, Sparkles, ArrowRight, GripVertical, BookOpen, Flag,
  CheckSquare, Square, EyeOff, RotateCcw,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { generateStudyPlan, type StudyPlanDay } from "@/lib/calculations/planner";
import { daysUntil, relativeDeadline, shortDate, timeLabel } from "@/lib/format";
import { Pill, ProgressBar } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toaster";
import { SubjectBadge } from "@/components/ui/SubjectBadge";
import type { HomeworkStatus, Homework } from "@/lib/types";

type Tab = "kanban" | "lijst" | "plan";

function PlannerView() {
  const router = useRouter();
  const params = useSearchParams();
  const app = useApp();
  const { data, state, now, appointments } = app;
  const [tab, setTab] = useState<Tab>("kanban");
  const [expanded, setExpanded] = useState<string | null>(params.get("task"));
  const [filter, setFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [blockOpen, setBlockOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id ?? "");
  const [due, setDue] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [blockLabel, setBlockLabel] = useState("Sport");
  const [blockDate, setBlockDate] = useState(new Date().toISOString().slice(0, 10));
  const [blockStart, setBlockStart] = useState("16:00");
  const [blockEnd, setBlockEnd] = useState("18:00");
  const [dragOver, setDragOver] = useState<HomeworkStatus | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => { if (params.get("add") === "1") setAddOpen(true); }, [params]);

  const homework = useMemo(() => data.homework.filter((h) => filter === "all" || h.subjectId === filter), [data.homework, filter]);
  const isPast = (h: Homework) => new Date(h.due).getTime() < now.getTime();
  const visibleHomework = useMemo(() => homework.filter((h) => showPast || !isPast(h)), [homework, showPast, now]);
  const pastIds = homework.filter(isPast).map((h) => h.id);
  const toggleSelected = (id: string) => setSelected((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const plan = useMemo<StudyPlanDay[]>(() => generateStudyPlan(appointments, state.blockedSlots, data.homework, data.subjects), [appointments, state.blockedSlots, data.homework, data.subjects]);
  const upcomingTests = appointments.filter((a) => a.type === "toets" && new Date(a.end) >= now).slice(0, 6);

  const columns: { key: HomeworkStatus; label: string; tone: string }[] = [
    { key: "todo", label: "Te doen", tone: "text-slate-500" },
    { key: "doing", label: "Bezig", tone: "text-blue-400" },
    { key: "done", label: "Afgerond", tone: "text-emerald-400" },
  ];

  const HomeworkCard = ({ h }: { h: Homework }) => {
    const subject = data.subjects.find((s) => s.id === h.subjectId);
    const isOpen = expanded === h.id;
    const doneSubs = h.subtasks.filter((s) => s.done).length;
    return (
      <motion.div layout draggable onDragStart={(e) => (e as unknown as DragEvent).dataTransfer?.setData("text/plain", h.id)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-accent/30 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="flex items-start gap-2">
          <button onClick={() => toggleSelected(h.id)} title="Selecteren voor bulkacties" className={`mt-0.5 shrink-0 transition ${selected.includes(h.id) ? "text-accent" : "text-slate-300 hover:text-accent dark:text-white/20"}`}>
            {selected.includes(h.id) ? <CheckSquare size={14} /> : <Square size={14} />}
          </button>
          <GripVertical size={13} className="mt-0.5 shrink-0 cursor-grab text-slate-300 dark:text-white/15" />
          <button onClick={() => setExpanded(isOpen ? null : h.id)} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject?.color }} /><p className={`truncate text-xs font-bold ${h.status === "done" ? "text-slate-400 line-through" : "text-slate-800 dark:text-white/90"}`}>{h.title}</p></div>
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-slate-400">
              {subject ? <SubjectBadge subjectId={subject.id} label={subject.name} /> : "Onbekend vak"} · {relativeDeadline(h.due, now)}
              {isPast(h) && <span className="font-bold text-amber-400">· verleden</span>}
            </p>
          </button>
          <ChevronDown size={14} className={`mt-0.5 shrink-0 text-slate-300 transition ${isOpen ? "rotate-180" : ""}`} />
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          {h.subtasks.length > 0 && <span className="mono text-[9px] text-slate-400">{doneSubs}/{h.subtasks.length} subtaken</span>}
          {h.subtasks.length > 0 && <div className="flex-1"><ProgressBar value={doneSubs / h.subtasks.length * 100} height={3} color={subject?.color} /></div>}
          <button onClick={() => window.dispatchEvent(new CustomEvent("magisterpro:focus", { detail: { subjectId: h.subjectId, taskId: h.id } }))} className="ml-auto rounded-lg p-1 text-slate-300 transition hover:bg-accent/10 hover:text-accent dark:text-white/20" title="Focus op deze taak"><Timer size={13} /></button>
          <button onClick={() => app.setHomeworkStatus(h.id, h.status === "done" ? "todo" : "done")} className={`rounded-lg p-1 transition ${h.status === "done" ? "text-emerald-400" : "text-slate-300 hover:text-emerald-400 dark:text-white/20"}`} title="Afvinken"><CheckCircle2 size={14} /></button>
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-white/[0.07]">
                <p className="text-[10px] leading-relaxed text-slate-500 dark:text-white/50">{h.description}</p>
                {h.subtasks.map((s) => (
                  <button key={s.id} onClick={() => app.toggleSubtask(h.id, s.id)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-[11px] hover:bg-slate-50 dark:hover:bg-white/5">
                    {s.done ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Circle size={13} className="text-slate-300" />}
                    <span className={s.done ? "text-slate-400 line-through" : "text-slate-700 dark:text-white/75"}>{s.title}</span>
                  </button>
                ))}
                <div className="flex gap-1.5">
                  <input className="input !py-1.5 !text-[11px]" placeholder="Nieuwe subtask…" onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim()) { app.addSubtask(h.id, e.currentTarget.value.trim()); e.currentTarget.value = ""; }
                  }} />
                </div>
                <textarea className="input min-h-[60px] !text-[11px]" placeholder="Persoonlijke notities bij dit huiswerk…" value={h.note} onChange={(e) => app.setHomeworkNote(h.id, e.target.value)} />
                <div className="flex gap-1.5">
                  {(["todo", "doing", "done"] as HomeworkStatus[]).map((s) => (
                    <button key={s} onClick={() => app.setHomeworkStatus(h.id, s)} className={`flex-1 rounded-lg border py-1 text-[9px] font-bold capitalize transition ${h.status === s ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-400 dark:border-white/10"}`}>{s === "todo" ? "Te doen" : s === "doing" ? "Bezig" : "Klaar"}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="mb-1 text-xs font-medium text-accent">Slimme planner</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Toetsweek & Huiswerk</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Automatisch terugrekenend leerplan, Kanban en focus-timer.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setBlockOpen(true)} className="btn-secondary"><Ban size={15} /> Blokkeer tijd</button>
          <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus size={15} /> Nieuwe taak</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.02]">
          {([["kanban", Columns3], ["lijst", ListTodo], ["plan", CalendarRange]] as const).map(([id, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${tab === id ? "bg-accent/12 text-accent" : "text-slate-500 dark:text-white/45"}`}><Icon size={14} />{id === "plan" ? "Toetsplan" : id}</button>
          ))}
        </div>
        <select className="input !w-auto !py-2" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Alle vakken</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button onClick={() => setShowPast(!showPast)} className={`btn ${showPast ? "bg-amber-500/15 text-amber-400" : "btn-secondary"}`}><Clock3 size={13} /> {showPast ? "Verleden zichtbaar" : "Verleden tonen"} ({pastIds.length})</button>
        <span className="ml-auto text-[11px] text-slate-400">{visibleHomework.filter((h) => h.status === "done").length}/{visibleHomework.length} afgerond</span>
      </div>

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-surface-raised/95 p-2.5 shadow-panel backdrop-blur">
            <span className="mono rounded-lg bg-accent/15 px-2 py-1 text-[11px] font-bold text-accent">{selected.length} geselecteerd</span>
            <button onClick={() => { app.completeHomeworkIds(selected); toast("Taken afgerond", "success", `${selected.length} taak/taken gemarkeerd als klaar.`); setSelected([]); }} className="btn-primary !py-1.5"><CheckCircle2 size={14} /> Markeer klaar</button>
            <button onClick={() => { app.hideHomeworkIds(selected); toast("Taken verborgen", "info", "Je kunt ze altijd herstellen."); setSelected([]); }} className="btn-secondary !py-1.5"><EyeOff size={14} /> Verberg</button>
            <button onClick={() => setSelected(pastIds)} className="btn-secondary !py-1.5"><Clock3 size={14} /> Selecteer verleden</button>
            <button onClick={() => setSelected([])} className="btn-secondary !py-1.5"><X size={14} /> Annuleren</button>
          </motion.div>
        )}
      </AnimatePresence>

      {state.hiddenHomeworkIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-white/[0.08] dark:text-white/50">
          <EyeOff size={13} /> {state.hiddenHomeworkIds.length} taak/taken uit zicht
          <button onClick={() => { app.restoreHiddenHomework(); toast("Taken hersteld", "success"); }} className="ml-auto flex items-center gap-1 font-semibold text-accent"><RotateCcw size={12} /> Herstel alles</button>
        </div>
      )}

      {/* Aankomende toetsen */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {upcomingTests.map((t) => {
          const s = data.subjects.find((x) => x.id === t.subjectId);
          return (
            <div key={t.id} className="flex shrink-0 items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-3 py-2">
              <Flag size={13} className="text-rose-400" />
              <div className="min-w-0"><p className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-white/85">{s ? <SubjectBadge subjectId={s.id} label={s.short} showDot={false} /> : "Onbekend"} · {t.toetsType}</p><p className="text-[9px] text-slate-400">{shortDate(t.start)} · {timeLabel(t.start)}</p></div>
              <Pill tone="red">{daysUntil(t.start, now)}d</Pill>
            </div>
          );
        })}
      </div>

      {tab === "kanban" && (
        <div className="grid gap-3 md:grid-cols-3">
          {columns.map((col) => {
            const items = visibleHomework.filter((h) => h.status === col.key);
            return (
              <div key={col.key} onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }} onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) { app.setHomeworkStatus(id, col.key); toast("Taak verplaatst", "success", `Naar ${col.label}`); } setDragOver(null); }}
                className={`min-h-[240px] rounded-2xl border border-dashed p-3 transition ${dragOver === col.key ? "border-accent bg-accent/[0.05]" : "border-slate-200 dark:border-white/[0.08]"}`}>
                <div className="mb-3 flex items-center gap-2 px-1"><p className={`text-xs font-bold uppercase tracking-wider ${col.tone}`}>{col.label}</p><span className="mono rounded-md bg-slate-100 px-1.5 text-[10px] dark:bg-white/[0.06]">{items.length}</span></div>
                <div className="space-y-2">{items.map((h) => <HomeworkCard key={h.id} h={h} />)}
                  {items.length === 0 && <p className="py-8 text-center text-[10px] text-slate-400">Sleep een taak hierheen</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "lijst" && (
        <div className="panel divide-y divide-slate-100 dark:divide-white/[0.06]">
          {[...visibleHomework].sort((a, b) => a.due.localeCompare(b.due)).map((h) => <HomeworkCard key={h.id} h={h} />)}
        </div>
      )}

      {tab === "plan" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent/[0.05] p-4 text-xs text-slate-600 dark:text-white/60">
            <Sparkles size={17} className="mt-0.5 shrink-0 text-accent" />
            <div><p className="font-bold text-slate-800 dark:text-white/90">Automatische toetsweek-generator</p>
              <p className="mt-1 leading-relaxed">Je aankomende toetsen zijn verdeeld over de komende dagen. Drukke lesdagen krijgen minder studietijd, geblokkeerde sport-/werkblokken worden ontzien.</p></div>
          </div>
          {state.blockedSlots.length > 0 && (
            <div className="flex flex-wrap gap-2">{state.blockedSlots.map((b) => (
              <button key={b.id} onClick={() => app.removeBlockedSlot(b.id)} className="chip text-rose-400"><Ban size={11} /> {b.label} · {shortDate(b.start)} {timeLabel(b.start)} <X size={11} /></button>
            ))}</div>
          )}
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {plan.slice(0, 14).map((day, i) => (
              <div key={day.date} className={`panel p-4 ${day.date === now.toISOString().slice(0, 10) ? "border-accent/40" : ""}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-slate-800 dark:text-white/90">{new Date(day.date + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "short" })}</p>
                    <p className="text-[10px] text-slate-400">{Math.round(day.load / 60)} lesuren</p></div>
                  {i === 0 && <Pill tone="accent">Vandaag</Pill>}
                </div>
                {day.blocks.length === 0 ? <p className="py-5 text-center text-[11px] text-slate-400">Geen studyblokken ingepland.</p> : (
                  <div className="space-y-2">{day.blocks.map((b) => (
                    <button key={b.id} onClick={() => b.taskId && setExpanded(b.taskId)} className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left transition ${b.kind === "blokkade" ? "border-rose-400/20 bg-rose-400/[0.05]" : "border-slate-200 hover:border-accent/30 dark:border-white/[0.08]"}`}>
                      {b.kind === "blokkade" ? <Ban size={13} className="text-rose-400" /> : b.kind === "huiswerk" ? <BookOpen size={13} className="text-blue-400" /> : <Sparkles size={13} className="text-accent" />}
                      <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-700 dark:text-white/80">{b.title}</p><p className="mono text-[9px] text-slate-400">{b.start}–{b.end} · {b.minutes} min</p></div>
                    </button>
                  ))}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Nieuwe taak of huiswerk" subtitle="Verschijnt in je Kanban en toetsplan">
        <div className="space-y-4">
          <div><label className="label">Omschrijving</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wat moet je doen?" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Vak</label><select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="label">Deadline</label><input type="datetime-local" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></div></div>
          <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setAddOpen(false)}>Annuleren</button>
            <button className="btn-primary" disabled={!title.trim()} onClick={() => { app.addHomework(title.trim(), subjectId, new Date(due).toISOString()); toast("Taak toegevoegd", "success", title); setTitle(""); setAddOpen(false); router.replace("/planner", { scroll: false }); }}>Toevoegen</button></div>
        </div>
      </Modal>

      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Tijd blokkeren" subtitle="Sport, werk of andere verplichte bezigheden">
        <div className="space-y-4">
          <div><label className="label">Wat ga je doen?</label><input className="input" value={blockLabel} onChange={(e) => setBlockLabel(e.target.value)} placeholder="Bijv. Voetbaltraining" /></div>
          <div><label className="label">Datum</label><input type="date" className="input" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Van</label><input type="time" className="input mono" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} /></div>
            <div><label className="label">Tot</label><input type="time" className="input mono" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} /></div></div>
          <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setBlockOpen(false)}>Annuleren</button>
            <button className="btn-primary" onClick={() => {
              app.addBlockedSlot({ id: `block-${Date.now()}`, label: blockLabel, start: new Date(`${blockDate}T${blockStart}:00`).toISOString(), end: new Date(`${blockDate}T${blockEnd}:00`).toISOString() });
              toast("Tijd geblokkeerd", "success", `${blockLabel} · ${blockStart}–${blockEnd}`); setBlockOpen(false);
            }}>Blokkeren</button></div>
        </div>
      </Modal>
    </div>
  );
}

export default function PlannerPage() {
  return <Suspense fallback={<div className="py-20 text-center text-sm text-slate-400">Planner laden…</div>}><PlannerView /></Suspense>;
}
