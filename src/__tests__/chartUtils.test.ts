import { getMonthlyWindowKeys, getAverages, formatDailyChartData, aggregateByMonth, buildMonthlyChartData } from '@/config/chartUtils';

describe('chartUtils', () => {
  describe('getMonthlyWindowKeys', () => {
    it('returns exactly 12 keys', () => {
      const keys = getMonthlyWindowKeys();
      expect(keys).toHaveLength(12);
    });

    it('each key matches YYYY-MM format', () => {
      const keys = getMonthlyWindowKeys();
      keys.forEach(key => {
        expect(key).toMatch(/^\d{4}-\d{2}$/);
      });
    });

    it('returns consecutive months', () => {
      const keys = getMonthlyWindowKeys();
      for (let i = 1; i < keys.length; i++) {
        const prev = new Date(keys[i - 1] + '-01');
        const curr = new Date(keys[i] + '-01');
        const diffMonths = (curr.getFullYear() - prev.getFullYear()) * 12 + (curr.getMonth() - prev.getMonth());
        expect(diffMonths).toBe(1);
      }
    });
  });

  describe('getAverages', () => {
    it('returns zeros for empty data', () => {
      const result = getAverages([]);
      expect(result).toEqual({ avgDaily: 0, avgMonthly: 0 });
    });

    it('calculates daily average correctly', () => {
      const data = [
        { date: '2026-01-01', daily_value: 10 },
        { date: '2026-01-02', daily_value: 20 },
        { date: '2026-01-03', daily_value: 30 },
      ];
      const result = getAverages(data);
      expect(result.avgDaily).toBe(20);
    });

    it('calculates monthly average from multiple months', () => {
      const data = [
        { date: '2026-01-01', daily_value: 100 },
        { date: '2026-01-02', daily_value: 200 },
        { date: '2026-02-01', daily_value: 300 },
      ];
      const result = getAverages(data);
      // Jan total = 300, Feb total = 300 → avg monthly = 300
      expect(result.avgMonthly).toBe(300);
    });

    it('handles single month data for monthly average', () => {
      const data = [
        { date: '2026-01-01', daily_value: 50 },
        { date: '2026-01-15', daily_value: 50 },
      ];
      const result = getAverages(data);
      expect(result.avgMonthly).toBe(100);
    });
  });

  describe('formatDailyChartData', () => {
    it('returns empty array for empty input', () => {
      const result = formatDailyChartData([]);
      expect(result).toEqual([]);
    });

    it('sorts data by date', () => {
      const data = [
        { date: '2026-01-03', value: 30 },
        { date: '2026-01-01', value: 10 },
        { date: '2026-01-02', value: 20 },
      ];
      const result = formatDailyChartData(data);
      expect(result.map(r => r.label)).toEqual(['Jan 1', '2', '3']);
      expect(result.map(r => r.value)).toEqual([10, 20, 30]);
    });

    it('marks month starts and attaches monthName', () => {
      const data = [
        { date: '2026-01-15', value: 10 },
        { date: '2026-02-01', value: 20 },
      ];
      const result = formatDailyChartData(data);
      expect(result[1].isMonthStart).toBe(true);
      expect(result[1].monthName).toBe('Feb');
    });
  });

  describe('aggregateByMonth', () => {
    it('groups values by YYYY-MM', () => {
      const data = [
        { date: '2026-01-01', daily_value: 10 },
        { date: '2026-01-15', daily_value: 20 },
        { date: '2026-02-01', daily_value: 30 },
      ];
      const result = aggregateByMonth(data);
      expect(result).toEqual({ '2026-01': 30, '2026-02': 30 });
    });
  });

  describe('buildMonthlyChartData', () => {
    it('fills missing months with 0', () => {
      const monthMap = { '2026-01': 100 };
      // Provide explicit window that spans missing months
      const keys = ['2026-01', '2026-02', '2026-03'];
      const result = buildMonthlyChartData(monthMap, keys);
      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(100);
      expect(result[1].value).toBe(0);
      expect(result[2].value).toBe(0);
    });
  });
});
