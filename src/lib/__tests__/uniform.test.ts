import { describe, expect, it } from 'vitest';

import { sizeCounts, sizeItemFromHeader, sizeLine, uniformItems } from '../uniform';

describe('uniform sizes', () => {
  it('uses the week’s items, or Jersey, Pants and Hat', () => {
    expect(uniformItems({ settings: {} })).toEqual(['Jersey', 'Pants', 'Hat']);
    expect(uniformItems({ settings: { uniformItems: ['Jersey', 'Hat', 'Belt'] } })).toEqual(['Jersey', 'Hat', 'Belt']);
  });

  it('reads size columns from a LeagueApps export', () => {
    expect(sizeItemFromHeader('Jersey Size')).toBe('Jersey');
    expect(sizeItemFromHeader("What is your player's pant size?")).toBe('Pants');
    expect(sizeItemFromHeader('Hat Size (fitted)')).toBe('Hat');
    expect(sizeItemFromHeader('Cap size')).toBe('Hat');
    expect(sizeItemFromHeader('T-Shirt Size')).toBe('T-shirt');
    expect(sizeItemFromHeader('Jersey Number')).toBeNull();
    expect(sizeItemFromHeader('Team Size')).toBeNull();
  });

  it('shows what to hand a player', () => {
    expect(sizeLine({ Jersey: 'YL', Hat: 'S/M' }, ['Jersey', 'Pants', 'Hat'])).toBe('Jersey YL · Pants — · Hat S/M');
  });

  it('counts a team’s bag by size, youth before adult', () => {
    const team: { uniform: Record<string, string> }[] = [{ uniform: { Jersey: 'AM', Pants: 'YL' } }, { uniform: { Jersey: 'YL' } }, { uniform: { Jersey: 'YS' } }, { uniform: { Jersey: 'YL' } }];
    expect(sizeCounts(team, ['Jersey', 'Pants'])).toEqual([
      { item: 'Jersey', sizes: [{ size: 'YS', count: 1 }, { size: 'YL', count: 2 }, { size: 'AM', count: 1 }], missing: 0 },
      { item: 'Pants', sizes: [{ size: 'YL', count: 1 }], missing: 3 },
    ]);
  });
});
