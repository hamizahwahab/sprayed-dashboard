'use client';

/// <reference path="../types/electron.d.ts" />

import { useState, useEffect, useMemo, useCallback } from 'react';
import AreaChartCard from '@/components/AreaChartCard';
import FooterSummary from '@/components/FooterSummary';
import { P2P_API_URL, SEEDLING_API_URL, API_CONFIG } from '@/config/api';
import {
  getAverages,
  buildDailyWindowData,
  isWindowComplete,
  aggregateByMonth,
  buildMonthlyChartData,
} from '@/config/chartUtils';
import type { P2PMetric, SeedlingMetric, ChartDataPoint } from '@/types';

// ── Shared helpers ──

// Determine if a daily chart is in danger mode (value decreased from earliest to latest date)
function calcDanger(data: ChartDataPoint[]): boolean {
  if (data.length < 2) return false;
  const firstValue = data[0].value;
  const lastValue = data[data.length - 1].value;
  return firstValue > lastValue;
}

// Fetch metrics from a given API endpoint and set the result via the state setter
async function fetchMetrics<T>(
  url: string,
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  onError?: () => void,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      onError?.();
      return;
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      setter(data as T[]);
    }
    onSuccess?.();
  } catch {
    onError?.();
  }
}

// Build daily chart data from raw metrics using a fixed 31-day window ending today
function buildDailyData(
  metrics: { date: string; daily_value: number }[]
): ChartDataPoint[] {
  if (metrics.length === 0) return [];
  return buildDailyWindowData(
    metrics.map(m => ({ date: m.date, value: m.daily_value })),
    31
  );
}

export default function Dashboard() {
  const [p2pMetrics, setP2pMetrics] = useState<P2PMetric[]>([]);
  const [seedlingMetrics, setSeedlingMetrics] = useState<SeedlingMetric[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [apiError, setApiError] = useState(false);
  const clearError = useCallback(() => setApiError(false), []);

  useEffect(() => {
    Promise.all([
      fetchMetrics(P2P_API_URL, setP2pMetrics, () => setApiError(true), clearError),
      fetchMetrics(SEEDLING_API_URL, setSeedlingMetrics, () => setApiError(true), clearError),
    ]).finally(() => {
      setInitialLoad(false);
    });

    let pollInterval: NodeJS.Timeout | null = null;
    if (API_CONFIG.POLL_INTERVAL > 0) {
      pollInterval = setInterval(() => {
        fetchMetrics(P2P_API_URL, setP2pMetrics, () => setApiError(true), clearError);
        fetchMetrics(SEEDLING_API_URL, setSeedlingMetrics, () => setApiError(true), clearError);
      }, API_CONFIG.POLL_INTERVAL);
    }

    window.electronAPI?.onRefreshP2PMetrics(() => {
      fetchMetrics(P2P_API_URL, setP2pMetrics, () => setApiError(true), clearError);
    });
    window.electronAPI?.onRefreshSeedlingMetrics(() => {
      fetchMetrics(SEEDLING_API_URL, setSeedlingMetrics, () => setApiError(true), clearError);
    });

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      window.electronAPI?.removeRefreshListener();
      window.electronAPI?.removeSeedlingRefreshListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Graph 1: DAILY P2P SPRAYED — from DB, fixed window ending today (31 days)
  const dailyP2PData = useMemo(() => buildDailyData(p2pMetrics), [p2pMetrics]);

  // Danger: only true if window is complete AND earliest value > latest value
  const p2pDanger = useMemo(() => {
    const windowComplete = isWindowComplete(
      p2pMetrics.map(m => ({ date: m.date, value: m.daily_value }))
    );
    return windowComplete && calcDanger(dailyP2PData);
  }, [dailyP2PData, p2pMetrics]);

  // Graph 3: MONTHLY P2P SPRAYED — derived from DB data, 12-month rolling window
  const monthlyP2PData = useMemo<ChartDataPoint[]>(() => {
    if (p2pMetrics.length === 0) return [];
    const monthMap = aggregateByMonth(p2pMetrics);
    return buildMonthlyChartData(monthMap);
  }, [p2pMetrics]);

  // Graph 2: DAILY SEEDLING SPRAYED — from API, fixed window ending today (31 days)
  const seedlingDailyData = useMemo(() => buildDailyData(seedlingMetrics), [seedlingMetrics]);

  // Danger: only true if window is complete AND earliest value > latest value
  const seedlingDanger = useMemo(() => {
    const windowComplete = isWindowComplete(
      seedlingMetrics.map(m => ({ date: m.date, value: m.daily_value }))
    );
    return windowComplete && calcDanger(seedlingDailyData);
  }, [seedlingDailyData, seedlingMetrics]);

  // Graph 4: MONTHLY SEEDLING SPRAYED — derived from API data, 12-month rolling window
  const seedlingMonthlyData = useMemo<ChartDataPoint[]>(() => {
    if (seedlingMetrics.length === 0) return [];
    const monthMap = aggregateByMonth(seedlingMetrics);
    return buildMonthlyChartData(monthMap);
  }, [seedlingMetrics]);

  // Footer averages
  const p2pAverages = useMemo(() => getAverages(p2pMetrics), [p2pMetrics]);
  const seedlingAverages = useMemo(() => getAverages(seedlingMetrics), [seedlingMetrics]);

  // Loading state: show spinner during first fetch attempt (even if DB is empty)
  const loading = useMemo(() => {
    return initialLoad && p2pMetrics.length === 0 && seedlingMetrics.length === 0;
  }, [initialLoad, p2pMetrics, seedlingMetrics]);

  if (loading) {
    return (
      <main className="flex flex-col h-screen bg-[var(--sprayed-bg)] text-white items-center justify-center">
        <div className="text-[#888] text-lg">Loading dashboard...</div>
      </main>
    );
  }

  return (
    <main className="main-layout select-none">
      {apiError && (
        <div className="error-banner">
          Connection error — retrying every {API_CONFIG.POLL_INTERVAL / 1000}s
        </div>
      )}
      {/* 4 Graph Section (2x2 grid) */}
      <div className="dashboard-grid">
        {/* Graph 1: DAILY P2P SPRAYED — Top Left (from SQLite DB) */}
        <AreaChartCard
          title="DAILY P2P SPRAYED"
          data={dailyP2PData}
          accentColor="#22C55E"
          gradientId="dailyP2PGrad"
          xAxisLabel="Day"
          yAxisLabel="Total Tree"
          danger={p2pDanger}
          tickSpacing={3}
        />

        {/* Graph 2: DAILY SEEDLING SPRAYED — Top Right (from API) */}
        <AreaChartCard
          title="DAILY SEEDLING SPRAYED"
          data={seedlingDailyData}
          accentColor="#22C55E"
          gradientId="dailySeedlingGrad"
          xAxisLabel="Day"
          yAxisLabel="Total Tree"
          danger={seedlingDanger}
          tickSpacing={3}
        />

        {/* Graph 3: MONTHLY P2P SPRAYED — Bottom Left (from DB) */}
        <AreaChartCard
          title="MONTHLY P2P SPRAYED"
          data={monthlyP2PData}
          accentColor="#22C55E"
          gradientId="monthlyP2PGrad"
          xAxisLabel="Month"
          yAxisLabel="Total Tree"
        />

        {/* Graph 4: MONTHLY SEEDLING SPRAYED — Bottom Right (from API) */}
        <AreaChartCard
          title="MONTHLY SEEDLING SPRAYED"
          data={seedlingMonthlyData}
          accentColor="#22C55E"
          gradientId="monthlySeedlingGrad"
          xAxisLabel="Month"
          yAxisLabel="Total Tree"
        />
      </div>

      {/* Footer: 4 Summary Cards */}
      <FooterSummary
        p2pAvgDaily={p2pAverages.avgDaily}
        p2pAvgMonthly={p2pAverages.avgMonthly}
        seedlingAvgDaily={seedlingAverages.avgDaily}
        seedlingAvgMonthly={seedlingAverages.avgMonthly}
      />
    </main>
  );
}
