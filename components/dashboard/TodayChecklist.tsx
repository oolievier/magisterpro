"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Circle, Plus, ListChecks, ArrowRight, X } from "lucide-react";
import { useApp } from "@/app/providers";
import { daysUntil, relativeDeadline } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toaster";

export function TodayChecklist() {
  const { data, setHomeworkStatus, addHomework, now } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id ?? "");
  const [due, setDue] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const tasks = data.homework
    .filter((h) => h.status !== "done" && daysUntil(h.due, now) <= 2)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 7);
  const doneCount = data.homework.filter((h) => h.status === "done").length;

  return (
    <section className="panel flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="section-title flex items-center gap-2"><ListChecks size={18} className="text-accent" /> Vandaag-checklist</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-white/45">Huiswerk + openstaande taken</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-ghost !p-1.5" title="Taak toevoegen"><Plus size={17} /></button>
      </div>
      <div className="space-y-1.5">
        {tasks.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Geen urgente taken. Mooi! 🎉</p>}
        {tasks.map((h) => {
          const subject = data.subjects.find((s) => s.id === h.subjectId);
          return (
            <motion.button key={h.id} whileTap={{ scale: 0.98 }} onClick={() => setHomeworkStatus(h.id, "done")}
              className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]">
              <span className="text-slate-300 transition group-hover:text-accent dark:text-white/20"><Circle size={17} /></span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject?.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-slate-800 dark:text-white/85">{h.title}</span>
                <span className="block truncate text-[10px] text-slate-400">{subject?.name} · {relativeDeadline(h.due, now)}</span>
              </span>
              {h.isNew && <span className="new-badge">Nieuw</span>}
              <Check size={14} className="text-slate-200 opacity-0 transition group-hover:opacity-100 dark:text-white/20" />
            </motion.button>
          );
        })}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-4 dark:border-white/[0.08]">
        <span className="mono text-[11px] text-slate-400">{doneCount} afgerond deze week</span>
        <Link href="/planner" className="flex items-center gap-1 text-[11px] font-semibold text-accent">Volledige planner <ArrowRight size={12} /></Link>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Nieuwe taak toevoegen" subtitle="Verschijnt direct in je checklist en planner">
        <div className="space-y-4">
          <div><label className="label">Taak</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Samenvatting hoofdstuk 7" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Vak</label><select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="label">Deadline</label><input type="datetime-local" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setAddOpen(false)}><X size={15} /> Annuleren</button>
            <button className="btn-primary" disabled={!title.trim()} onClick={() => { addHomework(title.trim(), subjectId, new Date(due).toISOString()); toast("Taak toegevoegd", "success", title); setTitle(""); setAddOpen(false); }}>Toevoegen</button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
