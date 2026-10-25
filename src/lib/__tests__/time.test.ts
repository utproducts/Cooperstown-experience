import { describe, expect, it } from 'vitest';
import { dateRange, localDateKey, localTimeKey, zonedToIso } from '../time';

describe('time', () => {
  it('converts Eastern wall clock to UTC in summer and winter', () => {
    expect(zonedToIso('2026-07-11', '08:00')).toBe('2026-07-11T12:00:00.000Z');
    expect(zonedToIso('2026-01-10', '08:00')).toBe('2026-01-10T13:00:00.000Z');
  });

  it('reads back local date/time keys', () => {
    const iso = zonedToIso('2026-07-11', '23:30');
    expect(localDateKey(iso)).toBe('2026-07-11');
    expect(localTimeKey(iso)).toBe('23:30');
  });

  it('builds inclusive date ranges', () => {
    expect(dateRange('2026-07-30', '2026-08-02')).toEqual(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']);
  });
});
