/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

/// <reference path="../types/electron.d.ts" />

import { useState, useEffect, useMemo } from 'react';
import AreaChartCard from '@/components/AreaChartCard';
import FooterSummary from '@/components/FooterSummary';
import { P2P_API_URL, API_CONFIG } from '@/config/api';
import {
  MOCK_P2P_METRICS,
  MOCK_SEEDLING_DAILY,
  MOCK_P2P_MONTHLY,
  MOCK_SEEDLING_MONTHLY,
  getP2PAverages,
  getSeedlingAverages,
  formatDailyChartData,
} from '@/config/mockData';
import type { P2PMetric, ChartDataPoint } from '@/types';

export default function Dashboard() {
  const [p2pMetrics, setP2pMetrics] = useState<P2PMetric[]>([]);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchP2PMetrics();

    let pollInterval: NodeJS.Timeout | null = null;
    if (API_CONFIG.POLL_INTERVAL > 0) {
      pollInterval = setInterval(fetchP2PMetrics, API_CONFIG.POLL_INTERVAL);
    }

    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onRefreshP2PMetrics(() => {
        fetchP2PMetrics();
      });
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.removeRefreshListener();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Graph 1: DAILY P2P SPRAYED — from DB (last 14 days)
  const dailyP2PData = useMemo<ChartDataPoint[]>(() => {
    const sorted = [...p2pMetrics].sort((a, b) => a.date.localeCompare(b.date));
    const last14 = sorted.slice(-14);
    return formatDailyChartData(
      last14.map(m => ({ date: m.date, value: m.daily_value }))
    );
  }, [p2pMetrics]);

  // Graph 3: MONTHLY P2P SPRAYED — derived from DB data
  const monthlyP2PData = useMemo<ChartDataPoint[]>(() => {
    if (p2pMetrics.length === 0) return [];
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthMap: Record<string, number> = {};
    for (const m of p2pMetrics) {
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
  }, [p2pMetrics]);

  // Graph 2: DAILY SEEDLING SPRAYED — hardcoded mock data
  const seedlingDailyData = useMemo<ChartDataPoint[]>(() => MOCK_SEEDLING_DAILY, []);

  // Graph 4: MONTHLY SEEDLING SPRAYED — hardcoded mock data
  const seedlingMonthlyData = useMemo<ChartDataPoint[]>(() => MOCK_SEEDLING_MONTHLY, []);

  // Footer averages
  const p2pAverages = useMemo(() => getP2PAverages(p2pMetrics), [p2pMetrics]);
  const seedlingAverages = useMemo(() => getSeedlingAverages(), []);

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
        />

        {/* Graph 2: DAILY SEEDLING SPRAYED — Top Right (hardcoded) */}
        <AreaChartCard
          title="DAILY SEEDLING SPRAYED"
          data={seedlingDailyData}
          accentColor="#22C55E"
          gradientId="dailySeedlingGrad"
          xAxisLabel="Day"
          yAxisLabel="Total Tree"
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
