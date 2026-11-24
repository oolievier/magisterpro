"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpenText, ClipboardList, NotebookPen, Download, CheckCircle2, Clock3, Paperclip, ChevronDown, Eye, Pencil, Send, FileText, CalendarClock } from "lucide-react";
import { useApp } from "@/app/providers";
import { Pill, ProgressBar } from "@/components/ui/Primitives";
import { daysUntil, relativeDeadline, shortDate } from "@/lib/format";
import { toast } from "@/components/ui/Toaster";
import type { EloStatus } from "@/lib/types";

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-invert space-y-2 text-xs leading-relaxed text-slate-600 dark:text-white/60">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h3 key={i} className="text-sm font-bold text-slate-900 dark:text-white">{line.slice(2)}</h3>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="mono rounded-lg bg-slate-50 p-2 font-semibold text-slate-700 dark:bg-white/[0.04] dark:text-white/80">{line.slice(2, -2)}</p>;
        if (line.startsWith("- [ ] ")) return <p key={i} className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-slate-300 dark:border-white/20" />{line.slice(6)}</p>;
        if (line.startsWith("- ")) return <p key={i} className="flex gap-2"><span className="text-accent">•</span>{line.slice(2)}</p>;
        return line.trim() ? <p key={i}>{line}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function EloPage() {
  const { data, state, setEloStatus, setSubjectNote } = useApp();
  const [tab, setTab] = useState<"guides" | "assignments" | "notes">("guides");
  const [guideSubject, setGuideSubject] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(data.studyGuides[0]?.id ?? null);
  const [noteSubject, setNoteSubject] = useState(data.subjects[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.notes[data.subjects[0]?.id ?? ""] ?? "");

  const guides = useMemo(() => data.studyGuides.filter((g) => guideSubject === "all" || g.subjectId === guideSubject).sort((a, b) => b.week - a.week), [data.studyGuides, guideSubject]);
  const assignments = data.eloAssignments;
  const openCount = assignments.filter((a) => a.status === "open").length;
  const note = state.notes[noteSubject] ?? "";

  const download = (name: string, content: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = name.replace(/\.[^.]+$/, ".txt"); a.click(); URL.revokeObjectURL(url);
    toast("Bijlage gedownload", "success", name);
  };

  const setStatus = (id: string, s: EloStatus) => {
    setEloStatus(id, s);
    toast("Status bijgewerkt", "success", s === "submitted" ? "Opdracht gemarkeerd als ingeleverd." : s === "graded" ? "Opdracht gemarkeerd als beoordeeld." : "Opdracht weer geopend.");
  };

  return (
    <div className="space-y-6">
      <div><p className="mb-1 text-xs font-medium text-accent">Studiewijzer & ELO</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Geen klik-doolhof meer</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Alle studiewijzers, opdrachten en notities overzichtelijk bij elkaar.</p></div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.02]">
          {([["guides", BookOpenText, "Studiewijzers"], ["assignments", ClipboardList, "Inleveropdrachten"], ["notes", NotebookPen, "Mijn notities"]] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === id ? "bg-accent/12 text-accent" : "text-slate-500 dark:text-white/45"}`}><Icon size={14} />{label}{id === "assignments" && openCount > 0 && <span className="mono rounded bg-rose-500/15 px-1 text-[9px] text-rose-400">{openCount}</span>}</button>
          ))}
        </div>
        {tab === "guides" && <select className="input !w-auto !py-2" value={guideSubject} onChange={(e) => setGuideSubject(e.target.value)}><option value="all">Alle vakken</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      </div>

      {tab === "guides" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {guides.map((g, i) => {
            const subject = data.subjects.find((s) => s.id === g.subjectId)!;
            const isOpen = expanded === g.id;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="panel overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : g.id)} className="flex w-full items-center gap-3 p-4 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white" style={{ background: subject.color }}>{subject.code}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900 dark:text-white/90">{g.title}</p><p className="text-[10px] text-slate-400">{subject.name} · week {g.week} · bijgewerkt {shortDate(g.updatedAt)}</p></div>
                  <Pill tone="accent">week {g.week}</Pill><ChevronDown size={15} className={`text-slate-300 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-white/[0.07]">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Leerdoelen</p>
                    <div className="space-y-1.5">{g.goals.map((goal) => <p key={goal} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-white/60"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400" />{goal}</p>)}</div>
                    <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Bijlagen</p>
                    <div className="flex flex-wrap gap-2">{g.attachments.map((a) => (
                      <button key={a} onClick={() => download(a, `MagisterPro — ${g.title}\n\nVak: ${subject.name}\nWeek: ${g.week}\n\nLeerdoelen:\n${g.goals.map((x) => `- ${x}`).join("\n")}\n\nBijlage: ${a}`)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 transition hover:border-accent/40 hover:text-accent dark:border-white/10 dark:text-white/60"><Paperclip size={11} />{a}<Download size={11} /></button>
                    ))}</div>
                    <button onClick={() => { setTab("notes"); setNoteSubject(subject.id); setDraft(state.notes[subject.id] ?? ""); }} className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-accent">Open vak-notities <span>→</span></button>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {tab === "assignments" && (
        <div className="space-y-3">
          {assignments.map((e, i) => {
            const subject = data.subjects.find((s) => s.id === e.subjectId)!;
            const tone = e.status === "open" ? (daysUntil(e.deadline) <= 2 ? "red" : "blue") : e.status === "submitted" ? "amber" : "green";
            return (
              <motion.div key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white" style={{ background: subject.color }}>{subject.code}</span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-slate-900 dark:text-white/90">{e.title}</p>{e.isNew && <span className="new-badge">Nieuw</span>}<Pill tone={tone}>{e.status === "open" ? "Nog in te leveren" : e.status === "submitted" ? "Ingeleverd" : "Beoordeeld"}</Pill></div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-white/45">{e.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400"><span className="flex items-center gap-1"><CalendarClock size={11} />{shortDate(e.deadline)} · {relativeDeadline(e.deadline)}</span><span className="flex items-center gap-1"><Paperclip size={11} />{e.attachmentCount} bijlagen</span>{e.grade !== undefined && <span className="mono font-bold text-emerald-400">cijfer {e.grade.toFixed(1)}</span>}</div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {e.status === "open" ? (
                    <><button onClick={() => download(e.title, `${e.title}\n\n${e.description}\n\nVak: ${subject.name}\nDeadline: ${e.deadline}`)} className="btn-secondary !px-2.5"><Download size={14} /></button>
                      <button onClick={() => setStatus(e.id, "submitted")} className="btn-primary"><Send size={14} /> Markeer ingeleverd</button></>
                  ) : (
                    <><button onClick={() => setStatus(e.id, "open")} className="btn-secondary">Heropen</button>
                      {e.status === "submitted" && <button onClick={() => setStatus(e.id, "graded")} className="btn-secondary"><CheckCircle2 size={14} /> Markeer beoordeeld</button>}</>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {tab === "notes" && (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="panel space-y-1 p-2">
            {data.subjects.map((s) => (
              <button key={s.id} onClick={() => { setNoteSubject(s.id); setDraft(state.notes[s.id] ?? ""); setEditing(false); }} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${noteSubject === s.id ? "bg-accent/10 font-semibold text-accent" : "text-slate-600 hover:bg-slate-50 dark:text-white/55 dark:hover:bg-white/5"}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}
              </button>
            ))}
          </div>
          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="section-title">Notities & formuleblad</h2><p className="text-xs text-slate-400">{data.subjects.find((s) => s.id === noteSubject)?.name} · lokaal opgeslagen</p></div>
              <button onClick={() => { setEditing(!editing); if (editing) { setSubjectNote(noteSubject, draft); toast("Notities opgeslagen", "success"); } }} className={editing ? "btn-primary" : "btn-secondary"}>
                {editing ? <><CheckCircle2 size={14} /> Opslaan</> : <><Pencil size={14} /> Bewerken</>}
              </button>
            </div>
            {editing ? (
              <textarea className="input mono min-h-[420px] !leading-relaxed" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="# Mijn aantekeningen&#10;**Formule:** ..." />
            ) : note.trim() ? <div className="min-h-[420px] rounded-xl border border-slate-200 p-4 dark:border-white/[0.08]"><Markdown text={note} /></div>
              : <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-slate-400"><FileText size={30} /><p className="text-xs">Nog geen notities voor dit vak.</p></div>}
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400"><Eye size={11} /> Markdown wordt automatisch vertaald naar leesbare opmaak.</p>
          </div>
        </div>
      )}
    </div>
  );
}
