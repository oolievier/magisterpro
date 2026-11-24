"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, GraduationCap, KeyRound, Link2, Loader2, LogOut, Palette,
  Radio, RefreshCw, RotateCcw, ShieldCheck, Sparkles, XCircle,
} from "lucide-react";
import { useApp, ACCENTS } from "@/app/providers";
import { exchangeZermeloCode } from "@/lib/api/zermelo";
import { toast } from "@/components/ui/Toaster";
import { Pill } from "@/components/ui/Primitives";
import type { EducationLevel, AccentName, ThemeName } from "@/lib/types";

const LEVELS: { value: EducationLevel; label: string }[] = [
  { value: "onderbouw", label: "Onderbouw (1–3)" },
  { value: "havo4", label: "4 HAVO" },
  { value: "havo5", label: "5 HAVO" },
  { value: "vwo4", label: "4 VWO" },
  { value: "vwo5", label: "5 VWO" },
  { value: "vwo6", label: "6 VWO" },
];

export default function SettingsPage() {
  const {
    state, patch, setTheme, setAccent, refresh, logout, resetLocalData,
    loading, loadError, lastSync, data,
  } = useApp();
  const c = state.connection;
  const [zSchool, setZSchool] = useState(c.zermeloSubdomain);
  const [code, setCode] = useState("");
  const [zBusy, setZBusy] = useState(false);
  const [zMessage, setZMessage] = useState("");

  const setConnection = (p: Partial<typeof c>) => patch({ connection: { ...c, ...p } });

  const linkZermelo = async () => {
    setZBusy(true);
    setZMessage("");
    const res = await exchangeZermeloCode(zSchool, code);
    if (res.ok && res.data) {
      setConnection({ zermeloSubdomain: zSchool.replace(/\.zportal\.nl.*$/, ""), zermeloToken: res.data.access_token });
      setCode("");
      setZMessage("Zermelo gekoppeld. Keuzelessen worden opnieuw geladen.");
      toast("Zermelo gekoppeld", "success");
      void refresh();
    } else {
      setZMessage(res.error ?? "Koppelen mislukt.");
      toast("Zermelo koppeling mislukt", "warning", res.error);
    }
    setZBusy(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="mb-1 text-xs font-medium text-accent">Instellingen</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Schoolkoppeling & voorkeuren</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Alleen echte Magister- en Zermelo-data. Geen demo-omgeving.</p>
      </div>

      <section className="panel p-5">
        <h2 className="section-title mb-4">Koppelingen</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-xl bg-blue-500/12 p-2 text-blue-400"><GraduationCap size={17} /></span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Magister v6</p>
            <p className="mono mt-1 text-[11px] text-slate-500 dark:text-white/45">{c.magisterSchool || "Niet verbonden"}</p>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-white/35">{state.connection.name || "Leerling"}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${c.zermeloToken ? "border-emerald-400/30 bg-emerald-400/[0.06]" : "border-amber-400/25 bg-amber-400/[0.05]"}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-xl bg-emerald-500/12 p-2 text-emerald-400"><Link2 size={17} /></span>
              {c.zermeloToken ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-amber-400" />}
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Zermelo v3</p>
            <p className="mono mt-1 text-[11px] text-slate-500 dark:text-white/45">{c.zermeloToken ? `${c.zermeloSubdomain}.zportal.nl` : "Niet gekoppeld"}</p>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-white/35">{c.zermeloToken ? "Keuzelessen actief" : "Koppel voor KWT en roosterwijzigingen"}</p>
          </div>
        </div>

        {!c.zermeloToken && (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/[0.08]">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <div>
                <label className="label">Zermelo-school</label>
                <div className="flex items-center gap-2">
                  <input className="input mono flex-1" value={zSchool} onChange={(e) => setZSchool(e.target.value)} placeholder="schoolnaam" />
                  <span className="text-[10px] text-slate-400">.zportal.nl</span>
                </div>
              </div>
              <div>
                <label className="label">Koppelingscode</label>
                <input className="input mono tracking-[0.25em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="12 cijfers" inputMode="numeric" />
              </div>
            </div>
            <button onClick={() => void linkZermelo()} disabled={zBusy || !zSchool || code.length !== 12} className="btn-secondary">
              {zBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Koppel Zermelo
            </button>
            {zMessage && <p className="text-[11px] text-slate-500 dark:text-white/50">{zMessage}</p>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-white/[0.08]">
          <button onClick={() => void refresh()} disabled={loading} className="btn-secondary">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Gegevens vernieuwen
          </button>
          {lastSync && <Pill tone="green">Laatst gesynchroniseerd {lastSync.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</Pill>}
          <Pill tone="neutral">{data.subjects.length} vakken · {data.grades.length} cijfers</Pill>
          {loadError && <span className="text-[11px] text-rose-400">{loadError}</span>}
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="rounded-xl bg-accent/12 p-2 text-accent"><ShieldCheck size={17} /></span>
          <div><h2 className="section-title">Profiel</h2><p className="text-xs text-slate-500 dark:text-white/45">Bepaalt o.a. de slaag/zak-regels.</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Naam (uit Magister)</label><input className="input" value={c.name} onChange={(e) => setConnection({ name: e.target.value })} /></div>
          <div><label className="label">School (uit Magister)</label><input className="input" value={c.school} onChange={(e) => setConnection({ school: e.target.value })} /></div>
          <div><label className="label">Niveau</label><select className="input" value={c.level} onChange={(e) => setConnection({ level: e.target.value as EducationLevel })}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="rounded-xl bg-accent/12 p-2 text-accent"><Palette size={17} /></span>
          <div><h2 className="section-title">Uiterlijk</h2><p className="text-xs text-slate-500 dark:text-white/45">Je voorkeuren worden lokaal bewaard.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(["dark", "light", "system"] as ThemeName[]).map((t) => (
            <button key={t} onClick={() => setTheme(t)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition ${state.theme === t ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-white/45"}`}>
              {t === "dark" ? "Donker" : t === "light" ? "Licht" : "Systeem"}
            </button>
          ))}
          <span className="mx-2 h-5 w-px bg-slate-200 dark:bg-white/10" />
          {(Object.keys(ACCENTS) as AccentName[]).map((a) => (
            <button key={a} onClick={() => setAccent(a)} title={ACCENTS[a].name} className={`h-8 w-8 rounded-full ring-2 transition ${state.accent === a ? "ring-white scale-110" : "ring-transparent hover:scale-110"}`} style={{ background: ACCENTS[a].hex }} />
          ))}
        </div>
      </section>

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Sessie & lokale data</h2>
          <p className="text-[11px] text-slate-500 dark:text-white/45">Wis notities, taken en simulator-data; de schoolkoppeling blijft behouden.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { resetLocalData(); toast("Lokale data gewist", "success", "Schoolgegevens blijven gekoppeld."); }} className="btn-secondary">
            <RotateCcw size={14} /> Wis lokale wijzigingen
          </button>
          <button onClick={logout} className="btn-secondary text-rose-400"><LogOut size={14} /> Uitloggen</button>
        </div>
      </motion.section>

      <p className="flex items-center justify-center gap-2 pb-4 text-center text-[10px] text-slate-400">
        <KeyRound size={11} /> MagisterPro v1.0 · Live data via server-side proxies · <Radio size={11} /> Geen demo-sandbox
      </p>
    </div>
  );
}
