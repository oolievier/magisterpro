/* ===========================================================================
 * Zermelo Portal API v3 service (server-side).
 * Koppelingscode (12 cijfers) -> permanente access_token via OAuth.
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
      const error = (data as { message?: string; error?: string })?.message ?? (data as { error?: string })?.error;
      return { ok: false, status: res.status, error: error ?? `Zermelo gaf status ${res.status}.` };
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
  capacity?: number;
  enrolled?: number;
  choiceGroupId?: number;
}

export const zermelo = {
  testConnection: (config: ZermeloConfig) => request<{ response?: { status?: number } }>(config, "api/v3/users/~me"),

  getAppointments<T = ZermeloAppointment[]>(config: ZermeloConfig, from: number, to: number) {
    const q = new URLSearchParams({
      start: String(from),
      end: String(to),
      fields: "id,start,end,subject,subjects,teacher,teachers,locationOfBranch,locations,appointmentType,cancelled,description,capacity,enrolled,choiceGroupId",
    });
    return request<T>(config, `api/v3/appointments?${q}`);
  },

  getLiveSchedule<T = unknown>(config: ZermeloConfig) {
    return request<T>(config, "api/v3/liveschedule");
  },

  getUsers<T = unknown[]>(config: ZermeloConfig) {
    return request<T>(config, "api/v3/users");
  },

  /**
   * Inschrijven/wisselen voor een keuzeles. Zermelo publiceert hiervoor geen
   * officieel gedocumenteerd student-endpoint; de proxy forwardt het verzoek
   * naar de school-instance. Alleen beschikbaar met een echte Zermelo-token.
   */
  enroll(config: ZermeloConfig, groupId: string, optionId: string) {
    const rawGroup = groupId.replace(/^kg-/, "");
    const rawOption = optionId.replace(/^zer-/, "");
    return request(config, `api/v3/choices/${encodeURIComponent(rawGroup)}/enrollments`, {
      method: "POST",
      body: JSON.stringify({ appointmentId: Number(rawOption) }),
    });
  },

  unenroll(config: ZermeloConfig, groupId: string) {
    const rawGroup = groupId.replace(/^kg-/, "");
    return request(config, `api/v3/choices/${encodeURIComponent(rawGroup)}/enrollments/me`, { method: "DELETE" });
  },
};
