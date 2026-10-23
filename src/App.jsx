
import { useEffect, useState } from "react";
import DailyJournal from "./components/DailyJournal";
import CycleCalendar from "./components/CycleCalendar";
import InsightsDashboard from "./components/InsightsDashboard";
import "./App.css";

function App() {
  const [page, setPage] = useState("cycles");
  const [journalDate, setJournalDate] = useState(null);

  const [cycles, setCycles] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  async function loadCycles() {
    try {
      const data = await window.luna.getCycles();
      setCycles(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadCycles();
  }, []);

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
      setMessage("Cycle saved successfully!");

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

  return (
    <main className="app">
      <header className="app-header">
        <h1>Luna ✿</h1>
        <p>Your cycle, your rhythm, your privacy.</p>
      </header>

      <nav className="app-nav">
        <button
          type="button"
          className={page === "cycles" ? "active" : ""}
          onClick={() => navigateTo("cycles")}
        >
          Cycle Tracker
        </button>

        <button
          type="button"
          className={page === "calendar" ? "active" : ""}
          onClick={() => navigateTo("calendar")}
        >
          Calendar
        </button>

        <button
          type="button"
          className={page === "journal" ? "active" : ""}
          onClick={() => navigateTo("journal")}
        >
          Daily Journal
        </button>

        <button
          type="button"
          className={page === "insights" ? "active" : ""}
          onClick={() => navigateTo("insights")}
        >
          Insights
        </button>
      </nav>

      {page === "journal" ? (
        <DailyJournal
          key={journalDate || "default"}
          initialDate={journalDate}
        />
      ) : page === "calendar" ? (
        <CycleCalendar onOpenJournal={openJournal} />
      ) : page === "insights" ? (
        <InsightsDashboard />
      ) : (
        <>
          <section className="panel">
            <h2>Log a period</h2>

            <form onSubmit={saveCycle}>
              <label>
                Period start date
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value)
                  }
                />
              </label>

              <label>
                Period end date (optional)
                <input
                  type="date"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(e.target.value)
                  }
                />
              </label>

              <label>
                Notes
                <textarea
                  maxLength={5000}
                  value={notes}
                  onChange={(e) =>
                    setNotes(e.target.value)
                  }
                  placeholder="Anything you'd like to remember?"
                />
              </label>

              <button type="submit">
                Save cycle
              </button>
            </form>

            {message && (
              <p role="status">{message}</p>
            )}
          </section>

          <section className="panel">
            <h2>Cycle History</h2>

            {cycles.length === 0 ? (
              <p>No periods recorded yet.</p>
            ) : (
              cycles.map((cycle) => (
                <div className="cycle" key={cycle.id}>
                  <div>
                    <strong>{cycle.start_date}</strong>

                    <p>
                      End: {cycle.end_date || "Ongoing"}
                    </p>

                    {cycle.notes && (
                      <p>{cycle.notes}</p>
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
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default App;
