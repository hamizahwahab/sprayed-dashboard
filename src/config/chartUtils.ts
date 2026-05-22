// Data processing utilities
import type { ChartDataPoint } from '@/types';

/** Abbreviated month names used for chart axis labels and display. Indexed 0-11. */
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Convert raw daily data to chart data with day-number labels and month boundaries.
 *
 * @param source - Unsorted array of daily data points with date string and numeric value
 * @returns ChartDataPoint[] sorted by date, with labels showing day numbers
 *          (prefixed by month name on month boundaries) and isMonthStart flags
 */
export function formatDailyChartData(
  source: { date: string; value: number }[]
): ChartDataPoint[] {
  const sorted = [...source].sort((a, b) => a.date.localeCompare(b.date));
  const result: ChartDataPoint[] = [];

  let prevMonth = -1;
  for (let i = 0; i < sorted.length; i++) {
    const { date, value } = sorted[i];
    const d = new Date(date + 'T00:00:00');
    const dayNum = d.getDate();
    const month = d.getMonth();

    // Check if this is first day of a month (or first data point overall)
    const isMonthStart = i === 0 || month !== prevMonth;
    prevMonth = month;

    result.push({
      label: isMonthStart ? MONTH_NAMES[month] : String(dayNum),
      value,
      fullDate: date,
      isMonthStart,
      monthName: isMonthStart ? MONTH_NAMES[month] : undefined,
    });
  }

  return result;
}

function formatDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildDailyWindowData(
  source: { date: string; value: number }[],
  windowDays = 31,
  endDate?: string
): ChartDataPoint[] {
  if (windowDays < 1) return [];

  const now = endDate ? new Date(`${endDate}T00:00:00`) : new Date();
  const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowStart = new Date(windowEnd);
  windowStart.setDate(windowEnd.getDate() - (windowDays - 1));

  const valueMap: Record<string, number> = {};
  for (const item of source) {
    if (!item?.date) continue;
    valueMap[item.date] = item.value;
  }

  const points: { date: string; value: number }[] = [];
  for (let current = new Date(windowStart); current <= windowEnd; current.setDate(current.getDate() + 1)) {
    const dateKey = formatDateIso(current);
    points.push({ date: dateKey, value: valueMap[dateKey] ?? 0 });
  }

  return formatDailyChartData(points);
}

/**
 * Check if the window end date (today by default) exists as real data in the source.
 * Used to validate whether the daily chart window is complete before applying danger logic.
 *
 * @param source - Raw metrics with date strings
 * @param endDate - Optional end date; defaults to today
 * @returns true if endDate exists in source, false otherwise
 */
export function isWindowComplete(
  source: { date: string; value: number }[],
  endDate?: string
): boolean {
  const now = endDate ? new Date(`${endDate}T00:00:00`) : new Date();
  const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDateKey = formatDateIso(windowEnd);
  return source.some(item => item.date === endDateKey);
}

// Format year-month key (e.g. 2026-05)
function formatKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Get the 12-month rolling window keys (11 months before current → current month).
 * Used to align monthly chart data to a fixed 12-month x-axis regardless of
 * whether data exists for every month.
 *
 * @returns Array of 12 "YYYY-MM" strings ending with the current month
 */
export function getMonthlyWindowKeys(): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    if (m < 0) { y -= 1; m += 12; }
    keys.push(formatKey(y, m));
  }
  return keys;
}

// ── Shared helpers for monthly chart data ──

/**
 * Aggregate daily metrics by month, summing daily_value per "YYYY-MM" key.
 * The month is derived from the date field (substring 0-7), so this works
 * for both P2P and Seedling metric types.
 *
 * @param metrics - Array of metric objects with date and daily_value
 * @returns Map of "YYYY-MM" → sum of daily_values for that month
 */
export function aggregateByMonth(
  metrics: { date: string; daily_value: number }[]
): Record<string, number> {
  const monthMap: Record<string, number> = {};
  for (const m of metrics) {
    const monthKey = m.date.substring(0, 7);
    if (!monthMap[monthKey]) monthMap[monthKey] = 0;
    monthMap[monthKey] += m.daily_value;
  }
  return monthMap;
}

/**
 * Build monthly ChartDataPoint[] from an aggregated month map and 12-month window keys.
 * Fills missing months with a value of 0 so the chart always shows a complete 12-month span.
 *
 * @param monthMap   - Map of "YYYY-MM" → total value (from aggregateByMonth)
 * @param windowKeys - Optional custom window keys; defaults to getMonthlyWindowKeys()
 * @returns Array of ChartDataPoint for each month in the window, with abbreviated month labels
 */
export function buildMonthlyChartData(
  monthMap: Record<string, number>,
  windowKeys?: string[]
): ChartDataPoint[] {
  const keys = windowKeys || getMonthlyWindowKeys();
  return keys.map((key) => {
    const [y, m] = key.split('-').map(Number);
    const monthIndex = m - 1;
    const value = monthMap[key] ?? 0;
    return {
      label: MONTH_NAMES[monthIndex],
      value: Math.round(value * 100) / 100,
      fullDate: key,
      monthName: MONTH_NAMES[monthIndex],
    };
  });
}

/**
 * Get daily and monthly averages for footer summary cards.
 * Derives month from the `date` field substring (0-7), working for both P2P and Seedling.
 *
 * @param data - Array of metric objects with date and daily_value
 * @returns Object with `avgDaily` (mean across all records) and
 *          `avgMonthly` (mean of per-month totals)
 */
export function getAverages(data: { date: string; daily_value: number }[]) {
  if (data.length === 0) return { avgDaily: 0, avgMonthly: 0 };

  const totalDaily = data.reduce((sum, m) => sum + m.daily_value, 0);
  const avgDaily = Math.round((totalDaily / data.length) * 100) / 100;

  const monthMap: Record<string, number> = {};
  for (const m of data) {
    const month = m.date.substring(0, 7);
    if (!monthMap[month]) monthMap[month] = 0;
    monthMap[month] += m.daily_value;
  }

  const monthTotals = Object.values(monthMap);
  const avgMonthly = monthTotals.length > 0
    ? Math.round((monthTotals.reduce((a, b) => a + b, 0) / monthTotals.length) * 100) / 100
    : 0;

  return { avgDaily, avgMonthly };
}
