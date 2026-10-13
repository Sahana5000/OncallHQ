import { RangeUtils } from './range.utils';

describe('RangeUtils', () => {
  describe('parseRange', () => {
    it('should parse PostgreSQL tstzrange string format correctly', () => {
      const rangeStr = '[2026-09-01T00:00:00Z,2026-10-01T00:00:00Z)';
      const parsed = RangeUtils.parseRange(rangeStr);

      expect(parsed.start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(parsed.end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('should parse PostgreSQL tstzrange string with spaces and quotes', () => {
      const rangeStr = '["2026-09-01 00:00:00+00", "2026-10-01 00:00:00+00")';
      const parsed = RangeUtils.parseRange(rangeStr);

      expect(parsed.start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(parsed.end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('should handle TimeRange object input directly', () => {
      const start = new Date('2026-09-01T00:00:00Z');
      const end = new Date('2026-10-01T00:00:00Z');
      const parsed = RangeUtils.parseRange({ start, end });

      expect(parsed.start).toEqual(start);
      expect(parsed.end).toEqual(end);
    });

    it('should throw Error for invalid range format', () => {
      expect(() => RangeUtils.parseRange('invalid-range')).toThrow();
    });
  });

  describe('formatRange', () => {
    it('should format TimeRange into PostgreSQL tstzrange string', () => {
      const start = new Date('2026-09-01T00:00:00.000Z');
      const end = new Date('2026-10-01T00:00:00.000Z');
      const formatted = RangeUtils.formatRange({ start, end });

      expect(formatted).toBe('[2026-09-01T00:00:00.000Z,2026-10-01T00:00:00.000Z)');
    });
  });

  describe('containsTimestamp', () => {
    const range = {
      start: new Date('2026-09-01T00:00:00.000Z'),
      end: new Date('2026-09-08T00:00:00.000Z'),
    };

    it('should return true for timestamp inside range', () => {
      expect(RangeUtils.containsTimestamp(range, '2026-09-04T12:00:00.000Z')).toBe(true);
    });

    it('should return true for exact start timestamp (inclusive)', () => {
      expect(RangeUtils.containsTimestamp(range, '2026-09-01T00:00:00.000Z')).toBe(true);
    });

    it('should return false for exact end timestamp (exclusive boundary)', () => {
      expect(RangeUtils.containsTimestamp(range, '2026-09-08T00:00:00.000Z')).toBe(false);
    });

    it('should return false for timestamp before start', () => {
      expect(RangeUtils.containsTimestamp(range, '2026-08-31T23:59:59.999Z')).toBe(false);
    });

    it('should return false for timestamp after end', () => {
      expect(RangeUtils.containsTimestamp(range, '2026-09-08T00:00:01.000Z')).toBe(false);
    });
  });
});
