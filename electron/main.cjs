/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, shell } = require("electron");

const APP_URL = process.env.MAGISTERPRO_URL?.trim() || "https://magisterpro.vercel.app";
const MAGISTER_HOST = "accounts.magister.net";
const CALLBACK_PREFIX = "m6loapp://oauth2redirect";
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

let mainWindow = null;
let authWindow = null;
let authTimer = null;
let authDone = false;

function sendAuth(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("magister-auth:callback", payload);
  }
}

function finishAuth(payload) {
  if (authDone) return;
  authDone = true;
  if (authTimer) clearTimeout(authTimer);
  authTimer = null;
  sendAuth(payload);
  if (authWindow && !authWindow.isDestroyed()) authWindow.close();
  authWindow = null;
}

/** Leest code/state uit zowel de fragment- als de query-variant van de redirect. */
function parseCallback(rawUrl) {
  try {
    if (!rawUrl.startsWith(CALLBACK_PREFIX)) return null;
    const url = new URL(rawUrl);
    const query = url.hash ? url.hash.slice(1) : url.search.slice(1);
    const params = new URLSearchParams(query);
    const code = params.get("code") || "";
    const error = params.get("error") || "";
    if (!code && !error) return null;
    return {
      code,
      state: params.get("state") || "",
      idToken: params.get("id_token") || "",
      error,
    };
  } catch {
    return null;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0a0f",
    title: "MagisterPro",
    webPreferences: {
      preload: require("node:path").join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadURL(APP_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(CALLBACK_PREFIX)) {
      const parsed = parseCallback(url);
      if (parsed) finishAuth(parsed);
      return { action: "deny" };
    }
    shell.openExternal(url).catch(() => undefined);
    return { action: "deny" };
  });
}

function start() {
  ipcMain.handle("magister-auth:open", async (_event, rawUrl) => {
    let target;
    try {
      target = new URL(String(rawUrl));
    } catch {
      throw new Error("Ongeldige Magister-login-URL.");
    }
    if (target.protocol !== "https:" || target.hostname !== MAGISTER_HOST || target.pathname !== "/connect/authorize") {
      throw new Error("Deze URL is geen Magister-loginpagina.");
    }

    if (authWindow && !authWindow.isDestroyed()) authWindow.close();
    authDone = false;

    authWindow = new BrowserWindow({
      width: 480,
      height: 760,
      parent: mainWindow || undefined,
      modal: Boolean(mainWindow),
      title: "Inloggen met Magister",
      backgroundColor: "#ffffff",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const intercept = (url) => {
      const parsed = parseCallback(url);
      if (!parsed) return false;
      finishAuth(parsed);
      return true;
    };

    authWindow.webContents.on("will-navigate", (event, url) => {
      if (intercept(url)) event.preventDefault();
    });
    authWindow.webContents.on("will-frame-navigate", (event, details) => {
      if (details.isMainFrame && intercept(details.url)) event.preventDefault();
    });
    authWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (!intercept(url) && url.startsWith("https://")) {
        authWindow.loadURL(url).catch(() => undefined);
      }
      return { action: "deny" };
    });

    authWindow.on("closed", () => {
      if (authTimer) clearTimeout(authTimer);
      authTimer = null;
      authWindow = null;
      if (!authDone) sendAuth({ code: "", state: "", error: "Inloggen met Magister is geannuleerd." });
    });

    authTimer = setTimeout(() => {
      if (!authDone) finishAuth({ code: "", state: "", error: "De Magister-login duurde te lang. Probeer opnieuw." });
    }, AUTH_TIMEOUT_MS);

    await authWindow.loadURL(target.toString());
  });

  app.whenReady().then(() => {
    createMainWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

module.exports = { parseCallback };

// Buiten Electron (bijvoorbeeld in een test) is `app` alleen een pad-string.
if (app && typeof app.whenReady === "function") start();
