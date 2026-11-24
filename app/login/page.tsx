"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight, GraduationCap, KeyRound, Link2, Loader2, LockKeyhole, Radio,
  ShieldCheck, Sparkles, Zap,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { magisterAuthUrl, createPkceVerifier, pkceChallenge, normalizeMagisterHost } from "@/lib/api/magister";
import { exchangeZermeloCode, normalizeZermeloSubdomain } from "@/lib/api/zermelo";
import { toast } from "@/components/ui/Toaster";

type Tab = "magister" | "zermelo";

export default function LoginPage() {
  const { patch, state, refresh } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("magister");
  const [school, setSchool] = useState(state.connection.magisterSchool.replace(/\.magister\.net$/, ""));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [zSchool, setZSchool] = useState(state.connection.zermeloSubdomain);
  const [code, setCode] = useState("");
  const [clientId, setClientId] = useState(state.connection.magisterClientId);
  const [redirectUri, setRedirectUri] = useState(state.connection.magisterRedirectUri || (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : ""));
  const [showOAuth, setShowOAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finish = () => {
    toast("Succesvol ingelogd", "success", "Live schoolgegevens worden geladen…");
    void refresh();
    router.push("/dashboard");
  };

  const loginMagister = async () => {
    setError("");
    setBusy(true);
    try {
      const host = normalizeMagisterHost(school);
      const res = await fetch("/api/auth/magister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school: host, username, password }),
      });
      const json = await res.json() as { token?: string; expiresIn?: number; message?: string };
      if (!res.ok || !json.token) throw new Error(json.message ?? "Inloggen bij Magister mislukt.");
      patch({
        connection: {
          ...state.connection,
          magisterSchool: host,
          magisterToken: json.token,
          magisterRefreshToken: "",
          magisterExpiresAt: Date.now() + (json.expiresIn ?? 3600) * 1000,
          name: state.connection.name || username,
          school: state.connection.school || host.replace(/\.magister\.net$/, ""),
        },
      });
      setPassword("");
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inloggen bij Magister mislukt.");
    } finally {
      setBusy(false);
    }
  };

  const startOAuth = async () => {
    setError("");
    try {
      const host = normalizeMagisterHost(school);
      const verifier = createPkceVerifier();
      const challenge = await pkceChallenge(verifier);
      const oauthState = createPkceVerifier(32);
      const nonce = createPkceVerifier(32);
      sessionStorage.setItem("magisterpro-oauth", JSON.stringify({
        verifier, state: oauthState, clientId, redirectUri, school: host,
      }));
      patch({
        connection: {
          ...state.connection,
          magisterSchool: host,
          magisterClientId: clientId,
          magisterRedirectUri: redirectUri,
        },
      });
      window.location.assign(magisterAuthUrl({
        clientId, redirectUri, verifier, challenge, state: oauthState, nonce, school: host,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kon de OAuth-flow niet starten.");
    }
  };

  const linkZermelo = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await exchangeZermeloCode(zSchool, code);
      if (!res.ok || !res.data) throw new Error(res.error ?? "Zermelo-koppeling mislukt.");
      const subdomain = normalizeZermeloSubdomain(zSchool);
      patch({
        connection: {
          ...state.connection,
          zermeloSubdomain: subdomain,
          zermeloToken: res.data.access_token,
        },
      });
      toast("Zermelo gekoppeld", "success", "Je keuzelessen en roosterwijzigingen worden geladen.");
      setCode("");
      if (state.connection.magisterToken) finish();
      else setTab("magister");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Zermelo-koppeling mislukt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-10 text-white">
      <div className="pointer-events-none absolute -left-32 top-0 h-[520px] w-[520px] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[130px]" />

      <div className="relative w-full max-w-5xl">
        <div className="mb-8 flex items-center justify-center gap-3 sm:justify-start">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-black shadow-glow">M</div>
          <div>
            <p className="text-sm font-extrabold tracking-tight">Magister<span className="text-indigo-400">Pro</span></p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Student Operating System</p>
          </div>
        </div>

        <div className="grid overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden flex-col justify-between border-r border-white/[0.07] bg-gradient-to-br from-indigo-500/[0.12] to-transparent p-9 lg:flex">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-300">Echte schoolkoppeling</p>
              <h1 className="text-3xl font-bold leading-tight tracking-tight">Je hele schoolleven.<br />Eén operating system.</h1>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
                Log in met je eigen schoolaccount. MagisterPro leest je cijfers, rooster en keuzelessen rechtstreeks uit Magister en Zermelo.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { icon: GraduationCap, text: "Cijferstudio met slaag/zak-check" },
                { icon: Radio, text: "Live rooster & Zermelo keuzelessen" },
                { icon: Zap, text: "Planner, focusdock en PTA-overzicht" },
                { icon: ShieldCheck, text: "Tokens blijven in jouw browser" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-xs text-white/60">
                  <span className="rounded-lg bg-indigo-400/10 p-2 text-indigo-300"><item.icon size={14} /></span>
                  {item.text}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/30">MagisterPro is geen officieel product van Schoolmaster BV of Zermelo.</p>
          </div>

          <div className="p-6 sm:p-9">
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
              {(["magister", "zermelo"] as Tab[]).map((value) => (
                <button key={value} onClick={() => { setTab(value); setError(""); }}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === value ? "bg-indigo-500 text-white shadow-glow" : "text-white/45 hover:text-white/80"}`}>
                  {value === "magister" ? <GraduationCap size={14} /> : <Link2 size={14} />}
                  {value === "magister" ? "Magister-login" : "Zermelo-login"}
                </button>
              ))}
            </div>

            {tab === "magister" ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold">Inloggen met Magister</h2>
                  <p className="mt-1 text-[11px] text-white/40">We sturen je via de officiële Magister-schoollogin. Je wachtwoord wordt niet opgeslagen.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-white/60">School</label>
                  <div className="flex items-center gap-2">
                    <input className="input mono flex-1" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="schoolnaam" autoComplete="organization" />
                    <span className="shrink-0 text-[11px] text-white/35">.magister.net</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-white/60">Gebruikersnaam</label>
                  <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Je Magister-gebruikersnaam" autoComplete="username" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-white/60">Wachtwoord</label>
                  <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loginMagister(); }} placeholder="••••••••" autoComplete="current-password" />
                </div>
                <button onClick={() => void loginMagister()} disabled={busy || !school || !username || !password} className="btn-primary w-full justify-center !py-3">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <LockKeyhole size={15} />} Inloggen via school
                </button>

                <button onClick={() => setShowOAuth(!showOAuth)} className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 hover:underline">
                  <KeyRound size={12} /> {showOAuth ? "Verberg" : "Gebruik eigen OAuth-webclient (gevorderd)"}
                </button>
                {showOAuth && (
                  <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] leading-relaxed text-white/45">
                      Heeft je school een geregistreerde OAuth-client met een web-redirect? Vul dan de client_id en redirect_uri in. Anders gebruik je hierboven de school-login.
                    </p>
                    <input className="input mono" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="client_id" />
                    <input className="input mono" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} placeholder="https://…/auth/callback" />
                    <button onClick={() => void startOAuth()} disabled={!clientId || !redirectUri || !school} className="btn-secondary w-full justify-center"><ArrowRight size={14} /> Start OAuth-aanmelding</button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold">Koppelen met Zermelo</h2>
                  <p className="mt-1 text-[11px] text-white/40">
                    Log in op de Zermelo-portal van je school en maak daar een koppelingscode van 12 cijfers aan. Vul die hieronder in.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-white/60">School</label>
                  <div className="flex items-center gap-2">
                    <input className="input mono flex-1" value={zSchool} onChange={(e) => setZSchool(e.target.value)} placeholder="schoolnaam" autoComplete="organization" />
                    <span className="shrink-0 text-[11px] text-white/35">.zportal.nl</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-white/60">Koppelingscode (12 cijfers)</label>
                  <input className="input mono tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="123456789012" inputMode="numeric" />
                </div>
                <button onClick={() => void linkZermelo()} disabled={busy || !zSchool || code.length !== 12} className="btn-primary w-full justify-center !py-3">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Koppel Zermelo
                </button>
                <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-3 text-[10px] leading-relaxed text-white/40">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  Zermelo gebruikt geen browser-OAuth voor leerlingen; de koppelingscode is de officiële manier om een token te verkrijgen. Je ziet daarna direct je keuzelessen en roosterwijzigingen.
                </div>
              </motion.div>
            )}

            {error && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-[11px] text-rose-300">{error}</p>}

            {state.connection.magisterToken && tab === "zermelo" && (
              <button onClick={() => router.push("/dashboard")} className="mt-4 flex w-full items-center justify-center gap-2 text-[11px] font-semibold text-white/45 hover:text-white">
                Terug naar dashboard <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-white/25">Alleen echte schoolgegevens · Alle data komt rechtstreeks van je school</p>
      </div>
    </main>
  );
}
