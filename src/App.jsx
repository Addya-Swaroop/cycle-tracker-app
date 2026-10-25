
import { useEffect, useState } from "react";
import DailyJournal from "./components/DailyJournal";
import CycleCalendar from "./components/CycleCalendar";
import InsightsDashboard from "./components/InsightsDashboard";
import PrivacySettings from "./components/PrivacySettings";
import "./App.css";

const AMBIENT_PARTICLES = Array.from({ length: 24 }, (_, index) => ({
  left: `${(index * 37 + 11) % 96 + 2}%`,
  top: `${(index * 29 + 7) % 90 + 5}%`,
  delay: `${-((index * 7) % 29)}s`,
  duration: `${16 + (index % 7) * 4}s`,
  size: `${index % 5 === 0 ? 4 : 2}px`,
}));

const NAV_ITEMS = [
  { id: "cycles", label: "Overview", icon: "home" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "journal", label: "Daily Journal", icon: "journal" },
  { id: "insights", label: "Insights", icon: "chart" },
  { id: "privacy", label: "Privacy & Data", icon: "shield" },
];

const PAGE_INFO = {
  cycles: {
    title: "Overview",
    subtitle: "Your cycle, at a glance.",
  },
  calendar: {
    title: "Calendar",
    subtitle: "Your records and estimated dates.",
  },
  journal: {
    title: "Daily Journal",
    subtitle: "A little space to check in with yourself.",
  },
  insights: {
    title: "Insights",
    subtitle: "Patterns from your recorded history.",
  },
  privacy: {
    title: "Privacy & Data",
    subtitle: "Your information stays in your control.",
  },
};

function Icon({ name, size = 19 }) {
  const icons = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" />
        <path d="M9 21v-8h6v8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
        <path d="M8 14h3M8 17h3M15 14h1" />
      </>
    ),
    journal: (
      <>
        <rect x="5" y="3" width="15" height="18" rx="2" />
        <path d="M9 3v18M12 8h5M12 12h5M12 16h3" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="m7 16 4-5 4 3 5-7" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </>
    ),
    moon: (
      <path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z" />
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

function parseLocalDate(value) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return date;
}

function daysBetween(start, end) {
  if (!start || !end) return 0;

  const first = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  const second = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );

  return Math.round((second - first) / 86400000);
}

function formatDate(value) {
  const date = parseLocalDate(value);

  if (!date) return "Not recorded";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getCycleSummary(cycles) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const starts = cycles
    .map(cycle => parseLocalDate(cycle.start_date))
    .filter(date => date && date <= today)
    .sort((a, b) => b - a);

  if (!starts.length) {
    return {
      day: null,
      length: null,
      nextDate: null,
    };
  }

  const intervals = [];

  for (let i = 0; i < starts.length - 1; i++) {
    const difference = daysBetween(starts[i + 1], starts[i]);

    if (difference >= 15 && difference <= 90) {
      intervals.push(difference);
    }
  }

  const length = intervals.length
    ? Math.round(
        intervals.slice(0, 6).reduce((sum, n) => sum + n, 0) /
          Math.min(intervals.length, 6)
      )
    : null;

  const day = daysBetween(starts[0], today) + 1;

  let nextDate = null;

  if (length) {
    const next = new Date(starts[0]);

    // Advance by whole cycles if the most recent entry is old.
    const cyclesElapsed = Math.max(
      1,
      Math.floor((day - 1) / length) + 1
    );

    next.setDate(next.getDate() + cyclesElapsed * length);

    nextDate = next.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  }

  return { day, length, nextDate };
}

/*
  Draws one stylised moon phase.

  The 28 positions represent a complete illustrated
  moon sequence. They are not astronomical calculations
  or medical predictions.
*/
function MoonPhase({ index, active }) {
  const angle = (index / 28) * Math.PI * 2;
  const cosine = Math.cos(angle);

  const r = 9;
  const rx = Math.max(0.1, Math.abs(cosine) * r);

  const waxing = index <= 14;
  const bright = "#F5DCE8";
  const shadow = "#73647E";

  let shape = null;

  if (index === 0) {
    shape = null;
  } else if (index === 14) {
    shape = <circle r={r} fill={bright} />;
  } else if (waxing) {
    shape = (
      <path
        d={
          `M 0 ${-r} ` +
          `A ${r} ${r} 0 0 1 0 ${r} ` +
          `A ${rx} ${r} 0 0 ${cosine > 0 ? 1 : 0} 0 ${-r} Z`
        }
        fill={bright}
      />
    );
  } else {
    shape = (
      <path
        d={
          `M 0 ${-r} ` +
          `A ${r} ${r} 0 0 0 0 ${r} ` +
          `A ${rx} ${r} 0 0 ${cosine > 0 ? 0 : 1} 0 ${-r} Z`
        }
        fill={bright}
      />
    );
  }

  return (
    <g>
      {active && (
        <>
          <circle
            r="16"
            fill="none"
            stroke="var(--orbit-active)"
            strokeWidth="1.6"
          />
          <circle
            r="13"
            fill="var(--orbit-active)"
            opacity=".12"
          />
        </>
      )}
      <circle r={r} fill={shadow} />
      {shape}
    </g>
  );
}

function MoonOrbit({ summary, onOpenCalendar }) {
  // 28 visual positions; actual cycle length stays independent.
  const position =
    summary.day && summary.length
      ? ((summary.day - 1) % summary.length) / summary.length
      : summary.day
        ? ((summary.day - 1) % 28) / 28
        : null;

  const activeIndex =
    position === null ? -1 : Math.floor(position * 28) % 28;

  const moonPositions = Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * Math.PI * 2 - Math.PI / 2;

    return {
      x: 150 + Math.cos(angle) * 118,
      y: 150 + Math.sin(angle) * 118,
    };
  });

  return (
    <section className="orbit-section" aria-label="Cycle overview">
      <div className="orbit-heading">
        <span className="eyebrow">YOUR CYCLE</span>
        <span className="orbit-caption">28 illustrated moon phases</span>
      </div>

      <div className="orbit-wrap">
        <div className="orbit-halo" aria-hidden="true" />

        <svg
          className="moon-orbit"
          viewBox="0 0 300 300"
          role="img"
          aria-label={
            summary.day
              ? `Cycle day ${summary.day}, represented on a 28-position moon orbit`
              : "A circular illustration of 28 moon phases"
          }
        >
          <circle
            cx="150"
            cy="150"
            r="118"
            fill="none"
            stroke="var(--orbit-track)"
            strokeWidth=".8"
            strokeDasharray="2 6"
          />

          {moonPositions.map((point, index) => (
            <g
              key={index}
              className={`moon-position ${index === activeIndex ? "moon-position-active" : ""}`}
              style={{ "--moon-delay": `${index * 24}ms` }}
              transform={`translate(${point.x} ${point.y})`}
            >
              <MoonPhase
                index={index}
                active={index === activeIndex}
              />
            </g>
          ))}
        </svg>

        <div className="orbit-center">
          <span className="orbit-center-label">
            {summary.day ? "Current cycle" : "Welcome to Luna"}
          </span>

          {summary.day ? (
            <>
              <strong>Day {summary.day}</strong>
              <span className="orbit-center-detail">
                {summary.length
                  ? `${summary.length}-day recorded average`
                  : "Add more cycles for estimates"}
              </span>
            </>
          ) : (
            <>
              <strong>Your rhythm</strong>
              <span className="orbit-center-detail">
                Begin by logging a period
              </span>
            </>
          )}

          <button
            className="orbit-link"
            type="button"
            onClick={onOpenCalendar}
          >
            View calendar <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>

      <p className="orbit-disclaimer">
        Moon phases are illustrative. Cycle estimates are based
        on your records and are not medical predictions.
      </p>
    </section>
  );
}

function App() {
  const [page, setPage] = useState("cycles");
  const [journalDate, setJournalDate] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("luna-theme");

      if (saved === "dark" || saved === "light") {
        return saved;
      }
    } catch {
      // Use the light theme if storage is unavailable.
    }

    return "light";
  });

  const [cycles, setCycles] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem("luna-theme", theme);
    } catch {
      // Theme still works for the current session.
    }
  }, [theme]);

  async function loadCycles() {
    try {
      const data = await window.luna.getCycles();
      setCycles(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCycles();
  }, [dataVersion]);

  function handleDataChanged() {
    setDataVersion(version => version + 1);
    setMessage("");
  }

  function openJournal(date) {
    setJournalDate(date);
    setPage("journal");
  }

  function navigateTo(pageName) {
    if (pageName === "journal") {
      setJournalDate(null);
    }

    setPage(pageName);
  }

  async function saveCycle(event) {
    event.preventDefault();
    setMessage("");

    try {
      await window.luna.addCycle({
        startDate,
        endDate: endDate || null,
        notes,
      });

      setStartDate("");
      setEndDate("");
      setNotes("");
      setMessage("Cycle saved successfully.");

      await loadCycles();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteCycle(id) {
    if (!window.confirm("Delete this period?")) {
      return;
    }

    try {
      await window.luna.deleteCycle(id);
      setMessage("Period deleted.");
      await loadCycles();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const summary = getCycleSummary(cycles);
  const currentPage = PAGE_INFO[page];

  return (
    <main className="app">
      <div className="ambient-background" aria-hidden="true">
        <span className="ambient-orb ambient-orb-one" />
        <span className="ambient-orb ambient-orb-two" />
        <span className="ambient-orb ambient-orb-three" />
        <div className="ambient-particles">
          {AMBIENT_PARTICLES.map((particle, index) => (
            <span
              key={index}
              className="ambient-particle"
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
              }}
            />
          ))}
        </div>
      </div>

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-symbol">
            <Icon name="moon" size={25} />
          </div>

          <div>
            <div className="brand-name">luna.</div>
            <div className="brand-description">
              PERSONAL CYCLE JOURNAL
            </div>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav
          className="sidebar-nav"
          aria-label="Main navigation"
          style={{
            "--active-nav-index": NAV_ITEMS.filter(item => item.id !== "privacy")
              .findIndex(item => item.id === page),
          }}
        >
          {NAV_ITEMS.filter(item => item.id !== "privacy").map(
            item => (
              <button
                key={item.id}
                type="button"
                className={`sidebar-link ${
                  page === item.id ? "active" : ""
                }`}
                onClick={() => navigateTo(item.id)}
                aria-current={
                  page === item.id ? "page" : undefined
                }
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            )
          )}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={`sidebar-link ${
              page === "privacy" ? "active" : ""
            }`}
            onClick={() => navigateTo("privacy")}
          >
            <Icon name="shield" />
            <span>Privacy & Data</span>
          </button>

          <button
            type="button"
            className="sidebar-link theme-switch"
            onClick={() =>
              setTheme(current =>
                current === "light" ? "dark" : "light"
              )
            }
            aria-label={
              theme === "light"
                ? "Switch to dark mode"
                : "Switch to light mode"
            }
          >
            <Icon
              name={theme === "light" ? "moon" : "sun"}
            />
            <span>
              {theme === "light" ? "Dark mode" : "Light mode"}
            </span>
            <span className="theme-indicator" />
          </button>

          <div className="sidebar-footer">
            <span className="privacy-dot" />
            Your records stay on this device
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">LUNA / WORKSPACE</span>
            <h1>{currentPage.title}</h1>
            <p>{currentPage.subtitle}</p>
          </div>

          <div className="header-date">
            {new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </header>

        <div className="workspace-content" key={page}>
          {page === "journal" ? (
            <DailyJournal
              key={`${dataVersion}-${journalDate || "default"}`}
              initialDate={journalDate}
            />
          ) : page === "calendar" ? (
            <CycleCalendar
              key={dataVersion}
              onOpenJournal={openJournal}
            />
          ) : page === "insights" ? (
            <InsightsDashboard key={dataVersion} />
          ) : page === "privacy" ? (
            <PrivacySettings
              onDataChanged={handleDataChanged}
            />
          ) : (
            <>
              <MoonOrbit
                summary={summary}
                onOpenCalendar={() => navigateTo("calendar")}
              />

              <div className="overview-columns">
                <section className="panel period-panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">NEW ENTRY</span>
                      <h2>Log a period</h2>
                    </div>
                    <Icon name="plus" />
                  </div>

                  <form onSubmit={saveCycle}>
                    <label>
                      Period start date
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={event =>
                          setStartDate(event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Period end date (optional)
                      <input
                        type="date"
                        min={startDate || undefined}
                        value={endDate}
                        onChange={event =>
                          setEndDate(event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Notes
                      <textarea
                        maxLength={5000}
                        value={notes}
                        onChange={event =>
                          setNotes(event.target.value)
                        }
                        placeholder="Anything you'd like to remember?"
                      />
                    </label>

                    <button type="submit">
                      Save cycle
                    </button>
                  </form>

                  {message && (
                    <p role="status" className="status-message luna-feedback">
                      {message}
                    </p>
                  )}
                </section>

                <section className="panel history-panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">YOUR RECORDS</span>
                      <h2>Cycle history</h2>
                    </div>
                    <span className="record-count">
                      {cycles.length} records
                    </span>
                  </div>

                  {loading ? (
                    <p className="empty-state">
                      Loading your records…
                    </p>
                  ) : cycles.length === 0 ? (
                    <div className="empty-state">
                      <Icon name="calendar" size={28} />
                      <p>No periods recorded yet.</p>
                      <span>
                        Your saved cycles will appear here.
                      </span>
                    </div>
                  ) : (
                    <div className="cycle-list">
                      {cycles.map(cycle => (
                        <div
                          className="cycle"
                          key={cycle.id}
                        >
                          <div className="cycle-details">
                            <strong>
                              {formatDate(cycle.start_date)}
                            </strong>

                            <p>
                              {cycle.end_date
                                ? `Ended ${formatDate(
                                    cycle.end_date
                                  )}`
                                : "End date not recorded"}
                            </p>

                            {cycle.notes && (
                              <p className="cycle-notes">
                                {cycle.notes}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            className="delete"
                            onClick={() =>
                              deleteCycle(cycle.id)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default App;
