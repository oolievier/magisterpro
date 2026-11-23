"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDays, List, Columns3, Grid3x3, Download, Coffee, MapPin, Clock3,
  AlertTriangle, Sparkles, Filter, CalendarPlus, ArrowRight, CheckCircle2, Radio,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { KwtModal } from "@/components/zermelo/KwtModal";
import { Pill } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { findFreeGaps, suggestForGap, downloadICS, timeLabel, minutesLeft, progressInLesson } from "@/lib/calculations/planner";
import { daysUntil, relativeDeadline, shortDate } from "@/lib/format";
import { toast } from "@/components/ui/Toaster";
import type { ChoiceGroup, Appointment } from "@/lib/types";

type View = "dag" | "week" | "maand" | "agenda";

function ScheduleView() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, state, now, appointments } = useApp();
  const [view, setView] = useState<View>("week");
  const [selectedDay, setSelectedDay] = useState(now.toISOString().slice(0, 10));
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [kwtGroup, setKwtGroup] = useState<ChoiceGroup | null>(null);
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState(data.subjects[0].id);
  const [newDate, setNewDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [customTests, setCustomTests] = useState<Appointment[]>([]);

  useEffect(() => { if (params.get("kwt") === "1" && data.choiceGroups[0]) setKwtGroup(data.choiceGroups[0]); }, [params, data.choiceGroups]);

  const allAppointments = useMemo(() => [...appointments, ...customTests], [appointments, customTests]);
  const filtered = useMemo(() => allAppointments.filter((a) => subjectFilter === "all" || a.subjectId === subjectFilter), [allAppointments, subjectFilter]);

  const weekDays = useMemo(() => {
    const monday = new Date(selectedDay);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 7 }).map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d.toISOString().slice(0, 10); });
  }, [selectedDay]);

  const monthDays = useMemo(() => {
    const first = new Date(selectedDay.slice(0, 7) + "-01T12:00:00");
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }).map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d.toISOString().slice(0, 10); });
  }, [selectedDay]);

  const dayStats = (iso: string) => {
    const appts = filtered.filter((a) => a.start.slice(0, 10) === iso && !a.cancelled);
    const gaps = findFreeGaps(appts);
    return {
      appts, gaps,
      start: appts.length ? timeLabel(appts[0].start) : "—",
      end: appts.length ? timeLabel(appts[appts.length - 1].end) : "—",
      gapMinutes: gaps.reduce((s, g) => s + g.minutes, 0),
    };
  };

  const renderAppointment = (a: Appointment, compact = false) => {
    const subject = data.subjects.find((s) => s.id === a.subjectId);
    const current = new Date(a.start) <= now && new Date(a.end) > now;
    return (
      <motion.div key={a.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className={`relative overflow-hidden rounded-xl border p-2.5 transition ${a.cancelled ? "border-rose-400/25 bg-rose-400/[0.06] opacity-70" : "border-slate-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]"} ${current ? "ring-2 ring-accent/50" : ""}`}
        style={{ borderLeftColor: subject?.color, borderLeftWidth: 3 }}>
        {current && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" style={{ width: `${progressInLesson(a.start, a.end, now)}%` }} />}
        <div className="flex items-start justify-between gap-1">
          <p className={`truncate text-[11px] font-bold ${a.cancelled ? "text-rose-400 line-through" : "text-slate-800 dark:text-white/85"}`}>{a.title}</p>
          {a.type === "toets" && <Pill tone="red">{a.toetsType}</Pill>}
          {a.kwtGroupId && <Pill tone="accent">KWT</Pill>}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
          <span className="mono">{timeLabel(a.start)}</span>
          <span className="flex items-center gap-0.5"><MapPin size={9} />{a.location}</span>
        </div>
        {a.originalLocation && a.originalLocation !== a.location && (
          <p className="mt-1 flex items-center gap-1 text-[9px] font-bold text-amber-400"><AlertTriangle size={9} /> was {a.originalLocation}</p>
        )}
        {a.cancelled && <p className="mt-1 text-[9px] font-bold text-rose-400">LES UITGEVALLEN</p>}
        {!compact && a.teacherId && <p className="mt-1 text-[9px] text-slate-400">{data.teachers.find((t) => t.id === a.teacherId)?.abbreviation} · bron: {a.source}</p>}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="mb-1 text-xs font-medium text-accent">Super-Rooster</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Rooster & Zermelo Hub</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Magister + Zermelo samengevoegd tot één waarheid.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { downloadICS(allAppointments, data.subjects); toast("Rooster geëxporteerd", "success", "Open de .ics in Apple- of Google Calendar."); }} className="btn-secondary"><Download size={15} /> Exporteer .ics</button>
          <button onClick={() => setAddOpen(true)} className="btn-primary"><CalendarPlus size={15} /> Toets/toevoegen</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.02]">
          {([["dag", CalendarDays], ["week", Columns3], ["maand", Grid3x3], ["agenda", List]] as const).map(([id, Icon]) => (
            <button key={id} onClick={() => setView(id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === id ? "bg-accent/12 text-accent" : "text-slate-500 hover:text-slate-800 dark:text-white/45"}`}><Icon size={14} />{id}</button>
          ))}
        </div>
        <select className="input !w-auto !py-2" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="all">Alle vakken</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" className="input !w-auto !py-2" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400"><Radio size={13} className="text-emerald-400" /> Zermelo leidend voor lokaal & uitval</span>
      </div>

      {/* KWT-blokken */}
      <section>
        <div className="mb-3 flex items-center gap-2"><Sparkles size={17} className="text-accent" /><h2 className="section-title">Openstaande Zermelo-keuzelessen</h2><Pill tone="accent">{state.connection.mode === "demo" ? "Demo" : "Live"}</Pill></div>
        <div className="grid gap-3 md:grid-cols-3">
          {data.choiceGroups.map((g) => {
            const chosen = state.enrollments[g.id] ? g.options.find((o) => o.id === state.enrollments[g.id]) : null;
            const urgent = g.mandatory && !chosen;
            return (
              <button key={g.id} onClick={() => setKwtGroup(g)} className={`panel group p-4 text-left transition hover:-translate-y-0.5 ${urgent ? "border-rose-400/30" : "hover:border-accent/30"}`}>
                <div className="mb-2 flex items-center justify-between"><Pill tone={urgent ? "red" : chosen ? "green" : "blue"}>{urgent ? "Actie nodig" : chosen ? "Ingeschreven" : "Vrijwillig"}</Pill><ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-accent" /></div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{g.title}</p>
                <p className="mt-1 text-[11px] text-slate-400">{shortDate(g.start)} · {timeLabel(g.start)}–{timeLabel(g.end)} · {g.options.length} opties</p>
                {chosen ? <p className="mt-3 truncate text-[11px] font-semibold text-emerald-400"><CheckCircle2 size={12} className="mr-1 inline" />{chosen.title} · {chosen.enrolled}/{chosen.capacity} plekken</p>
                  : <p className="mt-3 text-[11px] text-rose-400">Kiestijd sluit {relativeDeadline(g.deadline, now)}</p>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Tussenuur optimizer */}
      {(() => {
        const stats = dayStats(now.toISOString().slice(0, 10));
        if (!stats.gaps.length) return null;
        const gap = stats.gaps[0];
        const suggestion = suggestForGap(gap, data.homework, data.grades, data.subjects, state.connection.level);
        return (
          <div className="panel flex flex-col gap-3 border-amber-400/20 bg-amber-400/[0.04] p-4 sm:flex-row sm:items-center">
            <span className="rounded-xl bg-amber-400/15 p-2.5 text-amber-400"><Coffee size={19} /></span>
            <div className="flex-1"><p className="text-xs font-bold text-slate-800 dark:text-white/90">Tussenuur gevonden: {gap.minutes} minuten ({timeLabel(gap.start)}–{timeLabel(gap.end)})</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/50">{suggestion.reason}</p></div>
            <button onClick={() => window.dispatchEvent(new CustomEvent("magisterpro:focus", { detail: { subjectId: suggestion.subjectId } }))} className="btn-primary"><Clock3 size={14} /> Focus starten</button>
          </div>
        );
      })()}

      {/* Roosterweergaven */}
      {view === "dag" && (() => {
        const iso = selectedDay;
        const stats = dayStats(iso);
        return (
          <section className="panel p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">{new Date(iso + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}</h2>
                <p className="text-xs text-slate-400">Begint {stats.start} · uit om {stats.end} · {stats.gapMinutes} min tussenuren</p></div>
              <Pill tone={stats.gapMinutes >= 45 ? "amber" : "green"}>{stats.gapMinutes >= 45 ? "Tussenuur aanwezig" : "Compact rooster"}</Pill>
            </div>
            {stats.appts.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">Geen lessen op deze dag.</p> : (
              <div className="relative space-y-2 border-l border-slate-200 pl-5 dark:border-white/10">
                {stats.appts.map((a, i) => {
                  const gap = i < stats.appts.length - 1 ? (new Date(stats.appts[i + 1].start).getTime() - new Date(a.end).getTime()) / 60000 : 0;
                  return (
                    <div key={a.id}>
                      <div className="absolute -left-[7px] mt-4 h-3 w-3 rounded-full border-2 border-white bg-accent dark:border-[#0d0d15]" />
                      {renderAppointment(a)}
                      {gap >= 45 && <p className="my-2 flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[10px] font-semibold text-amber-500"><Coffee size={12} /> {Math.round(gap)} minuten vrij — {suggestForGap({ id: "g", date: iso, start: a.end, end: stats.appts[i + 1].start, minutes: gap, before: a.title, after: stats.appts[i + 1].title }, data.homework, data.grades, data.subjects, state.connection.level).title}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })()}

      {view === "week" && (
        <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
          {weekDays.map((iso) => {
            const stats = dayStats(iso);
            const kwtHere = data.choiceGroups.filter((g) => g.start.slice(0, 10) === iso);
            return (
              <div key={iso} className={`panel min-h-[280px] p-3 ${iso === now.toISOString().slice(0, 10) ? "border-accent/40" : ""}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{new Date(iso + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "short" })}</p><p className="mono text-lg font-bold text-slate-900 dark:text-white">{iso.slice(8)}</p></div>
                  <span className="mono text-[10px] text-slate-400">{stats.appts.length} les</span>
                </div>
                <div className="mb-3 rounded-lg bg-slate-50 px-2 py-1.5 text-[9px] text-slate-500 dark:bg-white/[0.03] dark:text-white/40">
                  <span className="mono">{stats.start}</span> → <span className="mono">{stats.end}</span>{stats.gapMinutes > 0 && <span className="ml-1 text-amber-400">· {stats.gapMinutes}m vrij</span>}
                </div>
                <div className="space-y-1.5">{stats.appts.map((a) => renderAppointment(a, true))}</div>
                {kwtHere.map((g) => (
                  <button key={g.id} onClick={() => setKwtGroup(g)} className="mt-1.5 w-full rounded-lg border border-dashed border-accent/40 bg-accent/[0.05] p-2 text-left text-[10px] font-semibold text-accent">
                    <Sparkles size={11} className="mr-1 inline" />KWT: {g.title}
                  </button>
                ))}
              </div>
            );
          })}
        </section>
      )}

      {view === "maand" && (
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{new Date(selectedDay.slice(0, 7) + "-01T12:00:00").toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}</h2>
            <div className="flex gap-1"><button className="btn-secondary !px-2 !py-1" onClick={() => { const d = new Date(selectedDay); d.setMonth(d.getMonth() - 1); setSelectedDay(d.toISOString().slice(0, 10)); }}>←</button><button className="btn-secondary !px-2 !py-1" onClick={() => { const d = new Date(selectedDay); d.setMonth(d.getMonth() + 1); setSelectedDay(d.toISOString().slice(0, 10)); }}>→</button></div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {["ma", "di", "wo", "do", "vr", "za", "zo"].map((d) => <p key={d} className="pb-2 text-center text-[10px] font-bold uppercase text-slate-400">{d}</p>)}
            {monthDays.map((iso) => {
              const stats = dayStats(iso);
              const tests = stats.appts.filter((a) => a.type === "toets");
              const isToday = iso === now.toISOString().slice(0, 10);
              return (
                <button key={iso} onClick={() => { setSelectedDay(iso); setView("dag"); }} className={`min-h-[76px] rounded-lg border p-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5 ${iso.slice(0, 7) !== selectedDay.slice(0, 7) ? "opacity-40" : ""} ${isToday ? "border-accent bg-accent/[0.06]" : "border-slate-200 dark:border-white/[0.06]"}`}>
                  <p className={`mono mb-1 text-[10px] font-bold ${isToday ? "text-accent" : "text-slate-500 dark:text-white/50"}`}>{iso.slice(8)}</p>
                  <div className="space-y-0.5">{stats.appts.slice(0, 3).map((a) => <div key={a.id} className="h-1.5 rounded-full" style={{ background: data.subjects.find((s) => s.id === a.subjectId)?.color ?? "#64748b" }} />)}</div>
                  {tests.length > 0 && <p className="mt-1 text-[8px] font-bold text-rose-400">{tests.length} toets{tests.length > 1 ? "en" : ""}</p>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {view === "agenda" && (
        <section className="panel divide-y divide-slate-100 dark:divide-white/[0.06]">
          {[...filtered].sort((a, b) => a.start.localeCompare(b.start)).filter((a) => new Date(a.end) >= now).slice(0, 40).map((a) => {
            const subject = data.subjects.find((s) => s.id === a.subjectId);
            return (
              <div key={a.id} className="flex items-center gap-4 p-3.5">
                <div className="w-16 shrink-0 text-center"><p className="mono text-sm font-bold text-slate-900 dark:text-white">{a.start.slice(8, 10)}</p><p className="text-[9px] uppercase text-slate-400">{new Date(a.start + "T12:00:00").toLocaleDateString("nl-NL", { month: "short" })}</p></div>
                <span className="h-9 w-1 rounded-full" style={{ background: subject?.color ?? "#64748b" }} />
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800 dark:text-white/85">{a.title}</p><p className="text-[10px] text-slate-400">{subject?.name} · {a.location} · {data.teachers.find((t) => t.id === a.teacherId)?.abbreviation}</p></div>
                <span className="mono text-xs text-slate-500 dark:text-white/50">{timeLabel(a.start)}</span>
                {a.type === "toets" && <Pill tone="red">{a.toetsType}</Pill>}
                {a.cancelled && <Pill tone="red">uitval</Pill>}
              </div>
            );
          })}
        </section>
      )}

      <KwtModal group={kwtGroup} onClose={() => setKwtGroup(null)} />
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Toets of afspraak toevoegen" subtitle="Verschijnt direct in je rooster en toetsplanner">
        <div className="space-y-4">
          <div><label className="label">Omschrijving</label><input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Bijv. PTA Wiskunde B — hoofdstuk 7" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Vak</label><select className="input" value={newSubject} onChange={(e) => setNewSubject(e.target.value)}>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="label">Datum & tijd</label><input type="datetime-local" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>Annuleren</button>
            <button className="btn-primary" disabled={!newTitle.trim()} onClick={() => {
              const start = new Date(newDate).toISOString();
              const end = new Date(new Date(newDate).getTime() + 55 * 60000).toISOString();
              setCustomTests((p) => [...p, { id: `custom-${Date.now()}`, start, end, subjectId: newSubject, location: "B204", title: newTitle, type: "toets", toetsType: "PTA", source: "magister" }]);
              toast("Toets toegevoegd", "success", newTitle);
              setNewTitle(""); setAddOpen(false); router.replace("/schedule", { scroll: false });
            }}>Toevoegen</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function SchedulePage() {
  return <Suspense fallback={<div className="py-20 text-center text-sm text-slate-400">Rooster laden…</div>}><ScheduleView /></Suspense>;
}
