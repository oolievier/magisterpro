import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zet de 12-cijferige Zermelo-koppelingscode om voor een access_token. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { school?: string; code?: string };
    const school = String(body.school ?? "")
      .trim().toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.zportal\.nl.*$/, "")
      .replace(/[^a-z0-9-]/g, "");
    const code = String(body.code ?? "").replace(/\D/g, "");
    if (!/^[a-z0-9-]+$/.test(school)) {
      return NextResponse.json({ message: "Vul een geldige Zermelo-school in." }, { status: 400 });
    }
    if (code.length !== 12) {
      return NextResponse.json({ message: "De koppelingscode moet precies 12 cijfers bevatten." }, { status: 400 });
    }

    // Zermelo verwacht de koppelingscode als query-parameter op
    // /api/v3/oauth/token (POST zonder body), niet als form-body op /oauth/token.
    const tokenUrl = new URL(`https://${school}.zportal.nl/api/v3/oauth/token`);
    tokenUrl.searchParams.set("grant_type", "authorization_code");
    tokenUrl.searchParams.set("code", code);
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": "MagisterPro/1.0",
      },
      cache: "no-store",
    });
    const text = await res.text();
    let payload: Record<string, unknown> = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { /* tekst */ }
    if (!res.ok) {
      const nested = (payload.response ?? {}) as Record<string, unknown>;
      const raw = String(
        payload.error_description ?? payload.message ?? payload.error
        ?? nested.message ?? nested.details ?? `Zermelo gaf status ${res.status}.`
      );
      const message = /expired|verlopen/i.test(raw)
        ? "Deze koppelingscode is verlopen. Maak een nieuwe code aan in de Zermelo-portal en probeer het direct opnieuw."
        : raw;
      return NextResponse.json({ message }, { status: res.status });
    }
    if (typeof payload.access_token !== "string") {
      return NextResponse.json({ message: "Zermelo gaf geen access_token terug." }, { status: 502 });
    }
    return NextResponse.json({
      access_token: payload.access_token,
      token: payload.access_token,
      expiresIn: Number(payload.expires_in ?? 0),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Koppelen met Zermelo mislukt." },
      { status: 502 }
    );
  }
}
