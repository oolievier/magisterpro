"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { AlertTriangle, Loader2, Settings2 } from "lucide-react";
import { useApp } from "@/app/providers";

/** Blokkeert de app totdat er een echte schoolkoppeling is: Magister óf Zermelo. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { mounted, state, loading, loadError, lastSync, refresh, data } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const connected = Boolean(state.connection.magisterToken || state.connection.zermeloToken);
  const allowSettings = pathname === "/settings";
  const hasData = data.subjects.length > 0 || data.appointments.length > 0 || data.choiceGroups.length > 0;
  const waiting = connected && !allowSettings && !loadError && (loading || (!lastSync && !hasData));

  useEffect(() => {
    if (mounted && !connected) router.replace("/login");
  }, [mounted, connected, router]);

  if (!connected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0f] text-white">
        <Loader2 className="animate-spin text-indigo-400" size={28} />
        <p className="text-xs tracking-[0.2em] text-white/45">Je wordt doorgestuurd naar de school-login…</p>
      </div>
    );
  }

  if (!allowSettings && loadError && !lastSync && !hasData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0a0a0f] px-4 text-center text-white">
        <AlertTriangle className="text-amber-400" size={28} />
        <div>
          <h1 className="text-lg font-bold">Schoolgegevens konden niet worden geladen</h1>
          <p className="mx-auto mt-2 max-w-md text-xs text-white/50">{loadError}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void refresh()} className="btn-secondary">Opnieuw proberen</button>
          <Link href="/settings" className="btn-secondary"><Settings2 size={14} /> Instellingen</Link>
        </div>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0f] text-white">
        <Loader2 className="animate-spin text-indigo-400" size={28} />
        <p className="text-xs tracking-[0.2em] text-white/45">Live schoolgegevens worden geladen…</p>
      </div>
    );
  }

  return <>{children}</>;
}
