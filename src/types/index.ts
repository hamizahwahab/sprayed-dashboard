// Shared Types for Sprayed Dashboard

/** Base type shared by both p2p_metrics and seedling_metrics tables (same schema). */
export interface MetricBase {
  /** Auto-incrementing primary key */
  id: number;
  /** Record date in YYYY-MM-DD format (e.g. "2026-05-18") */
  date: string;
  /** Cached year-month derived from date, in YYYY-MM format (e.g. "2026-05") */
  month: string;
  /** Numeric value recorded for this date (always ≥ 0) */
  daily_value: number;
  /** ISO-8601 timestamp of when the record was inserted */
  created_at: string;
}

// P2P / Seedling metric aliases (same schema as MetricBase; separate names for code clarity)
export type P2PMetric = MetricBase;
export type SeedlingMetric = MetricBase;

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
