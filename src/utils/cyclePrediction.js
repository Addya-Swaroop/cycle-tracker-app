
const DAY_MS = 24 * 60 * 60 * 1000;

function toUTC(key) {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(key, days) {
  const date = new Date(toUTC(key) + days * DAY_MS);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(start, end) {
  return Math.round((toUTC(end) - toUTC(start)) / DAY_MS);
}

export function localToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDate(key) {
  const date = new Date(toUTC(key));

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function calculatePrediction(cycles) {
  const today = localToday();

  const starts = [
    ...new Set(
      cycles
        .map(cycle => cycle.start_date)
        .filter(date =>
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          date <= today
        )
    ),
  ].sort();

  if (starts.length < 2) {
    return {
      available: false,
      message:
        "Log at least two period start dates to see an estimate.",
    };
  }

  const intervals = [];

  for (let i = 1; i < starts.length; i++) {
    const length = daysBetween(starts[i - 1], starts[i]);

    // Flag implausible intervals instead of silently
    // treating them as typical cycles.
    if (length < 15 || length > 90) {
      return {
        available: false,
        message:
          "Your recorded dates contain an unusually short or long interval. Review your cycle history before using predictions.",
      };
    }

    intervals.push(length);
  }

  // Use up to the six most recent intervals.
  const recent = intervals.slice(-6);

  // More recent cycles receive more weight.
  const weights = recent.map((_, index) => index + 1);
  const weightTotal = weights.reduce((a, b) => a + b, 0);

  const weightedAverage = recent.reduce(
    (sum, length, index) =>
      sum + length * weights[index],
    0
  ) / weightTotal;

  const average = Math.round(weightedAverage);

  const variance = recent.reduce(
    (sum, length) =>
      sum + Math.pow(length - weightedAverage, 2),
    0
  ) / recent.length;

  const standardDeviation = Math.sqrt(variance);

  // At least three days of uncertainty on either side.
  // This is a display heuristic, not a calibrated
  // statistical confidence interval.
  const margin = Math.max(
    3,
    Math.ceil(standardDeviation * 1.5)
  );

  const lastStart = starts[starts.length - 1];
  const expectedDate = addDays(lastStart, average);
  const windowStart = addDays(expectedDate, -margin);
  const windowEnd = addDays(expectedDate, margin);

  const daysSinceLastStart = daysBetween(lastStart, today);
  const overdue = today > windowEnd;

  let reliability = "Limited history";

  if (recent.length >= 3) {
    reliability =
      standardDeviation <= 3
        ? "More consistent history"
        : standardDeviation <= 7
          ? "Variable history"
          : "Highly variable history";
  }

  return {
    available: true,
    average,
    variation: Number(standardDeviation.toFixed(1)),
    margin,
    sampleSize: recent.length,
    lastStart,
    expectedDate,
    windowStart,
    windowEnd,
    overdue,
    daysSinceLastStart,
    reliability,
    intervals: recent,
  };
}
