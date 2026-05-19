// Mock data for development
import type { P2PMetric, ChartDataPoint } from '@/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Convert raw daily data to chart data with day-number labels and month boundaries
export function formatDailyChartData(
  source: { date: string; value: number }[]
): ChartDataPoint[] {
  const sorted = [...source].sort((a, b) => a.date.localeCompare(b.date));
  const result: ChartDataPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const { date, value } = sorted[i];
    const d = new Date(date + 'T00:00:00');
    const dayNum = d.getDate();
    const month = d.getMonth();

    // Check if this is first day of a month (or first data point overall)
    const isMonthStart = i === 0 || d.getMonth() !== new Date(sorted[i - 1].date + 'T00:00:00').getMonth();

    result.push({
      label: isMonthStart ? `${MONTH_NAMES[month]} ${dayNum}` : String(dayNum),
      value,
      fullDate: date,
      isMonthStart,
      monthName: isMonthStart ? MONTH_NAMES[month] : undefined,
    });
  }

  return result;
}

// Generate 31 days of mock P2P data (for Graph 1 - DAILY P2P SPRAYED)
function generateP2PMockData(): P2PMetric[] {
  const data: P2PMetric[] = [];
  const now = new Date();
  let id = 1;

  // 31-day window: start = today - 30 days, end = today (31 days total)
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const dateStr = date.toISOString().split('T')[0];
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    data.push({
      id: id++,
      date: dateStr,
      month: monthStr,
      daily_value: Math.round((Math.random() * 80 + 20) * 100) / 100,
      created_at: date.toISOString(),
    });
  }

  return data;
}

// Generate mock data for DAILY SEEDLING SPRAYED (Graph 2)
function generateSeedlingDailyData() {
  const data: { date: string; value: number }[] = [];
  const now = new Date();

  // 31-day window: start = today - 30 days, end = today (31 days total)
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    data.push({
      date: dateStr,
      value: Math.round((Math.random() * 60 + 10) * 100) / 100,
    });
  }

  return formatDailyChartData(data);
}

// Format year-month key (e.g. 2026-05)
function formatKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

// Get the 12-month rolling window keys (11 months before current → current month)
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

// Build monthly chart data from raw P2P data, filtered to a 12-month rolling window
function buildMonthlyData(
  dataMap: Map<string, number>,
  windowKeys: string[]
): ChartDataPoint[] {
  return windowKeys.map((key) => {
    const [y, m] = key.split('-').map(Number);
    const monthIndex = m - 1;
    const value = dataMap.has(key) ? dataMap.get(key)! : 0;
    return {
      label: MONTH_NAMES[monthIndex],
      value: Math.round(value * 100) / 100,
      fullDate: key,
      monthName: MONTH_NAMES[monthIndex],
    };
  });
}

// Mock data for MONTHLY P2P SPRAYED (Graph 3) — 12-month rolling window
function generateP2PMonthlyData(p2pData: P2PMetric[]): ChartDataPoint[] {
  const monthMap: Record<string, number> = {};
  for (const m of p2pData) {
    if (!monthMap[m.month]) monthMap[m.month] = 0;
    monthMap[m.month] += m.daily_value;
  }
  const dataMap = new Map(Object.entries(monthMap));
  const windowKeys = getMonthlyWindowKeys();
  return buildMonthlyData(dataMap, windowKeys);
}

// Mock data for MONTHLY SEEDLING SPRAYED (Graph 4) — 12-month rolling window
function generateSeedlingMonthlyData(): ChartDataPoint[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const dataMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    if (m < 0) { y -= 1; m += 12; }
    const key = formatKey(y, m);
    // Generate a random monthly total between 200 and 800
    dataMap.set(key, Math.round((Math.random() * 600 + 200) * 100) / 100);
  }

  const windowKeys = getMonthlyWindowKeys();
  return buildMonthlyData(dataMap, windowKeys);
}

// Generate all mock datasets
const mockP2P = generateP2PMockData();

export const MOCK_P2P_METRICS = mockP2P;
export const MOCK_SEEDLING_DAILY = generateSeedlingDailyData();
export const MOCK_P2P_MONTHLY = generateP2PMonthlyData(mockP2P);
export const MOCK_SEEDLING_MONTHLY = generateSeedlingMonthlyData();

// Get averages for P2P footer cards
export function getP2PAverages(data: P2PMetric[]) {
  if (data.length === 0) return { avgDaily: 0, avgMonthly: 0 };

  const totalDaily = data.reduce((sum, m) => sum + m.daily_value, 0);
  const avgDaily = Math.round((totalDaily / data.length) * 100) / 100;

  const monthMap: Record<string, number> = {};
  for (const m of data) {
    if (!monthMap[m.month]) monthMap[m.month] = 0;
    monthMap[m.month] += m.daily_value;
  }

  const monthTotals = Object.values(monthMap);
  const avgMonthly = monthTotals.length > 0
    ? Math.round((monthTotals.reduce((a, b) => a + b, 0) / monthTotals.length) * 100) / 100
    : 0;

  return { avgDaily, avgMonthly };
}

// Get averages for Seedling footer cards
export function getSeedlingAverages(data: { date: string; daily_value: number }[]) {
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
