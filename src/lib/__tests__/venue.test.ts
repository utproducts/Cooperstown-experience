import { describe, expect, it } from 'vitest';

import { byCategory, rankResults, weekCeremony } from '../venue';

describe('venue helpers', () => {
  it('ranks a leaderboard, ties share a place', () => {
    const fast = rankResults([{ value: 14.2 }, { value: 13.9 }, { value: 14.2 }, { value: 15 }], 'low');
    expect(fast.map((r) => [r.value, r.place])).toEqual([[13.9, 1], [14.2, 2], [14.2, 2], [15, 4]]);
    expect(rankResults([{ value: 60 }, { value: 70 }], 'high').map((r) => r.value)).toEqual([70, 60]);
  });

  it('groups a menu by category in order', () => {
    const g = byCategory([{ category: 'Drinks', sort: 2 }, { category: 'Food', sort: 0 }, { category: 'Food', sort: 1 }]);
    expect(g.map((x) => [x.category, x.items.length])).toEqual([['Food', 2], ['Drinks', 1]]);
  });

  it('reads a week’s ceremony only when it has a date and time', () => {
    expect(weekCeremony({ ceremony: { date: '2027-05-30', time: '19:00' } })).toMatchObject({ date: '2027-05-30', schedule: [], expect: [] });
    expect(weekCeremony({ ceremony: { date: '2027-05-30' } })).toBeNull();
    expect(weekCeremony(null)).toBeNull();
  });
});
