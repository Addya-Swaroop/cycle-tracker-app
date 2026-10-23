
const Database = require("better-sqlite3");
const path = require("node:path");
const { app } = require("electron");

let db;

const FLOWS = [
  "none", "spotting", "light", "medium", "heavy"
];

const MOODS = [
  "happy", "calm", "sad", "irritable",
  "anxious", "emotional", "energetic", "low"
];

const SYMPTOMS = [
  "cramps", "bloating", "headache", "fatigue",
  "back pain", "acne", "breast tenderness",
  "nausea", "cravings", "insomnia"
];

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) return false;

  const date = new Date(value + "T00:00:00Z");

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function validateCycle(startDate, endDate, notes) {
  if (
    !validDate(startDate) ||
    (endDate && !validDate(endDate))
  ) throw new Error("Invalid cycle date");

  if (endDate && endDate < startDate) {
    throw new Error("End date cannot precede start date");
  }

  if (typeof notes !== "string" || notes.length > 5000) {
    throw new Error("Invalid notes");
  }
}

function validateLog(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid daily log");
  }

  if (!validDate(data.logDate)) {
    throw new Error("Please select a valid date");
  }

  if (!FLOWS.includes(data.flow)) {
    throw new Error("Invalid flow intensity");
  }

  for (const [values, allowed] of [
    [data.moods, MOODS],
    [data.symptoms, SYMPTOMS],
  ]) {
    if (
      !Array.isArray(values) ||
      values.length > allowed.length ||
      new Set(values).size !== values.length ||
      !values.every(v => allowed.includes(v))
    ) {
      throw new Error("Invalid mood or symptom selection");
    }
  }

  if (
    typeof data.notes !== "string" ||
    data.notes.length > 5000
  ) {
    throw new Error("Notes must be under 5000 characters");
  }
}

function initializeDatabase() {
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
      CHECK (end_date IS NULL OR end_date >= start_date)
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_date TEXT NOT NULL UNIQUE,
      flow TEXT CHECK (
        flow IN (
          'none', 'spotting', 'light', 'medium', 'heavy'
        )
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

  console.log("Luna database initialized");
}

// CYCLE OPERATIONS

function getCycles() {
  return db.prepare(
    "SELECT * FROM cycles ORDER BY start_date DESC"
  ).all();
}

function addCycle(startDate, endDate, notes = "") {
  validateCycle(startDate, endDate, notes);

  const result = db.prepare(`
    INSERT INTO cycles (start_date, end_date, notes)
    VALUES (?, ?, ?)
  `).run(startDate, endDate || null, notes);

  return Number(result.lastInsertRowid);
}

function updateCycle(id, startDate, endDate, notes = "") {
  validateCycle(startDate, endDate, notes);

  return db.prepare(`
    UPDATE cycles
    SET start_date = ?, end_date = ?, notes = ?
    WHERE id = ?
  `).run(startDate, endDate || null, notes, id).changes;
}

function deleteCycle(id) {
  return db.prepare(
    "DELETE FROM cycles WHERE id = ?"
  ).run(id).changes;
}

// DAILY LOG OPERATIONS

function parseArray(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Supports any older single-mood records.
    return [value];
  }
}

function formatLog(row) {
  return {
    id: row.id,
    logDate: row.log_date,
    flow: row.flow || "none",
    moods: parseArray(row.mood),
    symptoms: parseArray(row.symptoms),
    notes: row.notes || "",
  };
}

function getDailyLogs() {
  const rows = db.prepare(`
    SELECT * FROM daily_logs
    ORDER BY log_date DESC
  `).all();

  return rows.map(formatLog);
}

function saveDailyLog(data) {
  validateLog(data);

  db.prepare(`
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
    data.logDate,
    data.flow,
    JSON.stringify(data.moods),
    JSON.stringify(data.symptoms),
    data.notes
  );

  return true;
}

function deleteDailyLog(id) {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error("Invalid log ID");
  }

  return db.prepare(
    "DELETE FROM daily_logs WHERE id = ?"
  ).run(id).changes;
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
};
