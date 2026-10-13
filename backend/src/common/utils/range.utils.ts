import { DateTime } from 'luxon';

export interface TimeRange {
  start: Date;
  end: Date;
}

export class RangeUtils {
  /**
   * Parses PostgreSQL tstzrange string or range object into TimeRange.
   * Example tstzrange formats:
   *  - "[2026-09-01 00:00:00+00, 2026-10-01 00:00:00+00)"
   *  - "[\"2026-09-01T00:00:00.000Z\",\"2026-10-01T00:00:00.000Z\")"
   */
  static parseRange(rangeInput: string | TimeRange | any): TimeRange {
    if (!rangeInput) {
      throw new Error('Range input is empty');
    }

    if (typeof rangeInput === 'object' && rangeInput.start && rangeInput.end) {
      return {
        start: new Date(rangeInput.start),
        end: new Date(rangeInput.end),
      };
    }

    if (typeof rangeInput === 'string') {
      const cleaned = rangeInput.trim();
      // Match pattern [start, end)
      const regex = /^([\[\(])"?([^",\s]+(?:\s+[^",\s]+)?)"?\s*,\s*"?([^",\s]+(?:\s+[^",\s]+)?)"?([\]\)])$/;
      const match = cleaned.match(regex);

      if (match) {
        const startStr = match[2];
        const endStr = match[3];

        const startDate = DateTime.fromISO(startStr, { zone: 'utc' }).isValid
          ? DateTime.fromISO(startStr, { zone: 'utc' }).toJSDate()
          : new Date(startStr);

        const endDate = DateTime.fromISO(endStr, { zone: 'utc' }).isValid
          ? DateTime.fromISO(endStr, { zone: 'utc' }).toJSDate()
          : new Date(endStr);

        return { start: startDate, end: endDate };
      }
    }

    throw new Error(`Invalid tstzrange format: ${JSON.stringify(rangeInput)}`);
  }

  /**
   * Format TimeRange into PostgreSQL tstzrange string: [start, end)
   */
  static formatRange(range: TimeRange): string {
    const startIso = range.start.toISOString();
    const endIso = range.end.toISOString();
    return `[${startIso},${endIso})`;
  }

  /**
   * Checks if timestamp T is within [start, end)
   */
  static containsTimestamp(range: TimeRange, target: Date | string | number): boolean {
    const targetMs = new Date(target).getTime();
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();
    return targetMs >= startMs && targetMs < endMs;
  }
}
