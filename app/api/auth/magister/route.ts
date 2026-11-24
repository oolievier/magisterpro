import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------------------
 * Echte Magister-schoollogin via de OIDC-authorisatie- en challenge-endpoints.
 * De school-login zelf vindt plaats bij accounts.magister.net; wij ontvangen
 * alleen het access_token. Gebruikersnaam/wachtwoord worden nooit opgeslagen.
 * ------------------------------------------------------------------------ */

const AUTHORITY = "https://accounts.magister.net";
const SCOPES = "openid profile attendance.overview calendar.user grades.read";

function normalizeHost(input: string): string {
  const raw = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const host = raw.endsWith(".magister.net") ? raw : `${raw}.magister.net`;
  if (!/^[a-z0-9-]+\.magister\.net$/.test(host)) throw new Error("Ongeldige schoolhost.");
  return host;
}

function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { school?: string; username?: string; password?: string };
    let host: string;
    try {
      host = normalizeHost(body.school ?? "");
    } catch {
      return NextResponse.json(
        { message: "Vul een geldige Magister-school in (bijv. schoolnaam.magister.net)." },
        { status: 400 }
      );
    }
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) {
      return NextResponse.json({ message: "Vul je Magister-gebruikersnaam en wachtwoord in." }, { status: 400 });
    }

    const jar = new Map<string, string>();
    const saveCookies = (res: Response) => {
      const values = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
      const single = res.headers.get("set-cookie");
      if (!values.length && single) values.push(single);
      for (const line of values) {
        const pair = line.split(";")[0];
        const index = pair.indexOf("=");
        if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    };
    const cookies = () => [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
    const decode = (value: string | null) => {
      if (!value) return "";
      try { return decodeURIComponent(value); } catch { return value; }
    };

    /** Volg redirects handmatig zodat we cookies en de callback-URL kunnen observeren. */
    const follow = async (start: string, init: RequestInit = {}) => {
      let current = start;
      const visited: string[] = [];
      for (let i = 0; i < 14; i++) {
        const res = await fetch(current, {
          ...init,
          redirect: "manual",
          headers: { ...(init.headers ?? {}), Cookie: cookies() },
          cache: "no-store",
        });
        saveCookies(res);
        visited.push(current);
        const location = res.headers.get("location");
        if (!location) return { res, visited, callbackUrl: "" };
        const next = new URL(location, current);
        if (next.pathname.endsWith("redirect_callback.html")) {
          return { res, visited, callbackUrl: next.href };
        }
        current = next.href;
        init = {};
      }
      throw new Error("Magister stuurde te veel redirects.");
    };

    const state = randomToken();
    const nonce = randomToken();
    const query = new URLSearchParams({
      client_id: `M6-${host}`,
      state,
      nonce,
      redirect_uri: `https://${host}/oidc/redirect_callback.html`,
      response_type: "id_token token",
      acr_values: `tenant:${host}`,
      scope: SCOPES,
    });

    const login = await follow(`${AUTHORITY}/connect/authorize?${query}`);
    const loginUrl = login.visited[login.visited.length - 1] ?? "";
    const sessionId = /(?:sessionId|session_id)=([a-fA-F0-9-]+)/.exec(loginUrl)?.[1];
    const returnUrl = decode(/(?:returnUrl|return_url)=([^&]+)/.exec(loginUrl)?.[1] ?? "");
    const xsrf = decode(jar.get("XSRF-TOKEN") ?? null);
    if (!sessionId || !returnUrl) {
      return NextResponse.json(
        { message: "De Magister-sessie kon niet worden gestart. Controleer de schoolhost en probeer opnieuw." },
        { status: 502 }
      );
    }

    const challenge = async (path: string, extra: Record<string, string>) => {
      const res = await fetch(`${AUTHORITY}/challenges/${path}`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": xsrf,
          Cookie: cookies(),
        },
        body: JSON.stringify({ sessionId, returnUrl, ...extra }),
        cache: "no-store",
      });
      saveCookies(res);
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try { json = text ? JSON.parse(text) : {}; } catch { /* tekst */ }
      if (!res.ok) {
        throw new Error(String(json.error ?? json.message ?? `Magister ${path}-challenge faalde (${res.status}).`));
      }
      return json;
    };

    await challenge("username", { username });
    const passwordResult = await challenge("password", { password });
    const redirect = passwordResult.redirectURL ?? passwordResult.redirectUrl;
    if (typeof redirect !== "string" || !redirect) {
      throw new Error("Magister gaf geen geldige login-redirect terug.");
    }

    const finished = await follow(new URL(redirect, AUTHORITY).href);
    const finalUrl = finished.callbackUrl || finished.res.headers.get("location") || "";
    const hash = finalUrl.includes("#") ? finalUrl.slice(finalUrl.indexOf("#") + 1) : "";
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    if (!token) {
      return NextResponse.json(
        { message: "Geen access_token ontvangen van Magister. Probeer opnieuw of controleer je schoolaccount." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      token,
      school: host,
      expiresIn: Number(params.get("expires_in") ?? 3600),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Inloggen bij Magister mislukt." },
      { status: 502 }
    );
  }
}
