
import { useEffect, useState } from "react";

const flows = [
  { value: "none", label: "None", icon: "○" },
  { value: "spotting", label: "Spotting", icon: "◦" },
  { value: "light", label: "Light", icon: "💧" },
  { value: "medium", label: "Medium", icon: "💧" },
  { value: "heavy", label: "Heavy", icon: "💧" },
];

const moods = [
  { value: "happy", label: "😊 Happy" },
  { value: "calm", label: "😌 Calm" },
  { value: "sad", label: "😔 Sad" },
  { value: "irritable", label: "😤 Irritable" },
  { value: "anxious", label: "😰 Anxious" },
  { value: "emotional", label: "🥹 Emotional" },
  { value: "energetic", label: "⚡ Energetic" },
  { value: "low", label: "😴 Low energy" },
];

const symptoms = [
  "cramps",
  "bloating",
  "headache",
  "fatigue",
  "back pain",
  "acne",
  "breast tenderness",
  "nausea",
  "cravings",
  "insomnia",
];

function localToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function emptyForm(date = localToday()) {
  return {
    logDate: date,
    flow: "none",
    moods: [],
    symptoms: [],
    notes: "",
  };
}

function toggleItem(items, item) {
  return items.includes(item)
    ? items.filter((value) => value !== item)
    : [...items, item];
}

export default function DailyJournal({ initialDate = null }) {
  const [form, setForm] = useState(() =>
    emptyForm(initialDate || localToday())
  );

  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadLogs() {
    const data = await window.luna.getDailyLogs();
    setLogs(data);
    return data;
  }

  useEffect(() => {
    let active = true;

    async function initializeJournal() {
      try {
        const data = await window.luna.getDailyLogs();

        if (!active) return;

        setLogs(data);

        if (initialDate) {
          const existing = data.find(
            (log) => log.logDate === initialDate
          );

          if (existing) {
            setForm({
              logDate: existing.logDate,
              flow: existing.flow,
              moods: [...existing.moods],
              symptoms: [...existing.symptoms],
              notes: existing.notes,
            });
          } else {
            setForm(emptyForm(initialDate));
          }
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    initializeJournal();

    return () => {
      active = false;
    };
  }, [initialDate]);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function chooseDate(date) {
    const existing = logs.find(
      (log) => log.logDate === date
    );

    if (existing) {
      setForm({
        logDate: existing.logDate,
        flow: existing.flow,
        moods: [...existing.moods],
        symptoms: [...existing.symptoms],
        notes: existing.notes,
      });
    } else {
      setForm(emptyForm(date));
    }

    setMessage("");
    setError("");
  }

  function editLog(log) {
    chooseDate(log.logDate);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveLog(event) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await window.luna.saveDailyLog(form);
      await loadLogs();

      setMessage("Daily entry saved successfully!");
      setForm(emptyForm());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(id) {
    if (!window.confirm("Delete this daily entry?")) {
      return;
    }

    try {
      await window.luna.deleteDailyLog(id);
      await loadLogs();

      setForm(emptyForm());
      setMessage("Entry deleted.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  const isEditing = logs.some(
    (log) => log.logDate === form.logDate
  );

  return (
    <div className="journal-page">
      <section className="panel">
        <div className="journal-heading">
          <h2>Daily Wellness Journal 🌷</h2>
          <p>How are you feeling today?</p>
        </div>

        <form onSubmit={saveLog}>
          <label>
            Select date
            <input
              type="date"
              required
              value={form.logDate}
              onChange={(e) =>
                chooseDate(e.target.value)
              }
            />
          </label>

          <div className="field-group">
            <h3>Flow intensity</h3>

            <div className="flow-options">
              {flows.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    "choice flow-choice " +
                    (form.flow === item.value
                      ? "selected"
                      : "")
                  }
                  aria-pressed={
                    form.flow === item.value
                  }
                  onClick={() =>
                    updateField("flow", item.value)
                  }
                >
                  <span className="flow-icon">
                    {item.icon}
                  </span>

                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <h3>Moods</h3>

            <p className="hint">
              Select as many as you like.
            </p>

            <div className="chip-group">
              {moods.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    "choice chip " +
                    (form.moods.includes(item.value)
                      ? "selected"
                      : "")
                  }
                  aria-pressed={
                    form.moods.includes(item.value)
                  }
                  onClick={() =>
                    updateField(
                      "moods",
                      toggleItem(
                        form.moods,
                        item.value
                      )
                    )
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <h3>Symptoms</h3>

            <p className="hint">
              Select any symptoms you experienced.
            </p>

            <div className="chip-group">
              {symptoms.map((symptom) => (
                <button
                  type="button"
                  key={symptom}
                  className={
                    "choice chip " +
                    (form.symptoms.includes(symptom)
                      ? "selected"
                      : "")
                  }
                  aria-pressed={
                    form.symptoms.includes(symptom)
                  }
                  onClick={() =>
                    updateField(
                      "symptoms",
                      toggleItem(
                        form.symptoms,
                        symptom
                      )
                    )
                  }
                >
                  {symptom}
                </button>
              ))}
            </div>
          </div>

          <label>
            Personal notes
            <textarea
              maxLength={5000}
              value={form.notes}
              placeholder="Anything else on your mind?"
              onChange={(e) =>
                updateField("notes", e.target.value)
              }
            />
          </label>

          <div className="form-actions">
            <button
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : isEditing
                  ? "Update entry"
                  : "Save entry"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setForm(emptyForm());
                setMessage("");
                setError("");
              }}
            >
              Clear
            </button>
          </div>
        </form>

        {message && (
          <p className="success-message" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Daily History</h2>

        <p className="hint">
          Your previous wellness entries.
        </p>

        {logs.length === 0 ? (
          <p>No daily entries recorded yet.</p>
        ) : (
          <div className="journal-history">
            {logs.map((log) => (
              <article
                className="log-card"
                key={log.id}
              >
                <div className="log-card-top">
                  <strong>{log.logDate}</strong>

                  <span className="flow-tag">
                    {log.flow}
                  </span>
                </div>

                {log.moods.length > 0 && (
                  <p>
                    <strong>Moods:</strong>{" "}
                    {log.moods.join(", ")}
                  </p>
                )}

                {log.symptoms.length > 0 && (
                  <p>
                    <strong>Symptoms:</strong>{" "}
                    {log.symptoms.join(", ")}
                  </p>
                )}

                {log.notes && (
                  <p className="log-notes">
                    {log.notes}
                  </p>
                )}

                <div className="log-actions">
                  <button
                    type="button"
                    onClick={() => editLog(log)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="delete"
                    onClick={() =>
                      deleteLog(log.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
