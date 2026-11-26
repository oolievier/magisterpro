/* Draait op accounts.magister.net: vangt de oidc-client-sessie direct bij het schrijven. */
(function () {
  "use strict";
  if (!window.MagisterProExt) return;

  var ext = window.MagisterProExt;
  document.documentElement.setAttribute("data-magisterpro-extension", "accounts");
  ext.watchSessionStorage("magister-accounts");

  function scan() {
    ext.send(ext.scanStores("magister-accounts"));
  }

  // De callback schrijft de user meestal kort na de redirect; scan daarom een paar keer.
  [0, 300, 1200, 3000].forEach(function (delay) {
    setTimeout(scan, delay);
  });
})();
