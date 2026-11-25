import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { writeQrSession } from "@/lib/server/magister-qr-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/** Start een QR-koppeling: de browser krijgt een requestId om te tonen/pollen. */
export async function POST() {
  try {
    const requestId = randomUUID();
    const createdAt = Date.now();
    const expiresAt = createdAt + 5 * 60 * 1000;
    await writeQrSession({ requestId, status: "pending", createdAt, expiresAt });
    return NextResponse.json({ requestId, expiresAt: new Date(expiresAt).toISOString() }, { headers });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Kon de QR-koppeling niet starten." },
      { status: 500, headers }
    );
  }
}
