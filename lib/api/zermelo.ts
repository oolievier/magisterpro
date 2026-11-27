/* ===========================================================================
 * Zermelo Portal API v3/v4 service (server-side).
 * Koppelingscode (12 cijfers) -> access_token via de eigen OAuth-route.
 * Inschrijven voor keuzelessen gebeurt via de actie-URL die Zermelo zelf in
 * liveschedule meegeeft; er is geen vast choices-endpoint (bevestigd in de
 * echte Zermelo-webclient).
 * ========================================================================= */

export interface ZermeloConfig {
  subdomain: string;
  token: string;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status: number;
}

export function normalizeZermeloSubdomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.zportal\.nl.*$/, "")
    .replace(/[^a-z0-9-]/g, "");
}

export function zermeloBase(subdomain: string): string {
  const clean = normalizeZermeloSubdomain(subdomain);
  if (!clean) throw new Error("Ongeldige Zermelo-school-subdomain.");
  return `https://${clean}.zportal.nl`;
}

async function request<T>(
  config: ZermeloConfig,
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  if (!config.token) return { ok: false, error: "Geen Zermelo access_token ingesteld.", status: 401 };
  try {
    const res = await fetch(`/api/zermelo/${path.replace(/^\/+/, "")}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-zermelo-subdomain": normalizeZermeloSubdomain(config.subdomain),
        "x-zermelo-token": config.token,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const body = (data ?? {}) as {
        message?: string; error?: string;
        response?: { message?: string; error?: string };
      };
      const error = body.message ?? body.error ?? body.response?.message ?? body.response?.error;
      const expired = res.status === 401 || /expired|verlopen|unauthorized/i.test(String(error ?? ""));
      return {
        ok: false,
        status: res.status,
        error: expired
          ? "Je Zermelo-sessie is verlopen. Maak een nieuwe koppelingscode aan via Instellingen."
          : error ?? `Zermelo gaf status ${res.status}.`,
      };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Netwerkfout." };
  }
}

export interface ZermeloTokenResponse {
  access_token?: string;
  token?: string;
  token_type?: string;
  expires_in?: number;
  expiresIn?: number;
}

/** Wisselt de 12-cijferige koppelingscode om via de eigen serverroute. */
export async function exchangeZermeloCode(
  subdomain: string,
  code: string
): Promise<ApiResult<ZermeloTokenResponse>> {
  const cleanCode = code.replace(/\D/g, "");
  const cleanSchool = normalizeZermeloSubdomain(subdomain);
  if (cleanCode.length !== 12) {
    return { ok: false, status: 400, error: "De koppelingscode moet precies 12 cijfers bevatten." };
  }
  if (!cleanSchool) return { ok: false, status: 400, error: "Vul eerst een geldige school-subdomain in." };
  try {
    const res = await fetch("/api/auth/zermelo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school: cleanSchool, code: cleanCode }),
    });
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (data as { message?: string })?.message ?? "De koppelingscode werd niet geaccepteerd.",
      };
    }
    return { ok: true, status: res.status, data: data as ZermeloTokenResponse };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Netwerkfout." };
  }
}

export interface ZermeloAppointment {
  id: number;
  /** Stabilere instantie-ID die Zermelo voor keuzelessen gebruikt. */
  appointmentInstance?: number;
  start: number;
  end: number;
  subject?: string;
  subjects?: string[];
  teacher?: string;
  teachers?: string[];
  locationOfBranch?: string;
  locations?: string[];
  appointmentType?: string;
  cancelled?: boolean;
  description?: string;
  remark?: string;
  capacity?: number;
  enrolled?: number;
  choiceGroupId?: number;
  optional?: boolean;
}

/** Actie zoals de echte webclient die tegenkomt in liveschedule. */
export interface ZermeloScheduleAction {
  code?: number;
  allowed?: boolean;
  /** Server-gegeven actie-URL; nooit zelf opbouwen. */
  post?: string;
  status?: { code?: number; nl?: string }[];
  appointment?: { appointmentInstance?: number };
}

export interface ZermeloLiveScheduleItem extends ZermeloAppointment {
  actions?: ZermeloScheduleAction[];
}

export interface ZermeloLiveSchedule {
  week?: number;
  user?: string;
  appointments?: ZermeloLiveScheduleItem[];
  replacements?: unknown[];
  status?: unknown[];
}

export interface ZermeloMe {
  code?: string;
  firstName?: string;
  lastName?: string;
  prefix?: string;
  displayName?: string;
}

const APPOINTMENT_FIELDS = [
  "id", "appointmentInstance", "start", "end", "subject", "subjects",
  "teacher", "teachers", "locationOfBranch", "locations", "appointmentType",
  "cancelled", "description", "remark", "capacity", "enrolled", "optional",
].join(",");

/** Valideert een door Zermelo geleverde actie-URL voordat we hem posten. */
export function actionPath(config: ZermeloConfig, post: string): string {
  if (!post) throw new Error("Deze Zermelo-actie heeft geen post-URL.");
  let url: URL;
  try {
    url = new URL(post, `${zermeloBase(config.subdomain)}/`);
  } catch {
    throw new Error("Ongeldige Zermelo-actie-URL.");
  }
  if (url.origin !== new URL(zermeloBase(config.subdomain)).origin) {
    throw new Error("Zermelo-actie-URL wijst naar een ander domein.");
  }
  const path = url.pathname.replace(/^\/+/, "");
  if (!/^api\/v[34]\//.test(path)) throw new Error("Zermelo-actiepad niet toegestaan.");
  return `${path}${url.search}`;
}

export const zermelo = {
  testConnection: (config: ZermeloConfig) => request<{ response?: { status?: number } }>(config, "api/v3/users/~me"),

  getMe<T = ZermeloMe>(config: ZermeloConfig) {
    return request<T>(config, "api/v3/users/~me?fields=code,firstName,lastName,prefix,displayName");
  },

  getAppointments<T = ZermeloAppointment[]>(config: ZermeloConfig, from: number, to: number) {
    const q = new URLSearchParams({ start: String(from), end: String(to), fields: APPOINTMENT_FIELDS });
    return request<T>(config, `api/v3/appointments?${q}`);
  },

  /** Liveschedule bevat de actie-URL's die de webclient gebruikt om in te schrijven. */
  getLiveScheduleForStudent(config: ZermeloConfig, studentCode: string, week: number) {
    const q = new URLSearchParams({
      student: studentCode,
      week: String(week),
      fields: "week,user,appointments,replacements,status",
    });
    return request<ZermeloLiveSchedule>(config, `api/v3/liveschedule?${q}`);
  },

  getUsers<T = unknown[]>(config: ZermeloConfig) {
    return request<T>(config, "api/v3/users");
  },

  /** POST naar de actie-URL van Zermelo, met lege body — ook voor uitschrijven. */
  postScheduleAction(config: ZermeloConfig, post: string) {
    let path: string;
    try { path = actionPath(config, post); }
    catch (e) { return Promise.resolve({ ok: false, status: 400, error: e instanceof Error ? e.message : "Ongeldige actie." }); }
    return request(config, path, { method: "POST", body: "" });
  },
};

/** Zoekt de actie bij een appointmentInstance (of indirect via action.appointment). */
export function findChoiceAction(
  schedule: ZermeloLiveSchedule | null | undefined,
  instance: number | string,
  preferredCodes: number[] = []
): ZermeloScheduleAction | undefined {
  if (!schedule?.appointments) return undefined;
  const item = schedule.appointments.find((a) =>
    Number(a.appointmentInstance ?? a.id) === Number(instance)
    || a.actions?.some((action) => Number(action.appointment?.appointmentInstance) === Number(instance))
  );
  const actions = (item?.actions ?? []).filter((a) => Boolean(a.post) && a.allowed !== false);
  if (!actions.length) return undefined;
  for (const code of preferredCodes) {
    const match = actions.find((a) => a.code === code || a.status?.some((s) => s.code === code));
    if (match) return match;
  }
  return actions.find((a) => a.allowed === true) ?? actions[0];
}
