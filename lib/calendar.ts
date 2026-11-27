"use client";

import { buildICS } from "@/lib/calculations/planner";
import type { Appointment, Subject, Teacher } from "@/lib/types";

/* ===========================================================================
 * Privé iCal-abonnement. De link bevat een willekeurige token; er worden geen
 * Magister-gegevens of wachtwoorden in de URL of op de server bewaard.
 * ========================================================================= */

const TOKEN_KEY = "magisterpro-calendar-token-v1";
export const CALENDAR_TOKEN_PATTERN = /^[a-f0-9]{32,64}$/i;

function newToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getCalendarToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const token = window.localStorage.getItem(TOKEN_KEY) ?? "";
    return CALENDAR_TOKEN_PATTERN.test(token) ? token : "";
  } catch {
    return "";
  }
}

/** Maakt (of hergebruikt) de privé-token op dit apparaat. */
export function ensureCalendarToken(): string {
  const existing = getCalendarToken();
  if (existing) return existing;
  const token = newToken();
  try { window.localStorage.setItem(TOKEN_KEY, token); } catch { /* privacy-mode */ }
  return token;
}

export function calendarFeedUrl(token = getCalendarToken()): string {
  if (!token || typeof window === "undefined") return "";
  return `${window.location.origin}/api/calendar/${token}.ics`;
}

/** Schrijft een rollend venster (afgelopen maand + komende 8 weken) naar de feed. */
export async function publishCalendarFeed(
  appointments: Appointment[],
  subjects: Subject[],
  teachers: Teacher[] = []
): Promise<boolean> {
  const token = getCalendarToken();
  if (!token || typeof window === "undefined") return false;
  const now = Date.now();
  const from = now - 30 * 86_400_000;
  const to = now + 56 * 86_400_000;
  const windowAppointments = appointments.filter((a) => {
    const start = new Date(a.start).getTime();
    const end = new Date(a.end).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end >= from && start <= to;
  });
  try {
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ics: buildICS(windowAppointments, subjects, teachers) }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Vervangt de token en verwijdert de oude feed direct. */
export async function rotateCalendarFeed(
  appointments: Appointment[],
  subjects: Subject[],
  teachers: Teacher[] = []
): Promise<string> {
  const previous = getCalendarToken();
  const token = newToken();
  try { window.localStorage.setItem(TOKEN_KEY, token); } catch { /* privacy-mode */ }
  if (previous && previous !== token) {
    void fetch(`/api/calendar/${previous}.ics`, { method: "DELETE", cache: "no-store" }).catch(() => undefined);
  }
  await publishCalendarFeed(appointments, subjects, teachers);
  return token;
}

/** Verwijdert de lokale token en de bijbehorende feed. */
export function revokeCalendarFeed(): void {
  const token = getCalendarToken();
  if (token) void fetch(`/api/calendar/${token}.ics`, { method: "DELETE", cache: "no-store" }).catch(() => undefined);
  try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* privacy-mode */ }
}
