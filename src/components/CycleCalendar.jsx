
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  daysBetween,
  localToday,
  formatDate,
  calculatePrediction,
} from "../utils/cyclePrediction";
import "./CycleCalendar.css";

const WEEKDAYS = [
  "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
];

function parseLocalDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function readableDate(key) {
  return parseLocalDate(key).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildCalendar(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const total = Math.ceil(
    (firstWeekday + daysInMonth) / 7
  ) * 7;

  return Array.from({ length: total }, (_, index) => {
    const date = new Date(
      year,
      month,
      index - firstWeekday + 1
    );

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return {
      key: `${y}-${m}-${d}`,
      day: date.getDate(),
      currentMonth:
        date.getMonth() === month &&
        date.getFullYear() === year,
    };
  });
}

function getPeriodDays(cycles) {
  const days = new Set();

  for (const cycle of cycles) {
    if (!cycle.end_date) {
      days.add(cycle.start_date);
      continue;
    }

    const duration = daysBetween(
      cycle.start_date,
      cycle.end_date
    );

    if (duration < 0 || duration > 30) {
      days.add(cycle.start_date);
      continue;
    }

    for (let i = 0; i <= duration; i++) {
      days.add(addDays(cycle.start_date, i));
    }
  }

  return days;
}

function getPredictedDays(prediction) {
  const days = new Set();

  if (!prediction.available || prediction.overdue) {
    return days;
  }

  const count = daysBetween(
    prediction.windowStart,
    prediction.windowEnd
  );

  for (let i = 0; i <= count; i++) {
    days.add(addDays(prediction.windowStart, i));
  }

  return days;
}

export default function CycleCalendar({ onOpenJournal }) {
  const [viewDate, setViewDate] = useState(
    () => new Date()
  );
  const [selectedDate, setSelectedDate] = useState(
    () => localToday()
  );

  const [cycles, setCycles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [cycleData, logData] = await Promise.all([
          window.luna.getCycles(),
          window.luna.getDailyLogs(),
        ]);

        if (!active) return;

        setCycles(cycleData);
        setLogs(logData);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const calendarDays = useMemo(
    () => buildCalendar(year, month),
    [year, month]
  );

  const periodDays = useMemo(
    () => getPeriodDays(cycles),
    [cycles]
  );

  const prediction = useMemo(
    () => calculatePrediction(cycles),
    [cycles]
  );

  const predictedDays = useMemo(
    () => getPredictedDays(prediction),
    [prediction]
  );

  const logMap = useMemo(
    () => new Map(
      logs.map(log => [log.logDate, log])
    ),
    [logs]
  );

  const selectedLog = logMap.get(selectedDate);
  const isRecordedPeriod = periodDays.has(selectedDate);

  const isPredicted =
    !isRecordedPeriod &&
    predictedDays.has(selectedDate);

  const selectedCycle = cycles.find(cycle => {
    if (cycle.start_date === selectedDate) {
      return true;
    }

    return Boolean(
      cycle.end_date &&
      selectedDate >= cycle.start_date &&
      selectedDate <= cycle.end_date
    );
  });

  function changeMonth(offset) {
    setViewDate(current => new Date(
      current.getFullYear(),
      current.getMonth() + offset,
      1
    ));
  }

  function goToday() {
    const today = new Date();
    setViewDate(today);
    setSelectedDate(localToday());
  }

  function selectDay(day) {
    setSelectedDate(day.key);

    if (!day.currentMonth) {
      setViewDate(parseLocalDate(day.key));
    }
  }

  function goToPrediction() {
    if (!prediction.available) return;

    setViewDate(parseLocalDate(
      prediction.expectedDate
    ));
    setSelectedDate(prediction.expectedDate);
  }

  const monthTitle = viewDate.toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" }
  );

  const todayKey = localToday();

  return (
    <div className="calendar-page">
      <section className="panel">
        <div className="calendar-header">
          <div>
            <h2>My Cycle Calendar 🌷</h2>
            <p className="calendar-subtitle">
              Your recorded days and estimated dates.
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

            const isEstimate =
              !isPeriod &&
              predictedDays.has(day.key);

            const isSelected =
              selectedDate === day.key;

            const isToday =
              todayKey === day.key;

            return (
              <button
                type="button"
                key={day.key}
                onClick={() => selectDay(day)}
                aria-pressed={isSelected}
                aria-label={
                  `${readableDate(day.key)}` +
                  (isPeriod ? ", recorded period" : "") +
                  (isEstimate ? ", estimated period start window" : "") +
                  (hasLog ? ", daily entry" : "")
                }
                className={[
                  "calendar-day",
                  !day.currentMonth ? "outside" : "",
                  isPeriod ? "period-day" : "",
                  isEstimate ? "predicted-day" : "",
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
            <i className="legend-period" />
            Recorded period
          </span>

          <span>
            <i className="legend-predicted" />
            Estimated start window
          </span>

          <span>
            <i className="legend-log" />
            Daily entry
          </span>

          <span>
            <i className="legend-today" />
            Today
          </span>
        </div>
      </section>

      <section className="panel">
        <h2>Next Period Estimate 🌙</h2>

        {loading ? (
          <p>Loading cycle history...</p>
        ) : !prediction.available ? (
          <p className="calendar-empty">
            {prediction.message}
          </p>
        ) : (
          <>
            <div className="prediction-highlight">
              <p className="prediction-label">
                Estimated start date
              </p>

              <h3>
                {formatDate(prediction.expectedDate)}
              </h3>

              <p>
                Possible start window:{" "}
                <strong>
                  {formatDate(prediction.windowStart)}
                  {" – "}
                  {formatDate(prediction.windowEnd)}
                </strong>
              </p>
            </div>

            <div className="calendar-stats">
              <div className="calendar-stat">
                <span>Typical cycle</span>
                <strong>
                  {prediction.average} days
                </strong>
              </div>

              <div className="calendar-stat">
                <span>Observed variation</span>
                <strong>
                  {prediction.variation} days
                </strong>
              </div>

              <div className="calendar-stat">
                <span>Intervals used</span>
                <strong>
                  {prediction.sampleSize}
                </strong>
              </div>
            </div>

            <p className="prediction-reliability">
              {prediction.reliability}
            </p>

            {prediction.overdue && (
              <p className="prediction-warning">
                The estimated start window has passed.
                This does not necessarily indicate a
                problem. Your next period may arrive
                later than expected.
              </p>
            )}

            <button
              type="button"
              onClick={goToPrediction}
            >
              View estimated date
            </button>
          </>
        )}

        <p className="calendar-disclaimer">
          This estimate uses recent recorded cycle
          lengths. The displayed window is a heuristic,
          not a medical confidence interval. Cycle
          timing can change due to many factors.
        </p>
      </section>

      <section className="panel selected-date-panel">
        <h2>{readableDate(selectedDate)}</h2>

        {selectedCycle && isRecordedPeriod && (
          <p className="calendar-period-info">
            🌸 Recorded period day
            {selectedCycle.start_date === selectedDate
              ? " · Period started"
              : ""}
          </p>
        )}

        {isPredicted && (
          <p className="prediction-reliability">
            ✨ This date falls within the estimated
            next-period start window. It is not a
            confirmed period day.
          </p>
        )}

        {selectedLog ? (
          <div className="calendar-log-details">
            <p>
              <strong>Flow:</strong>{" "}
              {selectedLog.flow}
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
                <strong>Notes:</strong>{" "}
                {selectedLog.notes}
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
          {selectedLog
            ? "Edit daily entry"
            : "Log this day"}
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
            <span>Daily entries</span>
            <strong>{logs.length}</strong>
          </div>

          <div className="calendar-stat">
            <span>Typical cycle length</span>
            <strong>
              {prediction.available
                ? `${prediction.average} days`
                : "Not available"}
            </strong>
          </div>
        </div>
      </section>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
