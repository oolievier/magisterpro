"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, GraduationCap, Link2, Loader2,
  RefreshCw, ShieldCheck, Smartphone, Sparkles, Zap,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { normalizeMagisterHost } from "@/lib/api/magister";
import { exchangeZermeloCode, normalizeZermeloSubdomain } from "@/lib/api/zermelo";
import { toast } from "@/components/ui/Toaster";

type Tab = "magister" | "zermelo";
type QrPhase = "idle" | "initiating" | "pending" | "expired" | "success";

interface QrStatus {
  status: "pending" | "completed" | "expired" | "not_found";
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  baseUrl?: string;
  name?: string;
}

function schoolFromBaseUrl(baseUrl?: string): string {
  if (!baseUrl) return "";
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return baseUrl.replace(/^https?:\/\//, "").split("/")[0];
  }
}

export default function LoginPage() {
  const { patch, state } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("magister");
  const [zSchool, setZSchool] = useState(state.connection.zermeloSubdomain);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [phase, setPhase] = useState<QrPhase>("idle");
  const [requestId, setRequestId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(300);
  const connectionRef = useRef(state.connection);
  const connectedRef = useRef(false);

  useEffect(() => { connectionRef.current = state.connection; }, [state.connection]);

  const startQr = async () => {
    setError("");
    setBusy(true);
    setPhase("initiating");
    connectedRef.current = false;
    try {
      const res = await fetch("/api/auth/magister/qr/initiate", { method: "POST", cache: "no-store" });
      const json = await res.json() as { requestId?: string; message?: string };
      if (!res.ok || !json.requestId) throw new Error(json.message ?? "Kon de QR-koppeling niet starten.");

      // Hetzelfde contract als de publieke auth-gateway: de app ontvangt de
      // tokens via onze eigen backend, zonder wachtwoord in deze webapp.
      const payload = `https://discipulus.harrydekat.dev/login?requestId=${encodeURIComponent(json.requestId)}&backendUrl=${encodeURIComponent(window.location.origin)}&requireRefreshToken=true`;
      const image = await QRCode.toDataURL(payload, {
        width: 280,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setRequestId(json.requestId);
      setQrDataUrl(image);
      setSecondsLeft(300);
      setPhase("pending");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Kon de QR-koppeling niet starten.");
    } finally {
      setBusy(false);
    }
  };

  // Aftellen tot de QR-code verloopt.
  useEffect(() => {
    if (tab !== "magister" || phase !== "pending") return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { setPhase("expired"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [tab, phase]);

  // Polling naar de tijdelijke koppelingssessie.
  useEffect(() => {
    if (tab !== "magister" || phase !== "pending" || !requestId || connectedRef.current) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/auth/magister/qr/status/${requestId}`, { cache: "no-store" });
        const data = await res.json() as QrStatus;
        if (!active || connectedRef.current) return;

        if (data.status === "completed" && data.accessToken) {
          connectedRef.current = true;
          const school = normalizeMagisterHost(schoolFromBaseUrl(data.baseUrl));
          const connection = connectionRef.current;
          patch({
            connection: {
              ...connection,
              magisterSchool: school,
              magisterToken: data.accessToken,
              magisterRefreshToken: data.refreshToken ?? "",
              magisterExpiresAt: data.expiresAt || Date.now() + 3600_000,
              magisterClientId: "",
              magisterRedirectUri: "",
              name: data.name || connection.name,
              school: school ? school.replace(/\.magister\.net$/, "") : connection.school,
            },
          });
          void fetch(`/api/auth/magister/qr/status/${requestId}`, { method: "DELETE" }).catch(() => {});
          setPhase("success");
          toast("Magister gekoppeld", "success", "Je echte schoolgegevens worden geladen…");
          setTimeout(() => router.push("/dashboard"), 800);
          return;
        }
        if (data.status === "expired") setPhase("expired");
      } catch { /* volgende poll probeert het opnieuw */ }
    };

    const interval = setInterval(() => { void poll(); }, 1800);
    void poll();
    return () => { active = false; clearInterval(interval); };
  }, [tab, phase, requestId, patch, router]);

  const linkZermelo = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await exchangeZermeloCode(zSchool, code);
      if (!res.ok || !res.data) throw new Error(res.error ?? "Zermelo-koppeling mislukt.");
      const subdomain = normalizeZermeloSubdomain(zSchool);
      patch({ connection: { ...connectionRef.current, zermeloSubdomain: subdomain, zermeloToken: res.data.access_token } });
      toast("Zermelo gekoppeld", "success", "Je keuzelessen en roosterwijzigingen worden geladen.");
      setCode("");
      if (connectionRef.current.magisterToken) router.push("/dashboard");
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
                { icon: Smartphone, text: "Magister-login via je telefoon" },
                { icon: Zap, text: "Planner, focusdock en PTA-overzicht" },
                { icon: ShieldCheck, text: "Tokens blijven in jouw browser" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-xs text-white/60">
                  <span className="rounded-lg bg-indigo-400/10 p-2 text-indigo-300"><item.icon size={14} /></span>
                  {item.text}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/30">MagisterPro is geen officieel product van Iddink Group of Zermelo.</p>
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
                  <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                    Scan de QR-code met de Magister-companion-app op je telefoon. Je wachtwoord voer je alleen in de app of op magister.net in — nooit hier.
                  </p>
                </div>

                {phase === "idle" || phase === "initiating" ? (
                  <button onClick={() => void startQr()} disabled={busy} className="btn-primary w-full justify-center !py-3">
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
                    {busy ? "QR-code maken…" : "Start Magister-login"}
                  </button>
                ) : null}

                {phase === "pending" && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
                    <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrDataUrl} alt="QR-code om te scannen met de Magister-app" className="h-[220px] w-[220px]" />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-white/80">Scan met de Magister-app op je telefoon</p>
                    <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-white/40">
                      <Clock size={12} />
                      <span>Verloopt over {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span>
                      <span className="ml-2 inline-flex items-center gap-1 text-emerald-400">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </span>
                        wacht op scan
                      </span>
                    </div>
                  </div>
                )}

                {phase === "expired" && (
                  <div className="flex flex-col items-center gap-3 rounded-2xl bg-amber-500/10 p-5 text-center">
                    <AlertTriangle size={22} className="text-amber-300" />
                    <p className="text-xs text-amber-100/80">De QR-code is verlopen. Maak een nieuwe aan.</p>
                    <button onClick={() => void startQr()} className="btn-secondary">
                      <RefreshCw size={13} /> Nieuwe QR-code
                    </button>
                  </div>
                )}

                {phase === "success" && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-500/10 p-5 text-center">
                    <CheckCircle2 size={22} className="text-emerald-400" />
                    <p className="text-xs text-emerald-100/80">Gekoppeld! Je live schoolgegevens worden geladen…</p>
                  </div>
                )}

                {phase === "pending" && (
                  <button onClick={() => void startQr()} className="flex w-full items-center justify-center gap-2 text-[10px] font-semibold text-white/40 hover:text-white/80">
                    <RefreshCw size={11} /> Nieuwe QR-code aanmaken
                  </button>
                )}

                <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-3 text-[10px] leading-relaxed text-white/40">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>
                    Geen wachtwoord in MagisterPro en geen speciale client-registratie nodig. De koppeling verloopt via de officiële Magister-OAuth van je telefoon; alleen tijdelijke tokens komen naar deze browser.
                  </span>
                </div>
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
