
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

const {
  initializeDatabase,
  getCycles,
  addCycle,
  updateCycle,
  deleteCycle,
  getDailyLogs,
  saveDailyLog,
  deleteDailyLog,
} = require("./database.cjs");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#FFF9F7",
    autoHideMenuBar: true,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!app.isPackaged) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(
      path.join(__dirname, "../dist/index.html")
    );
  }
}

app.whenReady().then(() => {
  initializeDatabase();

  // Cycle operations
  ipcMain.handle("cycles:get", () => getCycles());

  ipcMain.handle("cycles:add", (_, data) => {
    return addCycle(
      data.startDate,
      data.endDate,
      data.notes
    );
  });

  ipcMain.handle("cycles:update", (_, data) => {
    return updateCycle(
      data.id,
      data.startDate,
      data.endDate,
      data.notes
    );
  });

  ipcMain.handle("cycles:delete", (_, id) => {
    return deleteCycle(id);
  });

  // Daily journal operations
  ipcMain.handle("logs:get", () => {
    return getDailyLogs();
  });

  ipcMain.handle("logs:save", (_, data) => {
    return saveDailyLog(data);
  });

  ipcMain.handle("logs:delete", (_, id) => {
    return deleteDailyLog(id);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
