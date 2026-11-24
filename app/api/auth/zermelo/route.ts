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

    const form = new URLSearchParams({ grant_type: "authorization_code", code });
    const res = await fetch(`https://${school}.zportal.nl/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "MagisterPro/1.0",
      },
      body: form,
      cache: "no-store",
    });
    const text = await res.text();
    let payload: Record<string, unknown> = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { /* tekst */ }
    if (!res.ok) {
      return NextResponse.json(
        { message: payload.error_description ?? payload.message ?? payload.error ?? `Zermelo gaf status ${res.status}.` },
        { status: res.status }
      );
    }
    if (typeof payload.access_token !== "string") {
      return NextResponse.json({ message: "Zermelo gaf geen access_token terug." }, { status: 502 });
    }
    return NextResponse.json({ token: payload.access_token, expiresIn: Number(payload.expires_in ?? 0) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Koppelen met Zermelo mislukt." },
      { status: 502 }
    );
  }
}
