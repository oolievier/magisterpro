"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CalendarClock, BookOpen, CheckCircle2, Siren, BellRing, ChevronRight } from "lucide-react";
import { useApp } from "@/app/providers";
import { daysUntil, hoursUntil, relativeDeadline } from "@/lib/format";
import { Pill } from "@/components/ui/Primitives";

export function ActionRadar() {
  const { now, data, choiceGroups, state } = useApp();
  const unenrolled = choiceGroups.filter((g) => g.mandatory && !state.enrollments[g.id]);
  const changes = data.appointments.filter((a) => a.isNew && new Date(a.start) >= now).slice(0, 3);
  const deadlines = data.eloAssignments.filter((e) => e.status === "open" && hoursUntil(e.deadline, now) <= 48);
  const total = unenrolled.length + changes.length + deadlines.length;

  const items = [
    ...unenrolled.map((g) => ({
      id: `kwt-${g.id}`, tone: "red" as const, icon: Siren,
      title: "Verplichte Zermelo-keuzeles nog niet gekozen",
      detail: `${g.title} · sluit ${relativeDeadline(g.deadline, now)}`,
      href: "/schedule?kwt=1", action: "Nu kiezen", pill: `${daysUntil(g.deadline, now)} dagen`,
    })),
    ...changes.map((a) => ({
      id: `change-${a.id}`, tone: "amber" as const, icon: CalendarClock,
      title: a.cancelled ? "Lesuitval op komst" : "Lokaalwijziging gemeld",
      detail: `${a.title} · ${a.location}${a.originalLocation ? ` (was ${a.originalLocation})` : ""}`,
      href: "/schedule", action: "Bekijk rooster", pill: new Date(a.start).toLocaleDateString("nl-NL", { weekday: "short" }),
    })),
    ...deadlines.map((e) => ({
      id: `elo-${e.id}`, tone: "blue" as const, icon: BookOpen,
      title: "Inleveropdracht sluit binnen 48 uur",
      detail: e.title,
      href: "/elo", action: "Naar ELO", pill: relativeDeadline(e.deadline, now),
    })),
  ];

  const styles = {
    red: "border-rose-500/25 bg-rose-500/[0.07] text-rose-400",
    amber: "border-amber-500/25 bg-amber-500/[0.07] text-amber-400",
    blue: "border-blue-500/25 bg-blue-500/[0.07] text-blue-400",
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRing size={17} className="text-accent" />
          <h2 className="section-title">Actie-Radar</h2>
          <Pill tone={total ? "red" : "green"}>{total} meldingen</Pill>
        </div>
      </div>
      {total === 0 ? (
        <div className="panel flex items-center gap-3 p-5 text-sm text-emerald-500">
          <CheckCircle2 size={20} /> Alles onder controle — geen urgente acties.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={item.href} className={`group flex h-full items-start gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${styles[item.tone]}`}>
                  <span className="rounded-xl bg-white/10 p-2"><Icon size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-snug text-slate-900 dark:text-white/90">{item.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-70">{item.detail}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[11px] font-bold group-hover:gap-2 transition-all">{item.action} <ArrowRight size={12} /></span>
                      <span className="mono rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{item.pill}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
      <Link href="/messages" className="mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-[11px] font-medium text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/5">
        Bekijk alle schoolberichten <ChevronRight size={14} />
      </Link>
      {total > 0 && <span className="sr-only"><AlertTriangle /></span>}
    </section>
  );
}
