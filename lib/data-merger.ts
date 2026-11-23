import type { Appointment, AppData } from "@/lib/types";

/* ===========================================================================
 * Slimme data-merger: één waarheid uit Magister + Zermelo.
 * Zermelo is leidend voor lokaal/lesuitval/keuzelessen, Magister voor
 * huiswerk, toetsstof en cijfers.
 * ========================================================================= */

const sameSlot = (a: Appointment, b: Appointment) =>
  a.subjectId === b.subjectId &&
  Math.abs(new Date(a.start).getTime() - new Date(b.start).getTime()) < 20 * 60 * 1000;

export function mergeAppointments(magister: Appointment[], zermelo: Appointment[]): Appointment[] {
  const result: Appointment[] = magister.map((a) => ({ ...a }));
  zermelo.forEach((z) => {
    const index = result.findIndex((m) => sameSlot(m, z));
    if (index >= 0) {
      const m = result[index];
      result[index] = {
        ...m,
        // Zermelo is leidend voor actuele ruimte/uitval-informatie.
        location: z.location || m.location,
        originalLocation: m.location !== z.location ? m.location : m.originalLocation,
        cancelled: z.cancelled ?? m.cancelled,
        isNew: Boolean((m.location && z.location && m.location !== z.location) || z.cancelled),
        source: "merged",
      };
    } else {
      result.push({ ...z, source: "zermelo" });
    }
  });
  return result.sort((a, b) => a.start.localeCompare(b.start));
}

export interface DiffResult {
  newGrades: string[];
  newAppointments: string[];
  newHomework: string[];
  newMessages: string[];
  changedIds: string[];
}

/** Vergelijkt huidige data met een opgeslagen snapshot (localStorage). */
export function diffData(current: AppData, previous: Partial<AppData> | null): DiffResult {
  if (!previous) {
    return {
      newGrades: current.grades.filter((g) => g.isNew).map((g) => g.id),
      newAppointments: current.appointments.filter((a) => a.isNew).map((a) => a.id),
      newHomework: current.homework.filter((h) => h.isNew).map((h) => h.id),
      newMessages: current.messages.filter((m) => !m.read).map((m) => m.id),
      changedIds: [],
    };
  }
  const prevGrades = new Set((previous.grades ?? []).map((g) => g.id));
  const prevAppointments = new Set((previous.appointments ?? []).map((a) => `${a.id}-${a.location}-${a.cancelled}`));
  const prevHomework = new Set((previous.homework ?? []).map((h) => h.id));
  const prevMessages = new Set((previous.messages ?? []).map((m) => m.id));
  const changedIds: string[] = [];
  (previous.appointments ?? []).forEach((old) => {
    const now = current.appointments.find((a) => a.id === old.id);
    if (now && (now.location !== old.location || now.cancelled !== old.cancelled)) changedIds.push(now.id);
  });
  return {
    newGrades: current.grades.filter((g) => !prevGrades.has(g.id)).map((g) => g.id),
    newAppointments: current.appointments.filter((a) => !prevAppointments.has(`${a.id}-${a.location}-${a.cancelled}`)).map((a) => a.id),
    newHomework: current.homework.filter((h) => !prevHomework.has(h.id)).map((h) => h.id),
    newMessages: current.messages.filter((m) => !prevMessages.has(m.id) && !m.read).map((m) => m.id),
    changedIds,
  };
}

export function createSnapshot(data: AppData) {
  return {
    savedAt: new Date().toISOString(),
    grades: data.grades.map((g) => ({ id: g.id })),
    appointments: data.appointments.map((a) => ({ id: a.id, location: a.location, cancelled: a.cancelled })),
    homework: data.homework.map((h) => ({ id: h.id })),
    messages: data.messages.map((m) => ({ id: m.id })),
  };
}
