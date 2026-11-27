"use client";

/** Waar of de MagisterPro-browserextensie op deze pagina actief is. */
export function extensionActive(): boolean {
  return typeof document !== "undefined"
    && document.documentElement.getAttribute("data-magisterpro-extension") === "app";
}

/**
 * Wisselt met één klik naar de echte Magister-site.
 * Met de extensie openen we/focusen we een tab via de service worker; zonder
 * extensie is er altijd een veilige fallback naar accounts.magister.net.
 */
export function openMagister(school?: string): void {
  const raw = String(school ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const host = /^[a-z0-9-]+\.magister\.(net|nl)$/.test(raw)
    ? raw
    : /^[a-z0-9-]+$/.test(raw)
      ? `${raw}.magister.net`
      : "";
  const fallback = host ? `https://${host}/` : "https://accounts.magister.net/";

  if (extensionActive()) {
    window.dispatchEvent(new CustomEvent("magisterpro:open-magister", { detail: { school: host } }));
    return;
  }
  window.open(fallback, "_blank", "noopener,noreferrer");
}
