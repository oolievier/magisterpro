import { NextRequest, NextResponse } from "next/server";
import {
  deleteQrSession, isValidRequestId, readQrSession, writeQrSession,
} from "@/lib/server/magister-qr-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ requestId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { requestId } = await params;
  if (!isValidRequestId(requestId)) {
    return NextResponse.json({ status: "not_found" }, { status: 404, headers });
  }

  const session = await readQrSession(requestId);
  if (!session) return NextResponse.json({ status: "not_found" }, { status: 404, headers });

  if (Date.now() > session.expiresAt && session.status === "pending") {
    await writeQrSession({ ...session, status: "expired" });
    return NextResponse.json({ status: "expired" }, { headers });
  }

  if (session.status === "completed" && session.accessToken) {
    return NextResponse.json({
      status: "completed",
      accessToken: session.accessToken,
      refreshToken: session.refreshToken ?? "",
      expiresAt: session.tokenExpiresAt ?? 0,
      baseUrl: session.baseUrl ?? "",
      name: session.name ?? "",
    }, { headers });
  }

  return NextResponse.json({ status: session.status }, { headers });
}

/** Ruimt een afgerond of verlopen koppelingsrecord op. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { requestId } = await params;
  if (isValidRequestId(requestId)) await deleteQrSession(requestId);
  return NextResponse.json({ ok: true }, { headers });
}
