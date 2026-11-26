import { NextRequest, NextResponse } from "next/server";
import { getMagisterClientId } from "@/lib/api/magister";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function expectedRedirectUri(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_MAGISTER_REDIRECT_URI?.trim()
    || `${request.nextUrl.origin}/auth/callback`;
}

/**
 * Vernieuwt een Magister-token (QR-koppeling) of wisselt een OAuth-code om
 * voor een geregistreerde webclient.
 */
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

    const form = new URLSearchParams();
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "MagisterPro/1.0",
    };
    let fallbackRefresh = "";

    if (body.grant === "refresh") {
      if (!body.refreshToken) {
        return NextResponse.json({ message: "Geen refresh_token beschikbaar." }, { status: 400 });
      }
      // De QR-koppeling gebruikt dezelfde publieke client als de companion-app.
      form.set("client_id", body.clientId?.trim() || "iam-profile");
      form.set("grant_type", "refresh_token");
      form.set("refresh_token", body.refreshToken);
      headers["X-Requested-With"] = "net.magister.iam";
      fallbackRefresh = body.refreshToken;
    } else {
      const configuredClientId = getMagisterClientId();
      if (!configuredClientId) {
        return NextResponse.json(
          { message: "NEXT_PUBLIC_MAGISTER_CLIENT_ID is niet geconfigureerd." },
          { status: 503 }
        );
      }
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
      form.set("client_id", configuredClientId);
      const clientSecret = process.env.MAGISTER_CLIENT_SECRET?.trim();
      if (clientSecret) form.set("client_secret", clientSecret);
      form.set("grant_type", "authorization_code");
      form.set("code", body.code);
      form.set("code_verifier", body.verifier);
      form.set("redirect_uri", redirectUri);
    }

    const res = await fetch("https://accounts.magister.net/connect/token", {
      method: "POST",
      headers,
      body: form,
      cache: "no-store",
    });
    const text = await res.text();
    let payload: Record<string, unknown> = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { /* tekst */ }
    if (!res.ok) {
      const raw = String(payload.error_description ?? payload.error ?? `Token-endpoint gaf status ${res.status}.`);
      const message = /invalid_grant/i.test(raw)
        ? "Je Magister-sessie is verlopen. Log opnieuw in via de echte Magister-pagina."
        : raw;
      return NextResponse.json({ message }, { status: res.status });
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
