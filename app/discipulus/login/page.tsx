"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, KeyRound, ShieldCheck, Smartphone } from "lucide-react";

/**
 * Bestemming van de QR-code. Discipulus verwerkt de QR zelf; een gewone
 * scanner/camera opent deze pagina en kan de app alsnog starten.
 */
export default function DiscipulusLoginPage() {
  const [params, setParams] = useState<{ requestId: string; backendUrl: string; deepLink: string }>({
    requestId: "",
    backendUrl: "",
    deepLink: "discipulus://login",
  });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const requestId = search.get("requestId") ?? "";
    const backendUrl = search.get("backendUrl") ?? window.location.origin;
    const deepLink = new URL("discipulus://login");
    deepLink.searchParams.set("requestId", requestId);
    deepLink.searchParams.set("backendUrl", backendUrl);
    deepLink.searchParams.set("requireRefreshToken", "true");
    setParams({ requestId, backendUrl, deepLink: deepLink.toString() });
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-10 text-white">
      <div className="pointer-events-none absolute -left-32 top-0 h-[520px] w-[520px] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[130px]" />

      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-black shadow-glow">M</div>
          <div>
            <p className="text-sm font-extrabold tracking-tight">Magister<span className="text-indigo-400">Pro</span></p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Magister-koppeling</p>
          </div>
        </div>

        <h1 className="text-xl font-bold">Open de Discipulus-app</h1>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          Deze QR-code hoort bij een MagisterPro-login. Scan hem met de Discipulus-app, of tik hieronder om de app direct te openen. Je logt daarna in op de echte Magister-pagina — ook met tweefactorauthenticatie.
        </p>

        {params.requestId ? (
          <a href={params.deepLink} className="btn-primary mt-6 w-full justify-center !py-3">
            <Smartphone size={15} /> Open Discipulus
          </a>
        ) : (
          <p className="mt-6 rounded-xl bg-amber-500/10 p-3 text-[11px] text-amber-200/80">
            Deze link heeft geen koppelingsgegevens. Start de login opnieuw op de loginpagina.
          </p>
        )}

        <div className="mt-5 space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-[11px] text-white/50">
          <p className="font-semibold text-white/70">Werkt de knop niet?</p>
          <p>1. Installeer Discipulus op Android of iOS.</p>
          <p>2. Ga naar Instellingen → Overig → Login met Discipulus.</p>
          <p>3. Scan de QR-code opnieuw vanaf de MagisterPro-loginpagina.</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
          <a className="inline-flex items-center gap-1 text-indigo-300 underline" href="https://apps.apple.com/nl/app/discipulus/id6478711986" target="_blank" rel="noreferrer">
            App Store <ExternalLink size={11} />
          </a>
          <a className="inline-flex items-center gap-1 text-indigo-300 underline" href="https://play.google.com/store/apps/details?id=dev.harrydekat.discipulus" target="_blank" rel="noreferrer">
            Google Play <ExternalLink size={11} />
          </a>
        </div>

        <div className="mt-5 flex items-start gap-2 border-t border-white/[0.07] pt-4 text-[10px] leading-relaxed text-white/35">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
          <span>Je wachtwoord wordt alleen op de Magister-pagina ingevuld. MagisterPro ontvangt uitsluitend tijdelijke tokens.</span>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/45 hover:text-white">
            <ArrowLeft size={12} /> Terug naar login
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-white/25">
            <KeyRound size={11} /> {params.requestId ? `Sessie ${params.requestId.slice(0, 8)}…` : "Geen sessie"}
          </span>
        </div>
      </div>
    </main>
  );
}
