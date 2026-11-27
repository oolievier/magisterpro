/* ===========================================================================
 * Live-data-mapper: ruwe Magister v6 / Zermelo v3 antwoorden -> AppData.
 * Er is geen fallback-dataset: alles komt uit de echte schoolkoppeling.
 * ========================================================================= */

import { magister, normalizeMagisterHost, type MagisterConfig } from "@/lib/api/magister";
import { zermelo, type ZermeloAppointment, type ZermeloLiveSchedule } from "@/lib/api/zermelo";
import { mergeAppointments } from "@/lib/data-merger";
import type {
  AppData, Absence, Appointment, ChoiceGroup, ChoiceOption, EloAssignment, Grade,
  Homework, Message, PtaColumn, Profile, SchoolYearStats, StudyGuide, StudyGuideAttachment,
  Subject, Teacher,
} from "@/lib/types";

export interface LiveConnection {
  /** Magister is optioneel: Zermelo-only is een volledig ondersteunde modus. */
  magisterToken?: string;
  magisterSchool?: string;
  zermeloSubdomain?: string;
  zermeloToken?: string;
  zermeloStudentCode?: string;
}

export interface LiveDataResult {
  data: AppData;
  name: string;
  school: string;
  personId: string;
  studentCode: string;
  counts: { grades: number; appointments: number; choices: number; messages: number };
}

type Row = Record<string, any>; // ruwe API-objecten hebben wisselende casing per school

const COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6", "#3b82f6", "#ec4899", "#14b8a6", "#a3a3a3"];
const CORE = ["Nederlands", "Engels", "Wiskunde"];
const CANCELLED = new Set([4, 5]);

/** Veelvoorkomende Magister-afkortingen en code-vormen -> volledige vaknaam. */
const KNOWN_SUBJECTS: Record<string, string> = {
  ned: "Nederlands", ne: "Nederlands", nederlands: "Nederlands", netl: "Nederlands", nedl: "Nederlands",
  eng: "Engels", en: "Engels", engels: "Engels", entl: "Engels", engl: "Engels",
  wis: "Wiskunde", wisa: "Wiskunde A", wisb: "Wiskunde B", wisc: "Wiskunde C", wisd: "Wiskunde D",
  wiskunde: "Wiskunde", wiskundea: "Wiskunde A", wiskundeb: "Wiskunde B",
  nat: "Natuurkunde", natuurkunde: "Natuurkunde",
  natuur: "Natuurkunde", fysica: "Natuurkunde",
  sk: "Scheikunde", schei: "Scheikunde", scheikunde: "Scheikunde", schk: "Scheikunde",
  bio: "Biologie", biologie: "Biologie", biol: "Biologie",
  eco: "Economie", economie: "Economie", econ: "Economie",
  gs: "Geschiedenis", gesch: "Geschiedenis", geschiedenis: "Geschiedenis",
  ma: "Maatschappijleer", maats: "Maatschappijleer", maatschappijleer: "Maatschappijleer",
  fr: "Frans", frans: "Frans", du: "Duits", duits: "Duits", spa: "Spaans", spaans: "Spaans",
  inf: "Informatica", informatica: "Informatica", ict: "Informatica",
  kunst: "Kunst & Cultuur", ac: "Kunst & Cultuur", kc: "Kunst & Cultuur",
  lich: "Lichamelijke opvoeding", lo: "Lichamelijke opvoeding", gym: "Lichamelijke opvoeding",
  aard: "Aardrijkskunde", aardrijkskunde: "Aardrijkskunde", geo: "Aardrijkskunde",
  muz: "Muziek", muziek: "Muziek",
  lat: "Latijn", latijn: "Latijn", gr: "Grieks", grieks: "Grieks",
  fis: "Filosofie", filosofie: "Filosofie",
  god: "Godsdienst", gs2: "Godsdienst", levensbeschouwing: "Levensbeschouwing",
  accounting: "Accountancy", accountancy: "Accountancy",
  rechten: "Rechten", recht: "Rechten",
  bec: "Bedrijfseconomie", bedrijfseconomie: "Bedrijfseconomie",
  handel: "Handel", mba: "Management & Bedrijf",
  psych: "Psychologie", psychologie: "Psychologie",
  soc: "Sociologie", sociologie: "Sociologie",
  techniek: "Techniek", nlt: "Natuur & Techniek", stat: "Statistiek",
};

const pick = (row: Row, ...keys: string[]): any => {
  for (const key of keys) if (row?.[key] !== undefined && row[key] !== null) return row[key];
  return undefined;
};
const list = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value.filter(Boolean) as Row[];
  if (!value || typeof value !== "object") return [];
  const obj = value as Row;
  for (const key of ["Items", "items", "data", "Data"]) if (Array.isArray(obj[key])) return obj[key] as Row[];
  if (obj.response && Array.isArray(obj.response.data)) return obj.response.data as Row[];
  return [];
};
const str = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};
const num = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

/** Parseert cijfers als "7,5", "7.5", "7 1/2", "15/20" en gewone getallen. */
function parseGradeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  const raw = value.trim().replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  if (!raw) return NaN;
  const fraction = raw.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const result = Number(fraction[1]) + Number(fraction[2]) / Number(fraction[3]);
    return Number.isFinite(result) ? result : NaN;
  }
  const slash = raw.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (slash) {
    const upper = num(slash[1].replace(",", "."), NaN);
    const lower = num(slash[2].replace(",", "."), NaN);
    if (!Number.isFinite(upper) || !Number.isFinite(lower) || lower === 0) return NaN;
    // 12/20 is een 6 op de tienpuntsschaal; 7/10 blijft een 7.
    return lower === 100 ? upper / 10 : lower === 20 ? upper / 2 : upper;
  }
  let normalized = raw.replace(/\s/g, "");
  const hasDecimalComma = /,\d+$/.test(normalized);
  if (hasDecimalComma) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else normalized = normalized.replace(/,(\d{3})\b/g, "$1").replace(",", ".");
  return num(normalized, NaN);
}

const isTrueish = (value: unknown): boolean => {
  if (value === true) return true;
  if (typeof value === "number") return value !== 0;
  return /^(true|ja|j|yes|y|1)$/i.test(str(value).trim());
};
const isFalseish = (value: unknown): boolean => {
  if (value === false) return true;
  if (typeof value === "number") return value === 0;
  return /^(false|nee|n|no|0)$/i.test(str(value).trim());
};

/**
 * Zoekt recursief (maximaal 4 niveaus) naar het eerste veld dat aan de
 * sleutelnaam voldoet. Schoolportalen nesten vak en kolom op wisselende
 * manieren; vandaar sleutel-matching in plaats van een vaste pad-lijst.
 */
function findField(value: unknown, matcher: ((key: string) => boolean) | RegExp, depth = 0): unknown {
  const matches = (key: string) => typeof matcher === "function" ? matcher(key) : matcher.test(key);
  if (depth > 4 || value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findField(item, matcher, depth + 1);
      if (found !== undefined && found !== null && found !== "") return found;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;
  const row = value as Row;
  for (const [key, child] of Object.entries(row)) {
    if (matches(key) && (typeof child === "string" || typeof child === "number") && String(child).trim()) return child;
  }
  for (const child of Object.values(row)) {
    if (child && typeof child === "object") {
      const found = findField(child, matcher, depth + 1);
      if (found !== undefined && found !== null && found !== "") return found;
    }
  }
  return undefined;
}

const SUBJECT_KEYS = /^(omschrijving|naam|vaknaam|weergavenaam|displayname|code|afkorting|vakcode|short|name)$/i;
const GRADE_KEYS = /^(cijferstr|waarde|cijfer|cijfernumeriek|grade|score|punt|beoordeling|resultaat)$/i;
const COLUMN_KEYS = /^(kolomomschrijving|omschrijving|naam|code|kolomcode|label|description)$/i;

function gradeSubjectName(row: Row): string {
  const vak = pick(row, "Vak", "vak", "Vakken", "vakken");
  const fromVak = str(findField(vak, SUBJECT_KEYS));
  if (fromVak) return fromVak;
  const fromFlat = str(findField(row, (key) => /^vak(i|naam|code|omschrijving)?$/i.test(key) || /^vaknaam$/i.test(key)));
  if (fromFlat) return fromFlat;
  // Magister zet het vak bij cijfers in `kolom.naam` (bijv. "NAT199").
  const kolom = pick(row, "kolom", "Kolom", "CijferKolom");
  return str(findField(kolom, /^(naam|code|vakcode|studievaknaam)$/i));
}
const plain = (value: unknown): string => str(value)
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(p|div|li|h\d)>/gi, "\n")
  .replace(/<li[^>]*>/gi, "- ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/g, "&")
  .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const toISO = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return new Date().toISOString();
  if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T12:00:00`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};
const dayKey = (iso: string) => iso.slice(0, 10);
const slug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vak";
const keyFor = (value: unknown) => str(value).toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const hash = (value: string) => [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
const asLocalISO = (date: Date) => {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${hh}:${mm}`;
};

/* Afspraken worden in blokken van 4 weken opgehaald. Sommige schoolservers
 * beperken een enkele `van/tot`-call stilletjes tot een kortere periode; met
 * chunken krijgen we gegarandeerd de komende 8 weken (met 4 weken marge). */
const APPOINTMENT_PAST_MS = 30 * 86_400_000;
const APPOINTMENT_FUTURE_MS = 84 * 86_400_000;
const APPOINTMENT_CHUNK_MS = 28 * 86_400_000;

function timeRanges(fromMs: number, toMs: number): [number, number][] {
  const ranges: [number, number][] = [];
  for (let start = fromMs; start < toMs; start += APPOINTMENT_CHUNK_MS) {
    ranges.push([start, Math.min(start + APPOINTMENT_CHUNK_MS, toMs)]);
  }
  return ranges;
}

type ApiResult<T> = { ok: boolean; data?: T; error?: string };

async function magisterAppointmentsChunked(
  config: Parameters<typeof magister.getAppointments>[0],
  personId: string | number,
  nowMs: number
): Promise<ApiResult<unknown[]>> {
  const ranges = timeRanges(nowMs - APPOINTMENT_PAST_MS, nowMs + APPOINTMENT_FUTURE_MS);
  const results = await Promise.allSettled(ranges.map(([from, to]) =>
    magister.getAppointments(config, personId, asLocalISO(new Date(from)), asLocalISO(new Date(to)))
  ));
  const rows = results.flatMap((result) =>
    result.status === "fulfilled" && result.value?.ok ? list(result.value.data) : []
  );
  const succeeded = results.some((result) => result.status === "fulfilled" && result.value?.ok);
  const failure = results.find((result) => result.status === "rejected");
  return {
    ok: succeeded,
    data: rows,
    error: failure?.status === "rejected" ? String(failure.reason?.message ?? failure.reason) : undefined,
  };
}

async function zermeloAppointmentsChunked(
  config: Parameters<typeof zermelo.getAppointments>[0],
  nowMs: number
): Promise<ApiResult<unknown[]>> {
  const ranges = timeRanges(nowMs - APPOINTMENT_PAST_MS, nowMs + APPOINTMENT_FUTURE_MS);
  const results = await Promise.allSettled(ranges.map(([from, to]) =>
    zermelo.getAppointments(config, Math.floor(from / 1000), Math.floor(to / 1000))
  ));
  const rows = results.flatMap((result) =>
    result.status === "fulfilled" && result.value?.ok ? list(result.value.data) : []
  );
  const succeeded = results.some((result) => result.status === "fulfilled" && result.value?.ok);
  const failure = results.find((result) => result.status === "rejected");
  return {
    ok: succeeded,
    data: rows,
    error: failure?.status === "rejected" ? String(failure.reason?.message ?? failure.reason) : undefined,
  };
}

/**
 * Maakt van "NAT199", "WISb191", "Ned" en "Wiskunde B 191" één volledige,
 * herkenbare vaknaam. School-specifieke afkortingen uit de vakkenlijst
 * krijgen voorrang boven de algemene lijst.
 */
function canonicalSubject(value: unknown, aliases: Map<string, string>): string {
  const text = plain(value).replace(/\s+/g, " ").trim();
  if (!text || /^(kwt|keuze|mentor|vrij|leeg|overig)$/i.test(text)) return "";
  const resolve = (candidate: string) =>
    aliases.get(candidate.toLowerCase()) ?? aliases.get(keyFor(candidate)) ?? KNOWN_SUBJECTS[keyFor(candidate)];
  const direct = resolve(text);
  if (direct) return direct;
  // "NAT199", "WISb191", "Wiskunde B 191", "Wiskunde B (havo)", "Wis B 5h2"
  const cleaned = text
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+\d[A-Za-z]{1,3}\d?\s*$/, "")
    .replace(/[\/–—]/g, " ")
    .replace(/\s*[.:]\s*$/, "")
    .replace(/\s+/g, " ").trim();
  const base = cleaned.replace(/\d{2,4}\s*$/, "").replace(/\s+/g, " ").trim();
  const byBase = base ? resolve(base) : "";
  if (byBase) return byBase;
  const byCleaned = cleaned ? resolve(cleaned) : "";
  if (byCleaned) return byCleaned;
  return base || cleaned || text;
}

/** ISO-weeknummer, zoals Zermelo dat voor liveschedule gebruikt. */
function isoWeek(iso: string): number {
  const date = new Date(iso);
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

function profileFor(name: string): Profile {
  if (/wiskunde|natuurkunde|scheikunde|biologie|informatica|techniek|economie/i.test(name)) return "beta";
  if (/nederlands|engels|frans|duits|spaans|latijn|grieks|talen/i.test(name)) return "talen";
  return "maatschappij";
}
function shortFor(name: string): string {
  const known: Record<string, string> = {
    wiskunde: "Wis", "wiskunde a": "Wis A", "wiskunde b": "Wis B", "wiskunde c": "Wis C", "wiskunde d": "Wis D",
    natuurkunde: "Nat", scheikunde: "Schei", biologie: "Bio", economie: "Eco",
    nederlands: "Ned", engels: "Eng", frans: "Frans", duits: "Duits",
    maatschappijleer: "Maats", geschiedenis: "Gesch", informatica: "Inf",
  };
  return known[name.toLowerCase()] ?? name.slice(0, 7);
}
function codeFor(name: string): string {
  const known: Record<string, string> = {
    wiskunde: "WIS", "wiskunde a": "WIS-A", "wiskunde b": "WIS-B", "wiskunde c": "WIS-C", "wiskunde d": "WIS-D",
    natuurkunde: "NA", scheikunde: "SK", biologie: "BI", economie: "EC",
    nederlands: "NE", engels: "EN", frans: "FR", duits: "DU",
    maatschappijleer: "MA", geschiedenis: "GS", informatica: "INF",
  };
  return known[name.toLowerCase()] ?? (name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "VAK");
}

/** Vertaalt een Magister-link (Uri of Links[].Uri) naar een proxybaar API-pad. */
function apiLinkFor(value: unknown, host: string): string {
  if (!host) return "";
  const rawLinks = Array.isArray(value)
    ? value as Row[]
    : value && typeof value === "object" ? [value as Row] : [];
  const links = [...list(value), ...rawLinks];
  const rank = (link: Row) => {
    const rel = str(pick(link, "Rel", "rel")).toLowerCase();
    return rel.includes("contents") ? 2 : rel.includes("self") ? 1 : 0;
  };
  links.sort((a, b) => rank(b) - rank(a));

  const candidates: string[] = [];
  for (const link of links) {
    const uri = str(pick(link, "Uri", "uri", "Url", "url", "Href", "href", "Link"));
    if (uri && !candidates.includes(uri)) candidates.push(uri);
  }
  const direct = str(value);
  if (direct && !candidates.includes(direct)) candidates.push(direct);

  for (const raw of candidates) {
    if (!raw || (!raw.startsWith("/") && !/^https?:\/\//i.test(raw))) continue;
    try {
      const url = new URL(raw, `https://${host}`);
      const marker = url.pathname.indexOf("/api/");
      if (marker >= 0) return `${url.pathname.slice(marker + 1)}${url.search}`;
      // Een portaal-pad op dezelfde host kan via de browser worden geopend,
      // maar is niet proxybaar; dan volgt de portal-fallback in de UI.
    } catch {
      if (raw.startsWith("/api/")) return raw.replace(/^\/+/, "");
    }
  }
  return "";
}

function attachmentFor(value: unknown, index: number, host: string): StudyGuideAttachment {
  const row = (value ?? {}) as Row;
  const url = apiLinkFor(pick(row, "Links", "links"), host)
    || apiLinkFor(row, host)
    || apiLinkFor(pick(row, "Uri", "uri", "Url", "url", "Href", "href"), host);
  return {
    id: str(pick(row, "Id", "id")) || `att-${index}`,
    name: str(pick(row, "Naam", "naam", "weergavenaam", "DisplayName"))
      || url.split("/").filter(Boolean).pop()
      || "Bijlage",
    url,
    mime: str(pick(row, "ContentType", "contentType")) || undefined,
  };
}

export function emptyAppData(): AppData {
  const stats: SchoolYearStats = {
    lessonsAttended: 0, lessonsCancelled: 0, favoriteLocation: "—",
    mostCancelledSubjectId: "", bestWeekday: "Maandag",
  };
  return {
    subjects: [], teachers: [], grades: [], gradeCandidates: [],
    gradeDiagnostics: { raw: 0, accepted: 0, review: 0, dropped: 0, errors: [], sources: [] },
    rawGradeRows: [],
    ptaColumns: [], appointments: [],
    choiceGroups: [], homework: [], studyGuides: [], eloAssignments: [],
    messages: [], absences: [], stats,
  };
}

/** Haalt alle beschikbare live-data op en mapt die naar het uniforme model. */
export async function fetchLiveData(connection: LiveConnection): Promise<LiveDataResult> {
  // Magister is optioneel. Zonder Magister-koppeling laden we het rooster,
  // de vakken en de keuzelessen volledig uit Zermelo.
  const magisterEnabled = Boolean(connection.magisterToken && connection.magisterSchool);
  const config: MagisterConfig = {
    subdomain: connection.magisterSchool ?? "",
    token: connection.magisterToken ?? "",
  };
  const host = magisterEnabled ? normalizeMagisterHost(connection.magisterSchool!) : "";
  const accountRes = magisterEnabled ? await magister.getAccount(config) : null;
  if (magisterEnabled && accountRes && !accountRes.ok) {
    throw new Error(accountRes.error ?? "Kon je Magister-account niet ophalen. Log opnieuw in.");
  }
  const account: Row = accountRes?.ok ? (accountRes.data as Row) ?? {} : {};
  const person = account.Persoon;
  const personId: string | number | undefined = magisterEnabled ? person?.Id : undefined;
  if (magisterEnabled && !personId) throw new Error("Geen leerlingprofiel gevonden in Magister.");

  const enrollmentsRes = magisterEnabled && personId ? await magister.getEnrollments(config, personId) : null;
  const enrollments = list(enrollmentsRes?.data);
  const enrollment = enrollments.find((e) => e.isHoofdAanmelding || e.IsHoofdAanmelding) ?? enrollments[0];
  const aanmeldingId = enrollment?.id ?? enrollment?.Id ?? personId ?? "";

  const from = asLocalISO(new Date(Date.now() - 150 * 86_400_000));
  const to = asLocalISO(new Date(Date.now() + 180 * 86_400_000));

  // Cijfers hangen in Magister aan een aanmelding (schooljaar/profiel), niet
  // aan de persoon. Alleen de hoofdaanmelding ophalen laat dus alle andere
  // jaren/profielen weg. We pakken daarom élke aanmelding en lopen ook de
  // pagina's af, met fallback-paden voor scholen met een afwijkende API.
  const gradeFetchErrors: string[] = [];
  const gradeSources: { path: string; rows: number; error?: string }[] = [];
  const enrollmentIds = [...new Set([
    ...enrollments.map((e) => pick(e, "id", "Id")),
    aanmeldingId,
  ])].map(String).filter((id) => id && id !== "undefined" && id !== "null");

  const gradeKey = (row: Row): string => {
    const column = (pick(row, "kolom", "Kolom", "CijferKolom") ?? {}) as Row;
    return JSON.stringify([
      pick(row, "CijferId", "cijferId", "id", "Id"),
      pick(column, "id", "Id", "nummer", "Nummer"),
      pick(row, "DatumIngevoerd", "datumIngevoerd", "ingevoerdOp", "Datum", "datum"),
      pick(row, "CijferStr", "waarde", "Cijfer", "cijferGetal"),
    ]);
  };

  const fetchGradePath = async (path: string, rows: Row[], seen: Set<string>) => {
    let added = 0;
    let skip = 0;
    for (let page = 0; page < 40; page++) {
      const separator = path.includes("?") ? "&" : "?";
      const res = await magister.getGradesFromPath(config, `${path}${separator}top=1000&skip=${skip}`);
      if (!res.ok) {
        gradeFetchErrors.push(`${path} → HTTP ${res.status}${res.error ? `: ${res.error}` : ""}`);
        gradeSources.push({ path, rows: added, error: `HTTP ${res.status}` });
        return;
      }
      const pageRows = list(res.data);
      const before = rows.length;
      pageRows.forEach((row) => {
        const key = gradeKey(row);
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(row);
        added++;
      });
      if (!pageRows.length || rows.length === before) break; // geen nieuwe pagina meer
      skip += pageRows.length;
    }
    gradeSources.push({ path, rows: added });
  };

  const fetchGradesRobust = async () => {
    if (!magisterEnabled) return null;
    const rows: Row[] = [];
    const seen = new Set<string>();
    const paths = enrollmentIds.map((id) => `api/aanmeldingen/${id}/cijfers`);
    for (const path of paths) await fetchGradePath(path, rows, seen);
    // Fallbacks alleen als de gebruikelijke paden niets opleverden: op deze
    // scholen zijn het 404/403's en die ruis willen we niet in de diagnose.
    if (!rows.length) {
      const fallbacks = [
        ...enrollmentIds.map((id) => `api/personen/${personId}/aanmeldingen/${id}/cijfers`),
        ...(personId ? [`api/personen/${personId}/cijfers`, `api/leerlingen/${personId}/cijfers`] : []),
      ];
      for (const path of fallbacks) await fetchGradePath(path, rows, seen);
    }
    return { ok: rows.length > 0 || paths.length === 0, data: rows, status: 200 };
  };

  // Vaknamen (en studievakId-koppelingen) staan per aanmelding; die van alle
  // jaren zijn nodig om ook oudere cijfers aan een vak te kunnen hangen.
  const subjectResultsPromise = Promise.allSettled(enrollmentIds.map((id) =>
    magisterEnabled && personId ? magister.getEnrollmentSubjects(config, personId, id) : Promise.resolve(null)
  ));

  const [gradesRes, appointmentsRes, absencesRes, messagesRes, assignmentsRes, guidesRes,
    activitiesRes, zermeloRes, zermeloUsersRes] = await Promise.allSettled([
    fetchGradesRobust(),
    magisterEnabled && personId ? magisterAppointmentsChunked(config, personId, Date.now()) : Promise.resolve(null),
    magisterEnabled && personId ? magister.getAbsences(config, personId, from, to) : Promise.resolve(null),
    magisterEnabled ? magister.getMessages(config, 60) : Promise.resolve(null),
    magisterEnabled && personId ? magister.getAssignments(config, personId) : Promise.resolve(null),
    magisterEnabled && personId ? magister.getStudyGuides(config, personId) : Promise.resolve(null),
    magisterEnabled && personId ? magister.getActivities(config, personId) : Promise.resolve(null),
    connection.zermeloToken && connection.zermeloSubdomain
      ? zermeloAppointmentsChunked(
          { subdomain: connection.zermeloSubdomain, token: connection.zermeloToken },
          Date.now()
        )
      : Promise.resolve(null),
    connection.zermeloToken && connection.zermeloSubdomain
      ? zermelo.getMe({ subdomain: connection.zermeloSubdomain, token: connection.zermeloToken })
      : Promise.resolve(null),
  ]);

  const value = <T>(result: PromiseSettledResult<T>): T | null =>
    result.status === "fulfilled" ? result.value : null;
  const okData = <T>(result: PromiseSettledResult<{ ok: boolean; data?: T } | null>): T | null => {
    const res = value(result);
    return res?.ok ? (res.data ?? null) : null;
  };

  const rawGrades = list(okData(gradesRes));
  const rawAppointments = list(okData(appointmentsRes));
  const rawAbsences = list(okData(absencesRes));
  const rawMessages = list(okData(messagesRes));
  const rawAssignments = list(okData(assignmentsRes));
  const rawGuides = list(okData(guidesRes));
  const subjectResults = await subjectResultsPromise;
  const rawSubjects = subjectResults.flatMap((res) => {
    if (res.status !== "fulfilled" || !res.value?.ok) return [];
    return list(res.value.data);
  });
  const rawActivities = list(okData(activitiesRes));
  const zermeloResult = value(zermeloRes);
  const rawZermelo = zermeloResult?.ok ? list(zermeloResult.data) : [];
  // Zermelo verpakt antwoorden in { response: ... }; zowel direct als verpakt
  // werken voorkomt dat de leerlingcode (en dus liveschedule) leeg blijft.
  const unwrap = (input: unknown): Row => {
    const obj = (input ?? {}) as Row;
    return (obj.response ?? obj) as Row;
  };
  const zermeloMe = value(zermeloUsersRes)?.ok ? unwrap(value(zermeloUsersRes)?.data) : null;
  const studentCode = str(pick(zermeloMe ?? {}, "code", "studentCode")) || str(connection.zermeloStudentCode);

  /* ---- vakaliassen: afkorting -> volledige omschrijving ----
   * Eerst verzamelen, pas daarna toepassen. Zo kan de volledige omschrijving
   * uit de vakkenlijst ook afkortingen uit andere school-API's herkennen. */
  const aliases = new Map<string, string>();
  const aliasPairs: [string, string][] = [];
  rawSubjects.forEach((raw) => {
    const rawDescription = str(pick(raw, "omschrijving", "Omschrijving", "naam", "Naam", "Vaknaam"));
    const abbreviation = str(pick(raw, "afkorting", "Afkorting", "code", "Code"));
    if (!rawDescription) return;
    aliasPairs.push([rawDescription.toLowerCase(), rawDescription], [keyFor(rawDescription), rawDescription]);
    if (abbreviation) aliasPairs.push([abbreviation.toLowerCase(), rawDescription], [keyFor(abbreviation), rawDescription]);
  });
  aliasPairs.forEach(([key, value]) => aliases.set(key, value));

  // Cijfers verwijzen naar een studievak via kolom.studievakId. Die koppeling
  // is betrouwbaarder dan afkortingen en lost ook school-eigen codes op.
  const subjectNameByStudievakId = new Map<string, string>();
  rawSubjects.forEach((raw) => {
    const id = pick(raw, "studievakId", "StudievakId", "id", "Id");
    const name = str(pick(raw, "omschrijving", "Omschrijving", "naam", "Naam"));
    if (id !== undefined && id !== null && id !== "" && name) subjectNameByStudievakId.set(String(id), name);
  });

  /* ---- docenten: ruwe docentcodes -> volledige namen ---- */
  const teacherNameByCode = new Map<string, string>();
  const teacherEmailByCode = new Map<string, string>();
  const teacherCodes = [...new Set([
    ...rawGrades.map((g) => str(pick(g, "Docent", "docent"))),
    ...rawSubjects.map((s) => str(pick(s, "docent", "Docent"))),
  ].filter((code) => code.trim().length >= 2))].slice(0, 40);
  const contactResults = await Promise.allSettled(
    teacherCodes.map((code) => personId ? magister.getContacts(config, personId, code) : Promise.resolve(null))
  );
  contactResults.forEach((res, index) => {
    if (res.status !== "fulfilled" || !res.value || !res.value.ok) return;
    const code = teacherCodes[index].toLowerCase();
    const rows = list(res.value.data);
    const match = rows.find((row) => str(pick(row, "Docentcode", "docentcode")).toLowerCase() === code) ?? rows[0];
    if (!match) return;
    const fullName = str(pick(match, "Naam", "naam"))
      || [pick(match, "Voornaam"), pick(match, "Tussenvoegsel"), pick(match, "Achternaam")].map(str).filter(Boolean).join(" ");
    if (fullName) teacherNameByCode.set(code, fullName);
    const email = str(pick(match, "Emailadres", "emailadres", "Email"));
    if (email) teacherEmailByCode.set(code, email);
  });

  const teacherMap = new Map<string, Teacher>();
  const teacherFor = (value: unknown, fromCode = false): string => {
    const raw = str(value).trim();
    if (!raw) return "";
    const lookupKey = fromCode ? raw.toLowerCase() : "";
    const name = (lookupKey && teacherNameByCode.get(lookupKey)) || raw;
    const key = name.toLowerCase();
    if (!teacherMap.has(key)) {
      const pieces = name.split(/\s+/);
      teacherMap.set(key, {
        id: `doc-${slug(name)}`,
        name,
        abbreviation: pieces.map((p) => p[0]).join("").slice(0, 3).toUpperCase(),
        email: lookupKey ? teacherEmailByCode.get(lookupKey) ?? "" : "",
        subjects: [], locations: [],
      });
    }
    return teacherMap.get(key)!.id;
  };
  const teacherFromRow = (row: Row | undefined): string => {
    if (!row) return "";
    const full = str(pick(row, "Naam", "naam", "Omschrijving"));
    const code = str(pick(row, "Docentcode", "docentcode", "Docent", "docent"));
    return teacherFor(full || code, !full && Boolean(code));
  };

  const subjectMap = new Map<string, Subject>();
  const subjectFor = (value: unknown, fallback = ""): string => {
    const name = canonicalSubject(value, aliases) || fallback;
    if (!name) return "";
    const key = keyFor(name);
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        id: `vak-${slug(name)}`,
        name,
        short: shortFor(name),
        code: codeFor(name),
        color: COLORS[hash(name) % COLORS.length],
        teacherId: "",
        profile: profileFor(name),
        isCore: CORE.some((core) => name.toLowerCase().includes(core.toLowerCase())),
        isExamSubject: name !== "Onbekend vak",
        description: name === "Onbekend vak"
          ? "Cijfer zonder herkenbaar vak. Koppel het in Cijferdetectie aan het juiste vak."
          : `Vakgegevens geladen uit ${connection.magisterSchool || connection.zermeloSubdomain || "de schoolkoppeling"}.`,
      });
    }
    return subjectMap.get(key)!.id;
  };

  // De vakkenlijst van de aanmelding is leidend en voorkomt losse "NAT199"-vakken.
  rawSubjects.forEach((raw) => {
    const description = canonicalSubject(pick(raw, "omschrijving", "Omschrijving", "naam", "Naam"), aliases);
    const abbreviation = str(pick(raw, "afkorting", "Afkorting", "code", "Code"));
    const id = subjectFor(description || abbreviation);
    const teacherId = teacherFromRow(raw);
    if (id && teacherId) subjectMap.get(keyFor(description || abbreviation))!.teacherId = teacherId;
  });

  /* ---- cijfers: tolerate wisselende veldnamen bij schoolportalen ----
   * Alles wat we niet betrouwbaar kunnen plaatsen, gaat naar gradeCandidates
   * en kan in de Cijferdetectie met één klik aan een vak worden gekoppeld. */
  let droppedGrades = 0;
  const drafts = rawGrades.map((g, index): Grade | null => {
    if (isFalseish(pick(g, "TeltMee", "teltMee"))) { droppedGrades += 1; return null; }
    const exemption = [
      pick(g, "Vrijstelling", "vrijstelling"),
      pick(g, "VakDispensatie", "vakDispensatie"),
      pick(g, "HeeftVrijstelling", "heeftVrijstelling"),
    ].some(isTrueish);
    if (exemption) { droppedGrades += 1; return null; }

    const valueCandidates = [
      pick(g, "CijferStr", "cijferStr"),
      pick(g, "waarde", "Waarde", "Cijfer", "cijfer", "grade", "Grade"),
      pick(g, "CijferNumeriek", "cijferNumeriek"),
      findField(g, GRADE_KEYS),
    ];
    let value = NaN;
    for (const candidate of valueCandidates) {
      const parsed = parseGradeNumber(candidate);
      if (Number.isFinite(parsed)) { value = parsed; break; }
    }
    const rawValue = str(valueCandidates.find((candidate) => str(candidate).trim())) || "—";

    const kolom = (pick(g, "kolom", "CijferKolom", "Kolom") ?? {}) as Row;
    const columnLabel = plain(pick(kolom, "KolomOmschrijving", "omschrijving", "naam", "Naam"))
      || plain(findField(g, /^(kolomomschrijving|kolomlabel|description)$/i));
    const label = columnLabel || plain(pick(g, "omschrijving", "Omschrijving", "label")) || "Cijfer";
    const studievakId = findField(g, /^studievakid$/i) ?? pick(kolom, "studievakId", "StudievakId");
    const rawName = subjectNameByStudievakId.get(String(studievakId ?? "")) || gradeSubjectName(g);
    const subjectId = subjectFor(rawName, "Onbekend vak");
    const canonical = canonicalSubject(rawName, aliases);
    const valueOk = Number.isFinite(value) && value >= 0 && value <= 10;
    const needsReview = !valueOk || !canonical || subjectId === `vak-${slug("Onbekend vak")}`;

    const columnType = str(findField(g, /^type$/i)).toLowerCase();
    const columnHead = str(pick(kolom, "kop", "Kop", "KOP"));
    const columnJson = JSON.stringify(kolom ?? {}).toLowerCase();
    const typeText = [columnType, columnHead, label, columnJson].join(" ").toLowerCase();
    const isAverage = /gemiddelde|eindse|\bve\b/.test(`${columnType} ${columnHead}`) || /^(r1|vg1|ve|eind se)$/i.test(columnHead);
    const isPta = !isAverage && (/pta|schoolexamen|\bse\b|eindtoets/.test(typeText) || isTrueish(findField(g, /^(isptakolom|ptakolom|pta)$/i)));
    const type: Grade["type"] = isAverage ? "Overig"
      : /herkans|rep\b|2e kans|tweede kans|re-examen/.test(typeText) ? "REP"
      : /opdracht|assignment|werkstuk|practicum|presentatie/.test(typeText) ? "Opdracht"
      : isPta ? "PTA" : "SO";

    const columnCode = str(pick(g, "KolomCode", "kolomCode"))
      || str(findField(kolom, COLUMN_KEYS))
      || str(findField(g, /^kolom(code)?$/i))
      || `KOL-${index + 1}`;
    const weightValue = num(findField(g, /^(weegfactor|wegfactor|weging|weeging)$/i), NaN);
    const date = toISO(findField(g, /^(datumingevoerd|datum|behaaldop|ingevoerdop|date)$/i)
      ?? pick(g, "DatumIngevoerd", "datumIngevoerd", "ingevoerdOp", "behaaldOp", "datum", "Datum", "date"));
    const teacherCode = str(findField(g, /^(docent|docentcode|teacher)$/i));

    return {
      id: `cijfer-${String(pick(g, "CijferId", "cijferId", "id", "Id") ?? index + 1)}-${index}`,
      subjectId,
      value: needsReview ? 0 : value,
      weight: isAverage ? 0 : Number.isFinite(weightValue) && weightValue > 0 ? weightValue : 1,
      date, label, type,
      columnCode,
      teacherId: teacherCode ? teacherFor(teacherCode, true) : undefined,
      ptaColumnId: isPta ? `${subjectId}:${columnCode}` : undefined,
      isNew: Date.now() - new Date(date).getTime() < 3 * 86_400_000,
      needsReview,
      rawValue,
      rawSubject: rawName || "onbekend",
      rawColumn: columnLabel,
    };
  }).filter((grade): grade is Grade => grade !== null);

  const grades = drafts.filter((g) => !g.needsReview);
  const gradeCandidates = drafts.filter((g) => g.needsReview);
  const gradeDiagnostics = {
    raw: rawGrades.length,
    accepted: grades.length,
    review: gradeCandidates.length,
    dropped: droppedGrades,
    errors: gradeFetchErrors,
    sources: gradeSources,
  };

  const ptaColumns: PtaColumn[] = Object.values(grades.reduce<Record<string, Grade[]>>((acc, g) => {
    if (!g.ptaColumnId) return acc;
    (acc[g.ptaColumnId] ??= []).push(g);
    return acc;
  }, {})).map((items) => {
    const first = items[0];
    const latest = [...items].sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      id: first.ptaColumnId!,
      subjectId: first.subjectId,
      code: first.columnCode!,
      description: first.label,
      weight: first.weight,
      date: first.date,
      retakeable: items.some((g) => g.type === "REP") || /herkans/i.test(first.label),
      gradeId: latest.id,
    };
  }).sort((a, b) => a.subjectId.localeCompare(b.subjectId) || a.date.localeCompare(b.date));

  /* ---- afspraken ---- */
  const magisterAppointments: Appointment[] = rawAppointments.map((a, index) => {
    const vak = pick(a, "Vakken", "vakken", "Vak");
    const firstVak = (Array.isArray(vak) ? vak[0] : vak) as Row | undefined;
    const subjectName = pick(firstVak ?? {}, "Naam", "naam", "Omschrijving", "omschrijving");
    const subjectId = subjectFor(subjectName ?? "");
    const docenten = list(pick(a, "Docenten", "docenten"));
    const teacherId = teacherFromRow(docenten[0]);
    const status = num(pick(a, "Status"), 0);
    const infoType = num(pick(a, "InfoType"), 0);
    const lokalen = list(pick(a, "Lokalen", "lokalen"));
    const location = str(pick(a, "Lokatie", "lokatie", "location")) || str(pick(lokalen[0] ?? {}, "Naam", "naam")) || "—";
    const cancelled = CANCELLED.has(status) || Boolean(pick(a, "Geannuleerd", "cancelled"));
    const description = plain(pick(a, "Inhoud"));
    const title = plain(pick(a, "Omschrijving", "omschrijving", "Titel"))
      || (subjectId ? subjectMap.get(keyFor(subjectName))?.name ?? "Les" : "Les");
    const testText = `${title} ${description} ${str(pick(a, "WeergaveType"))}`.toLowerCase();
    const isTest = (infoType >= 2 && infoType <= 5)
      || /toets|tentamen|examen|pta|\bso\b|overhoring|schriftelijk/.test(testText);
    return {
      id: `mag-${pick(a, "Id", "id") ?? index}`,
      start: toISO(pick(a, "Start", "start", "Begin")),
      end: toISO(pick(a, "Einde", "einde", "Eind", "End")),
      subjectId: subjectId || undefined,
      teacherId: teacherId || undefined,
      location,
      originalLocation: str(pick(a, "OrigineleLokatie")) || undefined,
      title,
      type: (isTest ? "toets" : "les") as Appointment["type"],
      cancelled,
      toetsType: (infoType === 2 || /pto|\bso\b/.test(testText) ? "SO"
        : infoType === 3 || /pta/.test(testText) ? "PTA"
        : infoType === 4 || /herkans|rep/.test(testText) ? "REP" : undefined) as Appointment["toetsType"],
      source: "magister" as const,
    };
  }).filter((a) => a.subjectId || a.title);

  /* ---- keuzelessen uit Zermelo en activiteiten uit Magister ---- */
  const choiceGroupsMap = new Map<string, ChoiceOption[]>();
  const choiceMeta = new Map<string, {
    title: string; start: string; end: string; deadline: string;
    mandatory: boolean; source: "magister" | "zermelo";
  }>();
  const zermeloAppointments: Appointment[] = [];
  // Acties voor keuzelessen komen uit liveschedule. De server geeft de post-URL;
  // we bouwen hem niet zelf op (precies zoals de echte Zermelo-webclient).
  const liveSchedules = new Map<number, ZermeloLiveSchedule>();
  if (studentCode && rawZermelo.some((a) => Boolean(pick(a, "optional")) || pick(a, "appointmentType") === "choice")) {
    const weeks = [...new Set(rawZermelo.map((a) => isoWeek(toISO(a.start))))].slice(0, 12);
    const scheduleResults = await Promise.allSettled(weeks.map((week) =>
      zermelo.getLiveScheduleForStudent({ subdomain: connection.zermeloSubdomain ?? "", token: connection.zermeloToken ?? "" }, studentCode, week)
    ));
    scheduleResults.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value.ok && result.value.data) {
        liveSchedules.set(weeks[i], unwrap(result.value.data) as ZermeloLiveSchedule);
      }
    });
  }
  const actionsFor = (instance: string, start: string) => {
    const schedule = liveSchedules.get(isoWeek(start));
    const item = schedule?.appointments?.find((a) => Number(a.appointmentInstance ?? a.id) === Number(instance));
    return (item?.actions ?? []).filter((action) => Boolean(action.post)).map((action) => ({
      code: action.code,
      allowed: action.allowed,
      post: action.post!,
      statusCodes: (action.status ?? []).map((s) => Number(s.code)).filter(Number.isFinite),
    }));
  };
  rawZermelo.forEach((raw: Row, index) => {
    const a = raw as ZermeloAppointment;
    const subjectsRaw = pick(a, "subjects", "subject");
    const subjectNames: string[] = Array.isArray(subjectsRaw) ? subjectsRaw.map(str) : subjectsRaw ? [str(subjectsRaw)] : [];
    const subjectId = subjectFor(subjectNames[0] ?? "");
    const teacherNames: string[] = Array.isArray(a.teachers) ? a.teachers : a.teacher ? [a.teacher] : [];
    const teacherId = teacherFor(teacherNames[0] ?? "");
    const locations: string[] = Array.isArray(a.locations) ? a.locations.map(str) : [];
    const location = locations[0] || str(a.locationOfBranch) || "—";
    const start = toISO(a.start);
    const end = toISO(a.end);
    const choiceGroupId = a.choiceGroupId ? String(a.choiceGroupId)
      : (a.optional || a.appointmentType === "choice" ? `opt-${dayKey(start)}-${start.slice(11, 16)}` : "");
    const rawId = str(pick(a, "appointmentInstance", "id")) || String(index);
    const id = `zer-${rawId}`;

    if (choiceGroupId) {
      const actions = actionsFor(rawId, start);
      const option: ChoiceOption = {
        id, groupId: `kg-${choiceGroupId}`, source: "zermelo",
        rawId, rawGroupId: choiceGroupId,
        subjectId: subjectId || undefined,
        teacherId: teacherId || undefined,
        title: subjectNames.join(", ") || str(pick(a, "description", "remark")) || "Keuzeles",
        description: plain(pick(a, "remark", "description")) || "Keuzeles via Zermelo",
        location, start, end,
        capacity: num(pick(a, "capacity"), 1) || 1,
        enrolled: num(pick(a, "enrolled"), 0),
        kind: a.appointmentType === "activity" ? "workshop" : "KWT",
        actions,
        alreadyEnrolled: actions.some((action) => action.statusCodes.includes(3003) || action.code === 3003),
        canEnroll: actions.some((action) => action.allowed !== false && !action.statusCodes.includes(4001)),
      };
      choiceGroupsMap.set(choiceGroupId, [...(choiceGroupsMap.get(choiceGroupId) ?? []), option]);
      choiceMeta.set(choiceGroupId, {
        title: `Keuzeblok ${new Date(start).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}`,
        start,
        end,
        deadline: new Date(new Date(start).getTime() - 86_400_000).toISOString(),
        mandatory: false,
        source: "zermelo",
      });
    }

    zermeloAppointments.push({
      id,
      start, end,
      subjectId: subjectId || undefined,
      teacherId: teacherId || undefined,
      location,
      title: subjectNames.join(", ") || str(pick(a, "description")) || "Zermelo-afspraak",
      type: a.appointmentType === "exam" ? "toets" : choiceGroupId ? "KWT" : "les",
      cancelled: Boolean(a.cancelled),
      source: "zermelo",
      kwtGroupId: choiceGroupId ? `kg-${choiceGroupId}` : undefined,
      isNew: Boolean(pick(a, "new", "isNew")),
    });
  });

  const activityElementsResults = await Promise.allSettled(rawActivities.map((activity) =>
    personId ? magister.getActivityElements(config, personId, pick(activity, "Id", "id")) : Promise.resolve(null)
  ));
  rawActivities.forEach((activity, activityIndex) => {
    const elementResult = activityElementsResults[activityIndex];
    const elements = elementResult?.status === "fulfilled" && elementResult.value && elementResult.value.ok
      ? list(elementResult.value.data) : [];
    const activityId = str(pick(activity, "Id", "id"));
    if (!activityId) return;
    const groupKey = `mact-${activityId}`;
    const groupStart = toISO(pick(activity, "StartInschrijfdatum", "ZichtbaarVanaf")
      ?? new Date(Date.now() + 86_400_000).toISOString());
    const deadline = toISO(pick(activity, "EindeInschrijfdatum") ?? groupStart);
    elements.forEach((element, index) => {
      const elementId = str(pick(element, "Id", "id"));
      if (!elementId) return;
      const max = num(pick(element, "MaxAantalDeelnemers"), 0);
      const places = num(pick(element, "AantalPlaatsenBeschikbaar"), 0);
      const start = toISO(pick(element, "Start", "StartDatum", "BeginDatum", "Van") ?? groupStart);
      const end = toISO(pick(element, "Einde", "EindDatum", "Tot") ?? new Date(new Date(start).getTime() + 55 * 60_000).toISOString());
      const option: ChoiceOption = {
        id: `mactopt-${activityId}-${elementId}`,
        groupId: `kg-${groupKey}`,
        source: "magister",
        rawId: elementId,
        rawGroupId: activityId,
        title: plain(pick(element, "Titel", "titel")) || plain(pick(activity, "Titel", "titel")) || "Activiteit",
        description: plain(pick(element, "Details", "details")) || plain(pick(activity, "Details", "details")),
        location: str(pick(element, "Locatie", "Lokatie")) || "Magister",
        start, end,
        capacity: max || Math.max(1, places),
        enrolled: max && places ? Math.max(0, max - places) : 0,
        kind: /steun/i.test(str(pick(element, "Titel"))) ? "steun" : "workshop",
        alreadyEnrolled: Boolean(pick(element, "IsIngeschreven", "isIngeschreven")),
        canEnroll: pick(element, "IsOpInTeSchrijven", "isOpInTeSchrijven") !== false,
      };
      choiceGroupsMap.set(groupKey, [...(choiceGroupsMap.get(groupKey) ?? []), option]);
    });
    if (choiceGroupsMap.has(groupKey)) {
      choiceMeta.set(groupKey, {
        title: plain(pick(activity, "Titel", "titel")) || "Magister-activiteit",
        start: groupStart,
        end: groupStart,
        deadline,
        mandatory: Boolean(pick(activity, "IsVerplicht", "isVerplicht")),
        source: "magister",
      });
    }
  });

  const appointments = mergeAppointments(magisterAppointments, zermeloAppointments)
    .filter((a) => a.start && a.end);

  const choiceGroups: ChoiceGroup[] = [...choiceGroupsMap.entries()].map(([id, options]) => {
    const meta = choiceMeta.get(id);
    const starts = options.map((o) => o.start).sort();
    const ends = options.map((o) => o.end).sort();
    const start = meta?.start ?? starts[0];
    return {
      id: `kg-${id}`,
      title: meta?.title ?? `Keuzeblok ${new Date(start).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}`,
      start,
      end: ends[ends.length - 1] ?? start,
      mandatory: meta?.mandatory ?? false,
      deadline: meta?.deadline ?? new Date(new Date(start).getTime() - 86_400_000).toISOString(),
      source: meta?.source ?? "zermelo",
      options,
    };
  }).sort((a, b) => a.start.localeCompare(b.start));

  /* ---- huiswerk, ELO, studiewijzers ---- */
  const homework: Homework[] = rawAppointments.flatMap((a, index) => {
    const infoType = num(pick(a, "InfoType"), 0);
    const text = plain(pick(a, "Inhoud"));
    if (infoType !== 1 && !text) return [];
    const vak = pick(a, "Vakken", "vakken", "Vak");
    const firstVak = (Array.isArray(vak) ? vak[0] : vak) as Row | undefined;
    const subjectName = pick(firstVak ?? {}, "Naam", "naam", "Omschrijving", "omschrijving");
    return [{
      id: `hw-mag-${pick(a, "Id", "id") ?? index}`,
      subjectId: subjectFor(subjectName ?? ""),
      title: text.split("\n")[0].slice(0, 90) || `Huiswerk ${subjectName ?? ""}`.trim(),
      description: text,
      due: toISO(pick(a, "Start", "start")),
      createdAt: toISO(pick(a, "Start", "start")),
      status: (pick(a, "Afgerond") === true ? "done" : "todo") as Homework["status"],
      subtasks: [], note: "",
      source: "magister" as const,
    }];
  }).filter((h) => h.subjectId);

  const eloAssignments: EloAssignment[] = rawAssignments.map((a, index) => {
    const subjectName = str(pick(a, "vak", "Vak", "vaknaam", "VakNaam"));
    const attachments = list(pick(a, "Bijlagen", "bijlagen")).map((row, i) => attachmentFor(row, i, host));
    return {
      id: `elo-${pick(a, "Id", "id") ?? index}`,
      subjectId: subjectFor(subjectName),
      title: plain(pick(a, "Omschrijving", "omschrijving", "Titel", "titel")) || "Opdracht",
      description: plain(pick(a, "Inhoud", "inhoud", "Omschrijving")),
      deadline: toISO(pick(a, "Deadline", "deadline", "Einde", "einde")),
      status: (pick(a, "Afgerond") ? "submitted" : "open") as EloAssignment["status"],
      attachmentCount: attachments.length,
      attachments,
    };
  }).filter((e) => e.subjectId);

  // Sommige scholen sturen bijlagen niet mee in de studiewijzer-lijst; probeer
  // dan het echte detail-endpoint. Fouten worden genegeerd (best-effort).
  const guideAttachmentResults = await Promise.allSettled(rawGuides.map((g) => {
    const guideId = pick(g, "Id", "id");
    if (!personId || !guideId || list(pick(g, "Bijlagen", "bijlagen")).length) return Promise.resolve(null);
    return magister.getStudyGuideAttachments(config, personId, guideId);
  }));

  const studyGuides: StudyGuide[] = rawGuides.map((g, index) => {
    const subjectName = str(pick(g, "vak", "Vak", "vaknaam", "VakNaam"));
    const embedded = list(pick(g, "Bijlagen", "bijlagen"));
    const detailResult = guideAttachmentResults[index];
    const detailRows = detailResult?.status === "fulfilled" && detailResult.value && detailResult.value.ok
      ? list(detailResult.value.data) : [];
    const rows = [...embedded, ...detailRows].filter((row, i, all) =>
      all.findIndex((other) => str(pick(other, "Id", "id")) === str(pick(row, "Id", "id"))) === i
    );
    return {
      id: `sg-${pick(g, "Id", "id") ?? index}`,
      subjectId: subjectFor(subjectName),
      title: plain(pick(g, "Omschrijving", "omschrijving", "Titel", "titel")) || "Studiewijzer",
      week: num(pick(g, "Week", "week"), 1),
      goals: list(pick(g, "Leerdoelen", "leerdoelen")).map((d) => plain(pick(d, "Omschrijving", "omschrijving")) || str(d)).filter(Boolean),
      attachments: rows.map((row, i) => attachmentFor(row, i, host)),
      updatedAt: toISO(pick(g, "LaatstGewijzigd", "lastModified")),
    };
  }).filter((s) => s.subjectId);

  /* ---- berichten ---- */
  const details = await Promise.allSettled(rawMessages.slice(0, 12).map((m) => magister.getMessageDetail(config, pick(m, "id", "Id"))));
  const messages: Message[] = rawMessages.map((m, index) => {
    const detail = details[index]?.status === "fulfilled" ? details[index].value.data : null;
    const sender = pick(m, "afzender", "Afzender") ?? {};
    const senderName = str(pick(sender, "naam", "Naam")) || "School";
    return {
      id: `msg-${pick(m, "id", "Id") ?? index}`,
      from: senderName,
      fromId: teacherFor(senderName),
      to: "Ik",
      subject: plain(pick(m, "onderwerp", "Onderwerp")) || "(geen onderwerp)",
      body: plain(pick(detail ?? {}, "inhoud", "Inhoud")) || plain(pick(m, "inhoud", "Inhoud")) || plain(pick(m, "onderwerp", "Onderwerp")),
      date: toISO(pick(m, "verzondenOp", "VerzondenOp", "datum")),
      read: Boolean(pick(m, "isGelezen", "IsGelezen")),
      attachments: Boolean(pick(m, "heeftBijlagen", "HeeftBijlagen")) ? 1 : 0,
      folder: "inbox" as const,
    };
  });

  /* ---- absenties ---- */
  const absences: Absence[] = rawAbsences.map((a, index) => {
    const afspraak = pick(a, "Afspraak", "afspraak") ?? {};
    const start = toISO(pick(a, "Begin", "begin", "Datum", "datum", "Start") ?? pick(afspraak, "Start", "start"));
    const end = toISO(pick(a, "Einde", "einde", "Eind") ?? start);
    const omschrijving = `${str(pick(a, "Omschrijving", "omschrijving"))} ${str(pick(a, "Code", "code"))}`.toLowerCase();
    const type: Absence["type"] = /ziek/.test(omschrijving) ? "ziek"
      : /laat/.test(omschrijving) ? "te-laat"
      : /uitval|geannuleerd/.test(omschrijving) ? "uitval"
      : pick(a, "Geoorloofd") === true ? "geoorloofd" : "ongeoorloofd";
    const vak = pick(afspraak, "Vakken", "vakken", "Vak");
    const firstVak = (Array.isArray(vak) ? vak[0] : vak) as Row | undefined;
    const subjectName = pick(firstVak ?? {}, "Naam", "naam", "Omschrijving", "omschrijving");
    return {
      id: `abs-${pick(a, "Id", "id") ?? index}`,
      date: start,
      type,
      reason: str(pick(a, "Omschrijving", "omschrijving")) || "Verzuim",
      durationMinutes: Math.max(15, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000) || 60),
      subjectId: subjectFor(subjectName ?? "") || undefined,
      approved: Boolean(pick(a, "Geoorloofd", "geoorloofd")),
    };
  });

  /* ---- statistieken ---- */
  const locations = appointments.map((a) => a.location).filter((l) => l && l !== "—");
  const counts = new Map<string, number>();
  locations.forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1));
  const favoriteLocation = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const cancelledBySubject = new Map<string, number>();
  appointments.filter((a) => a.cancelled).forEach((a) => {
    if (a.subjectId) cancelledBySubject.set(a.subjectId, (cancelledBySubject.get(a.subjectId) ?? 0) + 1);
  });
  const mostCancelledSubjectId = [...cancelledBySubject.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const weekdaySum = Array(5).fill(0) as number[];
  const weekdayCount = Array(5).fill(0) as number[];
  grades.forEach((g) => {
    const day = (new Date(g.date).getDay() + 6) % 7;
    if (day < 5) { weekdaySum[day] += g.value; weekdayCount[day]++; }
  });
  const weekdays = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag"];
  let bestWeekday = "Maandag";
  let bestAverage = -1;
  weekdaySum.forEach((sum, index) => {
    const avg = weekdayCount[index] ? sum / weekdayCount[index] : 0;
    if (avg > bestAverage) { bestAverage = avg; bestWeekday = weekdays[index]; }
  });

  const school = str(pick(account, "School", "school"))
    || str(pick(account.School ?? {}, "Naam", "naam"))
    || (connection.magisterSchool ? connection.magisterSchool.replace(/\.magister\.net$/, "") : "")
    || connection.zermeloSubdomain
    || "";
  const name = [person?.Roepnaam, person?.Achternaam].filter(Boolean).join(" ")
    || [pick(zermeloMe ?? {}, "firstName"), pick(zermeloMe ?? {}, "lastName")].map(str).filter(Boolean).join(" ")
    || str(pick(zermeloMe ?? {}, "displayName"))
    || "Leerling";

  return {
    name, school,
    personId: String(personId ?? ""),
    studentCode,
    counts: {
      grades: grades.length,
      appointments: appointments.length,
      choices: choiceGroups.length,
      messages: messages.length,
    },
    data: {
      subjects: [...subjectMap.values()], teachers: [...teacherMap.values()],
      grades, gradeCandidates, gradeDiagnostics, rawGradeRows: rawGrades, ptaColumns, appointments,
      choiceGroups, homework, studyGuides, eloAssignments, messages, absences,
      stats: {
        lessonsAttended: appointments.filter((a) => !a.cancelled && a.type === "les").length,
        lessonsCancelled: appointments.filter((a) => a.cancelled).length,
        favoriteLocation, mostCancelledSubjectId, bestWeekday,
      },
    },
  };
}

export { dayKey };
