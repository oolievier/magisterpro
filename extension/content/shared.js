/* Gedeelde helpers voor de MagisterPro-extensie (content-script isolated world). */
var MagisterProExt = (function () {
  "use strict";

  var STORAGE_KEY = "magisterpro:magister-session";
  var EVENT_NAME = "magisterpro:extension-session";
  var APP_URL = "https://magisterpro.vercel.app";
  var KEY_PREFIX = "oidc.user:";

  function decodeJwt(token) {
    try {
      var part = String(token || "").split(".")[1];
      if (!part) return {};
      part = part.replace(/-/g, "+").replace(/_/g, "/");
      while (part.length % 4) part += "=";
      return JSON.parse(
        decodeURIComponent(
          Array.prototype.map
            .call(atob(part), function (c) {
              return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join("")
        )
      );
    } catch (_) {
      return {};
    }
  }

  function expiryToMs(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 0;
    return n > 1e12 ? n : n * 1000;
  }

  function cleanSchool(value) {
    var text = String(value || "").trim().toLowerCase();
    if (!text) return "";
    text = text.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+$/.test(text)) return "";
    if (/\.magister\.(net|nl)$/.test(text)) return text;
    if (/^[a-z0-9-]+$/.test(text)) return text + ".magister.net";
    return "";
  }

  function schoolFromLocation() {
    var host = cleanSchool(location.hostname);
    // Het accountcentrum is geen school; daar komt de school uit tenant of claims.
    if (host && !/^accounts\.magister\.(net|nl)$/.test(host)) return host;
    var sources = [location.hash.replace(/^#/, ""), location.search.replace(/^\?/, "")];
    for (var i = 0; i < sources.length; i++) {
      var params = new URLSearchParams(sources[i]);
      var tenant = params.get("tenant");
      if (tenant) return cleanSchool(tenant);
      var acr = params.get("acr_values") || "";
      var match = acr.match(/tenant:([^&,\s]+)/i);
      if (match) return cleanSchool(match[1]);
    }
    return "";
  }

  /** Leest één oidc-client-user-object uit en normaliseert het. */
  function parseOidcUser(key, raw, source) {
    if (!key || key.indexOf(KEY_PREFIX) !== 0 || !raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (_) { return null; }
    var accessToken = String(parsed.access_token || parsed.accessToken || "");
    if (!accessToken) return null;

    var idToken = String(parsed.id_token || parsed.idToken || "");
    var profile = decodeJwt(idToken);
    var accessClaims = decodeJwt(accessToken);
    var claims = Object.assign({}, accessClaims, profile);
    var name = String(claims.name || "").trim();
    if (!name) {
      name = [claims.given_name, claims.family_name].filter(Boolean).join(" ").trim();
    }

    var parts = key.slice(KEY_PREFIX.length).split(":");
    var authority = parts.shift() || "";
    var clientId = parts.join(":") || "";
    var expiresAt = expiryToMs(parsed.expires_at || parsed.expiresAt);
    if (!expiresAt) {
      var expiresIn = Number(parsed.expires_in || parsed.expiresIn || 3600);
      expiresAt = Date.now() + (isFinite(expiresIn) ? expiresIn : 3600) * 1000;
    }

    return {
      accessToken: accessToken,
      refreshToken: String(parsed.refresh_token || parsed.refreshToken || ""),
      idToken: idToken,
      expiresAt: expiresAt,
      authority: authority,
      clientId: clientId,
      school: schoolFromLocation() || cleanSchool(claims.tenant || claims.school || claims.organization || ""),
      name: name,
      source: source || "magister",
      capturedAt: Date.now(),
    };
  }

  /** Scan sessionStorage én localStorage naar door oidc-client opgeslagen sessies. */
  function scanStores(source) {
    var found = [];
    [sessionStorage, localStorage].forEach(function (store) {
      try {
        for (var i = 0; i < store.length; i++) {
          var key = store.key(i);
          if (!key) continue;
          var item = parseOidcUser(key, store.getItem(key), source);
          if (item) found.push(item);
        }
      } catch (_) { /* opslag kan geblokkeerd zijn */ }
    });
    return found;
  }

  function send(messages) {
    var list = Array.isArray(messages) ? messages : [messages];
    list.forEach(function (payload) {
      if (!payload || !payload.accessToken) return;
      try {
        chrome.runtime.sendMessage({ type: "MAGISTERPRO_SESSION", payload: payload }, function () {
          void chrome.runtime.lastError;
        });
      } catch (_) { /* extensie-context kan verdwijnen bij herladen */ }
    });
  }

  /** Patch setItem zodat we de token meekrijgen op het moment dat oidc-client hem schrijft. */
  function watchSessionStorage(source) {
    var original = Storage.prototype.setItem;
    try {
      Storage.prototype.setItem = function (key, value) {
        try {
          var item = parseOidcUser(key, value, source);
          if (item) send(item);
        } catch (_) { /* nooit de site breken */ }
        return original.call(this, key, value);
      };
    } catch (_) { /* readonly prototype */ }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    EVENT_NAME: EVENT_NAME,
    APP_URL: APP_URL,
    KEY_PREFIX: KEY_PREFIX,
    decodeJwt: decodeJwt,
    cleanSchool: cleanSchool,
    schoolFromLocation: schoolFromLocation,
    parseOidcUser: parseOidcUser,
    scanStores: scanStores,
    send: send,
    watchSessionStorage: watchSessionStorage,
  };
})();
