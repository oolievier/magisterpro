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
      const body = (data ?? {}) as {
        message?: string; omschrijving?: string; error_description?: string; error?: string;
      };
      const msg = body.message
        ?? body.omschrijving
        ?? body.error_description
        ?? body.error
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

  /** Volledige vaknamen bij de aanmelding van de leerling. */
  getEnrollmentSubjects<T = unknown[]>(config: MagisterConfig, personId: number | string, enrollmentId: number | string) {
    return request<T>(config, `api/personen/${personId}/aanmeldingen/${enrollmentId}/vakken`);
  },

  /** Zoekt docenten op naam/docentcode op, inclusief volledige achternaam. */
  getContacts<T = unknown[]>(config: MagisterConfig, personId: number | string, query: string) {
    const params = new URLSearchParams({ contactPersoonType: "Personeel", q: query });
    return request<T>(config, `api/personen/${personId}/contactpersonen?${params}`);
  },

  getActivities<T = unknown[]>(config: MagisterConfig, personId: number | string) {
    return request<T>(config, `api/personen/${personId}/activiteiten`);
  },

  getActivityElements<T = unknown[]>(config: MagisterConfig, personId: number | string, activityId: number | string) {
    return request<T>(config, `api/personen/${personId}/activiteiten/${activityId}/onderdelen`);
  },

  enrollActivity(config: MagisterConfig, personId: number | string, activityId: number | string, elementId: number | string) {
    return request(config, `api/personen/${personId}/activiteiten/${activityId}/onderdelen/${elementId}/inschrijvingen`, {
      method: "POST",
      body: JSON.stringify({
        persoonId: Number(personId),
        activiteitId: Number(activityId),
        onderdeelId: Number(elementId),
      }),
    });
  },

  unenrollActivity(config: MagisterConfig, personId: number | string, activityId: number | string, elementId: number | string) {
    return request(config, `api/personen/${personId}/activiteiten/${activityId}/onderdelen/${elementId}/inschrijvingen`, {
      method: "DELETE",
    });
  },
};

/** Downloadt een echte Magister-bijlage met de sessieheaders van de proxy. */
export async function downloadMagisterFile(config: MagisterConfig, apiPath: string, filename: string): Promise<void> {
  const clean = apiPath.replace(/^\/+/, "");
  if (!/^api\//.test(clean)) throw new Error("Geen geldige Magister-link voor deze bijlage.");
  const res = await fetch(`/api/magister/${clean}`, {
    headers: {
      "x-magister-subdomain": normalizeMagisterHost(config.subdomain),
      "x-magister-token": config.token,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Magister gaf status ${res.status} bij het downloaden.`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------------------
 * OAuth2/PKCE voor een eigen, bij Magister geregistreerde webclient.
 *
 * De leerling logt in op accounts.magister.net. MagisterPro ziet nooit een
 * wachtwoord: de autorisatiecode komt terug op onze HTTPS-callback en wordt
 * daar server-side omgewisseld voor een access_token + refresh_token.
 *
 * Instellen met omgevingsvariabelen (zie .env.example):
 *   NEXT_PUBLIC_MAGISTER_CLIENT_ID    verplicht
 *   NEXT_PUBLIC_MAGISTER_REDIRECT_URI optioneel, standaard {origin}/auth/callback
 *   NEXT_PUBLIC_MAGISTER_SCOPES       optioneel
 *   NEXT_PUBLIC_MAGISTER_RESPONSE_TYPE optioneel, standaard "code"
 * ------------------------------------------------------------------------- */
export const MAGISTER_AUTH_STORAGE_KEY = "magisterpro-oauth";

export function getMagisterClientId(): string {
  return process.env.NEXT_PUBLIC_MAGISTER_CLIENT_ID?.trim() || "";
}

export function getMagisterRedirectUri(): string {
  const configured = process.env.NEXT_PUBLIC_MAGISTER_REDIRECT_URI?.trim();
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/callback`;
}

export function getMagisterScopes(): string {
  return process.env.NEXT_PUBLIC_MAGISTER_SCOPES?.trim()
    || "openid profile offline_access attendance.overview calendar.user grades.read";
}

export function getMagisterResponseType(): string {
  return process.env.NEXT_PUBLIC_MAGISTER_RESPONSE_TYPE?.trim() || "code";
}

export function isMagisterOAuthConfigured(): boolean {
  return getMagisterClientId().length > 0;
}

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
  verifier: string;
  challenge: string;
  state: string;
  nonce: string;
  school?: string;
  clientId: string;
  redirectUri: string;
}

export function magisterAuthUrl(opts: MagisterAuthOptions): string {
  const q = new URLSearchParams({
    response_type: getMagisterResponseType(),
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: getMagisterScopes(),
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    state: opts.state,
    nonce: opts.nonce,
    prompt: "select_account",
  });
  if (opts.school) q.set("acr_values", `tenant:${normalizeMagisterHost(opts.school)}`);
  return `https://accounts.magister.net/connect/authorize?${q}`;
}
