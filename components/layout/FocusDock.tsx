"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Timer, Play, Pause, RotateCcw, X, Volume2, VolumeX, Flame, Sparkles } from "lucide-react";
import { useApp } from "@/app/providers";
import { toast } from "@/components/ui/Toaster";
import { clockFromMinutes } from "@/lib/format";

type Sound = "off" | "white" | "brown" | "rain";

export function FocusDock() {
  const { data, state, addFocusSession } = useApp();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<25 | 50>(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [subjectId, setSubjectId] = useState<string>("");
  const [sound, setSound] = useState<Sound>("off");
  const audioRef = useRef<{ ctx: AudioContext; source: AudioBufferSourceNode; gain: GainNode } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ subjectId?: string; taskId?: string }>).detail;
      if (detail?.subjectId) setSubjectId(detail.subjectId);
      setOpen(true);
    };
    window.addEventListener("magisterpro:focus", handler);
    return () => window.removeEventListener("magisterpro:focus", handler);
  }, []);

  const stopAudio = useCallback(() => {
    audioRef.current?.source.stop();
    audioRef.current?.ctx.close().catch(() => {});
    audioRef.current = null;
  }, []);

  const startAudio = useCallback((kind: Sound) => {
    stopAudio();
    if (kind === "off" || typeof window === "undefined") return;
    try {
      const ctx = new AudioContext();
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (kind === "brown") { last = (last + 0.02 * white) / 1.02; channel[i] = last * 3.2; }
        else channel[i] = white;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = kind === "rain" ? "bandpass" : "lowpass";
      filter.frequency.value = kind === "rain" ? 1200 : kind === "brown" ? 600 : 4200;
      const gain = ctx.createGain();
      gain.gain.value = 0.035;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      audioRef.current = { ctx, source, gain };
    } catch { /* audio niet beschikbaar */ }
  }, [stopAudio]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          setRunning(false);
          stopAudio();
          addFocusSession(mode, subjectId || undefined);
          toast("Focus-sessie afgerond!", "success", `${mode} minuten studie-XP bijgeschreven.`);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, mode, subjectId, addFocusSession, stopAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const setPreset = (m: 25 | 50) => { setMode(m); setRemaining(m * 60); setRunning(false); stopAudio(); };
  const reset = () => { setRemaining(mode * 60); setRunning(false); stopAudio(); };
  const toggle = () => {
    if (running) { setRunning(false); stopAudio(); }
    else { if (remaining === 0) setRemaining(mode * 60); setRunning(true); if (sound !== "off") startAudio(sound); }
  };

  const totalMinutes = state.focusSessions.reduce((s, f) => s + f.minutes, 0);
  const level = Math.floor(totalMinutes / 120) + 1;
  const progress = totalMinutes % 120;
  const uniqueDays = new Set(state.focusSessions.map((f) => f.completedAt.slice(0, 10)));
  const streak = uniqueDays.size;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[85] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
            <motion.div
              initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onMouseDown={(e) => e.stopPropagation()}
              className="panel-raised w-full max-w-md overflow-hidden p-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-xl bg-accent/15 p-2 text-accent"><Timer size={18} /></span>
                  <div><p className="text-sm font-bold text-slate-900 dark:text-white">Focus-sessie</p><p className="text-[11px] text-slate-400">Pomodoro · studie-XP</p></div>
                </div>
                <button onClick={() => setOpen(false)} className="btn-ghost !p-1.5"><X size={17} /></button>
              </div>

              <div className="mb-5 flex gap-2">
                {([25, 50] as const).map((m) => (
                  <button key={m} onClick={() => setPreset(m)} className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${mode === m ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-white/45"}`}>
                    {m} / {m === 25 ? 5 : 10} min
                  </button>
                ))}
              </div>

              <div className="relative mx-auto mb-6 flex h-48 w-48 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-white/10" />
                  <motion.circle cx="50" cy="50" r="45" fill="none" stroke="rgb(var(--accent))" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={283} animate={{ strokeDashoffset: 283 * (1 - remaining / (mode * 60)) }} transition={{ duration: 0.5 }}
                    style={{ filter: "drop-shadow(0 0 6px rgb(var(--accent)/0.5))" }} />
                </svg>
                <div className="text-center">
                  <p className="mono text-4xl font-bold text-slate-900 dark:text-white">{clockFromMinutes(remaining)}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{running ? "Focus bezig" : remaining === 0 ? "Afgerond!" : "Gereed"}</p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div><label className="label">Vak (optioneel)</label>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input">
                    <option value="">Geen specifiek vak</option>
                    {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Ambient geluid</label>
                  <div className="flex gap-1">
                    {(["off", "brown", "rain"] as Sound[]).map((s) => (
                      <button key={s} onClick={() => { setSound(s); if (running) startAudio(s); }}
                        className={`flex-1 rounded-lg border py-2.5 text-[10px] font-semibold capitalize transition ${sound === s ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-400 dark:border-white/10"}`}>
                        {s === "off" ? <VolumeX size={13} className="mx-auto" /> : s === "rain" ? "Regen" : "Brown"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={toggle} className="btn-primary flex-1">{running ? <Pause size={16} /> : <Play size={16} />}{running ? "Pauzeren" : "Start sessie"}</button>
                <button onClick={reset} className="btn-secondary !px-3" title="Reset"><RotateCcw size={16} /></button>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-2 text-xs"><Flame size={14} className="text-orange-400" /><span className="font-semibold text-slate-700 dark:text-white/80">{streak} dagen streak</span></div>
                <div className="flex items-center gap-2 text-xs"><Sparkles size={14} className="text-accent" /><span className="font-semibold text-slate-700 dark:text-white/80">Level {level} · {progress}/120 XP</span></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {running && (
        <button onClick={() => setOpen(true)} className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-accent/30 bg-[#14141e] px-4 py-2.5 text-xs font-semibold text-white shadow-glow lg:bottom-5">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent" /></span>
          <span className="mono">{clockFromMinutes(remaining)}</span>
          <span className="hidden sm:inline">focus bezig</span>
          <Volume2 size={13} className="text-white/40" />
        </button>
      )}
    </>
  );
}
