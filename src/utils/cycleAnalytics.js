
import { daysBetween } from "./cyclePrediction";

const VALID_FLOWS = [
  "none", "spotting", "light", "medium", "heavy"
];

function validDate(key) {
  if (
    typeof key !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(key)
  ) return false;

  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  return date.toISOString().slice(0, 10) === key;
}

function average(values) {
  if (!values.length) return null;

  return values.reduce((sum, value) => sum + value, 0) /
    values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return null;

  const mean = average(values);

  return Math.sqrt(
    values.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0
    ) / values.length
  );
}

function round(value, digits = 1) {
  return value === null
    ? null
    : Number(value.toFixed(digits));
}

function frequency(items) {
  const counts = new Map();

  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) =>
      b.count - a.count || a.name.localeCompare(b.name)
    );
}

export function calculateAnalytics(cycles, logs) {
  const sortedCycles = [...cycles]
    .filter(cycle => validDate(cycle.start_date))
    .sort((a, b) =>
      a.start_date.localeCompare(b.start_date)
    );

  const uniqueCycles = sortedCycles.filter(
    (cycle, index, arr) =>
      index === 0 ||
      cycle.start_date !== arr[index - 1].start_date
  );

  const cycleTrend = [];

  for (let i = 1; i < uniqueCycles.length; i++) {
    const previous = uniqueCycles[i - 1];
    const current = uniqueCycles[i];

    const length = daysBetween(
      previous.start_date,
      current.start_date
    );

    cycleTrend.push({
      date: current.start_date,
      label: current.start_date.slice(5),
      length,
      valid: length >= 15 && length <= 90,
    });
  }

  const validCycleTrend = cycleTrend.filter(
    item => item.valid
  );

  const lengths = validCycleTrend.map(
    item => item.length
  );

  const durationTrend = uniqueCycles
    .filter(cycle =>
      validDate(cycle.end_date) &&
      cycle.end_date >= cycle.start_date
    )
    .map(cycle => ({
      date: cycle.start_date,
      label: cycle.start_date.slice(5),
      duration: daysBetween(
        cycle.start_date,
        cycle.end_date
      ) + 1,
    }))
    .filter(item =>
      item.duration >= 1 && item.duration <= 30
    );

  const durations = durationTrend.map(
    item => item.duration
  );

  const sortedLogs = [...logs]
    .filter(log => validDate(log.logDate))
    .sort((a, b) =>
      a.logDate.localeCompare(b.logDate)
    );

  const symptoms = frequency(
    sortedLogs.flatMap(log =>
      Array.isArray(log.symptoms)
        ? [...new Set(log.symptoms)]
        : []
    )
  );

  const moods = frequency(
    sortedLogs.flatMap(log =>
      Array.isArray(log.moods)
        ? [...new Set(log.moods)]
        : []
    )
  );

  const flowCounts = VALID_FLOWS.map(flow => ({
    name: flow,
    count: sortedLogs.filter(
      log => log.flow === flow
    ).length,
  }));

  const monthlyCounts = new Map();

  for (const log of sortedLogs) {
    const month = log.logDate.slice(0, 7);

    monthlyCounts.set(
      month,
      (monthlyCounts.get(month) || 0) + 1
    );
  }

  const monthlyActivity = [...monthlyCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month,
      label: month,
      count,
    }));

  const avgCycle = average(lengths);
  const avgPeriod = average(durations);
  const variability = standardDeviation(lengths);

  return {
    totalPeriods: uniqueCycles.length,
    totalLogs: sortedLogs.length,
    completedPeriods: durations.length,
    validIntervals: lengths.length,
    excludedIntervals:
      cycleTrend.length - validCycleTrend.length,

    avgCycle: round(avgCycle),
    avgPeriod: round(avgPeriod),
    variability: round(variability),

    shortestCycle: lengths.length
      ? Math.min(...lengths)
      : null,

    longestCycle: lengths.length
      ? Math.max(...lengths)
      : null,

    cycleTrend,
    validCycleTrend,
    durationTrend,
    symptoms,
    moods,
    flowCounts,
    monthlyActivity,
  };
}
