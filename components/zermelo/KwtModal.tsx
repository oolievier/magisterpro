"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search, MapPin, UserRound, Users, AlertTriangle, CheckCircle2, Filter,
  ArrowRight, Sparkles, RefreshCw, ExternalLink,
} from "lucide-react";
import { useApp } from "@/app/providers";
import { Modal } from "@/components/ui/Modal";
import { Pill, ProgressBar } from "@/components/ui/Primitives";
import { conflictsFor } from "@/lib/calculations/planner";
import { weightedAverage } from "@/lib/calculations/grades";
import { timeLabel, shortDate, relativeDeadline } from "@/lib/format";
import { zermelo } from "@/lib/api/zermelo";
import { magister } from "@/lib/api/magister";
import { toast } from "@/components/ui/Toaster";
import type { ChoiceGroup, ChoiceOption } from "@/lib/types";

export function KwtModal({ group, onClose }: { group: ChoiceGroup | null; onClose: () => void }) {
  const { data, state, enroll, unenroll, appointments, refresh } = useApp();
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [onlyFree, setOnlyFree] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = group ? state.enrollments[group.id] : undefined;
  const source = group?.source ?? "zermelo";
  const isMagister = source === "magister";

  const isEnrolled = (option: ChoiceOption) => current === option.id || option.alreadyEnrolled === true;
  const enrolledOption = group?.options.find((o) => isEnrolled(o));

  /** Kiest de door Zermelo meegegeven actie op basis van de statuscodes. */
  const chooseAction = (option: ChoiceOption, unenrolling: boolean) => {
    const actions = option.actions ?? [];
    const allowed = actions.filter((a) => a.allowed !== false && Boolean(a.post));
    const has = (a: { code?: number; statusCodes: number[] }, code: number) => a.code === code || a.statusCodes.includes(code);
    if (unenrolling) {
      return allowed.find((a) => has(a, 3003) || a.code === 1002)
        ?? allowed.find((a) => has(a, 2002) || a.code === 1006)
        ?? allowed[0];
    }
    return allowed.find((a) => has(a, 2002) || a.code === 1006)
      ?? allowed.find((a) => !a.statusCodes.some((code) => code >= 3000))
      ?? allowed[0];
  };

  const lowSubjects = useMemo(
    () => data.subjects.filter((s) => weightedAverage(data.grades.filter((g) => g.subjectId === s.id)) < 6).map((s) => s.id),
    [data.subjects, data.grades]
  );

  const options = useMemo(() => {
    if (!group) return [];
    return group.options
      .filter((o) => {
        const text = `${o.title} ${o.description} ${o.location} ${data.subjects.find((s) => s.id === o.subjectId)?.name ?? ""} ${data.teachers.find((t) => t.id === o.teacherId)?.name ?? ""}`.toLowerCase();
        return text.includes(query.toLowerCase())
          && (subjectFilter === "all" || o.subjectId === subjectFilter)
          && (!onlyFree || o.enrolled < o.capacity || isEnrolled(o));
      })
      .sort((a, b) => {
        const aRec = a.subjectId && lowSubjects.includes(a.subjectId) ? 1 : 0;
        const bRec = b.subjectId && lowSubjects.includes(b.subjectId) ? 1 : 0;
        return bRec - aRec || a.enrolled / Math.max(1, a.capacity) - b.enrolled / Math.max(1, b.capacity);
      });
  }, [group, query, subjectFilter, onlyFree, data.subjects, data.teachers, lowSubjects, current]);

  const doEnroll = async (option: ChoiceOption) => {
    if (!group) return;
    const conflicts = conflictsFor(option, appointments);
    if (conflicts.length) {
      toast("Conflict met je reguliere rooster", "warning", `Overlapt met ${conflicts[0].title} (${timeLabel(conflicts[0].start)}).`);
      return;
    }
    if (option.alreadyEnrolled && current !== option.id) {
      toast("Al ingeschreven", "info", `${option.title} staat al op je inschrijvingen in ${isMagister ? "Magister" : "Zermelo"}.`);
      enroll(group.id, option.id);
      return;
    }
    if (option.canEnroll === false && isMagister) {
      toast("Inschrijven niet mogelijk", "warning", "Magister geeft aan dat dit onderdeel niet op in te schrijven is.");
      return;
    }
    if (option.enrolled >= option.capacity && option.id !== current) {
      toast("Deze keuzeles zit vol", "warning", "Kies een andere optie of zet je op de wachtlijst via school.");
      return;
    }

    setBusy(true);
    let ok = false;
    let error = "";
    if (isMagister) {
      const config = { subdomain: state.connection.magisterSchool, token: state.connection.magisterToken };
      if (!config.token || !state.connection.magisterPersonId) {
        error = "Magister is niet gekoppeld of het leerlingprofiel ontbreekt. Vernieuw je gegevens.";
      } else {
        const res = await magister.enrollActivity(config, state.connection.magisterPersonId, option.rawGroupId, option.rawId);
        ok = res.ok;
        error = res.error ?? "";
      }
    } else {
      if (!state.connection.zermeloToken) {
        error = "Koppel eerst je Zermelo-account via Instellingen.";
      } else {
        const action = chooseAction(option, false);
        if (!action) {
          error = "Zermelo gaf geen inschrijfactie voor deze les. Vernieuw de gegevens of schrijf je in via het portaal.";
        } else {
          const res = await zermelo.postScheduleAction(
            { subdomain: state.connection.zermeloSubdomain, token: state.connection.zermeloToken },
            action.post
          );
          ok = res.ok;
          error = res.error ?? "";
        }
      }
    }
    if (!ok) {
      setBusy(false);
      toast(`Inschrijven via ${isMagister ? "Magister" : "Zermelo"} mislukt`, "warning", error);
      return;
    }
    enroll(group.id, option.id);
    setBusy(false);
    toast(`Ingeschreven via ${isMagister ? "Magister" : "Zermelo"}`, "success", `${option.title} · ${option.location}.`);
    void refresh();
  };

  const doUnenroll = async () => {
    if (!group || !enrolledOption) return;
    setBusy(true);
    let ok = false;
    let error = "";
    if (isMagister) {
      const config = { subdomain: state.connection.magisterSchool, token: state.connection.magisterToken };
      if (!config.token || !state.connection.magisterPersonId) {
        error = "Magister is niet gekoppeld of het leerlingprofiel ontbreekt.";
      } else {
        const res = await magister.unenrollActivity(config, state.connection.magisterPersonId, enrolledOption.rawGroupId, enrolledOption.rawId);
        ok = res.ok;
        error = res.error ?? "";
      }
    } else {
      if (!state.connection.zermeloToken) {
        error = "Koppel eerst je Zermelo-account via Instellingen.";
      } else {
        const action = chooseAction(enrolledOption, true);
        if (!action) {
          error = "Zermelo gaf geen uitschrijfactie. Gebruik de portaal-link hieronder.";
        } else {
          const res = await zermelo.postScheduleAction(
            { subdomain: state.connection.zermeloSubdomain, token: state.connection.zermeloToken },
            action.post
          );
          ok = res.ok;
          error = res.error ?? "";
        }
      }
    }
    if (!ok) {
      setBusy(false);
      toast("Uitschrijven mislukt", "warning", error);
      return;
    }
    unenroll(group.id);
    setBusy(false);
    toast("Uitgeschreven", "info", `De plek is weer vrijgegeven in ${isMagister ? "Magister" : "Zermelo"}.`);
    void refresh();
  };

  const portalUrl = isMagister
    ? `https://${state.connection.magisterSchool || "accounts.magister.net"}`
    : `https://${state.connection.zermeloSubdomain || "school"}.zportal.nl`;

  return (
    <Modal
      open={Boolean(group)}
      onClose={onClose}
      title={group?.title ?? (isMagister ? "Magister-activiteiten" : "Zermelo keuzelessen")}
      subtitle={group
        ? `${shortDate(group.start)} · ${timeLabel(group.start)}–${timeLabel(group.end)} · ${group.mandatory ? "verplicht" : "vrijwillig"} · bron: ${isMagister ? "Magister" : "Zermelo"}${isMagister ? "" : ` · kiestijd sluit ${relativeDeadline(group.deadline)}`}`
        : ""}
      wide
    >
      {group && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input !pl-9" placeholder="Zoek op vak, docent of lokaal…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="input !w-auto" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="all">Alle vakken</option>
              {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => setOnlyFree(!onlyFree)} className={`btn ${onlyFree ? "bg-emerald-500/15 text-emerald-400" : "btn-secondary"}`}><Filter size={14} /> Alleen plek vrij</button>
            {enrolledOption && <button onClick={() => void doUnenroll()} disabled={busy} className="btn-secondary text-rose-400"><RefreshCw size={14} /> Uitschrijven</button>}
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/[0.05] p-3 text-[11px] text-slate-600 dark:text-white/60">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
            <span><strong className="text-slate-800 dark:text-white/90">Slimme suggestie:</strong> {
              isMagister ? "Activiteiten waarvoor je je al hebt ingeschreven, staan gemarkeerd. " : "Keuzelessen voor vakken waar je onder de 6 staat ("
            }{!isMagister && (lowSubjects.map((id) => data.subjects.find((s) => s.id === id)?.short).filter(Boolean).join(", ") || "geen")}{!isMagister && ") staan bovenaan. "}Capaciteit wordt bijgewerkt na in- en uitschrijven.</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {options.length === 0 && <p className="col-span-2 py-10 text-center text-xs text-slate-400">Geen opties gevonden met deze filters.</p>}
            {options.map((o, i) => {
              const subject = data.subjects.find((s) => s.id === o.subjectId);
              const teacher = data.teachers.find((t) => t.id === o.teacherId);
              const conflicts = conflictsFor(o, appointments);
              const full = o.enrolled >= o.capacity;
              const selected = isEnrolled(o);
              const recommended = o.subjectId && lowSubjects.includes(o.subjectId);
              return (
                <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} transition={{ delay: i * 0.04 }}
                  className={`relative rounded-2xl border p-4 transition ${selected ? "border-accent bg-accent/[0.06]" : "border-slate-200 dark:border-white/[0.08]"}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white" style={{ background: subject?.color ?? "#64748b" }}>{subject?.code ?? o.kind.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 dark:text-white/90">{o.title}</p>
                          {recommended && <Pill tone="accent">Aanbevolen</Pill>}
                          {selected && <Pill tone="green">Ingeschreven</Pill>}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400">{o.description || "Geen extra omschrijving"}</p>
                      </div>
                    </div>
                    <Pill tone={o.kind === "steun" ? "blue" : o.kind === "stilte" ? "neutral" : "accent"}>{o.kind}</Pill>
                  </div>
                  <div className="my-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-white/45">
                    <span className="flex items-center gap-1"><MapPin size={12} className="text-accent" /><span className="mono">{o.location}</span></span>
                    {teacher && <span className="flex items-center gap-1"><UserRound size={12} className="text-accent" />{teacher.name}</span>}
                    <span className="mono">{timeLabel(o.start)}–{timeLabel(o.end)}</span>
                  </div>
                  <div className="mb-3"><ProgressBar value={Math.min(100, (o.enrolled / Math.max(1, o.capacity)) * 100)} color={full ? "#f43f5e" : o.enrolled / Math.max(1, o.capacity) > 0.8 ? "#f59e0b" : "#10b981"}
                    label={`${o.enrolled}/${o.capacity} plekken bezet`} height={5} /></div>
                  {conflicts.length > 0 && (
                    <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-rose-500/10 p-2 text-[10px] text-rose-400"><AlertTriangle size={12} className="mt-0.5 shrink-0" />Conflict: {conflicts.map((c) => c.title).join(", ")}</div>
                  )}
                  <button disabled={busy || (full && !selected)} onClick={() => void doEnroll(o)}
                    className={`w-full ${selected ? "btn-secondary text-emerald-400" : conflicts.length ? "btn-secondary text-rose-400" : "btn-primary"}`}>
                    {selected ? <><CheckCircle2 size={14} /> Ingeschreven — bevestigen</> : full ? <><Users size={14} /> Vol</> : <><ArrowRight size={14} /> Inschrijven via {isMagister ? "Magister" : "Zermelo"}</>}
                  </button>
                </motion.div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <span>Bron: {isMagister ? "Magister activiteiten-API" : "Zermelo Portal API v3"} · live koppeling</span>
            <a href={portalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Open portaal <ExternalLink size={10} /></a>
          </div>
        </div>
      )}
    </Modal>
  );
}
