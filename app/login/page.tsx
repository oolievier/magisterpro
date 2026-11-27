"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, ExternalLink, GraduationCap, KeyRound, Link2,
  Loader2, RefreshCw, ShieldCheck, Smartphone, Sparkles, Zap,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { normalizeMagisterHost } from "@/lib/api/magister";
import { exchangeZermeloCode, normalizeZermeloSubdomain } from "@/lib/api/zermelo";
import {
  buildMagisterAuthorizeUrl, getNativeBridge, MAGISTER_CLIENT_ID,
  MAGISTER_NATIVE_STORAGE_KEY, MAGISTER_REDIRECT_URI,
  type MagisterAuthResult,
} from "@/lib/native/magister-auth";
import { Toaster, toast } from "@/components/ui/Toaster";

type Tab = "magister" | "zermelo";
type QrPhase = "idle" | "initiating" | "pending" | "expired" | "success";
type NativePhase = "idle" | "opening" | "waiting" | "success";

interface QrStatus {
  status: "pending" | "completed" | "expired" | "not_found";
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  baseUrl?: string;
  name?: string;
}

interface PendingNative {
  verifier: string;
  state: string;
  school: string;
}

function schoolFromBaseUrl(baseUrl?: string): string {
  if (!baseUrl) return "";
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return baseUrl.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function normalizeSchoolSafe(input: string): string {
  if (!input.trim()) return "";
  try { return normalizeMagisterHost(input); } catch { return ""; }
}

export default function LoginPage() {
  const { patch, state } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(
    state.connection.zermeloToken && !state.connection.magisterToken ? "zermelo" : "magister"
  );
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

  const [bridge, setBridge] = useState<Awaited<ReturnType<typeof getNativeBridge>>>(null);
  const [nativePhase, setNativePhase] = useState<NativePhase>("idle");
  const [school, setSchool] = useState("");
  const [useQr, setUseQr] = useState(false);
  const [extensionReady, setExtensionReady] = useState(false);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const pendingRef = useRef<PendingNative | null>(null);

  useEffect(() => { connectionRef.current = state.connection; }, [state.connection]);

  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent<{ accessToken?: string }>).detail?.accessToken) setExtensionConnected(true);
    };
    window.addEventListener("magisterpro:extension-session", handler);
    return () => window.removeEventListener("magisterpro:extension-session", handler);
  }, []);

  useEffect(() => {
    if (!extensionConnected && !state.connection.magisterToken && !state.connection.zermeloToken) return;
    const timer = window.setTimeout(() => router.push("/dashboard"), 500);
    return () => window.clearTimeout(timer);
  }, [extensionConnected, state.connection.magisterToken, state.connection.zermeloToken, router]);

  useEffect(() => {
    const check = () => setExtensionReady(
      document.documentElement.getAttribute("data-magisterpro-extension") === "app"
    );
    check();
    const timer = window.setTimeout(check, 800);
    return () => window.clearTimeout(timer);
  }, []);

  const startQr = async () => {
    setError("");
    setBusy(true);
    setPhase("initiating");
    connectedRef.current = false;
    try {
      const res = await fetch("/api/auth/magister/qr/initiate", { method: "POST", cache: "no-store" });
      const json = await res.json() as { requestId?: string; message?: string };
      if (!res.ok || !json.requestId) throw new Error(json.message ?? "Kon de QR-koppeling niet starten.");

      // Wijst naar onze eigen pagina: gewone camera's openen geen 404 meer,
      // en Discipulus leest requestId/backendUrl uit elke http(s)-QR-URL.
      const target = new URL("/discipulus/login", window.location.origin);
      target.searchParams.set("requestId", json.requestId);
      target.searchParams.set("backendUrl", window.location.origin);
      target.searchParams.set("requireRefreshToken", "true");
      const payload = target.toString();
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
          const school = normalizeSchoolSafe(schoolFromBaseUrl(data.baseUrl));
          const connection = connectionRef.current;
          patch({
            connection: {
              ...connection,
              magisterSchool: school,
              magisterToken: data.accessToken,
              magisterRefreshToken: data.refreshToken ?? "",
              magisterExpiresAt: data.expiresAt || Date.now() + 3600_000,
              magisterSessionSource: "qr",
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

  /** Voltooit de native Magister-login na de m6loapp-redirect. */
  const handleNativeResult = useCallback(async (result: MagisterAuthResult) => {
    const pending = pendingRef.current;
    if (!pending) { setError("Geen actieve Magister-login. Start opnieuw."); setNativePhase("idle"); return; }
    if (result.error) { setError(result.error); setNativePhase("idle"); pendingRef.current = null; return; }
    if (!result.code) { setError("Geen autorisatiecode ontvangen van Magister."); setNativePhase("idle"); pendingRef.current = null; return; }
    if (result.state && result.state !== pending.state) {
      setError("De login-state komt niet overeen. Start opnieuw om veiligheidsredenen.");
      setNativePhase("idle"); pendingRef.current = null; return;
    }

    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/magister/native/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: result.code, verifier: pending.verifier, school: pending.school }),
      });
      const json = await res.json() as {
        token?: string; refreshToken?: string; expiresIn?: number; baseUrl?: string; name?: string; message?: string;
      };
      if (!res.ok || !json.token) throw new Error(json.message ?? "Omwisselen van de Magister-code mislukt.");

      const schoolHost = normalizeSchoolSafe(schoolFromBaseUrl(json.baseUrl) || pending.school);
      patch({
        connection: {
          ...connectionRef.current,
          magisterSchool: schoolHost,
          magisterToken: json.token,
          magisterRefreshToken: json.refreshToken ?? "",
          magisterExpiresAt: Date.now() + (json.expiresIn ?? 3600) * 1000,
          magisterSessionSource: "native",
          magisterClientId: MAGISTER_CLIENT_ID,
          magisterRedirectUri: MAGISTER_REDIRECT_URI,
          name: json.name || connectionRef.current.name,
          school: schoolHost ? schoolHost.replace(/\.magister\.net$/, "") : connectionRef.current.school,
        },
      });
      pendingRef.current = null;
      sessionStorage.removeItem(MAGISTER_NATIVE_STORAGE_KEY);
      setNativePhase("success");
      toast("Magister gekoppeld", "success", "Je echte schoolgegevens worden geladen…");
      setTimeout(() => router.push("/dashboard"), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aanmelden met Magister mislukt.");
      setNativePhase("idle");
      pendingRef.current = null;
    } finally {
      setBusy(false);
    }
  }, [patch, router]);

  const nativeResultRef = useRef(handleNativeResult);
  useEffect(() => { nativeResultRef.current = handleNativeResult; }, [handleNativeResult]);

  // Ontdek de native shell en abonneer op de m6loapp-callback.
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      const raw = sessionStorage.getItem(MAGISTER_NATIVE_STORAGE_KEY);
      if (raw) pendingRef.current = JSON.parse(raw) as PendingNative;
    } catch { sessionStorage.removeItem(MAGISTER_NATIVE_STORAGE_KEY); }

    void getNativeBridge().then((found) => {
      if (!active || !found) return;
      setBridge(found);
      unsubscribe = found.onAuth((result) => nativeResultRef.current(result));
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  const startNative = async () => {
    if (!bridge) return;
    setError("");
    setBusy(true);
    setNativePhase("opening");
    try {
      const schoolHost = normalizeSchoolSafe(school);
      const { url, verifier, state } = await buildMagisterAuthorizeUrl(schoolHost);
      const pending = { verifier, state, school: schoolHost };
      pendingRef.current = pending;
      sessionStorage.setItem(MAGISTER_NATIVE_STORAGE_KEY, JSON.stringify(pending));
      await bridge.openAuth(url);
      setNativePhase("waiting");
    } catch (e) {
      pendingRef.current = null;
      setNativePhase("idle");
      setError(e instanceof Error ? e.message : "Kon de Magister-login niet openen.");
    } finally {
      setBusy(false);
    }
  };

  const linkZermelo = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await exchangeZermeloCode(zSchool, code);
      if (!res.ok || !res.data) throw new Error(res.error ?? "Zermelo-koppeling mislukt.");
      const subdomain = normalizeZermeloSubdomain(zSchool);
      const token = res.data.access_token || res.data.token || "";
      if (!token) throw new Error("Zermelo gaf geen access_token terug.");
      const expiresIn = Number(res.data.expires_in ?? res.data.expiresIn ?? 0);
      patch({
        connection: {
          ...connectionRef.current,
          zermeloSubdomain: subdomain,
          zermeloToken: token,
          zermeloTokenExpiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : 0,
          zermeloStudentCode: "",
        },
      });
      toast("Zermelo gekoppeld", "success", "Je rooster en keuzelessen worden geladen.");
      setCode("");
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Zermelo-koppeling mislukt.");
    } finally {
      setBusy(false);
    }
  };

  const qrSection = (
    <>
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
          <button
            onClick={() => {
              window.location.href = `discipulus://login?requestId=${encodeURIComponent(requestId)}&backendUrl=${encodeURIComponent(window.location.origin)}&requireRefreshToken=true`;
            }}
            className="btn-secondary mt-4 w-full justify-center !py-2 text-[11px]"
          >
            <Smartphone size={13} /> Open Discipulus-app
          </button>
          <p className="mt-2 text-[10px] text-white/30">
            Op je telefoon opent dit de app direct. Anders: scan de QR met Discipulus → Instellingen → Overig → Login met Discipulus.
            {" "}Geen app? {" "}
            <a className="text-indigo-300 underline" href="https://apps.apple.com/nl/app/discipulus/id6478711986" target="_blank" rel="noreferrer">iOS</a>
            {" · "}
            <a className="text-indigo-300 underline" href="https://play.google.com/store/apps/details?id=dev.harrydekat.discipulus" target="_blank" rel="noreferrer">Android</a>
          </p>
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
          Geen wachtwoord in MagisterPro. De koppeling verloopt via de officiële Magister-OAuth; alleen tijdelijke tokens komen naar deze browser.
        </span>
      </div>
    </>
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-10 text-white">
      <Toaster />
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
                { icon: KeyRound, text: "Echte Magister-login inclusief MFA" },
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
                    {bridge
                      ? "De echte Magister-loginpagina opent in de MagisterPro-app — inclusief MFA en school-SSO. Je wachtwoord voer je nooit in MagisterPro in."
                      : "Scan de QR-code met de Magister-companion-app op je telefoon. Je wachtwoord voer je alleen in de app of op magister.net in — nooit hier."}
                  </p>
                </div>

                <div className={`flex items-start gap-2 rounded-xl border p-3 text-[10px] leading-relaxed ${extensionReady ? "border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-100/80" : "border-white/[0.07] bg-white/[0.02] text-white/40"}`}>
                  <Zap size={14} className={`mt-0.5 shrink-0 ${extensionReady ? "text-emerald-400" : "text-indigo-300"}`} />
                  <div className="min-w-0">
                    <span>
                      {extensionReady
                        ? "MagisterPro-extensie actief. Log normaal in op de echte Magister-site; je sessie wordt automatisch overgenomen — ook met MFA."
                        : "Met de MagisterPro-browserextensie log je gewoon in op Magister en neemt MagisterPro je sessie over, zonder QR-code of extra app."}
                    </span>
                    <a
                      href="https://accounts.magister.net/"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-indigo-300 hover:text-indigo-200"
                    >
                      Open Magister <ExternalLink size={11} />
                    </a>
                  </div>
                </div>

                {bridge && !useQr && (
                  <>
                    {(nativePhase === "idle" || nativePhase === "opening") && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-semibold text-white/60">School (optioneel)</label>
                          <div className="flex items-center gap-2">
                            <input
                              className="input mono flex-1"
                              value={school}
                              onChange={(e) => setSchool(e.target.value)}
                              placeholder="schoolnaam"
                              autoComplete="organization"
                              disabled={busy}
                            />
                            <span className="shrink-0 text-[11px] text-white/35">.magister.net</span>
                          </div>
                          <p className="mt-1.5 text-[10px] text-white/35">Laat leeg om je school op de Magister-loginpagina te kiezen.</p>
                        </div>
                        <button onClick={() => void startNative()} disabled={busy} className="btn-primary w-full justify-center !py-3">
                          {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                          {busy ? "Magister-login openen…" : "Inloggen via Magister"}
                        </button>
                        <button onClick={() => setUseQr(true)} className="flex w-full items-center justify-center gap-2 text-[10px] font-semibold text-white/40 hover:text-white/80">
                          <Smartphone size={11} /> Of koppel via QR-code met een companion-app
                        </button>
                      </>
                    )}

                    {nativePhase === "waiting" && (
                      <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.07] p-5 text-center">
                        <Loader2 size={22} className="mx-auto animate-spin text-indigo-300" />
                        <p className="mt-3 text-xs font-semibold text-white/80">Voltooi je aanmelding op de Magister-pagina…</p>
                        <p className="mt-1.5 text-[10px] text-white/40">Tweefactorauthenticatie en school-SSO werken gewoon. Dit venster blijft open.</p>
                        <button
                          onClick={() => { pendingRef.current = null; setNativePhase("idle"); }}
                          className="mt-3 text-[10px] font-semibold text-white/45 hover:text-white"
                        >
                          Opnieuw proberen
                        </button>
                      </div>
                    )}

                    {nativePhase === "success" && (
                      <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-500/10 p-5 text-center">
                        <CheckCircle2 size={22} className="text-emerald-400" />
                        <p className="text-xs text-emerald-100/80">Gekoppeld! Je live schoolgegevens worden geladen…</p>
                      </div>
                    )}

                    <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-3 text-[10px] leading-relaxed text-white/40">
                      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                      <span>
                        De app gebruikt de publieke Magister-client en vangt de <span className="mono">m6loapp://</span>-redirect zelf op. Geen extra app, geen wachtwoord in MagisterPro.
                      </span>
                    </div>
                  </>
                )}

                {(!bridge || useQr) && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {useQr && (
                      <button onClick={() => setUseQr(false)} className="flex w-full items-center justify-center gap-2 text-[10px] font-semibold text-white/40 hover:text-white/80">
                        <ArrowRight size={11} className="rotate-180" /> Terug naar Magister-login
                      </button>
                    )}
                    {qrSection}
                  </motion.div>
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
                  Zermelo gebruikt geen browser-OAuth voor leerlingen; de koppelingscode is de officiële manier om een token te verkrijgen. De sleutel wordt daarna apart op dit apparaat bewaard, zodat je na uitloggen automatisch opnieuw verbonden bent. Je ziet direct je rooster, vakken en keuzelessen.
                </div>
              </motion.div>
            )}

            {error && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-[11px] text-rose-300">{error}</p>}

            {(state.connection.magisterToken || state.connection.zermeloToken) && tab === "zermelo" && (
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
