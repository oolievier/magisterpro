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
  magisterToken: string;
  magisterSchool: string;
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
  ned: "Nederlands", ne: "Nederlands", nederlands: "Nederlands",
  eng: "Engels", en: "Engels", engels: "Engels",
  wis: "Wiskunde", wisa: "Wiskunde A", wisb: "Wiskunde B", wisc: "Wiskunde C", wisd: "Wiskunde D",
  wiskunde: "Wiskunde", wiskundea: "Wiskunde A", wiskundeb: "Wiskunde B",
  nat: "Natuurkunde", natuurkunde: "Natuurkunde",
  natuur: "Natuurkunde", fysica: "Natuurkunde",
  sk: "Scheikunde", schei: "Scheikunde", scheikunde: "Scheikunde",
  bio: "Biologie", biologie: "Biologie",
  eco: "Economie", economie: "Economie",
  gs: "Geschiedenis", gesch: "Geschiedenis", geschiedenis: "Geschiedenis",
  ma: "Maatschappijleer", maats: "Maatschappijleer", maatschappijleer: "Maatschappijleer",
  fr: "Frans", frans: "Frans", du: "Duits", duits: "Duits", spa: "Spaans", spaans: "Spaans",
  inf: "Informatica", informatica: "Informatica", ict: "Informatica",
  kunst: "Kunst & Cultuur", ac: "Kunst & Cultuur",
  lich: "Lichamelijke opvoeding", lo: "Lichamelijke opvoeding", gym: "Lichamelijke opvoeding",
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
  // "NAT199", "WISb191", "Wiskunde B 191" -> "NAT", "WISb", "Wiskunde B"
  const base = text.replace(/\d{2,4}\s*$/, "").replace(/\s+/g, " ").trim();
  const byBase = base ? resolve(base) : "";
  if (byBase) return byBase;
  return base || text;
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
  const links = list(value);
  const relation = links.find((l) => /contents/i.test(str(pick(l, "Rel", "rel"))))
    ?? links.find((l) => /self/i.test(str(pick(l, "Rel", "rel"))));
  const raw = str(pick(relation ?? {}, "Uri", "uri", "Url", "url", "Href", "href")) || str(value);
  if (!raw || !raw.startsWith("/") && !/^https?:\/\//i.test(raw)) return "";
  try {
    const url = new URL(raw, `https://${host}`);
    if (url.hostname !== host) return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return raw.startsWith("/api/") ? raw : "";
  }
}

function attachmentFor(value: unknown, index: number, host: string): StudyGuideAttachment {
  const row = (value ?? {}) as Row;
  return {
    id: str(pick(row, "Id", "id")) || `att-${index}`,
    name: str(pick(row, "Naam", "naam", "weergavenaam", "DisplayName"))
      || (apiLinkFor(pick(row, "Links"), host).split("/").pop() ?? "Bijlage"),
    url: apiLinkFor(pick(row, "Links"), host) || apiLinkFor(pick(row, "Uri", "uri", "Url", "url"), host),
    mime: str(pick(row, "ContentType", "contentType")) || undefined,
  };
}

export function emptyAppData(): AppData {
  const stats: SchoolYearStats = {
    lessonsAttended: 0, lessonsCancelled: 0, favoriteLocation: "—",
    mostCancelledSubjectId: "", bestWeekday: "Maandag",
  };
  return {
    subjects: [], teachers: [], grades: [], ptaColumns: [], appointments: [],
    choiceGroups: [], homework: [], studyGuides: [], eloAssignments: [],
    messages: [], absences: [], stats,
  };
}

/** Haalt alle beschikbare live-data op en mapt die naar het uniforme model. */
export async function fetchLiveData(connection: LiveConnection): Promise<LiveDataResult> {
  const config: MagisterConfig = { subdomain: connection.magisterSchool, token: connection.magisterToken };
  const host = normalizeMagisterHost(connection.magisterSchool);
  const accountRes = await magister.getAccount(config);
  if (!accountRes.ok) {
    throw new Error(accountRes.error ?? "Kon je Magister-account niet ophalen. Log opnieuw in.");
  }
  const account = accountRes.data ?? {};
  const person = account.Persoon;
  const personId = person?.Id;
  if (!personId) throw new Error("Geen leerlingprofiel gevonden in Magister.");

  const enrollmentsRes = await magister.getEnrollments(config, personId);
  const enrollments = list(enrollmentsRes.data);
  const enrollment = enrollments.find((e) => e.isHoofdAanmelding || e.IsHoofdAanmelding) ?? enrollments[0];
  const aanmeldingId = enrollment?.id ?? enrollment?.Id ?? personId;

  const from = asLocalISO(new Date(Date.now() - 150 * 86_400_000));
  const to = asLocalISO(new Date(Date.now() + 180 * 86_400_000));

  const [gradesRes, appointmentsRes, absencesRes, messagesRes, assignmentsRes, guidesRes,
    enrollmentSubjectsRes, activitiesRes, zermeloRes, zermeloUsersRes] = await Promise.allSettled([
    magister.getGrades(config, aanmeldingId, 400),
    magister.getAppointments(config, personId, from, to),
    magister.getAbsences(config, personId, from, to),
    magister.getMessages(config, 60),
    magister.getAssignments(config, personId),
    magister.getStudyGuides(config, personId),
    magister.getEnrollmentSubjects(config, personId, aanmeldingId),
    magister.getActivities(config, personId),
    connection.zermeloToken
      ? zermelo.getAppointments(
          { subdomain: connection.zermeloSubdomain ?? "", token: connection.zermeloToken },
          Math.floor(Date.now() / 1000) - 30 * 86_400,
          Math.floor(Date.now() / 1000) + 120 * 86_400
        )
      : Promise.resolve(null),
    connection.zermeloToken
      ? zermelo.getMe({ subdomain: connection.zermeloSubdomain ?? "", token: connection.zermeloToken })
      : Promise.resolve(null),
  ]);

  const value = <T>(result: PromiseSettledResult<T>): T | null =>
    result.status === "fulfilled" ? result.value : null;
  const okData = <T>(result: PromiseSettledResult<{ ok: boolean; data?: T }>): T | null => {
    const res = value(result);
    return res?.ok ? (res.data ?? null) : null;
  };

  const rawGrades = list(okData(gradesRes));
  const rawAppointments = list(okData(appointmentsRes));
  const rawAbsences = list(okData(absencesRes));
  const rawMessages = list(okData(messagesRes));
  const rawAssignments = list(okData(assignmentsRes));
  const rawGuides = list(okData(guidesRes));
  const rawSubjects = list(okData(enrollmentSubjectsRes));
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

  /* ---- vakaliassen: afkorting -> volledige omschrijving ---- */
  const aliases = new Map<string, string>();
  rawSubjects.forEach((raw) => {
    const description = canonicalSubject(pick(raw, "omschrijving", "Omschrijving", "naam", "Naam"), aliases);
    const abbreviation = str(pick(raw, "afkorting", "Afkorting", "code", "Code"));
    if (description) {
      aliases.set(description.toLowerCase(), description);
      aliases.set(keyFor(description), description);
      if (abbreviation) { aliases.set(abbreviation.toLowerCase(), description); aliases.set(keyFor(abbreviation), description); }
    }
  });

  /* ---- docenten: ruwe docentcodes -> volledige namen ---- */
  const teacherNameByCode = new Map<string, string>();
  const teacherEmailByCode = new Map<string, string>();
  const teacherCodes = [...new Set([
    ...rawGrades.map((g) => str(pick(g, "Docent", "docent"))),
    ...rawSubjects.map((s) => str(pick(s, "docent", "Docent"))),
  ].filter((code) => code.trim().length >= 2))].slice(0, 40);
  const contactResults = await Promise.allSettled(
    teacherCodes.map((code) => magister.getContacts(config, personId, code))
  );
  contactResults.forEach((res, index) => {
    if (res.status !== "fulfilled" || !res.value.ok) return;
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
  const subjectFor = (value: unknown): string => {
    const name = canonicalSubject(value, aliases);
    if (!name) return "";
    const key = name.toLowerCase();
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
        isExamSubject: true,
        description: `Vakgegevens geladen uit ${connection.magisterSchool}.`,
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
    if (id && teacherId && subjectMap.get(keyForName(description || abbreviation))) {
      subjectMap.get(keyForName(description || abbreviation))!.teacherId = teacherId;
    }
  });
  function keyForName(value: unknown) {
    return canonicalSubject(value, aliases).toLowerCase();
  }

  /* ---- cijfers: alléén echte, numerieke cijfers ---- */
  const gradeValue = (g: Row): number => num(
    pick(g, "waarde", "Cijfer", "grade"),
    num(pick(g, "CijferStr"), NaN)
  );
  const numericGrades = rawGrades.filter((g) => {
    if (pick(g, "TeltMee") === false || pick(g, "Vrijstelling") === true || pick(g, "VakDispensatie") === true) return false;
    if (num(pick(g, "CijferId", "cijferId"), 1) === 0) return false;
    const value = gradeValue(g);
    return Number.isFinite(value) && value > 0 && value <= 10;
  });

  const grades: Grade[] = numericGrades.map((g, index) => {
    const kolom = (pick(g, "kolom", "CijferKolom") ?? {}) as Row;
    const vak = (pick(g, "Vak", "vak") ?? {}) as Row;
    const rawName = pick(vak, "Omschrijving", "omschrijving", "Naam", "naam")
      ?? pick(g, "vaknaam", "VakNaam")
      ?? pick(vak, "afkorting", "Afkorting");
    const subjectId = subjectFor(rawName ?? pick(g, "vak", "Vak"));
    const columnLabel = plain(pick(kolom, "KolomOmschrijving", "omschrijving", "naam", "Naam"));
    const label = columnLabel || plain(pick(g, "omschrijving", "Omschrijving")) || "Cijfer";
    const typeText = `${str(pick(kolom, "type", "Type"))} ${label}`.toLowerCase();
    const isPta = /pta|schoolexamen|examen/.test(typeText) || kolom.IsPTAKolom === true;
    const type: Grade["type"] = /herkans|rep\b/.test(typeText) ? "REP"
      : /opdracht|assignment/.test(typeText) ? "Opdracht"
      : isPta ? "PTA" : "SO";
    const columnId = pick(kolom, "Id", "id", "code", "Code", "KolomCode");
    const columnCode = str(pick(kolom, "code", "Code", "KolomCode")) || (columnId ? `KOL-${columnId}` : `KOL-${index + 1}`);
    const date = toISO(pick(g, "DatumIngevoerd", "datum", "Datum", "date"));
    const teacherCode = str(pick(g, "Docent", "docent"));
    return {
      id: `cijfer-${pick(g, "CijferId", "id", "Id") ?? index + 1}-${index}`,
      subjectId, value: gradeValue(g),
      weight: num(pick(kolom, "weegfactor", "weging", "Weging"), 1) || 1,
      date, label, type, columnCode,
      teacherId: teacherCode ? teacherFor(teacherCode, true) : undefined,
      ptaColumnId: isPta ? columnCode : undefined,
      isNew: Date.now() - new Date(date).getTime() < 3 * 86_400_000,
    };
  }).filter((g) => g.subjectId);

  const ptaColumns: PtaColumn[] = Object.values(grades.reduce<Record<string, Grade[]>>((acc, g) => {
    if (!g.ptaColumnId) return acc;
    (acc[g.ptaColumnId] ??= []).push(g);
    return acc;
  }, {})).map((items) => {
    const first = items[0];
    return {
      id: first.ptaColumnId!,
      subjectId: first.subjectId,
      code: first.columnCode!,
      description: first.label,
      weight: first.weight,
      date: first.date,
      retakeable: items.some((g) => g.type === "REP") || /herkans/i.test(first.label),
      gradeId: items[items.length - 1].id,
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
      || (subjectId ? subjectMap.get(keyForName(subjectName))?.name ?? "Les" : "Les");
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
    magister.getActivityElements(config, personId, pick(activity, "Id", "id"))
  ));
  rawActivities.forEach((activity, activityIndex) => {
    const elementResult = activityElementsResults[activityIndex];
    const elements = elementResult?.status === "fulfilled" && elementResult.value.ok
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

  const studyGuides: StudyGuide[] = rawGuides.map((g, index) => {
    const subjectName = str(pick(g, "vak", "Vak", "vaknaam", "VakNaam"));
    return {
      id: `sg-${pick(g, "Id", "id") ?? index}`,
      subjectId: subjectFor(subjectName),
      title: plain(pick(g, "Omschrijving", "omschrijving", "Titel", "titel")) || "Studiewijzer",
      week: num(pick(g, "Week", "week"), 1),
      goals: list(pick(g, "Leerdoelen", "leerdoelen")).map((d) => plain(pick(d, "Omschrijving", "omschrijving")) || str(d)).filter(Boolean),
      attachments: list(pick(g, "Bijlagen", "bijlagen")).map((row, i) => attachmentFor(row, i, host)),
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
    || connection.magisterSchool.replace(/\.magister\.net$/, "");
  const name = [person.Roepnaam, person.Achternaam].filter(Boolean).join(" ")
    || [pick(zermeloMe ?? {}, "firstName"), pick(zermeloMe ?? {}, "lastName")].map(str).filter(Boolean).join(" ")
    || str(pick(zermeloMe ?? {}, "displayName"))
    || "Leerling";

  return {
    name, school,
    personId: String(personId),
    studentCode,
    counts: {
      grades: grades.length,
      appointments: appointments.length,
      choices: choiceGroups.length,
      messages: messages.length,
    },
    data: {
      subjects: [...subjectMap.values()], teachers: [...teacherMap.values()], grades, ptaColumns, appointments,
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
