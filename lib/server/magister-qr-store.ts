/* ===========================================================================
 * Tijdelijke opslag voor de QR-koppeling met de Discipulus/Magister-app.
 *
 * Productie gebruikt Vercel Blob (BLOB_READ_WRITE_TOKEN, automatisch
 * verbonden met dit project). Lokaal, zonder token, valt dit terug op een
 * in-memory Map — voldoende voor `npm run dev`/`npm start` op één proces.
 *
 * Er worden alleen kortlevende koppelingsrecords opgeslagen (5 minuten).
 * ========================================================================= */

import { del, get, put } from "@vercel/blob";

export type QrSessionStatus = "pending" | "completed" | "expired";

export interface QrSession {
  requestId: string;
  status: QrSessionStatus;
  createdAt: number;
  expiresAt: number;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  baseUrl?: string;
  name?: string;
}

const PREFIX = "magister-qr/";
const pathFor = (requestId: string) => `${PREFIX}${requestId}.json`;

const globalStore = globalThis as typeof globalThis & {
  __magisterQrSessions?: Map<string, QrSession>;
};
const memory = (globalStore.__magisterQrSessions ??= new Map<string, QrSession>());

function useBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

async function readBlob(requestId: string): Promise<QrSession | null> {
  const result = await get(pathFor(requestId), { access: "private", useCache: false });
  if (!result?.stream) return null;
  const reader = result.stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text) as QrSession;
}

export async function writeQrSession(session: QrSession): Promise<void> {
  if (useBlob()) {
    await put(pathFor(session.requestId), JSON.stringify(session), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      cacheControlMaxAge: 0,
    });
    return;
  }
  memory.set(session.requestId, session);
}

export async function readQrSession(requestId: string): Promise<QrSession | null> {
  if (useBlob()) {
    try {
      return await readBlob(requestId);
    } catch {
      return null;
    }
  }
  return memory.get(requestId) ?? null;
}

export async function deleteQrSession(requestId: string): Promise<void> {
  if (useBlob()) {
    try {
      await del(pathFor(requestId));
    } catch { /* record is al weg */ }
    return;
  }
  memory.delete(requestId);
}

export function isValidRequestId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}
