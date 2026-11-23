"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Clock3, AlertTriangle, Zap, CheckCircle2, CalendarDays } from "lucide-react";
import { useApp } from "@/app/providers";
import { minutesLeft, progressInLesson } from "@/lib/calculations/planner";
import { timeLabel } from "@/lib/format";
import { Pill, ProgressBar } from "@/components/ui/Primitives";

export function LiveLessonTracker() {
  const { appointments, data, now } = useApp();
  const today = now.toISOString().slice(0, 10);
  const todays = appointments.filter((a) => a.start.slice(0, 10) === today).sort((a, b) => a.start.localeCompare(b.start));
  const current = todays.find((a) => new Date(a.start) <= now && new Date(a.end) > now && !a.cancelled);
  const next = todays.find((a) => new Date(a.start) > now && !a.cancelled);
  const display = current ?? next;
  const subject = display ? data.subjects.find((s) => s.id === display.subjectId) : undefined;
  const nextAfter = current ? todays.find((a) => new Date(a.start) > now && !a.cancelled) : undefined;
  const wingChange = current && nextAfter && current.location[0] !== nextAfter.location[0];
  const lastEnd = todays.length ? todays[todays.length - 1].end : null;
  const done = todays.filter((a) => new Date(a.end) < now).length;

  return (
    <div className="panel relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Live les-tracker</p>
          </div>
          <Link href="/schedule" className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
            Volledig rooster <ArrowRight size={12} />
          </Link>
        </div>

        {display ? (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Pill tone={current ? "green" : "accent"}>{current ? "NU BEZIG" : "VOLGENDE LES"}</Pill>
                {display.type === "toets" && <Pill tone="red">{display.toetsType ?? "TOETS"}</Pill>}
                {display.cancelled && <Pill tone="red">UITGEVALLEN</Pill>}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{display.title}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-white/50">
                <span className="flex items-center gap-1.5"><Clock3 size={14} className="text-accent" /><span className="mono font-semibold text-slate-700 dark:text-white/80">{timeLabel(display.start)} – {timeLabel(display.end)}</span></span>
                <span className="flex items-center gap-1.5"><MapPin size={14} className="text-accent" /><span className="mono font-semibold text-slate-700 dark:text-white/80">{display.location}</span>
                  {display.originalLocation && display.originalLocation !== display.location && <Pill tone="amber">was {display.originalLocation}</Pill>}
                </span>
                {subject && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: subject.color }} />{subject.name}</span>}
              </div>
              {current ? (
                <div className="mt-5">
                  <div className="mb-2 flex items-end justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-white/45">Les voortgang</span>
                    <span className="mono text-sm font-bold text-slate-900 dark:text-white">{minutesLeft(display.end, now)}<span className="ml-1 text-xs font-medium text-slate-400">min over</span></span>
                  </div>
                  <ProgressBar value={progressInLesson(display.start, display.end, now)} height={8} />
                </div>
              ) : (
                <p className="mt-5 text-xs text-slate-500 dark:text-white/45">Start over <span className="mono font-bold text-accent">{Math.max(0, Math.round((new Date(display.start).getTime() - now.getTime()) / 60000))} minuten</span>.</p>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Vandaag in 10 seconden</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="mono text-xl font-bold text-slate-900 dark:text-white">{todays.length}</p><p className="text-[10px] text-slate-400">lessen</p></div>
                <div><p className="mono text-xl font-bold text-slate-900 dark:text-white">{done}</p><p className="text-[10px] text-slate-400">gehad</p></div>
                <div><p className="mono text-xl font-bold text-slate-900 dark:text-white">{lastEnd ? timeLabel(lastEnd) : "—"}</p><p className="text-[10px] text-slate-400">echt uit</p></div>
              </div>
              <div className="divider" />
              {wingChange && nextAfter ? (
                <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-300">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>Let op: na deze les wissel je van <span className="mono font-bold">{current?.location[0]}</span> naar <span className="mono font-bold">{nextAfter.location[0]}</span>-vleugel ({nextAfter.location}).</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-2.5 text-[11px] text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  <span>{nextAfter ? `Hierna: ${nextAfter.title} in ${nextAfter.location}` : "Dit was je laatste les van vandaag."}</span>
                </div>
              )}
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => window.dispatchEvent(new CustomEvent("magisterpro:focus"))}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent/10 py-2 text-[11px] font-bold text-accent transition hover:bg-accent/20">
                <Zap size={13} /> Start direct een focus-sessie
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-accent/10 p-3 text-accent"><CalendarDays size={22} /></span>
              <div><p className="text-lg font-semibold text-slate-900 dark:text-white">Geen les meer vandaag</p><p className="text-xs text-slate-400">Tijd om je planner of cijfers te bekijken.</p></div>
            </div>
            <Link href="/planner" className="btn-primary">Open planner <ArrowRight size={15} /></Link>
          </div>
        )}
      </div>
    </div>
  );
}
