
const {
  contextBridge,
  ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld("luna", {
  // Cycles
  getCycles: () =>
    ipcRenderer.invoke("cycles:get"),

  addCycle: (data) =>
    ipcRenderer.invoke("cycles:add", data),

  updateCycle: (data) =>
    ipcRenderer.invoke("cycles:update", data),

  deleteCycle: (id) =>
    ipcRenderer.invoke("cycles:delete", id),

  // Daily journal
  getDailyLogs: () =>
    ipcRenderer.invoke("logs:get"),

  saveDailyLog: (data) =>
    ipcRenderer.invoke("logs:save", data),

  deleteDailyLog: (id) =>
    ipcRenderer.invoke("logs:delete", id),
});
