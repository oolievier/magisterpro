import { NextResponse } from "next/server";
import { isValidFeedToken, writeCalendarFeed } from "@/lib/server/calendar-feed-store";

export const runtime = "nodejs";

/** Publiceert het rooster achter de privé-token (alleen bezit van de token telt). */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { token?: unknown; ics?: unknown } | null;
    const token = String(body?.token ?? "");
    const ics = String(body?.ics ?? "");
    if (!isValidFeedToken(token)) {
      return NextResponse.json({ error: "Ongeldige agenda-token." }, { status: 400 });
    }
    if (!ics.includes("BEGIN:VCALENDAR") || !ics.includes("END:VCALENDAR") || ics.length > 2_000_000) {
      return NextResponse.json({ error: "Geen geldige iCal ontvangen." }, { status: 400 });
    }
    await writeCalendarFeed(token, ics);
    return NextResponse.json({ ok: true, url: `/api/calendar/${token}.ics` }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Agenda-link kon niet worden opgeslagen." }, { status: 500 });
  }
}
