"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Inbox, Send, Search, Paperclip, Mail, UserRound, MapPin, BookOpen,
  PenLine, X, CheckCheck, Filter, Users, ArrowLeft,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { Pill } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { shortDate, timeLabel, initials } from "@/lib/format";
import { toast } from "@/components/ui/Toaster";
import type { Message } from "@/lib/types";

function MessagesView() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, state, addMessage, markMessageRead } = useApp();
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox");
  const [selected, setSelected] = useState<string | null>(data.messages[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [composeOpen, setComposeOpen] = useState(params.get("teacher") !== null);
  const [recipient, setRecipient] = useState(params.get("teacher") ?? data.teachers[0].id);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mobileDetail, setMobileDetail] = useState(false);

  useEffect(() => { if (params.get("teacher")) setComposeOpen(true); }, [params]);

  const messages = useMemo(() => {
    const base = folder === "sent" ? [...state.sentMessages, ...data.messages.filter((m) => m.folder === "sent")] : data.messages.filter((m) => m.folder === "inbox");
    return base.filter((m) => {
      const text = `${m.from} ${m.subject} ${m.body}`.toLowerCase();
      return text.includes(query.toLowerCase()) && (!unreadOnly || !m.read) && (!attachmentsOnly || m.attachments > 0);
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [folder, data.messages, state.sentMessages, query, unreadOnly, attachmentsOnly]);

  const active = messages.find((m) => m.id === selected) ?? messages[0];
  const unread = data.messages.filter((m) => !m.read).length;

  const open = (m: Message) => { setSelected(m.id); setMobileDetail(true); if (!m.read) markMessageRead(m.id); };

  const teacherStats = data.teachers.map((t) => {
    const appts = data.appointments.filter((a) => a.teacherId === t.id);
    const grades = data.grades.filter((g) => g.teacherId === t.id);
    return {
      teacher: t,
      lessons: appts.length,
      locations: [...new Set(appts.map((a) => a.location))].slice(0, 3),
      avg: grades.length ? grades.reduce((s, g) => s + g.value, 0) / grades.length : 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="mb-1 text-xs font-medium text-accent">Berichten & directory</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Inbox & schoolgids</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Direct contact met docenten, alle lokalen in één kaart.</p></div>
        <button onClick={() => { setRecipient(params.get("teacher") ?? data.teachers[0].id); setComposeOpen(true); }} className="btn-primary"><PenLine size={15} /> Nieuw bericht</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr]">
        {/* Lijst */}
        <div className={`panel overflow-hidden ${mobileDetail ? "hidden lg:block" : ""}`}>
          <div className="border-b border-slate-200 p-3 dark:border-white/[0.08]">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/[0.04]">
              <button onClick={() => { setFolder("inbox"); setMobileDetail(false); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-bold transition ${folder === "inbox" ? "bg-white text-accent shadow-sm dark:bg-white/10" : "text-slate-500 dark:text-white/45"}`}><Inbox size={13} /> Inbox {unread > 0 && <span className="mono rounded bg-rose-500/15 px-1 text-[9px] text-rose-400">{unread}</span>}</button>
              <button onClick={() => { setFolder("sent"); setMobileDetail(false); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-bold transition ${folder === "sent" ? "bg-white text-accent shadow-sm dark:bg-white/10" : "text-slate-500 dark:text-white/45"}`}><Send size={13} /> Verzonden</button>
            </div>
            <div className="relative mt-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input !py-2 !pl-9 !text-xs" placeholder="Zoek berichten…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <div className="mt-2 flex gap-1.5">
              <button onClick={() => setUnreadOnly(!unreadOnly)} className={`chip !py-1 ${unreadOnly ? "!border-accent/40 !text-accent" : ""}`}><Filter size={10} /> Ongelezen</button>
              <button onClick={() => setAttachmentsOnly(!attachmentsOnly)} className={`chip !py-1 ${attachmentsOnly ? "!border-accent/40 !text-accent" : ""}`}><Paperclip size={10} /> Bijlagen</button>
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {messages.length === 0 && <p className="py-16 text-center text-xs text-slate-400">Geen berichten gevonden.</p>}
            {messages.map((m) => (
              <button key={m.id} onClick={() => open(m)} className={`flex w-full items-start gap-3 border-b border-slate-100 p-3.5 text-left transition dark:border-white/[0.05] ${active?.id === m.id ? "bg-accent/[0.06]" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: m.fromId === "system" ? "#10b981" : "#6366f1" }}>{initials(m.from)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className={`truncate text-xs ${!m.read ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-600 dark:text-white/60"}`}>{m.from}</p><span className="mono ml-auto shrink-0 text-[9px] text-slate-400">{shortDate(m.date)}</span></div>
                  <p className={`mt-0.5 truncate text-[11px] ${!m.read ? "font-semibold text-slate-700 dark:text-white/80" : "text-slate-400"}`}>{m.subject}</p>
                  <p className="mt-1 truncate text-[10px] text-slate-400">{m.body}</p>
                </div>
                {!m.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className={`panel flex min-h-[420px] flex-col ${!mobileDetail ? "hidden lg:flex" : ""}`}>
          {active ? (
            <>
              <div className="flex items-start gap-3 border-b border-slate-200 p-5 dark:border-white/[0.08]">
                <button onClick={() => setMobileDetail(false)} className="btn-ghost !p-1 lg:hidden"><ArrowLeft size={16} /></button>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{initials(active.from)}</span>
                <div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold text-slate-900 dark:text-white">{active.subject}</h2>
                  <p className="text-[11px] text-slate-400">Van <strong className="text-slate-600 dark:text-white/60">{active.from}</strong> aan {active.to} · {shortDate(active.date)} om {timeLabel(active.date)}</p></div>
                {active.attachments > 0 && <Pill tone="blue"><Paperclip size={10} /> {active.attachments}</Pill>}
              </div>
              <div className="flex-1 space-y-4 p-6 text-sm leading-relaxed text-slate-700 dark:text-white/70">
                {active.body.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
                {active.attachments > 0 && (
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Bijlagen</p>
                    {Array.from({ length: active.attachments }).map((_, i) => (
                      <button key={i} onClick={() => { const url = URL.createObjectURL(new Blob([`Bijlage ${i + 1} bij: ${active.subject}\n\n${active.body}`], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = `bijlage-${i + 1}.txt`; a.click(); URL.revokeObjectURL(url); toast("Bijlage gedownload", "success"); }} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-accent hover:bg-accent/5"><Paperclip size={12} />bijlage-{i + 1}.pdf</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-200 p-4 dark:border-white/[0.08]">
                <button onClick={() => { setRecipient(active.fromId === "me" ? active.to : active.fromId); setSubject(`Re: ${active.subject}`); setComposeOpen(true); }} className="btn-secondary w-full"><PenLine size={14} /> Antwoord sturen</button>
              </div>
            </>
          ) : <div className="flex flex-1 items-center justify-center text-xs text-slate-400">Selecteer een bericht</div>}
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2"><Users size={17} className="text-accent" /><h2 className="section-title">Docenten & lokalen gids</h2><Pill tone="accent">automatisch opgebouwd</Pill></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {teacherStats.map(({ teacher, lessons, locations, avg }, i) => (
            <motion.div key={teacher.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }} className="panel p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-fuchsia-500 text-[11px] font-bold text-white">{teacher.abbreviation}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-900 dark:text-white/90">{teacher.name}</p><p className="text-[10px] text-slate-400">{teacher.subjects.join(", ")}</p></div>
                <button onClick={() => { setRecipient(teacher.id); setSubject(""); setComposeOpen(true); }} className="btn-ghost !p-1.5" title="Bericht sturen"><Mail size={15} /></button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2 dark:bg-white/[0.03]"><p className="mono text-sm font-bold text-slate-800 dark:text-white/80">{lessons}</p><p className="text-[9px] text-slate-400">lessen</p></div>
                <div className="rounded-lg bg-slate-50 py-2 dark:bg-white/[0.03]"><p className="mono text-sm font-bold text-slate-800 dark:text-white/80">{avg ? avg.toFixed(1) : "—"}</p><p className="text-[9px] text-slate-400">gem. cijfer</p></div>
                <div className="rounded-lg bg-slate-50 py-2 dark:bg-white/[0.03]"><p className="mono text-sm font-bold text-slate-800 dark:text-white/80">{locations.length}</p><p className="text-[9px] text-slate-400">lokalen</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">{locations.map((l) => <span key={l} className="chip mono !py-0.5"><MapPin size={9} />{l}</span>)}</div>
              <p className="mt-3 truncate text-[10px] text-slate-400">{teacher.email}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <Modal open={composeOpen} onClose={() => { setComposeOpen(false); router.replace("/messages", { scroll: false }); }} title="Nieuw bericht" subtitle="Stuur direct naar een docent of medeleerling">
        <div className="space-y-4">
          <div><label className="label">Ontvanger</label><select className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
            <optgroup label="Docenten">{data.teachers.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.subjects.join(", ")}</option>)}</optgroup>
            <optgroup label="Medeleerlingen"><option value="student1">Lotte Jansen (5 VWO B)</option><option value="student2">Thijs de Groot (5 VWO B)</option><option value="student3">Noor El Amrani (5 VWO B)</option></optgroup>
          </select></div>
          <div><label className="label">Onderwerp</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Waar gaat je bericht over?" /></div>
          <div><label className="label">Bericht</label><textarea className="input min-h-[180px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Beste docent, …" /></div>
          <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setComposeOpen(false)}><X size={14} /> Annuleren</button>
            <button className="btn-primary" disabled={!subject.trim() || !body.trim()} onClick={() => {
              const teacher = data.teachers.find((t) => t.id === recipient);
              const names: Record<string, string> = { student1: "Lotte Jansen", student2: "Thijs de Groot", student3: "Noor El Amrani" };
              addMessage({ id: `sent-${Date.now()}`, from: "Ik", fromId: "me", to: teacher?.name ?? names[recipient] ?? recipient, subject, body, date: new Date().toISOString(), read: true, attachments: 0, folder: "sent" });
              toast("Bericht verzonden", "success", `Naar ${teacher?.name ?? names[recipient] ?? recipient}.`);
              setSubject(""); setBody(""); setComposeOpen(false); setFolder("sent"); router.replace("/messages", { scroll: false });
            }}><Send size={14} /> Versturen</button></div>
        </div>
      </Modal>
    </div>
  );
}

export default function MessagesPage() {
  return <Suspense fallback={<div className="py-20 text-center text-sm text-slate-400">Berichten laden…</div>}><MessagesView /></Suspense>;
}
