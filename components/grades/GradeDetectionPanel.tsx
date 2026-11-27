"use client";

import { useMemo, useState } from "react";
import { Check, Download, EyeOff, RotateCcw, ScanSearch, TriangleAlert } from "lucide-react";
import { useApp } from "@/app/providers";
import { Pill } from "@/components/ui/Primitives";
import { toast } from "@/components/ui/Toaster";
import { shortDate } from "@/lib/format";
import { isSeGrade, isSummaryGrade } from "@/lib/calculations/grades";
import type { Grade, GradeType } from "@/lib/types";

const TYPES: GradeType[] = ["SO", "PTA", "REP", "Opdracht", "Overig"];

/** Handmatige controle op cijfers die Magister met afwijkende veldnamen geeft. */
export function GradeDetectionPanel() {
  const { data, state, setGradeOverride, clearGradeOverride } = useApp();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    const accepted = data.grades.filter((g) => !g.fake);
    const ids = new Set(accepted.map((g) => g.id));
    const candidates = data.gradeCandidates.filter((g) => !ids.has(g.id));
    const summary = data.summaryGrades.filter((g) => !ids.has(g.id));
    return [...accepted, ...candidates, ...summary];
  }, [data.grades, data.gradeCandidates, data.summaryGrades]);

  const groupLabel = (g: Grade) => isSummaryGrade(g) ? "Gemiddelde" : isSeGrade(g) ? "SE" : "Voortgang";

  const valueText = (g: Grade) => {
    if (isSummaryGrade(g)) return g.rawValue ?? "—";
    if (drafts[g.id] !== undefined) return drafts[g.id];
    const value = state.gradeOverrides[g.id]?.value ?? g.value;
    return value ? String(value).replace(".", ",") : g.rawValue ?? "";
  };

  const downloadDiagnostics = () => {
    const blob = new Blob([JSON.stringify({
      generatedAt: new Date().toISOString(),
      diagnostics: data.gradeDiagnostics,
      mapped: rows.map((g) => ({
        id: g.id, date: g.date, rawSubject: g.rawSubject, rawColumn: g.rawColumn,
        rawValue: g.rawValue, label: g.label, type: g.type, needsReview: g.needsReview,
        group: groupLabel(g), summary: isSummaryGrade(g),
      })),
      rawGrades: data.rawGradeRows,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `magisterpro-cijferdiagnose-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Diagnose gedownload", "success", "Controleer het bestand op persoonsgegevens voordat je het deelt.");
  };

  const commitValue = (g: Grade) => {
    const text = (drafts[g.id] ?? valueText(g)).replace(/\s/g, "").replace(",", ".");
    const value = Number.parseFloat(text);
    if (!Number.isFinite(value) || value <= 0 || value > 10) {
      toast("Geen geldig cijfer", "warning", "Vul een cijfer tussen 0 en 10 in, bijvoorbeeld 7,5.");
      return;
    }
    setGradeOverride(g.id, { value });
  };

  const subjectId = (g: Grade) => state.gradeOverrides[g.id]?.subjectId ?? g.subjectId;
  const hidden = (g: Grade) => state.gradeOverrides[g.id]?.include === false;
  const d = data.gradeDiagnostics;

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="section-title flex items-center gap-2"><ScanSearch size={17} className="text-accent" /> Cijferdetectie</h2>
          <button onClick={downloadDiagnostics} className="btn-secondary"><Download size={13} /> Download diagnose</button>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-white/45">
          Magister gebruikt per school andere veldnamen. Controleer hier welke kolommen en cijfers bij welk vak horen; je keuzes worden bewaard en blijven na elke sync staan. SE-cijfers staan los van de overige cijfers; gemiddelde-kolommen verschijnen alleen onderaan deze diagnose en tellen nooit als cijfer mee.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Binnengekomen rijen", value: d.raw },
            { label: "Automatisch geplaatst", value: d.accepted },
            { label: "Handmatig controleren", value: d.review },
            { label: "Bewust overgeslagen", value: d.dropped },
            { label: "Gemiddelde-kolommen", value: d.summary },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]">
              <p className="mono text-xl font-bold text-slate-900 dark:text-white">{item.value}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
        {d.review > 0 && (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-[11px] text-amber-500">
            <TriangleAlert size={14} className="shrink-0" /> {d.review} rij(en) staan nog niet in je gemiddelde. Kies hieronder het vak en, als het cijfer ontbreekt, de waarde.
          </p>
        )}
        {d.errors.length > 0 && (
          <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] p-3 text-[11px] text-rose-400">
            <p className="flex items-center gap-2 font-bold"><TriangleAlert size={14} /> Magister gaf op deze cijferpaden geen gegevens:</p>
            <ul className="mono mt-1 space-y-0.5 text-[10px] opacity-80">{d.errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        )}
        {d.sources.length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 p-3 text-[11px] text-slate-500 dark:border-white/[0.08] dark:text-white/50">
            <p className="font-bold">Opgehaald per aanmelding / schooljaar:</p>
            <ul className="mono mt-1 space-y-0.5 text-[10px]">
              {d.sources.map((source) => (
                <li key={source.path}>{source.rows} rijen · {source.path}{source.error ? ` · ${source.error}` : ""}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full min-w-[1120px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 dark:bg-[#14141e] dark:text-white/30">
              <tr>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Datum</th>
                <th className="px-3 py-2 font-semibold">Rauw vak</th>
                <th className="px-3 py-2 font-semibold">Kolom / rij</th>
                <th className="px-3 py-2 font-semibold">Groep</th>
                <th className="px-3 py-2 font-semibold">Cijfer</th>
                <th className="px-3 py-2 font-semibold">Vak toewijzen</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 text-right font-semibold">Acties</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-xs text-slate-400">Geen cijfers gevonden. Ververs je gegevens met de extensie actief.</td></tr>
              )}
              {rows.map((g) => {
                const summary = isSummaryGrade(g);
                const needsReview = !summary && g.needsReview && !state.gradeOverrides[g.id]?.value && !state.gradeOverrides[g.id]?.subjectId;
                const group = groupLabel(g);
                return (
                  <tr key={g.id} className={`border-t border-slate-100 dark:border-white/[0.05] ${summary ? "bg-amber-400/[0.03] opacity-70" : hidden(g) ? "opacity-45" : ""}`}>
                    <td className="px-3 py-2">
                      <Pill tone={summary ? "neutral" : hidden(g) ? "neutral" : needsReview ? "amber" : "green"}>
                        {summary ? "Geen cijfer" : hidden(g) ? "Verborgen" : needsReview ? "Controleren" : "Actief"}
                      </Pill>
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-2 text-slate-400">{shortDate(g.date)}</td>
                    <td className="max-w-[170px] truncate px-3 py-2 text-slate-500 dark:text-white/55" title={g.rawSubject}>{g.rawSubject}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-slate-500 dark:text-white/55" title={`${g.rawColumn ?? ""} ${g.label}`}>{g.rawColumn || g.label}</td>
                    <td className="px-3 py-2"><Pill tone={summary ? "neutral" : group === "SE" ? "accent" : "blue"}>{group}</Pill></td>
                    <td className="px-3 py-2">
                      {summary ? (
                        <span className="mono text-slate-400">{valueText(g)}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            className="input mono !w-20 !px-2 !py-1 text-xs"
                            value={valueText(g)}
                            placeholder="—"
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [g.id]: e.target.value }))}
                            onBlur={() => commitValue(g)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitValue(g); } }}
                          />
                          <span className="text-[10px] text-slate-400">/ 10</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {summary ? <span className="text-slate-400">—</span> : (
                        <select
                          className="input !w-44 !px-2 !py-1 text-xs"
                          value={subjectId(g)}
                          onChange={(e) => setGradeOverride(g.id, { subjectId: e.target.value })}
                        >
                          {!data.subjects.some((s) => s.id === subjectId(g)) && <option value={subjectId(g)}>Onbekend vak</option>}
                          {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {summary ? <span className="text-[11px] text-slate-400">Overig</span> : (
                        <select
                          className="input !w-24 !px-2 !py-1 text-xs"
                          value={state.gradeOverrides[g.id]?.type ?? g.type}
                          onChange={(e) => setGradeOverride(g.id, { type: e.target.value as GradeType })}
                        >
                          {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {summary ? <span className="text-[10px] text-slate-400">alleen diagnose</span> : (
                        <>
                          <button title="Gebruik dit cijfer" className="btn-ghost !p-1.5 text-emerald-400" onClick={() => commitValue(g)}><Check size={14} /></button>
                          <button title={hidden(g) ? "Weer tonen" : "Dit cijfer negeren"} className={`btn-ghost !p-1.5 ${hidden(g) ? "text-accent" : "text-slate-400"}`}
                            onClick={() => setGradeOverride(g.id, { include: !hidden(g) })}><EyeOff size={14} /></button>
                          <button title="Automatische detectie herstellen" className="btn-ghost !p-1.5 text-slate-400" onClick={() => clearGradeOverride(g.id)}><RotateCcw size={14} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
