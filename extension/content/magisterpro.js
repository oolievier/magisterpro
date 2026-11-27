/* Draait op MagisterPro: geeft de extensie-sessie door aan de React-app. */
(function () {
  "use strict";
  if (!window.MagisterProExt) return;

  var ext = window.MagisterProExt;
  document.documentElement.setAttribute("data-magisterpro-extension", "app");
  var lastFingerprint = "";

  function publish(payload, force) {
    if (!payload || !payload.accessToken) return;
    var fingerprint = payload.accessToken + "|" + (payload.capturedAt || 0);
    if (!force && fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    window.dispatchEvent(new CustomEvent(ext.EVENT_NAME, { detail: payload }));
  }

  function requestSession() {
    chrome.runtime.sendMessage({ type: "MAGISTERPRO_GET_SESSION" }, function (payload) {
      void chrome.runtime.lastError;
      if (payload) publish(payload, true);
    });
  }

  // Onthoud welke origin van MagisterPro actief is, zodat de skin-links daar
  // naartoe gaan (productie of een lokale ontwikkelserver).
  chrome.runtime.sendMessage({ type: "MAGISTERPRO_APP_ORIGIN", origin: location.origin }, function () {
    void chrome.runtime.lastError;
  });

  // De webapp vraagt de sessie op zodra React is gehydrateerd. Events werken
  // tussen de geïsoleerde content-script-world en de pagina; window-globals niet.
  window.addEventListener("magisterpro:request-extension-session", requestSession);

  // De webapp kan met één klik naar de echte Magister-site wisselen.
  window.addEventListener("magisterpro:open-magister", function (event) {
    var detail = event.detail || {};
    chrome.runtime.sendMessage(
      { type: "MAGISTERPRO_OPEN_MAGISTER", school: detail.school || "" },
      function (result) {
        void chrome.runtime.lastError;
        window.dispatchEvent(new CustomEvent("magisterpro:open-magister-result", {
          detail: result || { ok: false }
        }));
      }
    );
  });

  chrome.runtime.onMessage.addListener(function (message) {
    if (message && message.type === "MAGISTERPRO_SESSION") publish(message.payload);
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    var change = changes[ext.STORAGE_KEY];
    if (change && change.newValue) publish(change.newValue);
  });

  chrome.storage.local.get(ext.STORAGE_KEY, function (data) {
    void chrome.runtime.lastError;
    publish(data && data[ext.STORAGE_KEY]);
  });
  requestSession();
})();
