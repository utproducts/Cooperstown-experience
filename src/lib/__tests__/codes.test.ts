import { describe, expect, it } from 'vitest';
import { checkInPayload, generateTeamCode, normalizeTeamCode, parseCheckInPayload, teamPrefix } from '../codes';

describe('team codes', () => {
  it('derives a prefix from the mascot, ignoring age groups', () => {
    expect(teamPrefix('Tampa Bay Rays 12U')).toBe('RAYS');
    expect(teamPrefix('Lake Forest Thunder')).toBe('THUN');
    expect(teamPrefix('12U')).toBe('TEAM');
    expect(teamPrefix('Ox')).toBe('OXXX');
  });

  it('generates unique codes with no ambiguous characters', () => {
    const taken = new Set<string>();
    const codes = Array.from({ length: 200 }, () => generateTeamCode('Rays', taken));
    expect(new Set(codes).size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^RAYS-[A-HJ-KMNP-Z2-9]{4}$/);
  });

  it('normalizes typed codes', () => {
    expect(normalizeTeamCode(' rays 7k2q ')).toBe('RAYS-7K2Q');
    expect(normalizeTeamCode('rays-7k2q')).toBe('RAYS-7K2Q');
  });

  it('round-trips check-in payloads and rejects foreign QR codes', () => {
    expect(parseCheckInPayload(checkInPayload('ABCDEFGH2345'))).toBe('ABCDEFGH2345');
    expect(parseCheckInPayload('https://example.com')).toBeNull();
    expect(parseCheckInPayload('CXP1:short')).toBeNull();
  });
});
