/* ===========================================================================
 * Magister API v6 service.
 * Alle calls gaan via de server-side proxy /api/magister/[...path] (CORS).
 * ========================================================================= */

export interface MagisterConfig {
  subdomain: string; // school-host of subdomain
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
    .replace(/\/.*$/, "")
    .replace(/\.magister\.net.*$/, "")
    .replace(/[^a-z0-9-]/g, "");
}

/** Accepteert zowel "school" als "https://school.magister.net". */
export function normalizeMagisterHost(input: string): string {
  const clean = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const host = clean.endsWith(".magister.net") ? clean : `${normalizeSubdomain(clean)}.magister.net`;
  if (!/^[a-z0-9-]+\.magister\.net$/.test(host)) throw new Error("Vul een geldige Magister-school in (bijv. schoolnaam.magister.net).");
  return host;
}

async function request<T>(
  config: MagisterConfig,
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  if (!config.token) return { ok: false, error: "Geen Magister access_token beschikbaar.", status: 401 };
  try {
    const url = `/api/magister/${path.replace(/^\/+/, "")}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-magister-subdomain": normalizeMagisterHost(config.subdomain),
        "x-magister-token": config.token,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data as { message?: string; omschrijving?: string })?.message
        ?? (data as { omschrijving?: string })?.omschrijving
        ?? `Magister gaf status ${res.status}.`;
      return { ok: false, status: res.status, error: msg };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Netwerkfout." };
  }
}

export interface MagisterPerson {
  Id: number;
  Roepnaam?: string;
  Achternaam?: string;
  Klas?: string;
}

export interface MagisterAccount {
  Persoon?: MagisterPerson;
  Groep?: { Naam?: string; Omschrijving?: string }[];
  [key: string]: unknown;
}

export interface MagisterEnrollment {
  id: number;
  isHoofdAanmelding?: boolean;
  Vakken?: { Naam?: string; Omschrijving?: string; Afkorting?: string }[];
  [key: string]: unknown;
}

export interface MagisterGrade {
  waarde?: number | string;
  CijferStr?: string;
  DatumIngevoerd?: string;
  omschrijving?: string;
  kolom?: {
    naam?: string;
    omschrijving?: string;
    weegfactor?: number;
    type?: string;
    code?: string;
    Code?: string;
  };
  CijferKolom?: { Id?: number; KolomOmschrijving?: string; Weging?: number; IsPTAKolom?: boolean };
  [key: string]: unknown;
}

export const magister = {
  testConnection: (config: MagisterConfig) => request<MagisterPerson[]>(config, "api/personen"),

  getAccount(config: MagisterConfig) {
    return request<MagisterAccount>(config, "api/account");
  },

  async getPerson(config: MagisterConfig): Promise<ApiResult<MagisterPerson>> {
    const res = await request<MagisterPerson[]>(config, "api/personen/me");
    if (!res.ok) return { ok: false, error: res.error, status: res.status };
    const person = Array.isArray(res.data) ? res.data[0] : res.data;
    return { ok: true, data: person, status: res.status };
  },

  getEnrollments(config: MagisterConfig, personId: number | string) {
    return request<{ items?: MagisterEnrollment[] }>(config, `api/leerlingen/${personId}/aanmeldingen`);
  },

  getGrades(config: MagisterConfig, enrollmentId: number | string, top = 250) {
    return request<{ items?: MagisterGrade[] }>(config, `api/aanmeldingen/${enrollmentId}/cijfers?top=${top}`);
  },

  getAppointments<T = unknown[]>(config: MagisterConfig, personId: number | string, from: string, to: string) {
    const q = new URLSearchParams({ van: from, tot: to });
    return request<T>(config, `api/personen/${personId}/afspraken?${q}`);
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

  getMessages<T = unknown[]>(config: MagisterConfig, top = 50) {
    return request<T>(config, `api/berichten/postvakin/berichten?top=${top}&skip=0`);
  },

  getMessageDetail<T = unknown>(config: MagisterConfig, id: number | string) {
    return request<T>(config, `api/berichten/berichten/${id}`);
  },

  sendMessage(config: MagisterConfig, body: unknown) {
    return request(config, `api/berichten/berichten`, { method: "POST", body: JSON.stringify(body) });
  },

  getAbsences<T = unknown[]>(config: MagisterConfig, personId: number | string, from: string, to: string) {
    const q = new URLSearchParams({ van: from, tot: to });
    return request<T>(config, `api/personen/${personId}/absenties?${q}`);
  },
};

/* ---------------------------------------------------------------------------
 * OAuth2 PKCE-hulp voor een door de school geregistreerde webclient.
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

export interface MagisterAuthOptions {
  clientId: string;
  redirectUri: string;
  verifier: string;
  challenge: string;
  state: string;
  nonce: string;
  school?: string;
}

export function magisterAuthUrl(opts: MagisterAuthOptions): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: "openid profile offline_access magister.mobile magister.ecs",
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    state: opts.state,
    nonce: opts.nonce,
    prompt: "select_account",
  });
  if (opts.school) q.set("acr_values", `tenant:${normalizeMagisterHost(opts.school)}`);
  return `https://accounts.magister.net/connect/authorize?${q}`;
}
