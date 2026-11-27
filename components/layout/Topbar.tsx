"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Search, Bell, Clock3, Timer, Command, ArrowUpRight, AlertTriangle, CalendarClock, BookOpen, ChevronRight, ExternalLink } from "lucide-react";
import { useApp } from "@/app/providers";
import { ThemeControls } from "./ThemeControls";
import { NAV } from "./Sidebar";
import { daysUntil, hoursUntil } from "@/lib/format";
import { openMagister } from "@/lib/extension";

export function Topbar({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const { now, data, choiceGroups, state } = useApp();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const label = NAV.find((n) => n.href === pathname)?.label ?? (pathname === "/settings" ? "Instellingen" : "MagisterPro");

  const unenrolled = choiceGroups.filter((g) => g.mandatory && !state.enrollments[g.id]);
  const soonAssignments = data.eloAssignments.filter((e) => e.status === "open" && hoursUntil(e.deadline, now) <= 48);
  const changes = data.appointments.filter((a) => a.isNew && new Date(a.start) >= now);
  const alerts = unenrolled.length + soonAssignments.length + changes.length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/70 px-4 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#0a0a10]/70 lg:px-7">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-white/30">
          <span>MagisterPro</span><ChevronRight size={12} /><span className="truncate">{label}</span>
        </div>
        <h1 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">{label}</h1>
      </div>

      <button
        onClick={onSearch}
        className="group hidden h-9 w-56 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-400 transition hover:border-accent/40 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-white/35 dark:hover:bg-white/[0.06] md:flex xl:w-72"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Zoek of voer een actie uit…</span>
        <kbd className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          <Command size={10} />K
        </kbd>
      </button>
      <button onClick={onSearch} className="btn-ghost !p-2 md:hidden" aria-label="Zoeken"><Search size={19} /></button>

      <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03] lg:flex">
        <Clock3 size={14} className="text-accent" />
        <span className="mono text-xs font-semibold text-slate-700 dark:text-white/80">
          {now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent("magisterpro:focus"))}
        className="btn-ghost !p-2 hidden sm:inline-flex"
        title="Start een focus-sessie"
      >
        <Timer size={18} />
      </button>
      <button
        onClick={() => openMagister(state.connection.magisterSchool)}
        className="btn-ghost hidden !px-2.5 sm:inline-flex"
        title="Wissel naar het echte Magister-portaal"
        aria-label="Wissel naar Magister"
      >
        <ExternalLink size={15} />
        <span className="text-[11px] font-semibold">Magister</span>
      </button>
      <ThemeControls />

      <div className="relative">
        <button onClick={() => setAlertsOpen(!alertsOpen)} className="btn-ghost !p-2 relative" aria-label="Meldingen" title="Actie-radar">
          <Bell size={18} />
          {alerts > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{alerts}</span>}
        </button>
        <AnimatePresence>
          {alertsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAlertsOpen(false)} />
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="panel-raised absolute right-0 top-12 z-50 w-[320px] p-2">
                <div className="flex items-center justify-between px-2 py-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Actie-radar</p>
                  <span className="chip mono">{alerts}</span>
                </div>
                {alerts === 0 && <p className="px-2 py-6 text-center text-xs text-slate-400">Alles onder controle. 🎉</p>}
                {unenrolled.map((g) => (
                  <Link key={g.id} href="/schedule" onClick={() => setAlertsOpen(false)} className="flex items-start gap-2.5 rounded-xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className="rounded-lg bg-rose-500/15 p-1.5 text-rose-400"><AlertTriangle size={14} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800 dark:text-white/90">KWT niet ingeschreven</span><span className="block text-[11px] text-slate-400">{g.title} · nog {daysUntil(g.deadline, now)} dagen</span></span>
                    <ArrowUpRight size={14} className="mt-1 text-slate-400" />
                  </Link>
                ))}
                {changes.map((a) => (
                  <Link key={a.id} href="/schedule" onClick={() => setAlertsOpen(false)} className="flex items-start gap-2.5 rounded-xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className="rounded-lg bg-amber-500/15 p-1.5 text-amber-400"><CalendarClock size={14} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800 dark:text-white/90">{a.cancelled ? "Les uitgevallen" : "Lokaal gewijzigd"}</span><span className="block text-[11px] text-slate-400">{a.title} · {a.location}</span></span>
                  </Link>
                ))}
                {soonAssignments.map((e) => (
                  <Link key={e.id} href="/elo" onClick={() => setAlertsOpen(false)} className="flex items-start gap-2.5 rounded-xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className="rounded-lg bg-blue-500/15 p-1.5 text-blue-400"><BookOpen size={14} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800 dark:text-white/90">Inleveropdracht sluit binnen 48u</span><span className="block text-[11px] text-slate-400">{e.title}</span></span>
                  </Link>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
