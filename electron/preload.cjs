
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("luna", {
  getCycles: () =>
    ipcRenderer.invoke("cycles:get"),

  addCycle: data =>
    ipcRenderer.invoke("cycles:add", data),

  updateCycle: data =>
    ipcRenderer.invoke("cycles:update", data),

  deleteCycle: id =>
    ipcRenderer.invoke("cycles:delete", id),

  getDailyLogs: () =>
    ipcRenderer.invoke("logs:get"),

  saveDailyLog: data =>
    ipcRenderer.invoke("logs:save", data),

  deleteDailyLog: id =>
    ipcRenderer.invoke("logs:delete", id),

  createEncryptedBackup: password =>
    ipcRenderer.invoke("privacy:backup", password),

  restoreEncryptedBackup: password =>
    ipcRenderer.invoke("privacy:restore", password),

  exportJson: () =>
    ipcRenderer.invoke("privacy:export-json"),

  importJson: () =>
    ipcRenderer.invoke("privacy:import-json"),

  eraseAllData: confirmation =>
    ipcRenderer.invoke("privacy:erase", confirmation)
});
