import { NextRequest, NextResponse } from "next/server";
import { normalizeMagisterHost } from "@/lib/api/magister";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** De publieke client van de officiële Magister-app; geen client secret nodig. */
const CLIENT_ID = "M6LOAPP";
const REDIRECT_URI = "m6loapp://oauth2redirect/";

function nameFromIdToken(idToken?: string): string {
  if (!idToken) return "";
  try {
    const payload = idToken.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!payload) return "";
    const json = JSON.parse(atob(payload)) as { given_name?: string; family_name?: string; name?: string };
    return json.name || [json.given_name, json.family_name].filter(Boolean).join(" ") || "";
  } catch {
    return "";
  }
}

async function discoverApiBase(accessToken: string, school: string): Promise<string> {
  const fallback = school ? `https://${school}/api` : "https://magister.net/api";
  try {
    const res = await fetch("https://magister.net/.well-known/host-meta.json?rel=magister-api", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    const json = await res.json() as { links?: { href?: string }[] };
    const href = json.links?.find((link) => typeof link.href === "string")?.href;
    return href || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Wisselt de autorisatiecode van de echte Magister-login (native shell) om
 * voor tokens. PKCE voorkomt dat een onderschepte code bruikbaar is.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      code?: string;
      verifier?: string;
      school?: string;
    };
    if (!body.code?.trim() || !body.verifier?.trim()) {
      return NextResponse.json({ message: "Ontbrekende autorisatiecode of PKCE-verifier." }, { status: 400 });
    }

    let school = "";
    if (body.school?.trim()) {
      try { school = normalizeMagisterHost(body.school); } catch { school = ""; }
    }

    const form = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code: body.code.trim(),
      code_verifier: body.verifier.trim(),
      redirect_uri: REDIRECT_URI,
    });
    const res = await fetch("https://accounts.magister.net/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "MagisterPro/1.0",
        "X-Requested-With": "net.magister.iam",
      },
      body: form,
      cache: "no-store",
    });
    const text = await res.text();
    let payload: Record<string, unknown> = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { /* tekstuele fout */ }
    if (!res.ok) {
      return NextResponse.json(
        { message: String(payload.error_description ?? payload.error ?? `Magister gaf status ${res.status}.`) },
        { status: res.status }
      );
    }

    const token = String(payload.access_token ?? "");
    if (!token) {
      return NextResponse.json({ message: "Magister gaf geen access_token terug." }, { status: 502 });
    }
    const baseUrl = await discoverApiBase(token, school);
    return NextResponse.json({
      token,
      refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : "",
      expiresIn: Number(payload.expires_in ?? 3600),
      baseUrl,
      name: nameFromIdToken(typeof payload.id_token === "string" ? payload.id_token : ""),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Omwisselen van de Magister-code mislukt." },
      { status: 502 }
    );
  }
}
