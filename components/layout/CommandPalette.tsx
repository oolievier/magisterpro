"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, CornerDownLeft, ArrowRight, Calculator, GraduationCap, CalendarDays,
  ListTodo, BookOpenText, MessageSquareText, ShieldCheck, Settings2, LayoutDashboard,
  ClipboardCheck, UserRound, Timer, Download, Sparkles, Zap, X,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { NAV } from "./Sidebar";
import { toast } from "@/components/ui/Toaster";
import { conflictsFor, downloadICS } from "@/lib/calculations/planner";
import { zermelo } from "@/lib/api/zermelo";
import { formatGrade } from "@/lib/calculations/grades";

interface Result {
  id: string;
  group: string;
  label: string;
  detail: string;
  icon: typeof Search;
  keywords?: string;
  action: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const app = useApp();
  const { data, state, now, enroll, appointments } = app;
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const go = (href: string) => { router.push(href); onClose(); };

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const list: Result[] = [];

    NAV.forEach((n) => list.push({
      id: `nav-${n.href}`, group: "Navigatie", label: n.label, detail: "Ga naar module", icon: n.icon,
      action: () => go(n.href),
    }));
    list.push({ id: "nav-settings", group: "Navigatie", label: "Instellingen & koppeling", detail: "School, token, niveau", icon: Settings2, action: () => go("/settings") });

    data.subjects.forEach((s) => {
      list.push({
        id: `subject-${s.id}`, group: "Vakken", label: s.name, detail: `Vakpagina · gemiddelde ${formatGrade(data.grades.filter((g) => g.subjectId === s.id).reduce((a, g) => a + g.value * g.weight, 0) / Math.max(1, data.grades.filter((g) => g.subjectId === s.id).reduce((a, g) => a + g.weight, 0)))}`,
        icon: GraduationCap, keywords: s.code,
        action: () => go(`/grades?subject=${s.id}`),
      });
      list.push({
        id: `calc-${s.id}`, group: "Cijfercalculator", label: `Wat moet ik halen voor ${s.name}?`, detail: "Open de 'wat moet ik halen' simulator", icon: Calculator, keywords: "wat moet ik halen rekenen cijfer",
        action: () => go(`/grades?subject=${s.id}&calc=1`),
      });
    });

    app.choiceGroups.forEach((g) => g.options.forEach((o) => {
      const subject = data.subjects.find((s) => s.id === o.subjectId);
      list.push({
        id: `choice-${o.id}`, group: "Zermelo keuzelessen", label: o.title,
        detail: `${o.enrolled}/${o.capacity} plekken · ${o.location} · ${subject?.name ?? "algemeen"}`,
        icon: Sparkles, keywords: `kwt keuzeles zermelo ${g.title}`,
        action: async () => {
          const conflicts = conflictsFor(o, appointments);
          if (conflicts.length) {
            toast("Conflict met je rooster", "warning", `Deze les overlapt met ${conflicts[0].title}.`);
            return;
          }
          if (o.enrolled >= o.capacity) {
            toast("Deze keuzeles is vol", "warning");
            return;
          }
          if (!state.connection.zermeloToken) {
            toast("Zermelo niet gekoppeld", "warning", "Koppel eerst je Zermelo-account via Instellingen.");
            return;
          }
          const res = await zermelo.enroll(
            { subdomain: state.connection.zermeloSubdomain, token: state.connection.zermeloToken },
            g.id, o.id
          );
          if (!res.ok) { toast("Zermelo inschrijving mislukt", "warning", res.error); return; }
          enroll(g.id, o.id);
          toast("Ingeschreven via Zermelo", "success", o.title);
          go("/schedule");
        },
      });
    }));

    data.teachers.forEach((t) => list.push({
      id: `teacher-${t.id}`, group: "Docenten", label: t.name, detail: `${t.abbreviation} · ${t.subjects.join(", ")}`, icon: UserRound, keywords: "docent leraar mail bericht",
      action: () => go(`/messages?teacher=${t.id}`),
    }));

    data.homework.filter((h) => h.status !== "done").forEach((h) => {
      const s = data.subjects.find((x) => x.id === h.subjectId);
      list.push({ id: `hw-${h.id}`, group: "Huiswerk", label: h.title, detail: `${s?.name ?? ""} · deadline ${new Date(h.due).toLocaleDateString("nl-NL")}`, icon: ListTodo,
        action: () => go(`/planner?task=${h.id}`) });
    });

    list.push(
      { id: "action-focus", group: "Acties", label: "Start een focus-sessie", detail: "25/5 of 50/10 Pomodoro", icon: Timer, keywords: "timer studeren pomo", action: () => { window.dispatchEvent(new CustomEvent("magisterpro:focus")); onClose(); } },
      { id: "action-test", group: "Acties", label: "Toets toevoegen", detail: "Plan een nieuwe toets of taak", icon: ClipboardCheck, keywords: "toets toevoegen nieuw", action: () => go("/planner?add=1") },
      { id: "action-export", group: "Acties", label: "Exporteer rooster (.ics)", detail: "Magister + Zermelo gecombineerd", icon: Download, keywords: "export calendar ics", action: () => { downloadICS(appointments, data.subjects); toast("Rooster geëxporteerd", "success", "magisterpro-rooster.ics"); onClose(); } },
      { id: "action-grade", group: "Acties", label: "Cijferstudio openen", detail: "Slaag/zak-check en simulaties", icon: Zap, keywords: "slaag zak simulator", action: () => go("/grades") },
    );

    if (!q) return list.slice(0, 12);
    const words = q.split(/\s+/);
    return list
      .map((r) => {
        const text = `${r.label} ${r.detail} ${r.group} ${r.keywords ?? ""}`.toLowerCase();
        const score = words.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0) + (r.label.toLowerCase().includes(q) ? 3 : 0);
        return { r, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 14)
      .map((x) => x.r);
  }, [query, data, app, state, appointments, enroll]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); results[index]?.action(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, index]);

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm"
          onMouseDown={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#101019] shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
              <Search size={19} className="text-accent" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
                placeholder="Zoek een vak, cijfer, keuzeles, docent of actie…"
                className="h-14 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/30"
              />
              <button onClick={onClose} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"><X size={16} /></button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <Search size={28} className="mx-auto mb-3 text-white/20" />
                  <p className="text-sm font-medium text-white/70">Geen resultaten voor “{query}”</p>
                  <p className="mt-1 text-xs text-white/35">Probeer een vak, docent of “wat moet ik halen”.</p>
                </div>
              )}
              {results.map((r, i) => {
                const showGroup = r.group !== lastGroup;
                lastGroup = r.group;
                const Icon = r.icon;
                return (
                  <div key={r.id}>
                    {showGroup && <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">{r.group}</p>}
                    <button
                      onMouseEnter={() => setIndex(i)}
                      onClick={r.action}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${i === index ? "bg-accent/15" : "hover:bg-white/[0.04]"}`}
                    >
                      <span className={`rounded-lg p-2 ${i === index ? "bg-accent/20 text-accent" : "bg-white/[0.05] text-white/40"}`}><Icon size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-white/90">{r.label}</span>
                        <span className="block truncate text-[11px] text-white/35">{r.detail}</span>
                      </span>
                      {i === index ? <CornerDownLeft size={14} className="text-accent" /> : <ArrowRight size={14} className="text-white/20" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-white/[0.08] px-4 py-2.5 text-[10px] text-white/30">
              <span>↑↓ navigeren</span><span>↵ uitvoeren</span><span>esc sluiten</span>
              <span className="ml-auto flex items-center gap-1"><Sparkles size={11} className="text-accent" /> MagisterPro Command</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
