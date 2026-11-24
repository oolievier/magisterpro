import { NextRequest, NextResponse } from "next/server";
import { getMagisterClientId } from "@/lib/api/magister";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function expectedRedirectUri(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_MAGISTER_REDIRECT_URI?.trim()
    || `${request.nextUrl.origin}/auth/callback`;
}

/** Wisselt een OAuth-code om voor tokens, of vernieuwt een access_token. */
export async function POST(request: NextRequest) {
  try {
    const configuredClientId = getMagisterClientId();
    if (!configuredClientId) {
      return NextResponse.json(
        { message: "NEXT_PUBLIC_MAGISTER_CLIENT_ID is niet geconfigureerd." },
        { status: 503 }
      );
    }

    const body = await request.json() as {
      grant?: "code" | "refresh";
      code?: string;
      verifier?: string;
      redirectUri?: string;
      clientId?: string;
      refreshToken?: string;
    };

    const form = new URLSearchParams({ client_id: configuredClientId });
    const clientSecret = process.env.MAGISTER_CLIENT_SECRET?.trim();
    if (clientSecret) form.set("client_secret", clientSecret);
    let fallbackRefresh = "";

    if (body.grant === "refresh") {
      if (!body.refreshToken) {
        return NextResponse.json({ message: "Geen refresh_token beschikbaar." }, { status: 400 });
      }
      form.set("grant_type", "refresh_token");
      form.set("refresh_token", body.refreshToken);
      fallbackRefresh = body.refreshToken;
    } else {
      const redirectUri = body.redirectUri?.trim() || "";
      if (!body.code || !body.verifier || !redirectUri) {
        return NextResponse.json({ message: "Ontbrekende OAuth-parameters." }, { status: 400 });
      }
      if (body.clientId && body.clientId.trim() !== configuredClientId) {
        return NextResponse.json({ message: "Onbekende Magister-client." }, { status: 400 });
      }
      if (redirectUri !== expectedRedirectUri(request)) {
        return NextResponse.json({ message: "Ongeldige redirect-URI voor deze client." }, { status: 400 });
      }
      form.set("grant_type", "authorization_code");
      form.set("code", body.code);
      form.set("code_verifier", body.verifier);
      form.set("redirect_uri", redirectUri);
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
        { message: String(payload.error_description ?? payload.error ?? `Token-endpoint gaf status ${res.status}.`) },
        { status: res.status }
      );
    }

    return NextResponse.json({
      token: payload.access_token,
      refreshToken: payload.refresh_token ?? fallbackRefresh ?? null,
      expiresIn: Number(payload.expires_in ?? 3600),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Tokenuitwisseling mislukt." },
      { status: 502 }
    );
  }
}
