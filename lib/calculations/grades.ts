import type { Grade, PtaColumn, Subject, EducationLevel } from "@/lib/types";

/* ===========================================================================
 * Cijferstudio — pure rekenlogica. Alle functies zijn deterministisch.
 * ========================================================================= */

export const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Gewogen gemiddelde. Geen cijfers betekent "geen waarde", niet nul. */
export function weightedAverage(grades: Grade[]): number {
  if (!grades.length) return NaN;
  const total = grades.reduce((sum, g) => sum + g.weight, 0);
  if (total <= 0) return NaN;
  return grades.reduce((sum, g) => sum + g.value * g.weight, 0) / total;
}

export function isSeGrade(g: Grade): boolean {
  return g.type === "PTA" || g.type === "REP" || Boolean(g.ptaColumnId) || /^PTA/i.test(g.columnCode ?? "");
}

export interface SubjectStats {
  subjectId: string;
  average: number;
  rounded: number;
  seAverage: number;
  progressAverage: number;
  count: number;
  totalWeight: number;
  trend: { date: string; value: number; label: string }[];
  spread: number;
  ptaProgress: number; // 0..100
  nextRoundGap: number; // hoeveel tekort tot de volgende 0,5-grens
}

export function subjectStats(
  subjectId: string,
  grades: Grade[],
  columns: PtaColumn[] = []
): SubjectStats {
  const own = grades.filter((g) => g.subjectId === subjectId);
  const se = own.filter(isSeGrade);
  const progress = own.filter((g) => !isSeGrade(g));
  const sorted = [...own].sort((a, b) => a.date.localeCompare(b.date));
  let running: Grade[] = [];
  const trend = sorted.map((g) => {
    running.push(g);
    return { date: g.date, value: round2(weightedAverage(running)), label: g.label };
  });
  const avg = weightedAverage(own);
  const values = own.map((g) => g.value);
  const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
  const subjectColumns = columns.filter((c) => c.subjectId === subjectId);
  const doneWeight = subjectColumns
    .filter((c) => c.gradeId)
    .reduce((s, c) => s + c.weight, 0);
  const allWeight = subjectColumns.reduce((s, c) => s + c.weight, 0);
  const roundedUp = Math.ceil(avg * 2) / 2;
  return {
    subjectId,
    average: avg,
    rounded: round1(avg),
    seAverage: weightedAverage(se),
    progressAverage: weightedAverage(progress),
    count: own.length,
    totalWeight: own.reduce((s, g) => s + g.weight, 0),
    trend,
    spread,
    ptaProgress: allWeight ? (doneWeight / allWeight) * 100 : 0,
    nextRoundGap: own.length ? Math.max(0, round2(roundedUp - avg)) : 0,
  };
}

/** Het exacte cijfer dat je nodig hebt om een target te bereiken. */
export function neededGrade(currentAverage: number, currentWeight: number, target: number, newWeight: number): number {
  if (newWeight <= 0) return 0;
  return (target * (currentWeight + newWeight) - currentAverage * currentWeight) / newWeight;
}

export interface WhatIfResult {
  required: number;
  achievable: boolean;
  scenarios: { grade: number; resultingAverage: number; delta: number }[];
}

export function whatIf(target: number, grades: Grade[], weight: number): WhatIfResult {
  const avg = weightedAverage(grades);
  const w = grades.reduce((s, g) => s + g.weight, 0);
  const required = neededGrade(avg, w, target, weight);
  return {
    required: round2(required),
    achievable: required <= 10,
    scenarios: [5, 6, 7, 8].map((g) => {
      const resultingAverage = weightedAverage([...grades, { ...grades[0], value: g, weight, fake: true }]);
      return { grade: g, resultingAverage: round2(resultingAverage), delta: round2(resultingAverage - avg) };
    }),
  };
}

/* ---------------------------------------------------------------------------
 * Officiële slaag/zak-check (bovenbouw havo/vwo, volgens opgave)
 * ------------------------------------------------------------------------- */

export type ExamStatus = "op-koers" | "aandacht" | "gevaar" | "geen-data";

export interface ExamCheck {
  status: ExamStatus;
  hasData: boolean;
  label: string;
  summary: string;
  roundedGrades: { subjectId: string; raw: number; rounded: number; core: boolean; count: number }[];
  averageRounded: number;
  averageOk: boolean;
  coreOk: boolean;
  coreIssues: string[];
  deficitPoints: number;
  compensationPoints: number;
  balanceOk: boolean;
  deficits: { subjectId: string; points: number }[];
  tips: { subjectId: string; text: string; gain: number }[];
}

export function deficitFor(rounded: number): number {
  if (!Number.isFinite(rounded) || rounded >= 6) return 0;
  return Math.min(5, 6 - rounded);
}

export function compensationFor(rounded: number): number {
  if (!Number.isFinite(rounded) || rounded <= 6) return 0;
  if (rounded === 7) return 1;
  if (rounded === 8) return 2;
  return 3;
}

const CORE_PATTERNS = [/nederlands/i, /engels/i, /wiskunde/i];
const EXAM_YEARS = new Set<EducationLevel>(["havo5", "vwo5", "vwo6"]);

export function examCheck(
  subjects: Subject[],
  allGrades: Grade[],
  level: EducationLevel
): ExamCheck {
  // Alleen vakken met echte cijfers tellen mee. Lege PTA-kolommen of vakken
  // die alleen uit een roosterafspraak komen, mogen de slaagcheck niet vervormen.
  const roundedGrades = subjects
    .filter((s) => s.isExamSubject)
    .map((s) => {
      // Samenvattingskolommen (voorlopig eindcijfer, R1/VG1, eind SE, ...) hebben
      // weging 0 en mogen niet als apart cijfer meetellen: dat geeft NaN of
      // dubbeltellingen. Alleen echte, gewogen cijfers bepalen de slaagcheck.
      const own = allGrades.filter((g) =>
        g.subjectId === s.id && Number.isFinite(g.value) && g.value > 0
        && Number.isFinite(g.weight) && g.weight > 0
      );
      const raw = weightedAverage(own);
      return {
        subjectId: s.id,
        raw,
        // Rapportcijfers worden half-omhoog afgerond, niet banker's rounding.
        rounded: Math.floor(raw + 0.5),
        core: CORE_PATTERNS.some((pattern) => pattern.test(s.name)) && s.isCore,
        count: own.length,
      };
    })
    .filter((r) => r.count > 0 && Number.isFinite(r.raw));

  const coreIssues: string[] = [];
  const coreEntries = roundedGrades.filter((r) => r.core);
  const fives = coreEntries.filter((r) => r.rounded === 5);
  const lows = coreEntries.filter((r) => r.rounded <= 4);
  if (lows.length) coreIssues.push(`Een kernvak staat op ${lows.map((l) => l.rounded).join(", ")} (4 of lager is niet toegestaan).`);
  if (fives.length > 1) coreIssues.push("Meer dan één kernvak staat op een 5.");
  const coreOk = coreIssues.length === 0;

  const deficits = roundedGrades
    .filter((r) => deficitFor(r.rounded) > 0)
    .map((r) => ({ subjectId: r.subjectId, points: deficitFor(r.rounded) }));
  const deficitPoints = deficits.reduce((s, d) => s + d.points, 0);
  const compensationPoints = roundedGrades.reduce((s, r) => s + compensationFor(r.rounded), 0);
  const hasData = roundedGrades.length > 0;
  const averageRounded = hasData
    ? roundedGrades.reduce((s, r) => s + r.rounded, 0) / roundedGrades.length
    : NaN;
  const averageOk = hasData && averageRounded >= 6;

  const tips = subjects
    .filter((s) => s.isExamSubject)
    .map((s) => {
      const entry = roundedGrades.find((r) => r.subjectId === s.id)!;
      if (!entry) return null;
      const needed = 6 - entry.raw;
      const gain = entry.rounded < 6 ? (6 - entry.rounded) * 1.4 - needed * 0.2 : Math.max(0, 7 - entry.raw) * 0.5;
      if (gain <= 0) return null;
      return {
        subjectId: s.id,
        gain: round2(gain),
        text:
          entry.rounded === 5
            ? `${s.name} staat op 5 — één punt hoger haalt je tekort weg en geeft compensatie.`
            : `${s.name} (${round1(entry.raw)}) is het rendement om op te hogen richting een 6.`,
      };
    })
    .filter((t): t is { subjectId: string; gain: number; text: string } => Boolean(t))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3);

  const balanceOk = hasData && compensationPoints >= deficitPoints && coreOk && averageOk;
  const status: ExamStatus = !hasData ? "geen-data" : balanceOk && averageRounded >= 6.4 ? "op-koers" : balanceOk ? "aandacht" : "gevaar";
  const label = status === "geen-data" ? "Nog geen cijfers" : status === "op-koers" ? "Ruim op koers" : status === "aandacht" ? "Aandachtspunt" : "Gevarenzone";

  const examYear = EXAM_YEARS.has(level);
  const shortage = Math.max(0, deficitPoints - compensationPoints);
  const baseSummary = status === "geen-data"
    ? "Zodra echte cijfers uit je schoolportaal binnenkomen, verschijnt hier je slaag/zak-check."
    : status === "op-koers"
      ? "Je staat er goed voor. Blijf je compensatiepunten behouden."
      : status === "aandacht"
        ? "Je haalt net aan de eisen, maar er is weinig marge over."
        : coreIssues.length > 0
          ? coreIssues[0]
          : shortage > 0
            ? `Er zijn ${shortage} tekortpunten te veel om te compenseren.`
            : "Je gemiddelde ligt nog onder een 6,0.";

  return {
    status,
    hasData,
    label,
    summary: examYear
      ? baseSummary
      : `Tussenstand voor ${level.toUpperCase()} — ${baseSummary} In het examenjaar geldt de definitieve slaag/zak-regeling.`,
    roundedGrades,
    averageRounded: round2(averageRounded),
    averageOk,
    coreOk,
    coreIssues,
    deficitPoints,
    compensationPoints,
    balanceOk,
    deficits,
    tips,
  };
}

/* ---------------------------------------------------------------------------
 * Analytics & recordboek
 * ------------------------------------------------------------------------- */

export function monthlyTrend(grades: Grade[], subjects: Subject[]) {
  const buckets = new Map<string, Grade[]>();
  grades.forEach((g) => {
    const key = g.date.slice(0, 7);
    buckets.set(key, [...(buckets.get(key) ?? []), g]);
  });
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, gs]) => ({
      month: new Date(`${month}-01T12:00:00`).toLocaleDateString("nl-NL", { month: "short" }),
      average: round2(weightedAverage(gs)),
      count: gs.length,
    }));
}

export function profileAverages(grades: Grade[], subjects: Subject[]) {
  const groups: Record<string, string[]> = { Bèta: [], Talen: [], Maatschappij: [], Kern: [] };
  subjects.forEach((s) => {
    const key =
      s.profile === "beta" ? "Bèta" : s.profile === "talen" ? "Talen" : s.profile === "maatschappij" ? "Maatschappij" : "Kern";
    const avg = weightedAverage(grades.filter((g) => g.subjectId === s.id));
    if (avg > 0) groups[key].push(String(round2(avg)));
  });
  return Object.entries(groups).map(([profile, values]) => ({
    profile,
    average: values.length ? round2(values.reduce((s, v) => s + Number(v), 0) / values.length) : 0,
  }));
}

export interface GradeRecords {
  highest: { grade: Grade; subject?: Subject } | null;
  comeback: { subjectId: string; from: number; to: number; delta: number } | null;
  consistent: { subjectId: string; spread: number } | null;
  bestWeekday: string;
}

export function gradeRecords(grades: Grade[], subjects: Subject[]): GradeRecords {
  const highest = grades.length
    ? grades.reduce((best, g) => (g.value > best.value ? g : best), grades[0])
    : null;
  let comeback: GradeRecords["comeback"] = null;
  subjects.forEach((s) => {
    const gs = grades.filter((g) => g.subjectId === s.id).sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < gs.length; i++) {
      const delta = gs[i].value - gs[i - 1].value;
      if (delta > 0 && (!comeback || delta > comeback.delta)) {
        comeback = { subjectId: s.id, from: gs[i - 1].value, to: gs[i].value, delta: round1(delta) };
      }
    }
  });
  const consistent = subjects
    .map((s) => ({ subjectId: s.id, spread: subjectStats(s.id, grades).spread }))
    .filter((s) => s.spread > 0)
    .sort((a, b) => a.spread - b.spread)[0] ?? null;
  const weekdays = Array(7).fill(0) as number[];
  const counts = Array(7).fill(0) as number[];
  grades.forEach((g) => {
    const day = (new Date(`${g.date}T12:00:00`).getDay() + 6) % 7;
    weekdays[day] += g.value;
    counts[day]++;
  });
  const names = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
  let bestWeekday = "Maandag";
  let best = -1;
  weekdays.forEach((sum, i) => {
    const avg = counts[i] ? sum / counts[i] : 0;
    if (avg > best) {
      best = avg;
      bestWeekday = names[i];
    }
  });
  return { highest: highest ? { grade: highest, subject: subjects.find((s) => s.id === highest.subjectId) } : null, comeback, consistent, bestWeekday };
}

/** Impact van één nieuw cijfer op het vakgemiddelde (verschil in gemiddelde). */
export function gradeImpact(grade: Grade, previousGrades: Grade[]): number {
  const before = weightedAverage(previousGrades);
  const after = weightedAverage([...previousGrades, grade]);
  return round2(after - before);
}

export function formatGrade(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1).replace(".", ",") : "—";
}
