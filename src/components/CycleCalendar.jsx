
import { useEffect, useMemo, useState } from "react";
import "./CycleCalendar.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key, amount) {
  const date = parseDate(key);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function dayDifference(start, end) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function readableDate(key) {
  return parseDate(key).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(year, month, index - firstDay + 1);

    return {
      key: toDateKey(date),
      day: date.getDate(),
      currentMonth: date.getMonth() === month &&
        date.getFullYear() === year,
    };
  });
}

export default function CycleCalendar({ onOpenJournal }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateKey(new Date())
  );
  const [cycles, setCycles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [savedCycles, savedLogs] = await Promise.all([
          window.luna.getCycles(),
          window.luna.getDailyLogs(),
        ]);

        if (active) {
          setCycles(savedCycles);
          setLogs(savedLogs);
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    loadData();
    return () => { active = false; };
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const calendarDays = useMemo(
    () => buildCalendar(year, month),
    [year, month]
  );

  const periodDays = useMemo(() => {
    const dates = new Set();

    for (const cycle of cycles) {
      if (!cycle.end_date) {
        // An unknown end date should not fill the
        // entire calendar with period highlighting.
        dates.add(cycle.start_date);
        continue;
      }

      const duration = dayDifference(
        cycle.start_date,
        cycle.end_date
      );

      // Defensive limit against malformed records.
      if (duration < 0 || duration > 30) continue;

      for (let i = 0; i <= duration; i++) {
        dates.add(addDays(cycle.start_date, i));
      }
    }

    return dates;
  }, [cycles]);

  const logMap = useMemo(
    () => new Map(logs.map(log => [log.logDate, log])),
    [logs]
  );

  const selectedLog = logMap.get(selectedDate);
  const selectedCycle = cycles.find(cycle => {
    if (cycle.start_date === selectedDate) return true;
    return cycle.end_date &&
      selectedDate >= cycle.start_date &&
      selectedDate <= cycle.end_date;
  });

  const cycleLengths = useMemo(() => {
    const sorted = [...cycles].sort((a, b) =>
      a.start_date.localeCompare(b.start_date)
    );

    const lengths = [];

    for (let i = 1; i < sorted.length; i++) {
      const length = dayDifference(
        sorted[i - 1].start_date,
        sorted[i].start_date
      );

      if (length > 0) lengths.push(length);
    }

    return lengths;
  }, [cycles]);

  const averageLength = cycleLengths.length
    ? Math.round(
        cycleLengths.reduce((sum, n) => sum + n, 0) /
        cycleLengths.length
      )
    : null;

  function changeMonth(offset) {
    setViewDate(current =>
      new Date(
        current.getFullYear(),
        current.getMonth() + offset,
        1
      )
    );
  }

  function goToday() {
    const today = new Date();
    setViewDate(today);
    setSelectedDate(toDateKey(today));
  }

  function selectDay(day) {
    setSelectedDate(day.key);

    if (!day.currentMonth) {
      setViewDate(parseDate(day.key));
    }
  }

  const monthTitle = viewDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const todayKey = toDateKey(new Date());

  return (
    <div className="calendar-page">
      <section className="panel">
        <div className="calendar-header">
          <div>
            <h2>My Cycle Calendar 🌷</h2>
            <p className="calendar-subtitle">
              A little overview of your cycle.
            </p>
          </div>

          <button
            type="button"
            className="calendar-today"
            onClick={goToday}
          >
            Today
          </button>
        </div>

        <div className="calendar-month-nav">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            ‹
          </button>

          <h3>{monthTitle}</h3>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            ›
          </button>
        </div>

        <div className="calendar-grid">
          {WEEKDAYS.map(day => (
            <div className="weekday" key={day}>
              {day}
            </div>
          ))}

          {calendarDays.map(day => {
            const isPeriod = periodDays.has(day.key);
            const hasLog = logMap.has(day.key);
            const isSelected = day.key === selectedDate;
            const isToday = day.key === todayKey;

            return (
              <button
                key={day.key}
                type="button"
                aria-label={`${readableDate(day.key)}${
                  isPeriod ? ", recorded period" : ""
                }${hasLog ? ", daily log" : ""}`}
                aria-pressed={isSelected}
                onClick={() => selectDay(day)}
                className={[
                  "calendar-day",
                  !day.currentMonth ? "outside" : "",
                  isPeriod ? "period-day" : "",
                  isSelected ? "selected-day" : "",
                  isToday ? "today-day" : "",
                ].filter(Boolean).join(" ")}
              >
                <span>{day.day}</span>

                {hasLog && (
                  <span className="journal-dot" />
                )}
              </button>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span>
            <i className="legend-period" /> Period
          </span>
          <span>
            <i className="legend-log" /> Daily entry
          </span>
          <span>
            <i className="legend-today" /> Today
          </span>
        </div>
      </section>

      <section className="panel selected-date-panel">
        <h2>{readableDate(selectedDate)}</h2>

        {selectedCycle && (
          <p className="calendar-period-info">
            🌸 Recorded period day
            {selectedCycle.start_date === selectedDate &&
              " · Period started"}
          </p>
        )}

        {selectedLog ? (
          <div className="calendar-log-details">
            <p>
              <strong>Flow:</strong> {selectedLog.flow}
            </p>
            <p>
              <strong>Moods:</strong>{" "}
              {selectedLog.moods.length
                ? selectedLog.moods.join(", ")
                : "Not recorded"}
            </p>
            <p>
              <strong>Symptoms:</strong>{" "}
              {selectedLog.symptoms.length
                ? selectedLog.symptoms.join(", ")
                : "Not recorded"}
            </p>

            {selectedLog.notes && (
              <p className="calendar-notes">
                <strong>Notes:</strong> {selectedLog.notes}
              </p>
            )}
          </div>
        ) : (
          <p className="calendar-empty">
            No daily journal entry for this date.
          </p>
        )}

        <button
          type="button"
          onClick={() => onOpenJournal(selectedDate)}
        >
          {selectedLog ? "Edit daily entry" : "Log this day"}
        </button>
      </section>

      <section className="panel">
        <h2>Cycle Overview</h2>

        <div className="calendar-stats">
          <div className="calendar-stat">
            <span>Periods recorded</span>
            <strong>{cycles.length}</strong>
          </div>

          <div className="calendar-stat">
            <span>Average cycle length</span>
            <strong>
              {averageLength !== null
                ? `${averageLength} days`
                : "Not enough data"}
            </strong>
          </div>

          <div className="calendar-stat">
            <span>Daily entries</span>
            <strong>{logs.length}</strong>
          </div>
        </div>

        <p className="calendar-disclaimer">
          Cycle length is measured from one period start
          date to the next. Statistics are descriptive,
          not predictions.
        </p>
      </section>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
