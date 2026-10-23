
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const {
  initializeDatabase,
  getCycles,
  addCycle,
  updateCycle,
  deleteCycle,
  getDailyLogs,
  saveDailyLog,
  deleteDailyLog,
  exportAllData,
  validateImport,
  importAllData,
  deleteAllData
} = require("./database.cjs");

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const BACKUP_FORMAT = "luna-encrypted-backup";
const BACKUP_VERSION = 1;

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
      sandbox: true
    }
  });

  if (!app.isPackaged) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(
      path.join(__dirname, "../dist/index.html")
    );
  }
}

function activeWindow() {
  return BrowserWindow.getFocusedWindow() ||
    BrowserWindow.getAllWindows()[0];
}

function requirePassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 1024
  ) {
    throw new Error(
      "Backup password must contain 8–1024 characters."
    );
  }
}

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
}

function encryptBackup(data, password) {
  requirePassword(password);

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const plaintext = Buffer.from(
    JSON.stringify(data),
    "utf8"
  );

  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  key.fill(0);
  plaintext.fill(0);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    kdf: "scrypt",
    encryption: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64")
  };
}

function decodeBase64(value, expectedBytes = null) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error("Invalid encrypted backup.");
  }

  const buffer = Buffer.from(value, "base64");

  if (
    (expectedBytes !== null &&
      buffer.length !== expectedBytes) ||
    buffer.toString("base64") !== value
  ) {
    throw new Error("Invalid encrypted backup.");
  }

  return buffer;
}

function decryptBackup(backup, password) {
  requirePassword(password);

  if (
    !backup ||
    backup.format !== BACKUP_FORMAT ||
    backup.version !== BACKUP_VERSION ||
    backup.kdf !== "scrypt" ||
    backup.encryption !== "aes-256-gcm"
  ) {
    throw new Error("Unsupported encrypted backup.");
  }

  const salt = decodeBase64(backup.salt, 16);
  const iv = decodeBase64(backup.iv, 12);
  const tag = decodeBase64(backup.tag, 16);
  const ciphertext = decodeBase64(backup.data);

  const key = deriveKey(password, salt);

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      iv
    );

    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    const result = JSON.parse(
      plaintext.toString("utf8")
    );

    plaintext.fill(0);
    return result;
  } catch {
    throw new Error(
      "Incorrect password or damaged backup file."
    );
  } finally {
    key.fill(0);
  }
}

async function readJsonFile(filePath) {
  const info = await fs.stat(filePath);

  if (info.size > MAX_FILE_BYTES) {
    throw new Error(
      "The selected file is too large (20 MB maximum)."
    );
  }

  const contents = await fs.readFile(
    filePath,
    "utf8"
  );

  try {
    return JSON.parse(contents);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
}

async function confirmReplacement() {
  const response = await dialog.showMessageBox(
    activeWindow(),
    {
      type: "warning",
      buttons: ["Cancel", "Replace local data"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: "Replace Luna data?",
      message: "Replace all existing Luna records?",
      detail:
        "This will overwrite your current periods, " +
        "journal entries, and settings. Create a " +
        "backup first if you want to keep them."
    }
  );

  return response.response === 1;
}

async function saveEncryptedBackup(_, password) {
  requirePassword(password);

  const result = await dialog.showSaveDialog(
    activeWindow(),
    {
      title: "Save encrypted Luna backup",
      defaultPath: `luna-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.luna`,
      filters: [
        { name: "Luna encrypted backup", extensions: ["luna"] }
      ]
    }
  );

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const data = exportAllData();
  const backup = encryptBackup(data, password);
  const output = JSON.stringify(backup, null, 2);

  if (Buffer.byteLength(output, "utf8") > MAX_FILE_BYTES) {
    throw new Error("Backup exceeds the 20 MB limit.");
  }

  await fs.writeFile(result.filePath, output, {
    encoding: "utf8",
    flag: "wx"
  }).catch(async error => {
    if (error.code !== "EEXIST") throw error;

    const confirmation = await dialog.showMessageBox(
      activeWindow(),
      {
        type: "warning",
        buttons: ["Cancel", "Overwrite"],
        defaultId: 0,
        cancelId: 0,
        message: "Overwrite existing backup?"
      }
    );

    if (confirmation.response !== 1) {
      return;
    }

    await fs.writeFile(result.filePath, output, "utf8");
  });

  return { canceled: false };
}

async function restoreEncryptedBackup(_, password) {
  requirePassword(password);

  const result = await dialog.showOpenDialog(
    activeWindow(),
    {
      title: "Restore encrypted Luna backup",
      properties: ["openFile"],
      filters: [
        { name: "Luna encrypted backup", extensions: ["luna"] }
      ]
    }
  );

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  const encrypted = await readJsonFile(
    result.filePaths[0]
  );

  const data = decryptBackup(encrypted, password);

  // Validate before showing the destructive confirmation.
  validateImport(data);

  if (!(await confirmReplacement())) {
    return { canceled: true };
  }

  const counts = importAllData(data);

  return { canceled: false, ...counts };
}

async function exportReadableJson() {
  const warning = await dialog.showMessageBox(
    activeWindow(),
    {
      type: "warning",
      buttons: ["Cancel", "Export JSON"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      message: "Export unencrypted personal data?",
      detail:
        "This JSON file will contain readable cycle, " +
        "journal, and settings data. Anyone who can " +
        "open the file may be able to read it."
    }
  );

  if (warning.response !== 1) {
    return { canceled: true };
  }

  const result = await dialog.showSaveDialog(
    activeWindow(),
    {
      title: "Export Luna data as JSON",
      defaultPath: "luna-export.json",
      filters: [
        { name: "JSON", extensions: ["json"] }
      ]
    }
  );

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const output = JSON.stringify(
    exportAllData(),
    null,
    2
  );

  if (Buffer.byteLength(output, "utf8") > MAX_FILE_BYTES) {
    throw new Error("Export exceeds the 20 MB limit.");
  }

  await fs.writeFile(result.filePath, output, "utf8");

  return { canceled: false };
}

async function importReadableJson() {
  const result = await dialog.showOpenDialog(
    activeWindow(),
    {
      title: "Import Luna JSON data",
      properties: ["openFile"],
      filters: [
        { name: "JSON", extensions: ["json"] }
      ]
    }
  );

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  const data = await readJsonFile(result.filePaths[0]);

  validateImport(data);

  if (!(await confirmReplacement())) {
    return { canceled: true };
  }

  const counts = importAllData(data);

  return { canceled: false, ...counts };
}

async function eraseLocalData(_, confirmation) {
  if (confirmation !== "DELETE LUNA DATA") {
    throw new Error(
      "Type DELETE LUNA DATA to confirm."
    );
  }

  const response = await dialog.showMessageBox(
    activeWindow(),
    {
      type: "warning",
      buttons: ["Cancel", "Delete all records"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: "Delete all Luna data",
      message: "Permanently delete local records?",
      detail:
        "This removes period records, daily logs, " +
        "and settings from Luna's active database. " +
        "It does not remove backups or guarantee " +
        "forensic erasure from the storage device."
    }
  );

  if (response.response !== 1) {
    return { canceled: true };
  }

  deleteAllData();
  return { canceled: false };
}

app.whenReady().then(() => {
  initializeDatabase();

  ipcMain.handle("cycles:get", () => getCycles());

  ipcMain.handle("cycles:add", (_, data) =>
    addCycle(
      data.startDate,
      data.endDate,
      data.notes
    )
  );

  ipcMain.handle("cycles:update", (_, data) =>
    updateCycle(
      data.id,
      data.startDate,
      data.endDate,
      data.notes
    )
  );

  ipcMain.handle("cycles:delete", (_, id) =>
    deleteCycle(id)
  );

  ipcMain.handle("logs:get", () => getDailyLogs());

  ipcMain.handle("logs:save", (_, data) =>
    saveDailyLog(data)
  );

  ipcMain.handle("logs:delete", (_, id) =>
    deleteDailyLog(id)
  );

  ipcMain.handle(
    "privacy:backup",
    saveEncryptedBackup
  );

  ipcMain.handle(
    "privacy:restore",
    restoreEncryptedBackup
  );

  ipcMain.handle(
    "privacy:export-json",
    exportReadableJson
  );

  ipcMain.handle(
    "privacy:import-json",
    importReadableJson
  );

  ipcMain.handle(
    "privacy:erase",
    eraseLocalData
  );

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
