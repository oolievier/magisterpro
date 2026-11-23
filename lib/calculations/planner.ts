import type {
  Appointment,
  BlockedSlot,
  Grade,
  Homework,
  Subject,
  ChoiceOption,
} from "@/lib/types";
import { weightedAverage, round1 } from "@/lib/calculations/grades";

/* ===========================================================================
 * Rooster- en planningslogica
 * ========================================================================= */

export interface TimeGap {
  id: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  before: string;
  after: string;
  locationFrom?: string;
  locationTo?: string;
}

const mins = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

/** Detecteert tussenuren vanaf `minMinutes` minuten op een gegeven dag. */
export function findFreeGaps(dayAppointments: Appointment[], minMinutes = 45): TimeGap[] {
  const lessons = dayAppointments
    .filter((a) => !a.cancelled && a.type !== "vrij")
    .sort((a, b) => a.start.localeCompare(b.start));
  const gaps: TimeGap[] = [];
  for (let i = 0; i < lessons.length - 1; i++) {
    const from = new Date(lessons[i].end).getTime();
    const to = new Date(lessons[i + 1].start).getTime();
    const duration = Math.round((to - from) / 60000);
    if (duration >= minMinutes) {
      gaps.push({
        id: `gap-${lessons[i].id}-${lessons[i + 1].id}`,
        date: lessons[i].start.slice(0, 10),
        start: lessons[i].end,
        end: lessons[i + 1].start,
        minutes: duration,
        before: lessons[i].title,
        after: lessons[i + 1].title,
        locationFrom: lessons[i].location,
        locationTo: lessons[i + 1].location,
      });
    }
  }
  return gaps;
}

export interface GapSuggestion {
  title: string;
  reason: string;
  subjectId?: string;
  taskId?: string;
  minutes: number;
}

/** Kiest de meest rendabele activiteit voor een tussenuur. */
export function suggestForGap(
  gap: TimeGap,
  homework: Homework[],
  grades: Grade[],
  subjects: Subject[],
  level: string
): GapSuggestion {
  const open = homework.filter((h) => h.status !== "done");
  const scored = open.map((h) => {
    const avg = weightedAverage(grades.filter((g) => g.subjectId === h.subjectId));
    const urgent = Math.max(0, 5 - Math.ceil((new Date(h.due).getTime() - Date.now()) / 86400000));
    return { h, score: urgent * 3 + Math.max(0, 6.5 - avg) * 2 + (level.includes("vwo") ? 0.4 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const minutes = Math.min(gap.minutes, best?.h.estimatedMinutes ?? gap.minutes);
  if (!best) {
    return {
      title: "Adem even uit",
      reason: `Je hebt ${gap.minutes} minuten vrij tussen ${gap.before} en ${gap.after}. Geen openstaande taken — pak een korte wandeling.`,
      minutes: gap.minutes,
    };
  }
  const subject = subjects.find((s) => s.id === best.h.subjectId);
  return {
    title: best.h.title,
    reason: `${gap.minutes} min vrij tussen uur ${gap.before} en ${gap.after} — ideaal om ${subject?.name ?? "je taak"} af te maken${weightedAverage(grades.filter((g) => g.subjectId === best.h.subjectId)) < 6 ? " (je staat er onder de 6 voor)" : ""}.`,
    subjectId: best.h.subjectId,
    taskId: best.h.id,
    minutes,
  };
}

export interface StudyBlock {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  subjectId?: string;
  taskId?: string;
  minutes: number;
  kind: "leerblok" | "huiswerk" | "blokkade";
}

export interface StudyPlanDay {
  date: string;
  load: number;
  blocks: StudyBlock[];
}

/**
 * Automatische toetsweek-generator: scan toetsen, verdeel leerdoelen
 * terugrekenend over beschikbare dagen, rekening houdend met drukke dagen en
 * door de gebruiker geblokkeerde sport/werk-blokken.
 */
export function generateStudyPlan(
  appointments: Appointment[],
  blocked: BlockedSlot[],
  homework: Homework[],
  subjects: Subject[],
  horizonDays = 14
): StudyPlanDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: StudyPlanDay[] = [];
  const tests = appointments.filter(
    (a) => a.type === "toets" && new Date(a.start).getTime() > Date.now()
  );

  for (let d = 0; d < horizonDays; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const iso = date.toISOString().slice(0, 10);
    const dayAppts = appointments.filter((a) => a.start.slice(0, 10) === iso && !a.cancelled);
    const busyMinutes = dayAppts.reduce(
      (s, a) => s + (new Date(a.end).getTime() - new Date(a.start).getTime()) / 60000,
      0
    );
    const blocks: StudyBlock[] = [];
    blocked
      .filter((b) => b.start.slice(0, 10) === iso)
      .forEach((b) =>
        blocks.push({
          id: b.id,
          date: iso,
          start: b.start,
          end: b.end,
          title: b.label,
          minutes: Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000),
          kind: "blokkade",
        })
      );
    const freeTime = Math.max(0, 120 - Math.round(busyMinutes / 3));
    if (freeTime >= 30 && d > 0) {
      const dayTests = tests.filter((t) => t.start.slice(0, 10) === iso);
      const target = dayTests[0] ?? tests[0];
      const subject = subjects.find((s) => s.id === target?.subjectId);
      const dueHomework = homework
        .filter((h) => h.status !== "done" && h.due.slice(0, 10) === iso)
        .slice(0, 1);
      if (dueHomework[0]) {
        blocks.push({
          id: `plan-hw-${dueHomework[0].id}`,
          date: iso,
          start: "16:00",
          end: timeLabel(new Date(new Date(`${iso}T16:00:00`).getTime() + Math.min(freeTime, 45) * 60000).toISOString()),
          title: dueHomework[0].title,
          subjectId: dueHomework[0].subjectId,
          taskId: dueHomework[0].id,
          minutes: Math.min(freeTime, 45),
          kind: "huiswerk",
        });
      }
      blocks.push({
        id: `plan-${iso}`,
        date: iso,
        start: "17:00",
        end: timeLabel(new Date(new Date(`${iso}T17:00:00`).getTime() + Math.min(freeTime, 50) * 60000).toISOString()),
        title: target ? `Voorbereiding ${subject?.name ?? target.title}` : "Herhaling & flashcards",
        subjectId: target?.subjectId,
        minutes: Math.min(freeTime, 50),
        kind: "leerblok",
      });
    }
    days.push({ date: iso, load: busyMinutes, blocks });
  }
  return days;
}

/** Conflictcheck tussen een keuzeles en het reguliere rooster. */
export function conflictsFor(
  option: ChoiceOption,
  appointments: Appointment[]
): Appointment[] {
  const start = new Date(option.start).getTime();
  const end = new Date(option.end).getTime();
  return appointments.filter((a) => {
    if (a.cancelled || a.kwtGroupId) return false;
    const aStart = new Date(a.start).getTime();
    const aEnd = new Date(a.end).getTime();
    return aStart < end && aEnd > start;
  });
}

/* ---------------------------------------------------------------------------
 * .ics-export (Magister + Zermelo gecombineerd)
 * ------------------------------------------------------------------------- */

const icsEscape = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

export function buildICS(appointments: Appointment[], subjects: Subject[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MagisterPro//Combined Schedule//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:MagisterPro Rooster",
  ];
  appointments.forEach((a) => {
    const subject = subjects.find((s) => s.id === a.subjectId);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${a.id}@magisterpro`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(a.start)}`,
      `DTEND:${icsDate(a.end)}`,
      `SUMMARY:${icsEscape(a.cancelled ? `[UITGEVALLEN] ${a.title}` : a.title)}`,
      `LOCATION:${icsEscape(a.location)}`,
      `DESCRIPTION:${icsEscape(`${subject?.name ?? ""} · ${a.type}${a.toetsType ? ` · ${a.toetsType}` : ""} · bron: ${a.source}`)}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(appointments: Appointment[], subjects: Subject[]) {
  const blob = new Blob([buildICS(appointments, subjects)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "magisterpro-rooster.ics";
  a.click();
  URL.revokeObjectURL(url);
}

/** Formatteerd een tijdsinterval voor weergave. */
export function formatInterval(start: string, end: string) {
  return `${timeLabel(start)}–${timeLabel(end)}`;
}

export function minutesLeft(endIso: string, now = new Date()): number {
  return Math.max(0, Math.round((new Date(endIso).getTime() - now.getTime()) / 60000));
}

export function progressInLesson(startIso: string, endIso: string, now = new Date()): number {
  const total = new Date(endIso).getTime() - new Date(startIso).getTime();
  const done = now.getTime() - new Date(startIso).getTime();
  return Math.min(100, Math.max(0, (done / total) * 100));
}

export { timeLabel, round1 };
