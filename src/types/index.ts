// Shared Types for Sprayed Dashboard

export interface P2PMetric {
  id: number;
  date: string;
  month: string;
  daily_value: number;
  created_at: string;
}

export interface SeedlingMetric {
  id: number;
  date: string;
  month: string;
  daily_value: number;
  created_at: string;
}

// Chart data point (used by Recharts)
export interface ChartDataPoint {
  label: string;
  value: number;
  /** Full date string for tooltip (e.g. "2026-05-18") */
  fullDate?: string;
  /** Whether this point is the first day of a month */
  isMonthStart?: boolean;
  /** Month label to show (e.g. "May") */
  monthName?: string;
}
