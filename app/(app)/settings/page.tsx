"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays, CheckCircle2, Copy, ExternalLink, GraduationCap, KeyRound, Link2, Loader2, LogOut, Palette,
  Radio, RefreshCw, RotateCcw, ShieldCheck, Sparkles, XCircle,
} from "lucide-react";
import { useApp, ACCENTS } from "@/app/providers";
import { normalizeMagisterHost } from "@/lib/api/magister";
import { openMagister } from "@/lib/extension";
import { exchangeZermeloCode } from "@/lib/api/zermelo";
import {
  calendarFeedUrl, ensureCalendarToken, getCalendarToken,
  publishCalendarFeed, revokeCalendarFeed, rotateCalendarFeed,
} from "@/lib/calendar";
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
    savedZermeloKey, saveZermeloKey, forgetZermeloKey,
    setSubjectColor, resetSubjectColors,
    loading, loadError, lastSync, data, appointments,
  } = useApp();
  const c = state.connection;
  const [mSchool, setMSchool] = useState(c.magisterSchool);
  const [zSchool, setZSchool] = useState(c.zermeloSubdomain);
  const [code, setCode] = useState("");
  const [zBusy, setZBusy] = useState(false);
  const [zMessage, setZMessage] = useState("");
  const [extMessage, setExtMessage] = useState("");
  const [calendarToken, setCalendarToken] = useState("");
  const [calendarBusy, setCalendarBusy] = useState(false);

  useEffect(() => { setMSchool(c.magisterSchool); }, [c.magisterSchool]);
  useEffect(() => { setCalendarToken(getCalendarToken()); }, []);

  const saveMagisterSchool = () => {
    try {
      const host = normalizeMagisterHost(mSchool);
      setConnection({ magisterSchool: host });
      setMSchool(host);
      void refresh();
    } catch {
      toast("Ongeldige school", "warning", "Vul bijv. laurenslyceum.magister.net in.");
    }
  };

  const requestExtensionSession = () => {
    setExtMessage("");
    window.dispatchEvent(new Event("magisterpro:request-extension-session"));
    window.setTimeout(() => {
      if (!document.documentElement.getAttribute("data-magisterpro-extension")) {
        setExtMessage("Extensie niet gevonden. Installeer de MagisterPro-extensie en laad Chrome opnieuw.");
      } else {
        setExtMessage("Verzoek verstuurd. Blijft Magister niet verbonden? Ververs eerst de Magister-pagina en probeer opnieuw.");
      }
    }, 800);
  };

  const setConnection = (p: Partial<typeof c>) => patch({ connection: { ...c, ...p } });

  const linkZermelo = async () => {
    setZBusy(true);
    setZMessage("");
    const res = await exchangeZermeloCode(zSchool, code);
    if (res.ok && res.data) {
      const expiresIn = Number(res.data.expires_in ?? res.data.expiresIn ?? 0);
      setConnection({
        zermeloSubdomain: zSchool.replace(/\.zportal\.nl.*$/, ""),
        zermeloToken: res.data.access_token ?? "",
        zermeloTokenExpiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : 0,
        zermeloStudentCode: "",
      });
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

  const createFeed = async () => {
    setCalendarBusy(true);
    const token = ensureCalendarToken();
    setCalendarToken(token);
    const ok = await publishCalendarFeed(appointments, data.subjects, data.teachers);
    setCalendarBusy(false);
    toast(ok ? "Agenda-link klaar" : "Link aangemaakt", ok ? "success" : "warning",
      ok ? "Plak de link in Google Agenda, Apple Kalender of Outlook." : "De link is aangemaakt; de eerste sync volgt zodra je rooster laadt.");
  };

  const rotateFeed = async () => {
    setCalendarBusy(true);
    await rotateCalendarFeed(appointments, data.subjects, data.teachers);
    setCalendarToken(getCalendarToken());
    setCalendarBusy(false);
    toast("Nieuwe agenda-link aangemaakt", "success", "De oude link werkt niet meer.");
  };

  const removeFeed = () => {
    revokeCalendarFeed();
    setCalendarToken("");
    toast("Agenda-link verwijderd", "info", "Je rooster staat niet meer in de gekoppelde agenda.");
  };

  const copyFeed = async () => {
    const url = calendarFeedUrl(calendarToken);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast("Agenda-link gekopieerd", "success", "Plak hem bij ‘Abonneren op URL’ in je agenda-app.");
    } catch {
      toast("Kopiëren niet gelukt", "warning", "Selecteer de link hierboven handmatig.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="mb-1 text-xs font-medium text-accent">Instellingen</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Schoolkoppeling & voorkeuren</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/45">Alleen echte Magister- en Zermelo-data. Geen demo-omgeving.</p>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-4 text-[12px] text-amber-200">
          {loadError}
        </div>
      )}

      <section className="panel p-5">
        <h2 className="section-title mb-4">Koppelingen</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-white/45">Zermelo alleen is genoeg voor rooster, vakken en keuzelessen. Magister is optioneel en voegt cijfers, PTA en ELO toe.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${c.magisterToken ? "border-emerald-400/30 bg-emerald-400/[0.06]" : "border-amber-400/25 bg-amber-400/[0.05]"}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-xl bg-blue-500/12 p-2 text-blue-400"><GraduationCap size={17} /></span>
              {c.magisterToken ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-amber-400" />}
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Magister v6</p>
            <p className="mono mt-1 text-[11px] text-slate-500 dark:text-white/45">{c.magisterSchool || "Niet verbonden"}</p>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-white/35">{c.magisterToken ? (state.connection.name || "Leerling") : "Optioneel · cijfers, PTA en ELO"}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${c.zermeloToken ? "border-emerald-400/30 bg-emerald-400/[0.06]" : "border-amber-400/25 bg-amber-400/[0.05]"}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-xl bg-emerald-500/12 p-2 text-emerald-400"><Link2 size={17} /></span>
              {c.zermeloToken ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-amber-400" />}
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Zermelo v3</p>
            <p className="mono mt-1 text-[11px] text-slate-500 dark:text-white/45">{c.zermeloToken ? `${c.zermeloSubdomain}.zportal.nl` : "Niet gekoppeld"}</p>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-white/35">{c.zermeloToken ? "Rooster, vakken en keuzelessen actief" : "Koppel voor rooster en keuzelessen"}</p>
          </div>
        </div>

        {c.zermeloToken && c.zermeloTokenExpiresAt > 0 && Date.now() > c.zermeloTokenExpiresAt - 86_400_000 && (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3 text-[11px] text-amber-400">
            Je Zermelo-koppeling verloopt binnenkort. Maak een nieuwe koppelingscode aan via je schoolportaal als inschrijven niet meer werkt.
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-white/[0.08]">
          <label className="label" htmlFor="magister-school">Magister-school</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="magister-school"
              className="input mono flex-1"
              value={mSchool}
              onChange={(e) => setMSchool(e.target.value)}
              onBlur={saveMagisterSchool}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              placeholder="schoolnaam.magister.net"
              autoComplete="organization"
            />
            <button
              className="btn-secondary justify-center"
              onClick={() => openMagister(c.magisterSchool)}
              title="Met één klik wisselen tussen MagisterPro en Magister"
            >
              Wissel naar Magister <ExternalLink size={13} />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-white/45">
            Wordt meestal automatisch herkend. Klopt de school niet? Vul hem hier in; er wordt geen wachtwoord gevraagd.
          </p>
        </div>

        {(!c.magisterToken && !c.zermeloToken) || (c.magisterToken && (loadError || c.magisterSessionSource === "extension")) && (
          <div className="mt-4 space-y-2 rounded-xl border border-slate-200 p-4 dark:border-white/[0.08]">
            <button onClick={requestExtensionSession} className="btn-secondary">
              <KeyRound size={14} /> Magister-sessie via extensie ophalen
            </button>
            <p className="text-[11px] text-slate-500 dark:text-white/50">
              Log in op <a className="font-semibold text-indigo-400 underline" href="https://accounts.magister.net/" target="_blank" rel="noreferrer">accounts.magister.net</a> of je <a className="font-semibold text-indigo-400 underline" href={`https://${c.magisterSchool || "accounts.magister.net"}`} target="_blank" rel="noreferrer">schoolportaal</a> met de extensie geïnstalleerd, en vernieuw die pagina een keer. Daarna werkt deze knop.
            </p>
            {extMessage && <p className="text-[11px] text-amber-400">{extMessage}</p>}
          </div>
        )}

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

        {(savedZermeloKey || c.zermeloToken) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3">
            <KeyRound size={14} className="text-emerald-400" />
            <p className="min-w-0 flex-1 text-[11px] text-slate-600 dark:text-white/60">
              {savedZermeloKey
                ? "Zermelo-sleutel is apart opgeslagen op dit apparaat en komt terug na uitloggen."
                : "Zermelo is verbonden; de sleutel wordt automatisch bewaard."}
            </p>
            <button
              onClick={() => { const ok = saveZermeloKey(); toast(ok ? "Zermelo-sleutel bewaard" : "Geen Zermelo-sleutel om te bewaren", ok ? "success" : "warning"); }}
              className="btn-secondary !py-1.5"
            >
              <KeyRound size={13} /> Bewaar sleutel
            </button>
            <button
              onClick={() => { forgetZermeloKey(); toast("Zermelo-sleutel verwijderd", "info", "Je moet opnieuw koppelen met een code uit het portaal."); }}
              className="btn-secondary !py-1.5 !text-rose-400"
            >
              <XCircle size={13} /> Verwijder sleutel
            </button>
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
          <span className="rounded-xl bg-accent/12 p-2 text-accent"><CalendarDays size={17} /></span>
          <div>
            <h2 className="section-title">Agenda-abonnement (iCal)</h2>
            <p className="text-xs text-slate-500 dark:text-white/45">Eén privé-link voor je hele rooster in Google Agenda, Apple Kalender of Outlook.</p>
          </div>
        </div>

        {calendarToken ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/[0.08]">
              <label className="label" htmlFor="calendar-feed">Jouw privé-link</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="calendar-feed"
                  readOnly
                  className="input mono min-w-0 flex-1 text-[11px]"
                  value={calendarFeedUrl(calendarToken)}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button onClick={() => void copyFeed()} className="btn-secondary justify-center"><Copy size={13} /> Kopieer link</button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-white/45">
                Gebruik in je agenda-app <strong>Abonneren op URL</strong> / <strong>Nieuwe abonnement-locatie</strong>. De link bevat jouw rooster — deel hem niet met anderen.
              </p>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-white/35">
                Vernieuwt automatisch wanneer je MagisterPro opent of de extensie een nieuwe sessie ziet. {lastSync ? `Laatste sync: ${lastSync.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}.` : "Nog geen sync uitgevoerd."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void createFeed()} disabled={calendarBusy} className="btn-secondary">
                {calendarBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Rooster nu publiceren
              </button>
              <button onClick={() => void rotateFeed()} disabled={calendarBusy} className="btn-secondary"><RefreshCw size={13} /> Nieuwe link maken</button>
              <button onClick={removeFeed} className="btn-secondary !text-rose-400"><XCircle size={13} /> Verwijder link</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white/90">Nog geen agenda-link</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-white/45">Maak een willekeurige privé-link. Er wordt geen Magister-wachtwoord of token in de URL gezet.</p>
            </div>
            <button onClick={() => void createFeed()} disabled={calendarBusy} className="btn-primary shrink-0">
              {calendarBusy ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />} Maak iCal-link
            </button>
          </div>
        )}
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="rounded-xl bg-accent/12 p-2 text-accent"><ShieldCheck size={17} /></span>
          <div><h2 className="section-title">Profiel</h2><p className="text-xs text-slate-500 dark:text-white/45">Bepaalt o.a. de slaag/zak-regels.</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Naam (uit schoolkoppeling)</label><input className="input" value={c.name} onChange={(e) => setConnection({ name: e.target.value })} /></div>
          <div><label className="label">School (uit schoolkoppeling)</label><input className="input" value={c.school} onChange={(e) => setConnection({ school: e.target.value })} /></div>
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

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-accent/12 p-2 text-accent"><Palette size={17} /></span>
            <div><h2 className="section-title">Vakkleuren</h2><p className="text-xs text-slate-500 dark:text-white/45">Kies per vak een eigen kleur voor rooster, cijfers en PTA.</p></div>
          </div>
          <button onClick={() => { resetSubjectColors(); toast("Vakkleuren hersteld", "success"); }} className="btn-secondary"><RotateCcw size={13} /> Standaardkleuren</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.subjects.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-white/[0.08]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-700 dark:text-white/75">{s.name}</span>
              <div className="flex gap-1">
                {["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6", "#3b82f6", "#ec4899"].map((color) => (
                  <button key={color} title={`Kleur ${color}`} onClick={() => setSubjectColor(s.id, color)}
                    className={`h-4 w-4 rounded-full transition hover:scale-125 ${state.subjectColors[s.id] === color ? "ring-2 ring-white ring-offset-1 ring-offset-slate-200 dark:ring-offset-[#12121c]" : ""}`}
                    style={{ background: color }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {data.subjects.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Vakken verschijnen zodra de schoolkoppeling gegevens laadt.</p>}
      </motion.section>

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
