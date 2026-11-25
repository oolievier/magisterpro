/* ===========================================================================
 * Brug tussen de webapp en de native MagisterPro-shell (Electron / Capacitor).
 *
 * De native shell opent de échte Magister-loginpagina en vangt de
 * m6loapp://oauth2redirect/ omleiding op. De webapp ziet nooit een wachtwoord
 * en heeft geen geregistreerde OAuth-client of companion-app nodig.
 * ========================================================================= */

import type { PluginListenerHandle } from "@capacitor/core";

export const MAGISTER_CLIENT_ID = "M6LOAPP";
export const MAGISTER_REDIRECT_URI = "m6loapp://oauth2redirect/";
export const MAGISTER_AUTHORIZE_URL = "https://accounts.magister.net/connect/authorize";
export const MAGISTER_NATIVE_STORAGE_KEY = "magisterpro-native-oauth";

export interface MagisterAuthResult {
  code: string;
  state: string;
  idToken?: string;
  error?: string;
}

interface ElectronNativeApi {
  platform: "electron";
  openAuth: (url: string) => Promise<void>;
  onAuth: (cb: (result: MagisterAuthResult) => void) => () => void;
}

type NativeWindow = Window & {
  magisterProNative?: ElectronNativeApi;
  __MAGISTERPRO_NATIVE__?: boolean;
};

interface Bridge {
  platform: "electron" | "capacitor";
  openAuth: (url: string) => Promise<void>;
  onAuth: (cb: (result: MagisterAuthResult) => void) => () => void;
}

function parseCallback(raw: string): MagisterAuthResult | null {
  try {
    const isCallback = raw.startsWith(MAGISTER_REDIRECT_URI)
      || raw.startsWith("https://discipulus.harrydekat.dev/login");
    if (!isCallback) return null;
    const hashIndex = raw.indexOf("#");
    const query = hashIndex >= 0 ? raw.slice(hashIndex + 1) : (raw.split("?")[1] ?? "");
    const params = new URLSearchParams(query);
    const code = params.get("code") ?? "";
    const error = params.get("error") ?? "";
    if (!code && !error) return null;
    return {
      code,
      state: params.get("state") ?? "",
      idToken: params.get("id_token") ?? "",
      error,
    };
  } catch {
    return null;
  }
}

function electronBridge(api: ElectronNativeApi): Bridge {
  return {
    platform: "electron",
    openAuth: (url) => api.openAuth(url),
    onAuth: (cb) => api.onAuth((result) => {
      const parsed = result && typeof result === "object" ? result : null;
      if (parsed) cb(parsed);
    }),
  };
}

async function capacitorBridge(): Promise<Bridge> {
  const [{ App }, { Browser }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/browser"),
  ]);
  return {
    platform: "capacitor",
    openAuth: async (url) => { await Browser.open({ url }); },
    onAuth: (cb) => {
      let handle: PluginListenerHandle | null = null;
      void App.addListener("appUrlOpen", (event: { url: string }) => {
        const parsed = parseCallback(event.url);
        if (parsed) {
          void Browser.close().catch(() => undefined);
          cb(parsed);
        }
      }).then((h) => { handle = h; });
      return () => { void handle?.remove(); };
    },
  };
}

/** Geeft de native brug terug, of null wanneer de app in een browser draait. */
export async function getNativeBridge(): Promise<Bridge | null> {
  if (typeof window === "undefined") return null;
  const win = window as NativeWindow;
  if (win.magisterProNative?.platform === "electron") return electronBridge(win.magisterProNative);

  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) return capacitorBridge();
  return null;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function createRandomState(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

/** Bouwt de officiële Magister-authorize-URL met PKCE en de m6loapp-redirect. */
export async function buildMagisterAuthorizeUrl(school: string) {
  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const state = createRandomState();
  const nonce = createRandomState();
  const params = new URLSearchParams({
    client_id: MAGISTER_CLIENT_ID,
    redirect_uri: MAGISTER_REDIRECT_URI,
    response_type: "code id_token",
    scope: "openid profile offline_access",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (school.trim()) params.set("acr_values", `tenant:${school.trim().toLowerCase()}`);
  return { url: `${MAGISTER_AUTHORIZE_URL}?${params.toString()}`, verifier, state, nonce };
}
