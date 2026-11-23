/* ===========================================================================
 * Magister API v6 service (server-side).
 * Gebruikt altijd de Next.js proxy /api/magister/[...path] om CORS te omzeilen.
 * ========================================================================= */

export interface MagisterConfig {
  subdomain: string;
  token: string;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status: number;
}

export function normalizeSubdomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.magister\.net.*$/, "")
    .replace(/[^a-z0-9-]/g, "");
}

export function magisterBase(subdomain: string): string {
  const clean = normalizeSubdomain(subdomain);
  if (!clean) throw new Error("Ongeldige school-subdomain.");
  return `https://${clean}.magister.net`;
}

async function request<T>(
  config: MagisterConfig,
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  if (!config.token) return { ok: false, error: "Geen Magister Bearer token ingesteld.", status: 401 };
  try {
    const url = `/api/magister/${path.replace(/^\/+/, "")}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-magister-subdomain": normalizeSubdomain(config.subdomain),
        "x-magister-token": config.token,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      return { ok: false, status: res.status, error: (data as { message?: string })?.message ?? `Magister gaf status ${res.status}.` };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Netwerkfout." };
  }
}

export interface MagisterPerson { Id: number; Roepnaam: string; Achternaam: string; Klas?: string }

export const magister = {
  testConnection: (config: MagisterConfig) => request<MagisterPerson[]>(config, "api/personen"),

  async getPerson(config: MagisterConfig): Promise<ApiResult<MagisterPerson>> {
    const res = await request<MagisterPerson[]>(config, "api/personen/me");
    if (!res.ok) return { ok: false, error: res.error, status: res.status };
    const person = Array.isArray(res.data) ? res.data[0] : res.data;
    return { ok: true, data: person, status: res.status };
  },

  getAppointments<T = unknown[]>(config: MagisterConfig, personId: number | string, from: string, to: string) {
    const q = new URLSearchParams({ van: from, tot: to });
    return request<T>(config, `api/personen/${personId}/afspraken?${q}`);
  },

  getGradeOverview<T = unknown>(config: MagisterConfig, personId: number | string) {
    return request<T>(config, `api/personen/${personId}/cijfers/cijferoverzichtvooraanmelding`);
  },

  getGradeColumns<T = unknown[]>(config: MagisterConfig, personId: number | string) {
    return request<T>(config, `api/personen/${personId}/cijfers/cijferkolommen`);
  },

  getStudyGuides<T = unknown[]>(config: MagisterConfig, personId: number | string) {
    return request<T>(config, `api/personen/${personId}/studiewijzers`);
  },

  getAssignments<T = unknown[]>(config: MagisterConfig, personId: number | string) {
    return request<T>(config, `api/personen/${personId}/opdrachten`);
  },

  getMessages<T = unknown[]>(config: MagisterConfig, personId: number | string) {
    return request<T>(config, `api/personen/${personId}/berichten`);
  },

  sendMessage(config: MagisterConfig, personId: number | string, body: unknown) {
    return request(config, `api/personen/${personId}/berichten`, { method: "POST", body: JSON.stringify(body) });
  },

  getAbsences<T = unknown[]>(config: MagisterConfig, personId: number | string) {
    return request<T>(config, `api/personen/${personId}/absenties`);
  },
};

/* ---------------------------------------------------------------------------
 * OAuth2 PKCE-hulp (voor de "Live" koppeling).
 * ------------------------------------------------------------------------- */
export function createPkceVerifier(length = 64): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function magisterAuthUrl(subdomain: string, clientId: string, redirectUri: string, verifier: string, challenge: string) {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: verifier,
  });
  return `${magisterBase(subdomain)}/oauth2/authorize?${q}`;
}
