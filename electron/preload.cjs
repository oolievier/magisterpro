/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("magisterProNative", {
  platform: "electron",
  openAuth: (url) => ipcRenderer.invoke("magister-auth:open", url),
  onAuth: (callback) => {
    if (typeof callback !== "function") return () => undefined;
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("magister-auth:callback", listener);
    return () => ipcRenderer.removeListener("magister-auth:callback", listener);
  },
});
