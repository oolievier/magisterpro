/* ===========================================================================
 * Live-data-mapper: ruwe Magister v6 / Zermelo v3 antwoorden -> AppData.
 * Er is geen fallback-dataset: alles komt uit de echte schoolkoppeling.
 * ========================================================================= */

import { magister, type MagisterConfig } from "@/lib/api/magister";
import { zermelo, type ZermeloAppointment } from "@/lib/api/zermelo";
import { mergeAppointments } from "@/lib/data-merger";
import type {
  AppData, Absence, Appointment, ChoiceGroup, ChoiceOption, EloAssignment, Grade,
  Homework, Message, PtaColumn, Profile, SchoolYearStats, StudyGuide, Subject, Teacher,
} from "@/lib/types";

export interface LiveConnection {
  magisterToken: string;
  magisterSchool: string;
  zermeloSubdomain?: string;
  zermeloToken?: string;
}

export interface LiveDataResult {
  data: AppData;
  name: string;
  school: string;
  counts: { grades: number; appointments: number; choices: number; messages: number };
}

type Row = Record<string, any>; // ruwe API-objecten hebben wisselende casing per school

const COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6", "#3b82f6", "#ec4899", "#14b8a6", "#a3a3a3"];
const CORE = ["Nederlands", "Engels", "Wiskunde"];
const CANCELLED = new Set([4, 5]);

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
const hash = (value: string) => [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
const asLocalISO = (date: Date) => {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${hh}:${mm}`;
};

function profileFor(name: string): Profile {
  if (/wiskunde|natuurkunde|scheikunde|biologie|informatica|techniek|economie/i.test(name)) return "beta";
  if (/nederlands|engels|frans|duits|spaans|latijn|grieks|talen/i.test(name)) return "talen";
  return "maatschappij";
}
function shortFor(name: string): string {
  const known: Record<string, string> = {
    wiskunde: "Wis", natuurkunde: "Nat", scheikunde: "Schei", biologie: "Bio",
    economie: "Eco", nederlands: "Ned", engels: "Eng", frans: "Frans",
    maatschappijleer: "Maats", geschiedenis: "Gesch",
  };
  const key = slug(name).split("-")[0];
  return known[key] ?? name.slice(0, 6);
}
function codeFor(name: string): string {
  const known: Record<string, string> = {
    wiskunde: "WB", natuurkunde: "NA", scheikunde: "SK", biologie: "BI", economie: "EC",
    nederlands: "NE", engels: "EN", frans: "FR", maatschappijleer: "MA", geschiedenis: "GS",
  };
  return (known[slug(name).split("-")[0]] ?? name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()) || "VAK";
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
  const enrollment = enrollments.find((e) => e.isHoofdAanmelding) ?? enrollments[0];
  const aanmeldingId = enrollment?.id ?? personId;

  const from = asLocalISO(new Date(Date.now() - 150 * 86_400_000));
  const to = asLocalISO(new Date(Date.now() + 180 * 86_400_000));

  const [gradesRes, appointmentsRes, absencesRes, messagesRes, assignmentsRes, guidesRes, zermeloRes, zermeloUsersRes] = await Promise.allSettled([
    magister.getGrades(config, aanmeldingId, 400),
    magister.getAppointments(config, personId, from, to),
    magister.getAbsences(config, personId, from, to),
    magister.getMessages(config, 60),
    magister.getAssignments(config, personId),
    magister.getStudyGuides(config, personId),
    connection.zermeloToken
      ? zermelo.getAppointments(
          { subdomain: connection.zermeloSubdomain ?? "", token: connection.zermeloToken },
          Math.floor(Date.now() / 1000) - 30 * 86_400,
          Math.floor(Date.now() / 1000) + 120 * 86_400
        )
      : Promise.resolve(null),
    connection.zermeloToken
      ? zermelo.getUsers({ subdomain: connection.zermeloSubdomain ?? "", token: connection.zermeloToken })
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
  const zermeloResult = value(zermeloRes);
  const rawZermelo = zermeloResult?.ok ? list(zermeloResult.data) : [];
  const rawZermeloUsers = value(zermeloUsersRes)?.ok ? list(value(zermeloUsersRes)?.data) : [];

  /* ---- docenten en vakken ---- */
  const teacherMap = new Map<string, Teacher>();
  const teacherFor = (name: string): string => {
    const clean = str(name).trim();
    if (!clean) return "";
    const key = clean.toLowerCase();
    if (!teacherMap.has(key)) {
      const pieces = clean.split(/\s+/);
      teacherMap.set(key, {
        id: `doc-${slug(clean)}`,
        name: clean,
        abbreviation: pieces.map((p) => p[0]).join("").slice(0, 3).toUpperCase(),
        email: "", subjects: [], locations: [],
      });
    }
    return teacherMap.get(key)!.id;
  };

  const subjectMap = new Map<string, Subject>();
  const subjectFor = (name: string): string => {
    const clean = str(name).trim();
    if (!clean || /^(kwt|keuze|mentor|vrij|leeg)$/i.test(clean)) return "";
    const key = clean.toLowerCase();
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        id: `vak-${slug(clean)}`,
        name: clean,
        short: shortFor(clean),
        code: codeFor(clean),
        color: COLORS[hash(clean) % COLORS.length],
        teacherId: "",
        profile: profileFor(clean),
        isCore: CORE.some((core) => clean.toLowerCase().includes(core.toLowerCase())),
        isExamSubject: true,
        description: `Vakgegevens geladen uit ${connection.magisterSchool}.`,
      });
    }
    return subjectMap.get(key)!.id;
  };

  rawGrades.forEach((g) => {
    const name = str(pick(g, "vaknaam", "VakNaam")) || str(pick(g.kolom, "naam", "Naam"));
    if (name) subjectFor(name);
  });
  rawAppointments.forEach((a) => {
    const vak = pick(a, "Vakken", "vakken", "Vak");
    const name = str(Array.isArray(vak) ? pick(vak[0] ?? {}, "Naam", "naam", "Omschrijving") : pick(vak ?? {}, "Naam", "naam"));
    if (name) subjectFor(name);
    else if (str(a.Omschrijving)) subjectFor(str(a.Omschrijving).split(" - ")[0]);
  });
  rawZermelo.forEach((a: Row) => {
    const subjects = pick(a, "subjects", "subject");
    (Array.isArray(subjects) ? subjects : [subjects]).forEach((name: unknown) => { if (str(name)) subjectFor(str(name)); });
  });
  rawAssignments.forEach((a) => {
    const name = str(pick(a, "vak", "Vak", "vaknaam", "VakNaam"));
    if (name) subjectFor(name);
  });

  const subjects = [...subjectMap.values()];

  /* ---- cijfers ---- */
  const grades: Grade[] = rawGrades.map((g, index) => {
    const kolom = (g.kolom ?? g.CijferKolom ?? {}) as Row;
    const value = num(pick(g, "waarde", "Cijfer", "grade"), num(pick(g, "CijferStr"), NaN));
    const name = str(pick(g, "vaknaam", "VakNaam")) || str(pick(kolom, "naam", "Naam"));
    const subjectId = subjectFor(name);
    const label = plain(pick(g, "omschrijving", "Omschrijving")) || str(pick(kolom, "omschrijving", "KolomOmschrijving", "naam", "Naam")) || "Cijfer";
    const typeText = `${str(pick(kolom, "type", "Type"))} ${label}`.toLowerCase();
    const type: Grade["type"] = /herkans|rep\b/.test(typeText) ? "REP"
      : /opdracht|assignment/.test(typeText) ? "Opdracht"
      : /pta|schoolexamen|examen/.test(typeText) || g.CijferKolom?.IsPTAKolom ? "PTA" : "SO";
    const columnCode = str(pick(kolom, "code", "Code")) || `KOL-${index + 1}`;
    const date = toISO(pick(g, "DatumIngevoerd", "datum", "Datum", "date"));
    const teacherCode = str(pick(g, "Docent", "docent"));
    return {
      id: `cijfer-${pick(g, "id", "Id", "CijferKolom")?.Id ?? index + 1}-${index}`,
      subjectId, value,
      weight: num(pick(kolom, "weegfactor", "weging", "Weging"), 1) || 1,
      date, label, type, columnCode,
      teacherId: teacherCode ? teacherFor(teacherCode) : undefined,
      ptaColumnId: columnCode,
      isNew: Date.now() - new Date(date).getTime() < 3 * 86_400_000,
    };
  }).filter((g) => g.subjectId && Number.isFinite(g.value) && g.value > 0 && g.value <= 10);

  const ptaColumns: PtaColumn[] = Object.values(grades.reduce<Record<string, Grade[]>>((acc, g) => {
    (acc[g.columnCode!] ??= []).push(g);
    return acc;
  }, {})).map((items, index) => {
    const first = items[0];
    return {
      id: first.columnCode!,
      subjectId: first.subjectId,
      code: first.columnCode!,
      description: first.label,
      weight: first.weight,
      date: first.date,
      retakeable: items.some((g) => g.type === "REP") || index % 3 !== 1,
      gradeId: items[items.length - 1].id,
    };
  });

  /* ---- afspraken ---- */
  const magisterAppointments: Appointment[] = rawAppointments.map((a, index) => {
    const vak = pick(a, "Vakken", "vakken", "Vak");
    const subjectName = str(Array.isArray(vak) ? pick(vak[0] ?? {}, "Naam", "naam", "Omschrijving") : pick(vak ?? {}, "Naam", "naam"));
    const subjectId = subjectFor(subjectName || (str(a.Omschrijving).split(" - ")[0] || ""));
    const docenten = list([pick(a, "Docenten", "docenten")]);
    const teacherId = teacherFor(str(pick(docenten[0] ?? {}, "Naam", "naam")));
    const status = num(pick(a, "Status"), 0);
    const infoType = num(pick(a, "InfoType"), 0);
    const lokalen = list([pick(a, "Lokalen", "lokalen")]);
    const location = str(pick(a, "Lokatie", "lokatie", "location")) || str(pick(lokalen[0] ?? {}, "Naam", "naam")) || "—";
    const cancelled = CANCELLED.has(status) || Boolean(pick(a, "Geannuleerd", "cancelled"));
    const title = str(pick(a, "Omschrijving", "omschrijving", "Titel")) || subjects.find((s) => s.id === subjectId)?.name || "Les";
    return {
      id: `mag-${pick(a, "Id", "id") ?? index}`,
      start: toISO(pick(a, "Start", "start", "Begin")),
      end: toISO(pick(a, "Einde", "einde", "Eind", "End")),
      subjectId: subjectId || undefined,
      teacherId: teacherId || undefined,
      location,
      originalLocation: str(pick(a, "OrigineleLokatie")) || undefined,
      title,
      type: (infoType >= 2 && infoType <= 5 ? "toets" : "les") as Appointment["type"],
      cancelled,
      toetsType: (infoType === 2 ? "SO" : infoType === 3 ? "PTA" : infoType === 4 ? "REP" : undefined) as Appointment["toetsType"],
      source: "magister" as const,
    };
  }).filter((a) => a.subjectId || a.title);

  const choiceGroupsMap = new Map<string, ChoiceOption[]>();
  const zermeloAppointments: Appointment[] = [];
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
    const choiceGroupId = a.choiceGroupId ? String(a.choiceGroupId) : "";
    const id = `zer-${pick(a, "appointmentInstance", "id") ?? index}`;

    if (choiceGroupId) {
      const option: ChoiceOption = {
        id, groupId: choiceGroupId,
        subjectId: subjectId || undefined,
        teacherId: teacherId || undefined,
        title: subjectNames.join(", ") || str(pick(a, "description", "remark")) || "Keuzeles",
        description: plain(pick(a, "remark", "description")) || "Keuzeles via Zermelo",
        location, start, end,
        capacity: num(pick(a, "capacity"), 1) || 1,
        enrolled: num(pick(a, "enrolled"), 0),
        kind: a.appointmentType === "choice" ? "KWT" : a.appointmentType === "activity" ? "workshop" : "KWT",
      };
      choiceGroupsMap.set(choiceGroupId, [...(choiceGroupsMap.get(choiceGroupId) ?? []), option]);
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
      kwtGroupId: choiceGroupId || undefined,
      isNew: Boolean(pick(a, "new", "isNew")),
    });
  });

  const appointments = mergeAppointments(magisterAppointments, zermeloAppointments)
    .filter((a) => a.start && a.end);

  const choiceGroups: ChoiceGroup[] = [...choiceGroupsMap.entries()].map(([id, options], index) => {
    const starts = options.map((o) => o.start).sort();
    const ends = options.map((o) => o.end).sort();
    const start = starts[0];
    const deadline = new Date(new Date(start).getTime() - 86_400_000).toISOString();
    return {
      id: `kg-${id}`,
      title: `Keuzeblok ${new Date(start).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}`,
      start, end: ends[ends.length - 1],
      mandatory: false, deadline,
      options: options.map((o) => ({ ...o, groupId: `kg-${id}` })),
    };
  }).sort((a, b) => a.start.localeCompare(b.start));

  /* ---- huiswerk, ELO, studiewijzers ---- */
  const homework: Homework[] = rawAppointments.flatMap((a, index) => {
    const infoType = num(pick(a, "InfoType"), 0);
    const text = plain(pick(a, "Inhoud"));
    if (infoType !== 1 && !text) return [];
    const vak = pick(a, "Vakken", "vakken", "Vak");
    const subjectName = str(Array.isArray(vak) ? pick(vak[0] ?? {}, "Naam", "naam") : pick(vak ?? {}, "Naam", "naam"));
    return [{
      id: `hw-mag-${pick(a, "Id", "id") ?? index}`,
      subjectId: subjectFor(subjectName),
      title: text.split("\n")[0].slice(0, 90) || `Huiswerk ${subjectName}`,
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
    return {
      id: `elo-${pick(a, "Id", "id") ?? index}`,
      subjectId: subjectFor(subjectName),
      title: plain(pick(a, "Omschrijving", "omschrijving", "Titel", "titel")) || "Opdracht",
      description: plain(pick(a, "Inhoud", "inhoud", "Omschrijving")),
      deadline: toISO(pick(a, "Deadline", "deadline", "Einde", "einde")),
      status: (pick(a, "Afgerond") ? "submitted" : "open") as EloAssignment["status"],
      attachmentCount: list(pick(a, "Bijlagen", "bijlagen")).length,
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
      attachments: list(pick(g, "Bijlagen", "bijlagen")).map((d) => str(pick(d, "Naam", "naam", "weergavenaam"))).filter(Boolean),
      updatedAt: toISO(pick(g, "LaatstGewijzigd", "lastModified")),
    };
  }).filter((s) => s.subjectId);

  /* ---- berichten ---- */
  const details = await Promise.allSettled(rawMessages.slice(0, 12).map((m) => magister.getMessageDetail(config, pick(m, "id", "Id"))));
  const messages: Message[] = rawMessages.map((m, index) => {
    const detail = details[index]?.status === "fulfilled" ? details[index].value.data : null;
    const sender = pick(m, "afzender", "Afzender") ?? {};
    return {
      id: `msg-${pick(m, "id", "Id") ?? index}`,
      from: str(pick(sender, "naam", "Naam")) || "School",
      fromId: `doc-${slug(str(pick(sender, "naam", "Naam")))}`,
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
    const subjectName = str(Array.isArray(vak) ? pick(vak[0] ?? {}, "Naam", "naam") : pick(vak ?? {}, "Naam", "naam"));
    return {
      id: `abs-${pick(a, "Id", "id") ?? index}`,
      date: start,
      type,
      reason: str(pick(a, "Omschrijving", "omschrijving")) || "Verzuim",
      durationMinutes: Math.max(15, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000) || 60),
      subjectId: subjectFor(subjectName) || undefined,
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
    || str(pick(rawZermeloUsers[0] ?? {}, "displayName"))
    || "Leerling";

  return {
    name, school,
    counts: {
      grades: grades.length,
      appointments: appointments.length,
      choices: choiceGroups.length,
      messages: messages.length,
    },
    data: {
      subjects, teachers: [...teacherMap.values()], grades, ptaColumns, appointments,
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
