/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

/// <reference path="../types/electron.d.ts" />

import { useState, useEffect, useMemo } from 'react';
import AreaChartCard from '@/components/AreaChartCard';
import FooterSummary from '@/components/FooterSummary';
import { P2P_API_URL, SEEDLING_API_URL, API_CONFIG } from '@/config/api';
import {
  MOCK_P2P_METRICS,
  MOCK_SEEDLING_DAILY,
  MOCK_P2P_MONTHLY,
  MOCK_SEEDLING_MONTHLY,
  getP2PAverages,
  getSeedlingAverages,
  formatDailyChartData,
  getMonthlyWindowKeys,
} from '@/config/mockData';
import type { P2PMetric, SeedlingMetric, ChartDataPoint } from '@/types';

export default function Dashboard() {
  const [p2pMetrics, setP2pMetrics] = useState<P2PMetric[]>([]);
  const [seedlingMetrics, setSeedlingMetrics] = useState<SeedlingMetric[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch P2P metrics from the Electron HTTP server (for Graph 1)
  const fetchP2PMetrics = async () => {
    try {
      const response = await fetch(P2P_API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        setP2pMetrics(data);
      } else if (p2pMetrics.length === 0) {
        setP2pMetrics(MOCK_P2P_METRICS);
      }
    } catch {
      if (p2pMetrics.length === 0) {
        setP2pMetrics(MOCK_P2P_METRICS);
      }
    }
  };

  // Fetch Seedling metrics from the Electron HTTP server (for Graph 2)
  const fetchSeedlingMetrics = async () => {
    try {
      const response = await fetch(SEEDLING_API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        setSeedlingMetrics(data);
      } else if (seedlingMetrics.length === 0) {
        setSeedlingMetrics(MOCK_P2P_METRICS as SeedlingMetric[]);
      }
    } catch {
      if (seedlingMetrics.length === 0) {
        setSeedlingMetrics(MOCK_P2P_METRICS as SeedlingMetric[]);
      }
    }
  };

  useEffect(() => {
    Promise.all([
      fetchP2PMetrics(),
      fetchSeedlingMetrics(),
    ]).finally(() => {
      setLoading(false);
    });

    let pollInterval: NodeJS.Timeout | null = null;
    if (API_CONFIG.POLL_INTERVAL > 0) {
      pollInterval = setInterval(() => {
        fetchP2PMetrics();
        fetchSeedlingMetrics();
      }, API_CONFIG.POLL_INTERVAL);
    }

    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onRefreshP2PMetrics(() => {
        fetchP2PMetrics();
      });
      window.electronAPI.onRefreshSeedlingMetrics(() => {
        fetchSeedlingMetrics();
      });
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.removeRefreshListener();
        window.electronAPI.removeSeedlingRefreshListener();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Graph 1: DAILY P2P SPRAYED — from DB (last 31 days)
  const dailyP2PData = useMemo<ChartDataPoint[]>(() => {
    const sorted = [...p2pMetrics].sort((a, b) => a.date.localeCompare(b.date));
    const last31 = sorted.slice(-31);
    return formatDailyChartData(
      last31.map(m => ({ date: m.date, value: m.daily_value }))
    );
  }, [p2pMetrics]);

  // Danger: true when the first data point's date > last data point's date on the daily graph
  const p2pDanger = useMemo(() => {
    if (dailyP2PData.length < 2) return false;
    const first = dailyP2PData[0].fullDate;
    const last = dailyP2PData[dailyP2PData.length - 1].fullDate;
    if (!first || !last) return false;
    return first > last;
  }, [dailyP2PData]);

  // Graph 3: MONTHLY P2P SPRAYED — derived from DB data, 12-month rolling window
  const monthlyP2PData = useMemo<ChartDataPoint[]>(() => {
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Aggregate daily values by month
    const monthMap: Record<string, number> = {};
    for (const m of p2pMetrics) {
      if (!monthMap[m.month]) monthMap[m.month] = 0;
      monthMap[m.month] += m.daily_value;
    }

    // Map to 12-month rolling window
    const windowKeys = getMonthlyWindowKeys();
    return windowKeys.map((key) => {
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
  }, [p2pMetrics]);

  // Graph 2: DAILY SEEDLING SPRAYED — from API (last 31 days), fallback to mock
  const seedlingDailyData = useMemo<ChartDataPoint[]>(() => {
    if (seedlingMetrics.length > 0) {
      const sorted = [...seedlingMetrics].sort((a, b) => a.date.localeCompare(b.date));
      const last31 = sorted.slice(-31);
      return formatDailyChartData(
        last31.map(m => ({ date: m.date, value: m.daily_value }))
      );
    }
    return MOCK_SEEDLING_DAILY;
  }, [seedlingMetrics]);

  // Danger for seedling daily graph
  const seedlingDanger = useMemo(() => {
    if (seedlingDailyData.length < 2) return false;
    const first = seedlingDailyData[0].fullDate;
    const last = seedlingDailyData[seedlingDailyData.length - 1].fullDate;
    if (!first || !last) return false;
    return first > last;
  }, [seedlingDailyData]);

  // Graph 4: MONTHLY SEEDLING SPRAYED — derived from API data, 12-month rolling window
  const seedlingMonthlyData = useMemo<ChartDataPoint[]>(() => {
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (seedlingMetrics.length > 0) {
      // Aggregate daily values by month
      const monthMap: Record<string, number> = {};
      for (const m of seedlingMetrics) {
        const monthKey = m.month || m.date.substring(0, 7);
        if (!monthMap[monthKey]) monthMap[monthKey] = 0;
        monthMap[monthKey] += m.daily_value;
      }

      // Map to 12-month rolling window
      const windowKeys = getMonthlyWindowKeys();
      return windowKeys.map((key) => {
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
    return MOCK_SEEDLING_MONTHLY;
  }, [seedlingMetrics]);

  // Footer averages
  const p2pAverages = useMemo(() => getP2PAverages(p2pMetrics), [p2pMetrics]);
  const seedlingAverages = useMemo(() => {
    if (seedlingMetrics.length > 0) {
      return getSeedlingAverages(seedlingMetrics);
    }
    // Fallback: build data shape from MOCK_SEEDLING_DAILY
    const fallbackData = MOCK_SEEDLING_DAILY.map(d => ({
      date: d.fullDate || '',
      daily_value: d.value,
    })).filter(d => d.date);
    return getSeedlingAverages(fallbackData);
  }, [seedlingMetrics]);

  if (loading) {
    return (
      <main className="flex flex-col h-screen bg-[#050505] text-white items-center justify-center">
        <div className="text-[#888] text-lg">Loading dashboard...</div>
      </main>
    );
  }

  return (
    <main className="main-layout select-none">
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

        {/* Graph 2: DAILY SEEDLING SPRAYED — Top Right (hardcoded) */}
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

        {/* Graph 4: MONTHLY SEEDLING SPRAYED — Bottom Right (hardcoded) */}
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
