
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { calculateAnalytics } from "../utils/cycleAnalytics";
import "./InsightsDashboard.css";

const COLORS = {
  rose: "#B87C96",
  olive: "#788B65",
  lavender: "#9C83B8",
  peach: "#D7A27D",
  grid: "var(--insights-grid)",
  text: "var(--insights-chart-text)",
};

function titleCase(value) {
  return value
    .split(" ")
    .map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function StatCard({ label, value, description }) {
  return (
    <div className="insight-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  empty,
  emptyMessage,
}) {
  return (
    <section className="insight-chart-card">
      <h3>{title}</h3>
      <p>{description}</p>

      {empty ? (
        <div className="insight-empty">
          {emptyMessage}
        </div>
      ) : (
        <div className="insight-chart">
          {children}
        </div>
      )}
    </section>
  );
}

export default function InsightsDashboard() {
  const [cycles, setCycles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const analytics = useMemo(
    () => calculateAnalytics(cycles, logs),
    [cycles, logs]
  );

  const topSymptoms = analytics.symptoms.slice(0, 8);
  const topMoods = analytics.moods.slice(0, 8);

  const recordedFlows = analytics.flowCounts.filter(
    item => item.count > 0
  );

  const insights = [];

  if (analytics.validIntervals >= 2) {
    insights.push(
      `Your recorded cycle lengths range from ` +
      `${analytics.shortestCycle} to ` +
      `${analytics.longestCycle} days.`
    );
  }

  if (topSymptoms.length > 0) {
    insights.push(
      `${titleCase(topSymptoms[0].name)} is your ` +
      `most frequently logged symptom, recorded ` +
      `on ${topSymptoms[0].count} day(s).`
    );
  }

  if (topMoods.length > 0) {
    insights.push(
      `${titleCase(topMoods[0].name)} is your ` +
      `most frequently logged mood, recorded ` +
      `on ${topMoods[0].count} day(s).`
    );
  }

  if (analytics.excludedIntervals > 0) {
    insights.push(
      `${analytics.excludedIntervals} cycle ` +
      `interval(s) outside the 15–90 day analysis ` +
      `range were excluded from summary statistics. ` +
      `Review the recorded dates for accuracy.`
    );
  }

  if (loading) {
    return (
      <div className="insights-page">
        <section className="panel">
          <p>Loading your insights...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-page">
        <section className="panel">
          <p className="error-message" role="alert">
            {error}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="insights-page">
      <section className="panel insights-intro">
        <div>
          <p className="insights-eyebrow">
            LUNA / PERSONAL INSIGHTS
          </p>

          <h2>Your Cycle Insights 🌷</h2>

          <p>
            A closer look at your recorded patterns,
            moods, and symptoms.
          </p>
        </div>

        <div className="insights-decoration">
          ✦
        </div>
      </section>

      <div className="insights-stat-grid">
        <StatCard
          label="Average cycle length"
          value={
            analytics.avgCycle === null
              ? "—"
              : `${analytics.avgCycle} days`
          }
          description={
            `${analytics.validIntervals} intervals analysed`
          }
        />

        <StatCard
          label="Average period duration"
          value={
            analytics.avgPeriod === null
              ? "—"
              : `${analytics.avgPeriod} days`
          }
          description={
            `${analytics.completedPeriods} completed periods`
          }
        />

        <StatCard
          label="Cycle variability"
          value={
            analytics.variability === null
              ? "—"
              : `${analytics.variability} days`
          }
          description="Standard deviation of cycle lengths"
        />

        <StatCard
          label="Daily entries"
          value={analytics.totalLogs}
          description="Days with journal records"
        />
      </div>

      <div className="insights-chart-grid">
        <ChartCard
          title="Cycle Length Trend"
          description={
            "Days between consecutive recorded period starts."
          }
          empty={analytics.validCycleTrend.length === 0}
          emptyMessage={
            "Log at least two period start dates to see your cycle trend."
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={analytics.validCycleTrend}
              margin={{ top: 10, right: 15, bottom: 10, left: -20 }}
            >
              <CartesianGrid
                stroke={COLORS.grid}
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <YAxis
                domain={["auto", "auto"]}
                allowDecimals={false}
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }}
                labelStyle={{ color: "var(--text)" }}
                itemStyle={{ color: "var(--text)" }}
                formatter={value => [
                  `${value} days`,
                  "Cycle length",
                ]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.date || ""
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="length"
                name="Cycle length"
                stroke={COLORS.rose}
                strokeWidth={3}
                dot={{ r: 5 }}
                activeDot={{ r: 7 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Period Duration"
          description={
            "Recorded bleeding duration for completed periods."
          }
          empty={analytics.durationTrend.length === 0}
          emptyMessage={
            "Add period end dates to see duration trends."
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analytics.durationTrend}
              margin={{ top: 10, right: 15, bottom: 10, left: -20 }}
            >
              <CartesianGrid
                stroke={COLORS.grid}
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }}
                labelStyle={{ color: "var(--text)" }}
                itemStyle={{ color: "var(--text)" }}
                formatter={value => [
                  `${value} days`,
                  "Period duration",
                ]}
              />
              <Bar
                dataKey="duration"
                name="Period duration"
                fill={COLORS.peach}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Most Logged Symptoms"
          description={
            "Number of journal days on which each symptom was selected."
          }
          empty={topSymptoms.length === 0}
          emptyMessage={
            "Track symptoms in your Daily Journal to see patterns."
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topSymptoms.map(item => ({
                ...item,
                name: titleCase(item.name),
              }))}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
            >
              <CartesianGrid
                stroke={COLORS.grid}
                strokeDasharray="4 4"
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={115}
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }} labelStyle={{ color: "var(--text)" }} itemStyle={{ color: "var(--text)" }} />
              <Bar
                dataKey="count"
                name="Logged days"
                fill={COLORS.olive}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Mood Patterns"
          description={
            "How often different moods were selected."
          }
          empty={topMoods.length === 0}
          emptyMessage={
            "Record moods in your Daily Journal to see their frequency."
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topMoods.map(item => ({
                ...item,
                name: titleCase(item.name),
              }))}
              margin={{ top: 10, right: 15, bottom: 10, left: -20 }}
            >
              <CartesianGrid
                stroke={COLORS.grid}
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="name"
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }} labelStyle={{ color: "var(--text)" }} itemStyle={{ color: "var(--text)" }} />
              <Bar
                dataKey="count"
                name="Logged days"
                fill={COLORS.lavender}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Flow Tracking"
          description={
            "Distribution of flow intensity across logged days."
          }
          empty={recordedFlows.length === 0}
          emptyMessage={
            "Add daily flow records to see their distribution."
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={recordedFlows.map(item => ({
                ...item,
                name: titleCase(item.name),
              }))}
              margin={{ top: 10, right: 15, bottom: 10, left: -20 }}
            >
              <CartesianGrid
                stroke={COLORS.grid}
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="name"
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }} labelStyle={{ color: "var(--text)" }} itemStyle={{ color: "var(--text)" }} />
              <Bar
                dataKey="count"
                name="Logged days"
                fill={COLORS.rose}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Monthly Journal Activity"
          description={
            "How many different days you recorded each month."
          }
          empty={analytics.monthlyActivity.length === 0}
          emptyMessage={
            "Your monthly logging activity will appear here."
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={analytics.monthlyActivity}
              margin={{ top: 10, right: 15, bottom: 10, left: -20 }}
            >
              <CartesianGrid
                stroke={COLORS.grid}
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: COLORS.text, fontSize: 11 }}
              />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }} labelStyle={{ color: "var(--text)" }} itemStyle={{ color: "var(--text)" }} />
              <Line
                type="monotone"
                dataKey="count"
                name="Days logged"
                stroke={COLORS.olive}
                strokeWidth={3}
                dot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="panel">
        <h2>What Your Records Show ✨</h2>

        {insights.length === 0 ? (
          <p className="insight-empty-text">
            Keep logging your periods and daily wellness
            entries. Your personal summaries will
            appear here as you collect more data.
          </p>
        ) : (
          <div className="insights-summary">
            {insights.map((insight, index) => (
              <div
                className="insight-summary-item"
                key={index}
              >
                <span>✦</span>
                <p>{insight}</p>
              </div>
            ))}
          </div>
        )}

        <p className="insights-disclaimer">
          These insights describe recorded entries,
          not your entire health history. Unlogged days
          are unknown, and observed patterns do not
          establish medical causes or diagnoses.
        </p>
      </section>
    </div>
  );
}
