'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Label,
} from 'recharts';
import type { ChartDataPoint } from '@/types';

interface AreaChartCardProps {
  title: string;
  data: ChartDataPoint[];
  accentColor?: string;
  gradientId?: string;
  currentValue?: string | number;
  subtitle?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export default function AreaChartCard({
  title,
  data,
  accentColor = '#60A5FA',
  gradientId = 'colorValue',
  currentValue,
  subtitle,
  xAxisLabel,
  yAxisLabel,
}: AreaChartCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [measured, setMeasured] = useState(false);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setSize({ width: rect.width, height: rect.height });
      setMeasured(true);
    }
  }, []);

  useEffect(() => {
    // Measure on mount (layout should be ready by now)
    measure();

    // Re-measure whenever the element resizes
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [measure]);

  const hasData = data.length > 0;
  const showChart = measured && hasData && size.width > 0 && size.height > 0;

  return (
    <div className="graph-card">
      <div className="graph-title">{title}</div>
      {currentValue !== undefined && (
        <div className="graph-value">{currentValue}</div>
      )}
      {subtitle && <div className="graph-subtitle">{subtitle}</div>}
      <div className="chart-container" ref={containerRef}>
        {showChart ? (
          <AreaChart
            width={size.width}
            height={size.height}
            data={data}
            margin={{ top: 5, right: 10, left: 10, bottom: 22 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={accentColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#888' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
              tickLine={false}
            >
              {xAxisLabel && (
                <Label
                  value={xAxisLabel}
                  position="insideBottom"
                  offset={-5}
                  style={{ fill: '#666', fontSize: 10 }}
                />
              )}
            </XAxis>
            <YAxis
              tick={{ fontSize: 10, fill: '#888' }}
              axisLine={false}
              tickLine={false}
            >
              {yAxisLabel && (
                <Label
                  value={yAxisLabel}
                  angle={-90}
                  position="insideLeft"
                  offset={5}
                  style={{ fill: '#666', fontSize: 10 }}
                />
              )}
            </YAxis>
            <Tooltip
              contentStyle={{
                backgroundColor: '#161616',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#888' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={accentColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: accentColor }}
            />
          </AreaChart>
        ) : (
          <div className="flex items-center justify-center w-full h-full text-[#555] text-sm">
            {hasData ? '' : 'No data available'}
          </div>
        )}
      </div>
    </div>
  );
}
