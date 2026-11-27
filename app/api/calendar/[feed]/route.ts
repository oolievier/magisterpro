import { NextResponse } from "next/server";
import { deleteCalendarFeed, isValidFeedToken, readCalendarFeed } from "@/lib/server/calendar-feed-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ feed: string }> };

function tokenFrom(feed: string): string {
  const token = decodeURIComponent(feed).replace(/\.ics$/i, "");
  return isValidFeedToken(token) ? token : "";
}

const notFound = (message: string) => new NextResponse(message, {
  status: 404,
  headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
});

/** Leest de privé-feed. Kalenderapps abonneren zich op exact deze URL. */
export async function GET(_request: Request, { params }: RouteContext) {
  const token = tokenFrom((await params).feed);
  if (!token) return notFound("Onbekende agenda-link.");
  const ics = await readCalendarFeed(token);
  if (!ics) return notFound("Deze agenda-link is niet (meer) beschikbaar. Maak een nieuwe link in MagisterPro.");
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="magisterpro-rooster.ics"',
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

/** Intrekt een link (bij roteren of verwijderen in Instellingen). */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const token = tokenFrom((await params).feed);
  if (!token) return notFound("Onbekende agenda-link.");
  await deleteCalendarFeed(token);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
