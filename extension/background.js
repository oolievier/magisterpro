/* Service worker: bewaart de laatste echte Magister-sessie en geeft hem door aan onze webapp. */
"use strict";

var STORAGE_KEY = "magisterpro:magister-session";
var APP_URL = "https://magisterpro.vercel.app";
var APP_MATCHES = [
  "https://magisterpro.vercel.app/*",
  "http://localhost:3000/*",
  "http://127.0.0.1:3000/*",
];

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

  if (message.type === "MAGISTERPRO_OPEN_APP") {
    var path = String(message.path || "/login");
    if (path.charAt(0) !== "/") path = "/" + path;
    chrome.tabs.create({ url: APP_URL + path });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "MAGISTERPRO_CLEAR") {
    chrome.storage.local.remove(STORAGE_KEY).then(function () { sendResponse({ ok: true }); });
    return true;
  }

  return false;
});
