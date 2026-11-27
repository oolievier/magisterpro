/* ===========================================================================
 * Opslag voor privé iCal-feeds. Productie gebruikt Vercel Blob (dezelfde
 * BLOB_READ_WRITE_TOKEN als de QR-koppeling); lokaal valt dit terug op een
 * in-memory Map. Er staat alleen een publiceerbare .ics in — geen tokens,
 * wachtwoorden of Magister-sessies.
 * ========================================================================= */

import { del, get, put } from "@vercel/blob";

const PREFIX = "magisterpro-calendar/";
const pathFor = (token: string) => `${PREFIX}${token}.ics`;
const TOKEN_PATTERN = /^[a-f0-9]{32,64}$/i;

export function isValidFeedToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

const globalStore = globalThis as typeof globalThis & {
  __magisterCalendarFeeds?: Map<string, string>;
};
const memory = (globalStore.__magisterCalendarFeeds ??= new Map<string, string>());

function useBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

async function readBlob(token: string): Promise<string | null> {
  const result = await get(pathFor(token), { access: "private", useCache: false });
  if (!result?.stream) return null;
  const reader = result.stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return `${text}${decoder.decode()}`;
}

export async function writeCalendarFeed(token: string, ics: string): Promise<void> {
  if (!isValidFeedToken(token)) throw new Error("Ongeldige feed-token.");
  if (useBlob()) {
    await put(pathFor(token), ics, {
      access: "private",
      contentType: "text/calendar; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return;
  }
  memory.set(token, ics);
}

export async function readCalendarFeed(token: string): Promise<string | null> {
  if (!isValidFeedToken(token)) return null;
  if (useBlob()) {
    try {
      return await readBlob(token);
    } catch {
      return null;
    }
  }
  return memory.get(token) ?? null;
}

export async function deleteCalendarFeed(token: string): Promise<void> {
  if (!isValidFeedToken(token)) return;
  if (useBlob()) {
    try {
      await del(pathFor(token));
    } catch { /* feed is al weg */ }
    return;
  }
  memory.delete(token);
}
