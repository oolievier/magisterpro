"use strict";

var status = document.getElementById("status");
document.getElementById("open").addEventListener("click", function () {
  chrome.runtime.sendMessage({ type: "MAGISTERPRO_OPEN_APP", path: "/login" });
});
document.getElementById("clear").addEventListener("click", function () {
  chrome.runtime.sendMessage({ type: "MAGISTERPRO_CLEAR" }, function () {
    status.textContent = "Sessie gewist.";
  });
});

chrome.runtime.sendMessage({ type: "MAGISTERPRO_GET_SESSION" }, function (session) {
  void chrome.runtime.lastError;
  if (!session) {
    status.textContent = "Nog geen Magister-sessie. Log eerst in op de officiële Magister-site.";
    return;
  }
  var when = new Date(session.capturedAt || Date.now()).toLocaleString("nl-NL");
  status.textContent = "Sessie gekoppeld via " + (session.school || session.source || "Magister") + " (" + when + ").";
});
