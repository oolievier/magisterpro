"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDays, List, Columns3, Grid3x3, Download, Coffee, MapPin, Clock3,
  AlertTriangle, Sparkles, Filter, CalendarPlus, ArrowRight, CheckCircle2, Radio, ClipboardCheck, Table2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { KwtModal } from "@/components/zermelo/KwtModal";
import { Pill } from "@/components/ui/Primitives";
import { SubjectBadge } from "@/components/ui/SubjectBadge";
import { Modal } from "@/components/ui/Modal";
import { findFreeGaps, suggestForGap, downloadICS, timeLabel, minutesLeft, progressInLesson } from "@/lib/calculations/planner";
import { daysUntil, relativeDeadline, shortDate } from "@/lib/format";
import { toast } from "@/components/ui/Toaster";
import type { ChoiceGroup, Appointment } from "@/lib/types";

type View = "dag" | "week" | "raster" | "maand" | "agenda";

function ScheduleView() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, state, now, appointments, addHomework } = useApp();
  const [view, setView] = useState<View>("raster");
  const [selectedDay, setSelectedDay] = useState(now.toISOString().slice(0, 10));
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [kwtGroup, setKwtGroup] = useState<ChoiceGroup | null>(null);
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState(data.subjects[0]?.id ?? "");
  const [newDate, setNewDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [customTests, setCustomTests] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  useEffect(() => { if (params.get("kwt") === "1" && data.choiceGroups[0]) setKwtGroup(data.choiceGroups[0]); }, [params, data.choiceGroups]);

  /** Pijltjes (toetsenbord én knoppen) schuiven altijd precies één week. */
  const shiftWeek = (direction: -1 | 1) => {
    setSelectedDay((current) => {
      const date = new Date(`${current}T12:00:00`);
      date.setDate(date.getDate() + direction * 7);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (selectedAppointment || addOpen || kwtGroup) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName))) return;
      event.preventDefault();
      shiftWeek(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedAppointment, addOpen, kwtGroup]);

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

  /** Uren die de school echt gebruikt; het vroegste lesuur wordt kolom 1. */
  const schoolHours = useMemo(() => {
    const starts = filtered.map((a) => Number(a.start.slice(11, 13))).filter((h) => Number.isFinite(h));
    const ends = filtered.map((a) => Number(a.end.slice(11, 13))).filter((h) => Number.isFinite(h));
    if (!starts.length) return [8, 9, 10, 11, 12, 13, 14, 15, 16];
    const first = Math.min(...starts);
    const last = Math.max(...starts, ...ends);
    return Array.from({ length: Math.max(1, last - first + 1) }, (_, i) => first + i);
  }, [filtered]);

  const dayStats = (iso: string) => {
    const appts = filtered.filter((a) => a.start.slice(0, 10) === iso);
    const active = appts.filter((a) => !a.cancelled);
    const gaps = findFreeGaps(active);
    return {
      appts, active, gaps,
      start: active.length ? timeLabel(active[0].start) : "—",
      end: active.length ? timeLabel(active[active.length - 1].end) : "—",
      gapMinutes: gaps.reduce((s, g) => s + g.minutes, 0),
    };
  };

  const renderAppointment = (a: Appointment, compact = false) => {
    const subject = data.subjects.find((s) => s.id === a.subjectId);
    const current = new Date(a.start) <= now && new Date(a.end) > now;
    return (
      <motion.div key={a.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -1 }}
        role="button" tabIndex={0}
        aria-label={`${a.title}, ${timeLabel(a.start)} tot ${timeLabel(a.end)} — open details`}
        onClick={() => setSelectedAppointment(a)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedAppointment(a); } }}
        className={`relative cursor-pointer overflow-hidden rounded-xl border p-2.5 transition hover:border-accent/50 ${a.cancelled ? "border-rose-500/60 bg-rose-500/[0.12]" : a.type === "toets" ? "border-amber-400/50 bg-amber-400/[0.08] ring-1 ring-amber-400/20" : "border-slate-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]"} ${current ? "ring-2 ring-accent/50" : ""}`}
        style={{ borderLeftColor: a.cancelled ? "#f43f5e" : a.type === "toets" ? "#f59e0b" : subject?.color, borderLeftWidth: 3 }}>
        {current && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" style={{ width: `${progressInLesson(a.start, a.end, now)}%` }} />}
        <div className="flex items-start justify-between gap-1">
          <p className={`truncate text-[11px] font-bold ${a.cancelled ? "text-rose-400 line-through" : "text-slate-800 dark:text-white/85"}`}>{a.title}</p>
          {a.type === "toets" && <span className="flex shrink-0 items-center gap-1 rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-sm"><ClipboardCheck size={10} />{a.toetsType ?? "toets"}</span>}
          {a.kwtGroupId && <Pill tone="accent">KWT</Pill>}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
          <span className="mono">{timeLabel(a.start)}</span>
          <span className="flex items-center gap-0.5"><MapPin size={9} />{a.location}</span>
          {subject && <SubjectBadge subjectId={subject.id} label={subject.short} showDot={false} className="ml-auto !text-[9px]" />}
        </div>
        {a.originalLocation && a.originalLocation !== a.location && (
          <p className="mt-1 flex items-center gap-1 text-[9px] font-bold text-amber-400"><AlertTriangle size={9} /> was {a.originalLocation}</p>
        )}
        {a.cancelled && <p className="mt-1 text-[9px] font-bold text-rose-400">LES UITGEVALLEN</p>}
        {!compact && a.teacherId && <p className="mt-1 text-[9px] text-slate-400">{data.teachers.find((t) => t.id === a.teacherId)?.name ?? "Onbekende docent"} · bron: {a.source}</p>}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="mb-1 text-xs font-medium text-accent">Super-Rooster</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Rooster & Zermelo Hub</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Magister + Zermelo samengevoegd tot één waarheid.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { downloadICS(allAppointments, data.subjects, data.teachers); toast("Rooster geëxporteerd", "success", "Open de .ics in Apple- of Google Calendar."); }} className="btn-secondary"><Download size={15} /> Exporteer .ics</button>
          <button onClick={() => setAddOpen(true)} className="btn-primary"><CalendarPlus size={15} /> Toets/toevoegen</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.02]">
          {([["dag", CalendarDays], ["week", Columns3], ["raster", Table2], ["maand", Grid3x3], ["agenda", List]] as const).map(([id, Icon]) => (
            <button key={id} onClick={() => setView(id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === id ? "bg-accent/12 text-accent" : "text-slate-500 hover:text-slate-800 dark:text-white/45"}`}><Icon size={14} />{id}</button>
          ))}
        </div>
        <select className="input !w-auto !py-2" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="all">Alle vakken</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <button title="Vorige week (←)" aria-label="Vorige week" onClick={() => shiftWeek(-1)} className="btn-ghost !p-1.5"><ChevronLeft size={15} /></button>
          <input type="date" aria-label="Kies datum" className="input !w-auto !border-0 !bg-transparent !py-1.5" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
          <button title="Volgende week (→)" aria-label="Volgende week" onClick={() => shiftWeek(1)} className="btn-ghost !p-1.5"><ChevronRight size={15} /></button>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400"><Radio size={13} className="text-emerald-400" /> Zermelo leidend voor lokaal & uitval · pijltjes = 1 week</span>
      </div>

      {/* Grote rode uitvalmelding */}
      {(() => {
        const cancelled = allAppointments
          .filter((a) => a.cancelled && new Date(a.end) >= new Date(now.toISOString().slice(0, 10) + "T00:00:00"))
          .sort((a, b) => a.start.localeCompare(b.start));
        if (!cancelled.length) return null;
        return (
          <motion.section initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border-2 border-rose-500 bg-gradient-to-r from-rose-600/25 via-rose-500/15 to-rose-600/10 p-5 shadow-[0_0_40px_-12px_rgba(244,63,94,0.6)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white"><AlertTriangle size={24} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">Lesuitval · {cancelled.length} {cancelled.length === 1 ? "les" : "lessen"}</p>
                <h2 className="mt-0.5 text-lg font-black text-rose-100">{cancelled[0].title} valt uit</h2>
                <p className="mt-1 text-xs text-rose-200/80">
                  {shortDate(cancelled[0].start)} · {timeLabel(cancelled[0].start)} · {" "}
                  {cancelled[0].subjectId ? <SubjectBadge subjectId={cancelled[0].subjectId} className="!text-rose-200" /> : "Onbekend vak"}
                  {cancelled.length > 1 && ` · en nog ${cancelled.length - 1} andere${cancelled.length === 2 ? "" : "n"}`}
                </p>
              </div>
              <Pill tone="red">GEANNULEERD</Pill>
            </div>
          </motion.section>
        );
      })()}

      {/* KWT-blokken */}
      <section>
        <div className="mb-3 flex items-center gap-2"><Sparkles size={17} className="text-accent" /><h2 className="section-title">Openstaande keuzeblokken · Magister + Zermelo</h2><Pill tone="green">Live</Pill></div>
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

      {view === "raster" && (() => {
        const pad = (n: number) => String(n).padStart(2, "0");
        const HOUR_PX = 72;
        const firstHour = schoolHours[0] ?? 8;
        const gridHeight = schoolHours.length * HOUR_PX;
        const dayStart = (iso: string) => new Date(`${iso}T${pad(firstHour)}:00:00`).getTime();
        const box = (iso: string, start: string, end: string) => {
          const topPx = (new Date(start).getTime() - dayStart(iso)) / 3_600_000 * HOUR_PX;
          const bottomPx = (new Date(end).getTime() - dayStart(iso)) / 3_600_000 * HOUR_PX;
          const top = Math.max(0, Math.min(gridHeight, topPx));
          const height = Math.max(20, Math.min(gridHeight, bottomPx) - top);
          return { top, height };
        };
        const gapsFor = (appts: Appointment[]) => {
          const sorted = [...appts].sort((a, b) => a.start.localeCompare(b.start));
          return sorted.slice(0, -1).flatMap((a, i) => {
            const next = sorted[i + 1];
            const minutes = Math.round((new Date(next.start).getTime() - new Date(a.end).getTime()) / 60_000);
            if (minutes < 15) return [];
            const lunch = new Date(a.end).getHours() < 13 && new Date(next.start).getHours() >= 12 && minutes >= 30;
            return [{ start: a.end, end: next.start, minutes, label: lunch ? "Lunchpauze" : minutes >= 45 ? "Pauze" : "Tussenuur" }];
          });
        };
        const lanesFor = (appts: Appointment[]) => {
          const sorted = [...appts].sort((a, b) => a.start.localeCompare(b.start));
          const ends: number[] = [];
          const lanes: Record<string, number> = {};
          sorted.forEach((a) => {
            const start = new Date(a.start).getTime();
            let lane = ends.findIndex((end) => end <= start);
            if (lane < 0) { lane = ends.length; ends.push(0); }
            ends[lane] = new Date(a.end).getTime();
            lanes[a.id] = lane;
          });
          return { lanes, count: Math.max(1, ends.length) };
        };
        return (
          <section className="panel overflow-hidden p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-base font-bold text-slate-900 dark:text-white">Urenraster</h2>
                <p className="text-[11px] text-slate-400">Dagen bovenaan, uren naar beneden · eerste rij = {pad(firstHour)}:00 (1e uur)</p></div>
              <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-accent" />Les</span>
                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-amber-400" />Toets</span>
                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-dashed border-emerald-400" />Pauze/tussenuur</span>
                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-rose-500" />Uitval</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[1080px]">
                <div className="flex border-b border-slate-200 dark:border-white/[0.08]">
                  <div className="w-16 shrink-0 px-2 pb-2 text-[9px] font-bold uppercase text-slate-400">Tijd</div>
                  <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(140px, 1fr))` }}>
                    {weekDays.map((iso) => (
                      <div key={iso} className="border-l border-slate-200 px-1 pb-2 text-center dark:border-white/[0.06]">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-accent">{new Date(iso + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "short" })}</p>
                        <p className="mono text-[10px] text-slate-500 dark:text-white/50">{iso.slice(8)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex">
                  <div className="w-16 shrink-0 border-r border-slate-200 dark:border-white/[0.06]" style={{ height: gridHeight }}>
                    {schoolHours.map((hour, i) => (
                      <div key={hour} className="border-b border-slate-100 pr-2 text-right dark:border-white/[0.05]" style={{ height: HOUR_PX }}>
                        <p className="mono pt-1 text-[10px] font-semibold text-slate-600 dark:text-white/70">{pad(hour)}:00</p>
                        <p className="text-[8px] uppercase text-slate-400">{i + 1}e</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(140px, 1fr))` }}>
                    {weekDays.map((iso) => {
                      const stats = dayStats(iso);
                      const gaps = gapsFor(stats.active);
                      const { lanes, count } = lanesFor(stats.appts);
                      return (
                        <div key={iso} className={`relative border-l border-slate-200 dark:border-white/[0.06] ${iso === now.toISOString().slice(0, 10) ? "bg-accent/[0.035]" : ""}`} style={{ height: gridHeight }}>
                          <div className="absolute inset-0 grid" style={{ gridTemplateRows: `repeat(${schoolHours.length}, ${HOUR_PX}px)` }}>
                            {schoolHours.map((hour) => <div key={hour} className="border-b border-slate-100 dark:border-white/[0.05]" />)}
                          </div>
                          {gaps.map((gap) => {
                            const { top, height } = box(iso, gap.start, gap.end);
                            return (
                              <div key={`${gap.start}-${gap.end}`} style={{ top, height }}
                                className="absolute left-1 right-1 flex items-center justify-center overflow-hidden rounded-md border border-dashed border-emerald-400/60 bg-emerald-400/[0.08] px-0.5 text-center text-[8px] font-bold text-emerald-500" title={`${gap.label}: ${gap.minutes} minuten`}>
                                <span className="truncate">{gap.label} · {gap.minutes}m</span>
                              </div>
                            );
                          })}
                          {stats.appts.map((a) => {
                            const subject = data.subjects.find((s) => s.id === a.subjectId);
                            const { top, height } = box(iso, a.start, a.end);
                            const lane = lanes[a.id] ?? 0;
                            return (
                              <motion.div key={a.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.02 }}
                                role="button" tabIndex={0}
                                aria-label={`${a.title}, ${timeLabel(a.start)} — open details`}
                                onClick={() => setSelectedAppointment(a)}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedAppointment(a); } }}
                                style={{ top, height, left: `calc(${lane * 100 / count}% + 3px)`, width: `calc(${100 / count}% - 6px)`, background: a.cancelled ? "rgba(244,63,94,0.22)" : a.type === "toets" ? "rgba(245,158,11,0.18)" : `${subject?.color ?? "#6366f1"}26`, borderColor: a.cancelled ? "#f43f5e" : a.type === "toets" ? "#f59e0b" : subject?.color ?? "#6366f1" }}
                                className="absolute cursor-pointer overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left">
                                <p className={`truncate text-[9px] font-bold ${a.cancelled ? "text-rose-400 line-through" : "text-slate-800 dark:text-white/85"}`}>{a.title}</p>
                                <p className="mono truncate text-[8px] text-slate-500 dark:text-white/45">{timeLabel(a.start)} {a.type === "toets" && "· TOETS"}{a.cancelled && " · UITVAL"}</p>
                              </motion.div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-slate-400">Pauzes en tussenuren worden automatisch afgeleid uit de tijd tussen twee lessen. Klik op een les voor details en acties.</p>
          </section>
        );
      })()}

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
              <button type="button" key={a.id} onClick={() => setSelectedAppointment(a)} className="flex w-full items-center gap-4 p-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                <div className="w-16 shrink-0 text-center"><p className="mono text-sm font-bold text-slate-900 dark:text-white">{a.start.slice(8, 10)}</p><p className="text-[9px] uppercase text-slate-400">{new Date(a.start + "T12:00:00").toLocaleDateString("nl-NL", { month: "short" })}</p></div>
                <span className="h-9 w-1 rounded-full" style={{ background: subject?.color ?? "#64748b" }} />
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800 dark:text-white/85">{a.title}</p><p className="text-[10px] text-slate-400">{subject?.name} · {a.location} · {data.teachers.find((t) => t.id === a.teacherId)?.name ?? "—"}</p></div>
                <span className="mono text-xs text-slate-500 dark:text-white/50">{timeLabel(a.start)}</span>
                {a.type === "toets" && <span className="flex shrink-0 items-center gap-1 rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white"><ClipboardCheck size={10} />{a.toetsType ?? "toets"}</span>}
                {a.cancelled && <Pill tone="red">uitval</Pill>}
              </button>
            );
          })}
        </section>
      )}

      <Modal
        open={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointment(null)}
        title={selectedAppointment?.title ?? "Les"}
        subtitle={selectedAppointment
          ? `${shortDate(selectedAppointment.start)} · ${timeLabel(selectedAppointment.start)}–${timeLabel(selectedAppointment.end)} · bron: ${selectedAppointment.source}`
          : undefined}
      >
        {selectedAppointment && (() => {
          const a = selectedAppointment;
          const subjectId = a.subjectId;
          const subject = data.subjects.find((s) => s.id === subjectId);
          const teacher = data.teachers.find((t) => t.id === a.teacherId)?.name;
          const group = data.choiceGroups.find((g) => g.id === a.kwtGroupId);
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {a.cancelled && <Pill tone="red">Les uitgevallen</Pill>}
                {a.type === "toets" && <Pill tone="amber">{a.toetsType ?? "Toets"}</Pill>}
                {group && <Pill tone="accent">KWT · {group.title}</Pill>}
                {!a.cancelled && a.type !== "toets" && !group && <Pill tone="green">Normale les</Pill>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vak</p><div className="mt-1 text-sm font-semibold text-slate-800 dark:text-white/90">{subject ? <SubjectBadge subjectId={subject.id} /> : "Onbekend vak"}</div></div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tijd</p><p className="mono mt-1 text-sm font-semibold text-slate-800 dark:text-white/90">{timeLabel(a.start)} – {timeLabel(a.end)}</p></div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lokaal</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white/90"><MapPin size={13} className="text-accent" />{a.location || "Onbekend"}</p>{a.originalLocation && a.originalLocation !== a.location && <p className="mt-1 text-[10px] font-bold text-amber-400">was {a.originalLocation}</p>}</div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Docent</p><p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white/90">{teacher ?? a.teacherId ?? "Onbekend"}</p></div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-white/[0.08]">
                <button className="btn-primary" onClick={() => { window.dispatchEvent(new CustomEvent("magisterpro:focus", { detail: { subjectId: a.subjectId } })); toast("Focus gestart", "success", `Je focust op ${subject?.name ?? "dit vak"}.`); setSelectedAppointment(null); }}><Clock3 size={14} /> Focus starten</button>
                {subjectId && <button className="btn-secondary" onClick={() => { router.push(`/grades?subject=${encodeURIComponent(subjectId)}`); setSelectedAppointment(null); }}>Bekijk vak</button>}
                {subjectId && <button className="btn-secondary" onClick={() => { addHomework(`${a.title} — voorbereiding`, subjectId, a.start); toast("Studieblok toegevoegd", "success", "Staat nu in je planner."); setSelectedAppointment(null); router.push("/planner"); }}>Maak studieblok</button>}
                {group && <button className="btn-secondary" onClick={() => { setKwtGroup(group); setSelectedAppointment(null); }}><Sparkles size={14} /> Open keuze</button>}
              </div>
            </div>
          );
        })()}
      </Modal>
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
