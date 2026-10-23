
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("luna", {
  appName: "Luna",
  platform: process.platform,
});
