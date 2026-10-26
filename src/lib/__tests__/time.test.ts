import { describe, expect, it } from 'vitest';
import { dateRange, formatDateTime, formatTime, localDateKey, localTimeKey, to12h, zoneLabel, zonedToIso } from '../time';

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

describe('12-hour times with a time zone', () => {
  it('always labels Cooperstown times ET, summer or winter', () => {
    expect(formatTime('2027-06-02T22:00:00Z')).toBe('6:00 PM ET');
    expect(formatTime('2027-01-15T13:30:00Z')).toBe('8:30 AM ET');
    expect(formatDateTime('2027-06-04T12:00:00Z')).toBe('Fri, Jun 4 · 8:00 AM ET');
    expect(zoneLabel('America/New_York')).toBe('ET');
  });
  it('turns stored 24-hour times into AM/PM', () => {
    expect(to12h('08:00')).toBe('8:00 AM');
    expect(to12h('12:00')).toBe('12:00 PM');
    expect(to12h('00:30')).toBe('12:30 AM');
    expect(to12h('22:00')).toBe('10:00 PM');
    expect(to12h('24:00')).toBe('12:00 AM');
  });
});
