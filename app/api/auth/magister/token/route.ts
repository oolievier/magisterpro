import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Wisselt een OAuth-code om voor tokens, of vernieuwt een access_token. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      grant?: "code" | "refresh";
      code?: string;
      verifier?: string;
      redirectUri?: string;
      clientId?: string;
      refreshToken?: string;
    };
    const clientId = body.clientId?.trim() || "M6LOAPP";
    const form = new URLSearchParams({ client_id: clientId });
    let expiresIn = 3600;

    if (body.grant === "refresh") {
      if (!body.refreshToken) {
        return NextResponse.json({ message: "Geen refresh_token beschikbaar." }, { status: 400 });
      }
      form.set("grant_type", "refresh_token");
      form.set("refresh_token", body.refreshToken);
    } else {
      if (!body.code || !body.verifier || !body.redirectUri) {
        return NextResponse.json({ message: "Ontbrekende OAuth-parameters." }, { status: 400 });
      }
      form.set("grant_type", "authorization_code");
      form.set("code", body.code);
      form.set("code_verifier", body.verifier);
      form.set("redirect_uri", body.redirectUri);
    }

    const res = await fetch("https://accounts.magister.net/connect/token", {
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
        { message: payload.error_description ?? payload.error ?? `Token-endpoint gaf status ${res.status}.` },
        { status: res.status }
      );
    }
    expiresIn = Number(payload.expires_in ?? expiresIn);
    return NextResponse.json({
      token: payload.access_token,
      refreshToken: payload.refresh_token ?? body.refreshToken ?? null,
      expiresIn,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Tokenuitwisseling mislukt." },
      { status: 502 }
    );
  }
}
