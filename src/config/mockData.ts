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

// Generate 30 days of mock P2P data (for Graph 1 - DAILY P2P SPRAYED)
function generateP2PMockData(): P2PMetric[] {
  const data: P2PMetric[] = [];
  const now = new Date();
  let id = 1;

  for (let i = 29; i >= 0; i--) {
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

  for (let i = 13; i >= 0; i--) {
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

// Mock data for MONTHLY P2P SPRAYED (Graph 3)
function generateP2PMonthlyData(p2pData: P2PMetric[]): ChartDataPoint[] {
  const monthMap: Record<string, number> = {};
  for (const m of p2pData) {
    if (!monthMap[m.month]) monthMap[m.month] = 0;
    monthMap[m.month] += m.daily_value;
  }
  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => {
      const [y, m] = month.split('-');
      const monthIndex = parseInt(m) - 1;
      return {
        label: MONTH_NAMES[monthIndex],
        value: Math.round(total * 100) / 100,
        fullDate: month,
        monthName: MONTH_NAMES[monthIndex],
      };
    });
}

// Mock data for MONTHLY SEEDLING SPRAYED (Graph 4)
function generateSeedlingMonthlyData(): ChartDataPoint[] {
  return [
    { label: 'Feb', value: 820, fullDate: '2026-02', monthName: 'Feb' },
    { label: 'Mar', value: 1050, fullDate: '2026-03', monthName: 'Mar' },
    { label: 'Apr', value: 940, fullDate: '2026-04', monthName: 'Apr' },
    { label: 'May', value: 780, fullDate: '2026-05', monthName: 'May' },
  ];
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
export function getSeedlingAverages() {
  const daily = MOCK_SEEDLING_DAILY;
  const monthly = MOCK_SEEDLING_MONTHLY;

  const avgDaily = daily.length > 0
    ? Math.round((daily.reduce((s, d) => s + d.value, 0) / daily.length) * 100) / 100
    : 0;

  const avgMonthly = monthly.length > 0
    ? Math.round((monthly.reduce((s, m) => s + m.value, 0) / monthly.length) * 100) / 100
    : 0;

  return { avgDaily, avgMonthly };
}
