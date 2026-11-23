"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Database, Radio, Shield, KeyRound, ExternalLink, TestTube2, CheckCircle2,
  AlertTriangle, Loader2, RotateCcw, GraduationCap, Palette, Info, Copy, Link2, Sparkles,
} from "lucide-react";
import { useApp, ACCENTS } from "@/app/providers";
import { magister, magisterAuthUrl, createPkceVerifier, pkceChallenge, normalizeSubdomain } from "@/lib/api/magister";
import { exchangeZermeloCode, normalizeZermeloSubdomain, zermelo } from "@/lib/api/zermelo";
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

type TestState = "idle" | "loading" | "ok" | "error";

export default function SettingsPage() {
  const { state, patch, setTheme, setAccent, resetDemo } = useApp();
  const c = state.connection;
  const [magTest, setMagTest] = useState<TestState>("idle");
  const [zTest, setZTest] = useState<TestState>("idle");
  const [magMsg, setMagMsg] = useState("");
  const [zMsg, setZMsg] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [pkce, setPkce] = useState<{ verifier: string; url: string } | null>(null);

  const setConnection = (p: Partial<typeof c>) => patch({ connection: { ...c, ...p } });

  const testMagister = async () => {
    setMagTest("loading");
    const res = await magister.testConnection({ subdomain: c.magisterSubdomain, token: c.magisterToken });
    setMagTest(res.ok ? "ok" : "error");
    setMagMsg(res.ok ? `Verbonden met ${normalizeSubdomain(c.magisterSubdomain)}.magister.net — ${Array.isArray(res.data) ? res.data.length : 1} profiel(len) gevonden.` : res.error ?? "Onbekende fout");
    toast(res.ok ? "Magister verbinding OK" : "Magister test mislukt", res.ok ? "success" : "warning", res.error);
  };

  const exchangeCode = async () => {
    setZTest("loading");
    const res = await exchangeZermeloCode(c.zermeloSubdomain, c.zermeloCode);
    if (res.ok && res.data) {
      setConnection({ zermeloToken: res.data.access_token });
      setZTest("ok"); setZMsg("Koppelingscode omgezet naar een permanent access_token.");
      toast("Zermelo gekoppeld", "success", "Je access_token is lokaal opgeslagen.");
    } else {
      setZTest("error"); setZMsg(res.error ?? "Onbekende fout");
      toast("Zermelo koppeling mislukt", "warning", res.error);
    }
  };

  const testZermelo = async () => {
    if (!c.zermeloToken) { await exchangeCode(); return; }
    setZTest("loading");
    const result = await zermelo.testConnection({ subdomain: c.zermeloSubdomain, token: c.zermeloToken });
    setZTest(result.ok ? "ok" : "error");
    setZMsg(result.ok ? `Verbonden met ${normalizeZermeloSubdomain(c.zermeloSubdomain)}.zportal.nl.` : result.error ?? "Onbekende fout");
    toast(result.ok ? "Zermelo verbinding OK" : "Zermelo test mislukt", result.ok ? "success" : "warning", result.error);
  };

  const startPkce = () => {
    const verifier = createPkceVerifier();
    pkceChallenge(verifier).then((challenge) => {
      const url = magisterAuthUrl(c.magisterSubdomain, "magisterpro", window.location.origin + "/auth/callback", verifier, challenge);
      setPkce({ verifier, url });
      toast("PKCE-flow voorbereid", "info", "Open de autorisatie-URL in een nieuw tabblad.");
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div><p className="mb-1 text-xs font-medium text-accent">Instellingen</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Schoolkoppeling & voorkeuren</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Demo sandbox of echte Magister + Zermelo data.</p></div>

      <section className="panel p-5">
        <h2 className="section-title mb-1">Databron</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-white/45">Kies waar MagisterPro zijn data vandaan haalt.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => setConnection({ mode: "demo" })} className={`rounded-2xl border p-4 text-left transition ${c.mode === "demo" ? "border-amber-400/50 bg-amber-400/[0.07]" : "border-slate-200 hover:border-accent/30 dark:border-white/[0.08]"}`}>
            <div className="mb-2 flex items-center justify-between"><Database size={20} className="text-amber-400" />{c.mode === "demo" && <CheckCircle2 size={16} className="text-amber-400" />}</div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Demo Sandbox</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-white/45">Uitgebreide 5 VWO-dataset met cijfers, rooster, KWT-blokken en berichten. Alles werkt direct.</p>
          </button>
          <button onClick={() => setConnection({ mode: "live" })} className={`rounded-2xl border p-4 text-left transition ${c.mode === "live" ? "border-emerald-400/50 bg-emerald-400/[0.07]" : "border-slate-200 hover:border-accent/30 dark:border-white/[0.08]"}`}>
            <div className="mb-2 flex items-center justify-between"><Radio size={20} className="text-emerald-400" />{c.mode === "live" && <CheckCircle2 size={16} className="text-emerald-400" />}</div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Live Magister + Zermelo</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-white/45">Verbind met je eigen school via de server-side CORS-proxy's. Tokens blijven in je browser.</p>
          </button>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2.5"><span className="rounded-xl bg-accent/12 p-2 text-accent"><Shield size={17} /></span><div><h2 className="section-title">Profiel</h2><p className="text-xs text-slate-500 dark:text-white/45">Bepaalt o.a. de slaag/zak-regels.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Naam</label><input className="input" value={c.name} onChange={(e) => setConnection({ name: e.target.value })} /></div>
          <div><label className="label">School</label><input className="input" value={c.school} onChange={(e) => setConnection({ school: e.target.value })} /></div>
          <div><label className="label">Niveau</label><select className="input" value={c.level} onChange={(e) => setConnection({ level: e.target.value as EducationLevel })}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2.5"><span className="rounded-xl bg-blue-500/12 p-2 text-blue-400"><KeyRound size={17} /></span><div><h2 className="section-title">Magister API v6</h2><p className="text-xs text-slate-500 dark:text-white/45">Bearer token via OAuth2 PKCE of DevTools.</p></div></div>
        <div className="space-y-4">
          <div><label className="label">School-subdomain</label><div className="flex items-center gap-2">
            <input className="input mono" value={c.magisterSubdomain} onChange={(e) => setConnection({ magisterSubdomain: e.target.value })} placeholder="laurenslyceum" />
            <span className="shrink-0 text-xs text-slate-400">.magister.net</span>
          </div></div>
          <div><label className="label">Bearer token</label><textarea className="input mono min-h-[80px] text-[11px]" value={c.magisterToken} onChange={(e) => setConnection({ magisterToken: e.target.value })} placeholder="Plak hier je access_token…" /></div>
          <button onClick={() => setShowHelp(!showHelp)} className="flex items-center gap-1.5 text-[11px] font-semibold text-accent"><Info size={13} /> {showHelp ? "Verberg" : "Toon"} uitleg: hoe krijg ik mijn token?</button>
          {showHelp && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[11px] leading-relaxed text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/55">
              <p><strong>Optie A — OAuth2 PKCE (aanbevolen):</strong> klik op “PKCE-flow starten”. Je wordt naar de school-login gestuurd en komt terug met een code die je voor een token kunt omwisselen.</p>
              <p><strong>Optie B — DevTools:</strong> log in op je Magister-omgeving, open DevTools → Network, ververs de pagina en zoek een request naar <span className="mono">/api/personen</span>. Kopieer de waarde van <span className="mono">Authorization: Bearer …</span> en plak die hierboven.</p>
              <p>Je token wordt alleen in <span className="mono">localStorage</span> van deze browser bewaard en nooit naar onze servers verstuurd.</p>
            </motion.div>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={testMagister} disabled={magTest === "loading" || !c.magisterToken} className="btn-primary">
              {magTest === "loading" ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />} Test verbinding
            </button>
            <button onClick={startPkce} disabled={!c.magisterSubdomain} className="btn-secondary"><Link2 size={14} /> PKCE-flow starten</button>
          </div>
          {magTest !== "idle" && <div className={`flex items-start gap-2 rounded-xl p-3 text-[11px] ${magTest === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
            {magTest === "ok" ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}{magMsg}</div>}
          {pkce && (
            <div className="space-y-2 rounded-xl border border-accent/20 bg-accent/[0.05] p-3">
              <p className="text-[11px] font-bold text-accent">PKCE-verifier (code challenge al berekend)</p>
              <a href={pkce.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-accent hover:underline">Open autorisatie-URL <ExternalLink size={12} /></a>
              <button onClick={() => { navigator.clipboard.writeText(pkce.verifier); toast("Verifier gekopieerd", "success"); }} className="chip"><Copy size={11} /> Kopieer verifier</button>
            </div>
          )}
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2.5"><span className="rounded-xl bg-emerald-500/12 p-2 text-emerald-400"><Radio size={17} /></span><div><h2 className="section-title">Zermelo Portal API v3</h2><p className="text-xs text-slate-500 dark:text-white/45">12-cijferige koppelingscode → access_token.</p></div></div>
        <div className="space-y-4">
          <div><label className="label">School-subdomain</label><div className="flex items-center gap-2">
            <input className="input mono" value={c.zermeloSubdomain} onChange={(e) => setConnection({ zermeloSubdomain: e.target.value })} placeholder="laurenslyceum" />
            <span className="shrink-0 text-xs text-slate-400">.zportal.nl</span>
          </div></div>
          <div><label className="label">Koppelingscode (12 cijfers)</label><input className="input mono tracking-[0.3em]" value={c.zermeloCode} onChange={(e) => setConnection({ zermeloCode: e.target.value.replace(/\D/g, "").slice(0, 12) })} placeholder="123456789012" inputMode="numeric" /></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exchangeCode} disabled={c.zermeloCode.length !== 12 || !c.zermeloSubdomain || zTest === "loading"} className="btn-primary">
              {zTest === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Genereer access_token
            </button>
            <button onClick={testZermelo} disabled={zTest === "loading" || (!c.zermeloToken && c.zermeloCode.length !== 12)} className="btn-secondary"><TestTube2 size={14} /> Test Zermelo</button>
          </div>
          {c.zermeloToken && <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-[11px] text-emerald-400"><CheckCircle2 size={14} /> Access_token opgeslagen ({c.zermeloToken.slice(0, 6)}…{c.zermeloToken.slice(-4)})</p>}
          {zTest !== "idle" && <div className={`flex items-start gap-2 rounded-xl p-3 text-[11px] ${zTest === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
            {zTest === "ok" ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}{zMsg}</div>}
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2.5"><span className="rounded-xl bg-accent/12 p-2 text-accent"><Palette size={17} /></span><div><h2 className="section-title">Uiterlijk</h2><p className="text-xs text-slate-500 dark:text-white/45">Je voorkeuren worden lokaal bewaard.</p></div></div>
        <div className="flex flex-wrap items-center gap-3">
          {(["dark", "light", "system"] as ThemeName[]).map((t) => <button key={t} onClick={() => setTheme(t)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition ${state.theme === t ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-white/45"}`}>{t === "dark" ? "Donker" : t === "light" ? "Licht" : "Systeem"}</button>)}
          <span className="mx-2 h-5 w-px bg-slate-200 dark:bg-white/10" />
          {(Object.keys(ACCENTS) as AccentName[]).map((a) => <button key={a} onClick={() => setAccent(a)} title={ACCENTS[a].name} className={`h-8 w-8 rounded-full ring-2 transition ${state.accent === a ? "ring-white scale-110" : "ring-transparent hover:scale-110"}`} style={{ background: ACCENTS[a].hex }} />)}
        </div>
      </section>

      <section className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Alles opnieuw instellen</h2><p className="text-[11px] text-slate-500 dark:text-white/45">Verwijdert alle lokale wijzigingen en herstelt de demo-sandbox.</p></div>
        <button onClick={() => { resetDemo(); toast("Demo hersteld", "success", "Alle lokale data is teruggezet."); }} className="btn-secondary text-rose-400"><RotateCcw size={14} /> Reset alles</button>
      </section>

      <p className="pb-4 text-center text-[10px] text-slate-400">MagisterPro v1.0 · Student Operating System · Gebouwd met Next.js, Framer Motion & Recharts</p>
    </div>
  );
}
