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
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/**
 * Wisselt de 12-cijferige koppelingscode om voor een permanent access_token.
 * Probeert eerst het officiële v3-tokenendpoint, daarna de kortere variant.
 */
export async function exchangeZermeloCode(
  subdomain: string,
  code: string
): Promise<ApiResult<ZermeloTokenResponse>> {
  const cleanCode = code.replace(/\D/g, "");
  if (cleanCode.length !== 12) {
    return { ok: false, status: 400, error: "De koppelingscode moet precies 12 cijfers bevatten." };
  }
  const cleanSchool = normalizeZermeloSubdomain(subdomain);
  if (!cleanSchool) return { ok: false, status: 400, error: "Vul eerst een geldige school-subdomain in." };

  for (const path of ["api/v3/oauth/token", "oauth/token"]) {
    try {
      const res = await fetch("/api/zermelo/" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-zermelo-subdomain": cleanSchool,
          "x-zermelo-token": "",
        },
        body: JSON.stringify({ code: cleanCode }),
      });
      const text = await res.text();
      let data: unknown = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (res.ok && data && typeof data === "object" && "access_token" in data) {
        return { ok: true, status: res.status, data: data as ZermeloTokenResponse };
      }
      if (res.status !== 404) {
        return {
          ok: false,
          status: res.status,
          error: (data as { message?: string })?.message ?? "De koppelingscode werd niet geaccepteerd.",
        };
      }
    } catch (e) {
      return { ok: false, status: 0, error: e instanceof Error ? e.message : "Netwerkfout." };
    }
  }
  return { ok: false, status: 404, error: "Kon het Zermelo token-endpoint niet bereiken." };
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
   * officieel documenteerd student-endpoint; we sturen een genormaliseerd
   * verzoek naar de proxy die het naar de school-instance forwardt. In demo-
   * modus wordt dit volledig lokaal afgehandeld.
   */
  enroll(config: ZermeloConfig, groupId: string, optionId: string) {
    return request(config, `api/v3/choices/${groupId}/enrollments`, {
      method: "POST",
      body: JSON.stringify({ appointmentId: Number(optionId) }),
    });
  },

  unenroll(config: ZermeloConfig, groupId: string) {
    return request(config, `api/v3/choices/${groupId}/enrollments/me`, { method: "DELETE" });
  },
};
