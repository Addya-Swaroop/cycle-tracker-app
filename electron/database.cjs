
const Database = require("better-sqlite3");
const path = require("node:path");
const { app } = require("electron");

let db;

const MOODS = [
  "happy", "calm", "sad", "irritable",
  "anxious", "emotional", "energetic", "low"
];

const SYMPTOMS = [
  "cramps", "bloating", "headache", "fatigue",
  "back pain", "acne", "breast tenderness",
  "nausea", "cravings", "insomnia"
];

const FLOWS = [
  "none", "spotting", "light", "medium", "heavy"
];

function initializeDatabase() {
  if (db) return;

  const dbPath = path.join(
    app.getPath("userData"),
    "luna.sqlite"
  );

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL UNIQUE,
      end_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      CHECK(end_date IS NULL OR end_date >= start_date)
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_date TEXT NOT NULL UNIQUE,
      flow TEXT CHECK(
        flow IN ('none','spotting','light','medium','heavy')
      ),
      mood TEXT,
      symptoms TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function ensureDb() {
  if (!db) throw new Error("Database not initialized.");
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) return false;

  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));

  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function validateNotes(notes) {
  if (typeof notes !== "string" || notes.length > 5000) {
    throw new Error("Notes must contain at most 5000 characters.");
  }
  return notes;
}

function validateCycle(startDate, endDate, notes = "") {
  if (!validDate(startDate)) {
    throw new Error("Invalid period start date.");
  }

  if (endDate !== null && endDate !== "") {
    if (!validDate(endDate) || endDate < startDate) {
      throw new Error("Invalid period end date.");
    }
  }

  return {
    startDate,
    endDate: endDate || null,
    notes: validateNotes(notes ?? "")
  };
}

function validateSelections(values, allowed, field) {
  if (
    !Array.isArray(values) ||
    values.length > allowed.length ||
    values.some(value => !allowed.includes(value)) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(`Invalid ${field} selection.`);
  }
  return values;
}

function validateLog(log) {
  if (!log || typeof log !== "object" || Array.isArray(log)) {
    throw new Error("Invalid daily entry.");
  }

  if (!validDate(log.logDate)) {
    throw new Error("Invalid journal date.");
  }

  if (!FLOWS.includes(log.flow)) {
    throw new Error("Invalid flow intensity.");
  }

  return {
    logDate: log.logDate,
    flow: log.flow,
    moods: validateSelections(log.moods, MOODS, "mood"),
    symptoms: validateSelections(
      log.symptoms, SYMPTOMS, "symptom"
    ),
    notes: validateNotes(log.notes ?? "")
  };
}

function getCycles() {
  ensureDb();
  return db.prepare(`
    SELECT * FROM cycles
    ORDER BY start_date DESC
  `).all();
}

function addCycle(startDate, endDate, notes = "") {
  ensureDb();
  const cycle = validateCycle(startDate, endDate, notes);

  return db.prepare(`
    INSERT INTO cycles (start_date, end_date, notes)
    VALUES (?, ?, ?)
  `).run(cycle.startDate, cycle.endDate, cycle.notes);
}

function updateCycle(id, startDate, endDate, notes = "") {
  ensureDb();
  const cycle = validateCycle(startDate, endDate, notes);

  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Invalid cycle ID.");
  }

  return db.prepare(`
    UPDATE cycles
    SET start_date = ?, end_date = ?, notes = ?
    WHERE id = ?
  `).run(
    cycle.startDate,
    cycle.endDate,
    cycle.notes,
    id
  );
}

function deleteCycle(id) {
  ensureDb();
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Invalid cycle ID.");
  }

  return db.prepare(
    "DELETE FROM cycles WHERE id = ?"
  ).run(id);
}

function decodeArray(raw) {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function getDailyLogs() {
  ensureDb();

  return db.prepare(`
    SELECT * FROM daily_logs
    ORDER BY log_date DESC
  `).all().map(row => ({
    id: row.id,
    logDate: row.log_date,
    flow: row.flow ?? "none",
    moods: decodeArray(row.mood),
    symptoms: decodeArray(row.symptoms),
    notes: row.notes ?? "",
    createdAt: row.created_at
  }));
}

function saveDailyLog(log) {
  ensureDb();
  const entry = validateLog(log);

  return db.prepare(`
    INSERT INTO daily_logs (
      log_date, flow, mood, symptoms, notes
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(log_date) DO UPDATE SET
      flow = excluded.flow,
      mood = excluded.mood,
      symptoms = excluded.symptoms,
      notes = excluded.notes
  `).run(
    entry.logDate,
    entry.flow,
    JSON.stringify(entry.moods),
    JSON.stringify(entry.symptoms),
    entry.notes
  );
}

function deleteDailyLog(id) {
  ensureDb();

  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Invalid journal ID.");
  }

  return db.prepare(
    "DELETE FROM daily_logs WHERE id = ?"
  ).run(id);
}

function exportAllData() {
  ensureDb();

  const settings = db.prepare(`
    SELECT key, value FROM settings
    ORDER BY key
  `).all();

  return {
    format: "luna-data",
    version: 1,
    exportedAt: new Date().toISOString(),
    cycles: getCycles().map(cycle => ({
      startDate: cycle.start_date,
      endDate: cycle.end_date,
      notes: cycle.notes ?? ""
    })),
    dailyLogs: getDailyLogs().map(log => ({
      logDate: log.logDate,
      flow: log.flow,
      moods: log.moods,
      symptoms: log.symptoms,
      notes: log.notes
    })),
    settings
  };
}

function validateImport(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.format !== "luna-data" ||
    data.version !== 1 ||
    !Array.isArray(data.cycles) ||
    !Array.isArray(data.dailyLogs) ||
    !Array.isArray(data.settings)
  ) {
    throw new Error("Unsupported or invalid Luna data file.");
  }

  if (
    data.cycles.length > 10000 ||
    data.dailyLogs.length > 100000 ||
    data.settings.length > 1000
  ) {
    throw new Error("Import exceeds supported record limits.");
  }

  const cycles = data.cycles.map(item => {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid cycle record.");
    }
    return validateCycle(
      item.startDate, item.endDate, item.notes
    );
  });

  const dailyLogs = data.dailyLogs.map(validateLog);

  const settings = data.settings.map(item => {
    if (
      !item ||
      typeof item.key !== "string" ||
      typeof item.value !== "string" ||
      item.key.length < 1 ||
      item.key.length > 200 ||
      item.value.length > 10000
    ) {
      throw new Error("Invalid setting record.");
    }

    return { key: item.key, value: item.value };
  });

  function ensureUnique(values, name) {
    if (new Set(values).size !== values.length) {
      throw new Error(`Duplicate ${name} in import.`);
    }
  }

  ensureUnique(
    cycles.map(item => item.startDate),
    "period start dates"
  );
  ensureUnique(
    dailyLogs.map(item => item.logDate),
    "journal dates"
  );
  ensureUnique(
    settings.map(item => item.key),
    "settings"
  );

  return { cycles, dailyLogs, settings };
}

function importAllData(data) {
  ensureDb();

  // Validate every record BEFORE changing anything.
  const validated = validateImport(data);

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM daily_logs").run();
    db.prepare("DELETE FROM cycles").run();
    db.prepare("DELETE FROM settings").run();

    const insertCycle = db.prepare(`
      INSERT INTO cycles (start_date, end_date, notes)
      VALUES (?, ?, ?)
    `);

    const insertLog = db.prepare(`
      INSERT INTO daily_logs (
        log_date, flow, mood, symptoms, notes
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertSetting = db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
    `);

    for (const cycle of validated.cycles) {
      insertCycle.run(
        cycle.startDate,
        cycle.endDate,
        cycle.notes
      );
    }

    for (const log of validated.dailyLogs) {
      insertLog.run(
        log.logDate,
        log.flow,
        JSON.stringify(log.moods),
        JSON.stringify(log.symptoms),
        log.notes
      );
    }

    for (const setting of validated.settings) {
      insertSetting.run(setting.key, setting.value);
    }
  });

  transaction();

  return {
    cycles: validated.cycles.length,
    dailyLogs: validated.dailyLogs.length,
    settings: validated.settings.length
  };
}

function deleteAllData() {
  ensureDb();

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM daily_logs").run();
    db.prepare("DELETE FROM cycles").run();
    db.prepare("DELETE FROM settings").run();
  });

  transaction();
  return true;
}

module.exports = {
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
};
