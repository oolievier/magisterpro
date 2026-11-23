export const hoursUntil = (iso: string, now = new Date()) =>
  (new Date(iso).getTime() - now.getTime()) / 3_600_000;

export const daysUntil = (iso: string, now = new Date()) =>
  Math.ceil(hoursUntil(iso, now) / 24);

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

export const weekdayShort = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-NL", { weekday: "short" }).replace(".", "");

export const relativeDeadline = (iso: string, now = new Date()) => {
  const h = hoursUntil(iso, now);
  if (h < 0) return "verlopen";
  if (h < 1) return `over ${Math.round(h * 60)} min`;
  if (h < 24) return `over ${Math.round(h)} uur`;
  const d = Math.ceil(h / 24);
  return d === 1 ? "morgen" : `over ${d} dagen`;
};

export const clockFromMinutes = (total: number) => {
  const m = Math.max(0, Math.floor(total));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const initials = (name: string) =>
  name.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
