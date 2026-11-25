import { NextRequest, NextResponse } from "next/server";
import { isValidRequestId, readQrSession, writeQrSession } from "@/lib/server/magister-qr-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Ontvangt de tokens vanuit de Discipulus/Magister-app na het scannen van de QR.
 * CORS is bewust open: dit is hetzelfde contract als de publieke auth-gateway.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const requestId = String(body.requestId ?? body.request_id ?? body.id ?? "").trim();

    if (!isValidRequestId(requestId)) {
      return NextResponse.json({ error: "Ongeldige requestId." }, { status: 400, headers: corsHeaders });
    }

    const session = await readQrSession(requestId);
    if (!session) {
      return NextResponse.json({ error: "QR-verzoek niet gevonden." }, { status: 404, headers: corsHeaders });
    }
    if (session.status !== "pending" || Date.now() > session.expiresAt) {
      return NextResponse.json({ error: "QR-verzoek is verlopen of al gebruikt." }, { status: 403, headers: corsHeaders });
    }

    const tokenSet = (body.tokenSet ?? body.token_set ?? {}) as Record<string, unknown>;
    const accessToken = String(
      body.accessToken ?? body.access_token ?? body.token ?? tokenSet.access_token ?? tokenSet.accessToken ?? ""
    ).trim();
    const refreshToken = String(
      body.refreshToken ?? body.refresh_token ?? tokenSet.refresh_token ?? tokenSet.refreshToken ?? ""
    ).trim();
    const baseUrl = String(body.baseUrl ?? body.base_url ?? body.tenantUrl ?? "").trim();
    const name = String(body.name ?? "").trim();

    const expiresRaw = body.expires_in ?? body.expiresIn ?? tokenSet.expires_in ?? tokenSet.expiresIn;
    const expiresAtRaw = body.expires_at ?? body.expiresAt ?? tokenSet.expires_at ?? tokenSet.expiresAt;
    const expiresIn = Number(expiresRaw);
    const expiresAtSeconds = Number(expiresAtRaw);
    const tokenExpiresAt = Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0
      ? expiresAtSeconds * 1000
      : Number.isFinite(expiresIn) && expiresIn > 0
        ? Date.now() + expiresIn * 1000
        : Date.now() + 3600 * 1000;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Geen access_token ontvangen van de app." },
        { status: 400, headers: corsHeaders }
      );
    }

    await writeQrSession({
      ...session,
      status: "completed",
      accessToken,
      refreshToken,
      tokenExpiresAt,
      baseUrl,
      name,
    });

    return NextResponse.json(
      { message: "Magister gekoppeld.", requestId },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Koppeling mislukt." },
      { status: 500, headers: corsHeaders }
    );
  }
}
