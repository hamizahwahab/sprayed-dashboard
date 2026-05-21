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

// Props received by Recharts custom tick renderer
interface CustomTickProps {
  x: number | string;
  y: number | string;
  payload: { value: string };
  index: number;
  visibleTicksCount: number;
}

// Resolve tick fill color — extracted from nested ternary for readability
function getTickFill(danger: boolean, isMonthStart: boolean, isLast: boolean): string {
  if (danger) {
    if (isMonthStart) return '#F87171';
    if (isLast) return '#EF4444';
    return 'rgba(239,68,68,0.6)';
  }
  if (isMonthStart) return '#4ADE80';
  if (isLast) return '#22C55E';
  return '#888';
}

interface AreaChartCardProps {
  title: string;
  data: ChartDataPoint[];
  accentColor?: string;
  gradientId?: string;
  currentValue?: string | number;
  subtitle?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  danger?: boolean;
  /** Show label only every Nth tick (e.g. 3 = every 3rd). Month starts & last point always shown. 0 or 1 = show all. */
  tickSpacing?: number;
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
  danger = false,
  tickSpacing = 0,
}: AreaChartCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setSize({ width: rect.width, height: rect.height });
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
  const showChart = hasData && size.width > 0 && size.height > 0;

  // Resolve colors: if danger mode, override to red
  const resolvedAccent = danger ? '#EF4444' : accentColor;
  const resolvedGradientId = danger ? `${gradientId}Danger` : gradientId;

  // Custom tick renderer for spaced labels (every Nth day + month starts + last point)
  const useSpacing = tickSpacing > 1;
  const renderCustomTick = (props: CustomTickProps) => {
    const { x, y, payload, index } = props;
    const value: string = payload.value;
    const isMonthStart = value.includes(' ');
    const isLast = index === data.length - 1;
    const showLabel = isMonthStart || isLast || (useSpacing && index % tickSpacing === 0);

    return (
      <g transform={`translate(${x},${y})`}>
        {/* Small vertical tick line for all days */}
        <line y2={5} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        {/* Label text — only shown conditionally */}
        <text
          x={0}
          y={14}
          textAnchor="middle"
          fill={getTickFill(danger, isMonthStart, isLast)}
          fontSize={isMonthStart || isLast ? 11 : 10}
          fontWeight={isMonthStart || isLast ? 600 : 400}
          visibility={showLabel ? 'visible' : 'hidden'}
        >
          {value}
        </text>
      </g>
    );
  };

  return (
    <div className={`graph-card${danger ? ' danger' : ''}`}>
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
              <linearGradient id={resolvedGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={resolvedAccent} stopOpacity={0.3} />
                <stop offset="95%" stopColor={resolvedAccent} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              tick={useSpacing ? renderCustomTick : { fontSize: 10, fill: '#888' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
              tickLine={false}
              interval={useSpacing ? 0 : undefined}
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
              stroke={resolvedAccent}
              strokeWidth={2}
              fill={`url(#${resolvedGradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: resolvedAccent }}
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
