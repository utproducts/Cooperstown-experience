import { describe, expect, it } from 'vitest';

import GRID from '../../data/asv-walk-grid.json';
import SAMPLE from '../../data/sample-venue.json';
import { bestPath, pathLength, type WalkGrid } from '../walk';

// A 5×5 grid: a wall down the middle with one gap at the bottom.
const tiny: WalkGrid = { size: 5, rows: ['11011', '11011', '11011', '11011', '11111'] };
const at = (gx: number, gy: number) => ({ x: (gx + 0.5) / 5, y: (gy + 0.5) / 5 });
const cell = (p: { x: number; y: number }, n: number) => [Math.floor(p.x * n), Math.floor(p.y * n)];

describe('bestPath', () => {
  it('goes around a wall through the gap', () => {
    const path = bestPath(tiny, at(0, 0), at(4, 0))!;
    expect(path[0]).toEqual(at(0, 0));
    expect(path[path.length - 1]).toEqual(at(4, 0));
    expect(Math.max(...path.map((p) => p.y))).toBeGreaterThan(0.8); // dips down to the gap
  });

  it('snaps a start or end on a blocked cell to the nearest walkable one', () => {
    expect(bestPath(tiny, at(2, 0), at(0, 0))).not.toBeNull();
  });

  it('returns null when nothing is walkable', () => {
    expect(bestPath({ size: 3, rows: ['000', '000', '000'] }, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 })).toBeNull();
  });

  it('never routes into a pocket cut off from the main area', () => {
    // The right column is walkable but walled off: a tap there snaps to the big area on the left.
    const grid: WalkGrid = { size: 5, rows: ['11101', '11101', '11101', '11101', '11101'] };
    const path = bestPath(grid, at(0, 2), at(4, 2))!;
    expect(path).not.toBeNull();
    expect(Math.max(...path.slice(0, -1).map((p) => p.x))).toBeLessThan(0.6);
  });

  it('finds walking paths across the Village between real pins, never through water or off campus', () => {
    const grid = GRID as WalkGrid;
    const pin = (name: string) => SAMPLE.places.find((p) => p.name === name) as { x: number; y: number };
    for (const [a, b] of [
      ['Parking Lot D', 'Field 10'],
      ['Hotel Parking', 'Field 1'],
      ['Player Village', 'Field 11'],
    ]) {
      const path = bestPath(grid, pin(a), pin(b))!;
      expect(path, `${a} → ${b}`).not.toBeNull();
      // Every corner of the smoothed path (except the pins themselves) is on a walkable cell.
      for (const p of path.slice(1, -1)) {
        const [gx, gy] = cell(p, grid.size);
        expect(grid.rows[gy][gx], `${a} → ${b} at ${gx},${gy}`).not.toBe('0');
      }
      // A walking path is longer than the straight line, but not absurdly.
      const straight = Math.hypot(pin(a).x - pin(b).x, pin(a).y - pin(b).y);
      expect(pathLength(path)).toBeGreaterThanOrEqual(straight - 1e-9);
      expect(pathLength(path)).toBeLessThan(straight * 2.2);
    }
  });
});
