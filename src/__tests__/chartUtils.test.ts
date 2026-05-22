import { getMonthlyWindowKeys, getAverages, formatDailyChartData, buildDailyWindowData, isWindowComplete, aggregateByMonth, buildMonthlyChartData } from '@/config/chartUtils';

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
      expect(result.map(r => r.label)).toEqual(['Jan', '2', '3']);
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
      expect(result[1].label).toBe('Feb');
    });
  });

  describe('buildDailyWindowData', () => {
    it('returns a fixed window of dates ending on the given end date', () => {
      const source = [
        { date: '2026-01-01', value: 10 },
        { date: '2026-01-03', value: 20 },
      ];
      const result = buildDailyWindowData(source, 5, '2026-01-05');

      expect(result).toHaveLength(5);
      expect(result.map(r => r.fullDate)).toEqual([
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
        '2026-01-04',
        '2026-01-05',
      ]);
      expect(result.map(r => r.value)).toEqual([10, 0, 20, 0, 0]);
    });

    it('drops dates that fall after the window end date', () => {
      const source = [
        { date: '2026-01-01', value: 10 },
        { date: '2026-01-06', value: 50 },
      ];
      const result = buildDailyWindowData(source, 5, '2026-01-05');

      expect(result.some(r => r.fullDate === '2026-01-06')).toBe(false);
      expect(result.map(r => r.value)).toEqual([10, 0, 0, 0, 0]);
    });
  });

  describe('isWindowComplete', () => {
    it('returns true when end date exists in source', () => {
      const source = [
        { date: '2026-01-01', value: 10 },
        { date: '2026-01-05', value: 50 },
      ];
      const result = isWindowComplete(source, '2026-01-05');
      expect(result).toBe(true);
    });

    it('returns false when end date is missing', () => {
      const source = [
        { date: '2026-01-01', value: 10 },
        { date: '2026-01-04', value: 40 },
      ];
      const result = isWindowComplete(source, '2026-01-05');
      expect(result).toBe(false);
    });

    it('returns false for empty source', () => {
      const result = isWindowComplete([], '2026-01-05');
      expect(result).toBe(false);
    });

    it('uses today as default end date', () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayKey = `${year}-${month}-${day}`;

      const source = [
        { date: todayKey, value: 100 },
      ];
      const result = isWindowComplete(source);
      expect(result).toBe(true);
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
