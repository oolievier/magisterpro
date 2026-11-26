/* Draait op de schoolportal van Magister: skin + directe sessie-overdracht. */
(function () {
  "use strict";
  if (!window.MagisterProExt) return;

  var ext = window.MagisterProExt;
  ext.send(ext.scanStores("magister-school"));

  var panelId = "magisterpro-skin-panel";
  if (document.getElementById(panelId)) return;

  var panel = document.createElement("aside");
  panel.id = panelId;
  panel.setAttribute("aria-label", "MagisterPro-snelkoppelingen");

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mp-fab";
  toggle.setAttribute("aria-label", "MagisterPro-paneel openen");
  toggle.textContent = "M";

  var card = document.createElement("div");
  card.className = "mp-card";
  card.hidden = true;

  var head = document.createElement("div");
  head.className = "mp-head";
  var title = document.createElement("strong");
  title.textContent = "MagisterPro";
  var close = document.createElement("button");
  close.type = "button";
  close.className = "mp-close";
  close.setAttribute("aria-label", "Sluiten");
  close.textContent = "×";
  head.appendChild(title);
  head.appendChild(close);

  var status = document.createElement("p");
  status.className = "mp-status";
  status.textContent = "Sessie controleren…";

  var links = document.createElement("div");
  links.className = "mp-links";
  [
    ["Command Center", "/"],
    ["Cijferstudio", "/grades"],
    ["Rooster", "/schedule"],
    ["Planner", "/planner"],
    ["Instellingen", "/settings"],
  ].forEach(function (entry) {
    var link = document.createElement("button");
    link.type = "button";
    link.textContent = entry[0];
    link.addEventListener("click", function () {
      chrome.runtime.sendMessage({ type: "MAGISTERPRO_OPEN_APP", path: entry[1] }, function () {
        void chrome.runtime.lastError;
      });
    });
    links.appendChild(link);
  });

  var actions = document.createElement("div");
  actions.className = "mp-actions";

  var skinButton = document.createElement("button");
  skinButton.type = "button";
  skinButton.textContent = "Skin aan/uit";
  skinButton.addEventListener("click", function () {
    var on = document.body.classList.toggle("magisterpro-skin");
    skinButton.setAttribute("aria-pressed", on ? "true" : "false");
  });

  var copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Sessie opnieuw koppelen";
  copyButton.addEventListener("click", function () {
    var sessions = ext.scanStores("magister-school");
    ext.send(sessions);
    status.textContent = sessions.length ? "Sessie verstuurd." : "Geen sessie gevonden. Log eerst in op Magister.";
  });

  actions.appendChild(skinButton);
  actions.appendChild(copyButton);

  var note = document.createElement("p");
  note.className = "mp-note";
  note.textContent = "Je wachtwoord blijft op de Magister-pagina. MagisterPro ontvangt alleen tijdelijke tokens.";

  card.appendChild(head);
  card.appendChild(status);
  card.appendChild(links);
  card.appendChild(actions);
  card.appendChild(note);
  panel.appendChild(toggle);
  panel.appendChild(card);
  document.body.appendChild(panel);

  toggle.addEventListener("click", function () {
    card.hidden = !card.hidden;
    toggle.setAttribute("aria-expanded", card.hidden ? "false" : "true");
  });
  close.addEventListener("click", function () { card.hidden = true; });

  // Toon of er een bruikbare sessie in deze tab staat.
  var sessions = ext.scanStores("magister-school");
  if (sessions.length) {
    var session = sessions[sessions.length - 1];
    status.textContent = "Gekoppeld via " + (session.school || "Magister") + ".";
  } else {
    status.textContent = "Log in op Magister; de sessie wordt dan automatisch overgenomen.";
  }
})();
