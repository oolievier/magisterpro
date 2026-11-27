/* Service worker: bewaart de laatste echte Magister-sessie en geeft hem door aan onze webapp. */
"use strict";

var STORAGE_KEY = "magisterpro:magister-session";
var APP_ORIGIN_KEY = "magisterpro:app-origin";
var APP_URL = "https://magisterpro.vercel.app";
var APP_MATCHES = [
  "https://magisterpro.vercel.app/*",
  "http://localhost:3000/*",
  "http://127.0.0.1:3000/*",
];
var MAGISTER_MATCHES = [
  "https://accounts.magister.net/*",
  "https://*.magister.net/*",
  "https://*.magister.nl/*",
];
var ACCOUNTS_URL = "https://accounts.magister.net/";

/** Accepteert alleen een kale, whitelisted Magister-host uit de webpagina. */
function cleanMagisterHost(value) {
  var host = String(value || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return /^[a-z0-9-]+\.magister\.(net|nl)$/.test(host) ? host : "";
}

/** Focus een bestaande app-tab en navigeer hem naar het gevraagde pad. */
async function focusOrOpenApp(url) {
  try {
    var tabs = await chrome.tabs.query({ url: APP_MATCHES });
    var tab = tabs.find(function (t) { return t.id != null; });
    if (tab && tab.id != null) {
      await chrome.tabs.update(tab.id, { active: true, url: url });
      return;
    }
  } catch (_) { /* valt terug op nieuwe tab */ }
  await chrome.tabs.create({ url: url });
}

/** Focus een bestaande Magister-tab met exact dezelfde URL, anders nieuwe tab. */
async function focusOrOpenMagister(url) {
  try {
    var tabs = await chrome.tabs.query({ url: MAGISTER_MATCHES });
    var tab = tabs.find(function (t) { return t.url === url && t.id != null; });
    if (tab && tab.id != null) {
      await chrome.tabs.update(tab.id, { active: true });
      return;
    }
  } catch (_) { /* valt terug op nieuwe tab */ }
  await chrome.tabs.create({ url: url });
}

async function currentSession() {
  var data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || null;
}

async function notifyAppTabs(payload) {
  try {
    var tabs = await chrome.tabs.query({ url: APP_MATCHES });
    await Promise.all(
      tabs
        .filter(function (tab) { return tab.id != null; })
        .map(function (tab) {
          return chrome.tabs.sendMessage(tab.id, { type: "MAGISTERPRO_SESSION", payload: payload })
            .catch(function () { /* tab heeft geen content script */ });
        })
    );
  } catch (_) { /* geen tabs beschikbaar */ }
}

async function saveSession(payload) {
  if (!payload || !payload.accessToken) return null;
  var previous = await currentSession();
  // Een token van de schoolportal is specifieker dan die van het accountcentrum.
  if (previous && previous.source === "magister-school" && payload.source === "magister-accounts") {
    return previous;
  }
  var session = Object.assign({}, payload, { capturedAt: Date.now() });
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
  await notifyAppTabs(session);
  return session;
}

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message || typeof message.type !== "string") return false;

  if (message.type === "MAGISTERPRO_SESSION") {
    saveSession(message.payload).then(sendResponse).catch(function (error) {
      sendResponse({ error: String(error && error.message || error) });
    });
    return true;
  }

  if (message.type === "MAGISTERPRO_GET_SESSION") {
    currentSession().then(sendResponse).catch(function () { sendResponse(null); });
    return true;
  }

  if (message.type === "MAGISTERPRO_APP_ORIGIN") {
    chrome.storage.local.set({ [APP_ORIGIN_KEY]: String(message.origin || APP_URL) }).then(function () {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "MAGISTERPRO_OPEN_APP") {
    var path = String(message.path || "/login");
    if (path.charAt(0) !== "/") path = "/" + path;
    chrome.storage.local.get(APP_ORIGIN_KEY).then(function (data) {
      var base = data[APP_ORIGIN_KEY] || APP_URL;
      return focusOrOpenApp(base + path);
    }).then(function () {
      sendResponse({ ok: true });
    }).catch(function (error) {
      sendResponse({ ok: false, error: String(error && error.message || error) });
    });
    return true;
  }

  if (message.type === "MAGISTERPRO_OPEN_MAGISTER") {
    var host = cleanMagisterHost(message.school);
    var target = host ? "https://" + host + "/" : ACCOUNTS_URL;
    focusOrOpenMagister(target).then(function () {
      sendResponse({ ok: true, url: target });
    }).catch(function (error) {
      sendResponse({ ok: false, error: String(error && error.message || error) });
    });
    return true;
  }

  if (message.type === "MAGISTERPRO_CLEAR") {
    chrome.storage.local.remove(STORAGE_KEY).then(function () { sendResponse({ ok: true }); });
    return true;
  }

  return false;
});
