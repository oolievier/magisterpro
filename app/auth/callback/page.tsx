"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { useApp } from "@/app/providers";
import { MAGISTER_AUTH_STORAGE_KEY } from "@/lib/api/magister";

interface PendingOAuth {
  verifier: string;
  state: string;
  nonce: string;
  clientId: string;
  redirectUri: string;
  school: string;
}

export default function AuthCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { patch, state } = useApp();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      const hash = typeof window !== "undefined" ? new URLSearchParams(window.location.hash.slice(1)) : new URLSearchParams();
      const queryError = params.get("error") ?? hash.get("error");
      if (queryError) { setError(queryError); return; }

      const raw = sessionStorage.getItem(MAGISTER_AUTH_STORAGE_KEY);
      if (!raw) { setError("De OAuth-sessie is verlopen of deze pagina is in een ander venster geopend. Start opnieuw in het oorspronkelijke venster."); return; }
      let pending: PendingOAuth;
      try { pending = JSON.parse(raw) as PendingOAuth; } catch { setError("Ongeldige OAuth-sessie."); return; }

      const code = params.get("code") ?? hash.get("code");
      const returnedState = params.get("state") ?? hash.get("state");
      if (!code) { setError("Geen autorisatiecode ontvangen van Magister."); return; }
      if (!returnedState || returnedState !== pending.state) {
        setError("De OAuth-state komt niet overeen. Start opnieuw om veiligheidsredenen.");
        return;
      }
      if (!pending.verifier || !pending.clientId || !pending.redirectUri) {
        setError("De OAuth-sessie is onvolledig. Start opnieuw.");
        return;
      }

      try {
        const res = await fetch("/api/auth/magister/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant: "code",
            code,
            verifier: pending.verifier,
            clientId: pending.clientId,
            redirectUri: pending.redirectUri,
          }),
        });
        const json = await res.json() as { token?: string; refreshToken?: string; expiresIn?: number; message?: string };
        if (!res.ok || !json.token) throw new Error(json.message ?? "Omwisselen van de code mislukt.");

        patch({
          connection: {
            ...state.connection,
            magisterSchool: pending.school || state.connection.magisterSchool,
            magisterToken: json.token,
            magisterRefreshToken: json.refreshToken ?? "",
            magisterExpiresAt: Date.now() + (json.expiresIn ?? 3600) * 1000,
            magisterClientId: pending.clientId,
            magisterRedirectUri: pending.redirectUri,
          },
        });
        sessionStorage.removeItem(MAGISTER_AUTH_STORAGE_KEY);
        setDone(true);
        router.replace("/dashboard");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Aanmelden mislukt.");
      }
    };
    void run();
  }, [params, patch, router, state.connection]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0a0a0f] px-4 text-center text-white">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-black shadow-glow">M</div>
      {error ? (
        <>
          <AlertTriangle className="text-rose-400" size={24} />
          <div>
            <h1 className="text-lg font-bold">Aanmelden mislukt</h1>
            <p className="mx-auto mt-2 max-w-md text-xs text-white/50">{error}</p>
          </div>
          <Link href="/login" className="btn-secondary"><ArrowLeft size={14} /> Terug naar login</Link>
        </>
      ) : (
        <>
          {done ? <CheckCircle2 className="text-emerald-400" size={24} /> : <Loader2 className="animate-spin text-indigo-400" size={24} />}
          <p className="text-sm font-semibold">{done ? "Aangemeld — live data wordt geladen…" : "Je Magister-aanmelding wordt voltooid…"}</p>
        </>
      )}
    </main>
  );
}
