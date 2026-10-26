import { describe, expect, it } from 'vitest';
import { generateSeasonWeeks, matchWeek, pickDefaultEvent, weekStatus } from '../weeks';

const season = generateSeasonWeeks('2027-05-29', 16, { daysPerWeek: 7 }).map((w, i) => ({ id: `w${i + 1}`, ...w }));

describe('season weeks', () => {
  it('generates consecutive Saturday-to-Friday weeks', () => {
    expect(season).toHaveLength(16);
    expect(season[0]).toMatchObject({ name: 'Week 1', startsOn: '2027-05-29', endsOn: '2027-06-04' });
    expect(season[1]).toMatchObject({ name: 'Week 2', startsOn: '2027-06-05', endsOn: '2027-06-11' });
    expect(season[15]).toMatchObject({ startsOn: '2027-09-11', endsOn: '2027-09-17' });
  });

  it('defaults to 6-day rolling weeks, so Day 1 moves through the weekdays', () => {
    const w = generateSeasonWeeks('2027-06-05', 3); // a Saturday
    expect(w.map((x) => x.startsOn)).toEqual(['2027-06-05', '2027-06-11', '2027-06-17']);
    expect(w[0].endsOn).toBe('2027-06-10');
    const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
    expect(w.map((x) => weekday(x.startsOn))).toEqual([6, 5, 4]); // Sat, Fri, Thu
  });

  it('supports break days between weeks', () => {
    expect(generateSeasonWeeks('2027-06-05', 2, { daysPerWeek: 6, breakDays: 1 })[1].startsOn).toBe('2027-06-12');
  });
});

describe('pickDefaultEvent', () => {
  it('prefers the current week, then the next, then the latest', () => {
    expect(pickDefaultEvent(season, '2027-06-08')?.id).toBe('w2');
    expect(pickDefaultEvent(season, '2027-01-01')?.id).toBe('w1');
    expect(pickDefaultEvent(season, '2027-12-01')?.id).toBe('w16');
    expect(pickDefaultEvent([], '2027-01-01')).toBeNull();
  });

  it('reports status', () => {
    expect(weekStatus(season[1], '2027-06-05')).toBe('current');
    expect(weekStatus(season[1], '2027-06-12')).toBe('past');
    expect(weekStatus(season[1], '2027-06-04')).toBe('upcoming');
  });
});

describe('matchWeek', () => {
  it('matches by start date first', () => {
    expect(matchWeek(season, { program: 'Week 1', startDate: '06/07/2027' })?.id).toBe('w2');
  });
  it('matches a date inside the program name', () => {
    expect(matchWeek(season, { program: '12U Cooperstown (7/3/2027)' })?.id).toBe('w6');
  });
  it('matches by week number', () => {
    expect(matchWeek(season, { program: 'Cooperstown WEEK 7 - 12U' })?.id).toBe('w7');
    expect(matchWeek(season, { program: 'Week #12' })?.id).toBe('w12');
  });
  it('returns null when nothing matches', () => {
    expect(matchWeek(season, { program: 'Fall Ball' })).toBeNull();
    expect(matchWeek(season, {})).toBeNull();
  });
});
