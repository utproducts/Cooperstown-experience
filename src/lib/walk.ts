// The best walking path across the campus map, on a grid of walking costs traced from the map picture
// (scripts/build-walk-grid.py). Walkways are cheapest, then pavement, parking and lawn; fields and buildings are a
// last resort; water and off-campus cells are blocked.

export interface WalkGrid {
  size: number;
  /** One string per row; each character is a cost code (0 = blocked). */
  rows: string[];
}

export interface Pt {
  x: number;
  y: number;
}

const COST: Record<string, number> = { '1': 1, '2': 1.4, '3': 1.8, '4': 2.6, '5': 3, '6': 4, '7': 6, '8': 10, '9': 25 };
const SQRT2 = Math.SQRT2;

/**
 * Cheapest path from one spot on the picture to another (both 0..1), as points on the picture, smoothed. Start and end
 * snap to the nearest walkable cell (a pin can sit on a building). Null when no path exists.
 */
export function bestPath(grid: WalkGrid, from: Pt, to: Pt): Pt[] | null {
  const n = grid.size;
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return null;
  const cost = (gx: number, gy: number) => (gx < 0 || gy < 0 || gx >= n || gy >= n ? 0 : (COST[grid.rows[gy][gx]] ?? 0));
  const cellOf = (p: Pt) => ({ gx: clamp(Math.floor(p.x * n), 0, n - 1), gy: clamp(Math.floor(p.y * n), 0, n - 1) });
  // Only snap onto the main walkable area: a tap can land in a little pocket that no path reaches.
  const main = mainArea(grid);
  const reachable = (gx: number, gy: number) => (main[gy * n + gx] ? cost(gx, gy) : 0);
  const start = snap(cellOf(from), reachable, n);
  const goal = snap(cellOf(to), reachable, n);
  if (!start || !goal) return null;

  const idx = (gx: number, gy: number) => gy * n + gx;
  const g = new Float64Array(n * n).fill(Infinity);
  const came = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const heap = new MinHeap();
  const h = (gx: number, gy: number) => {
    const dx = Math.abs(gx - goal.gx);
    const dy = Math.abs(gy - goal.gy);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  };
  const s = idx(start.gx, start.gy);
  const t = idx(goal.gx, goal.gy);
  g[s] = 0;
  heap.push(s, h(start.gx, start.gy));
  while (heap.size) {
    const cur = heap.pop();
    if (cur === t) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % n;
    const cy = (cur - cx) / n;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        const c = cost(nx, ny);
        if (!c) continue;
        // No squeezing diagonally between two blocked cells.
        if (dx && dy && (!cost(cx + dx, cy) || !cost(cx, cy + dy))) continue;
        const ni = idx(nx, ny);
        const ng = g[cur] + c * (dx && dy ? SQRT2 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          heap.push(ni, ng + h(nx, ny));
        }
      }
  }
  if (!Number.isFinite(g[t])) return null;

  const cells: Pt[] = [];
  for (let i = t; i !== -1; i = came[i]) cells.push({ x: ((i % n) + 0.5) / n, y: (Math.floor(i / n) + 0.5) / n });
  cells.reverse();
  return [from, ...simplify(cells, 0.9 / n).slice(1, -1), to].filter((p, i, a) => i === 0 || p.x !== a[i - 1].x || p.y !== a[i - 1].y);
}

/** Length of a path in picture units (0..1 across). */
export const pathLength = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

const areas = new WeakMap<WalkGrid, Uint8Array>();

/** The largest connected walkable area of the grid (cached per grid). */
function mainArea(grid: WalkGrid): Uint8Array {
  const cached = areas.get(grid);
  if (cached) return cached;
  const n = grid.size;
  const label = new Int32Array(n * n);
  const open = (i: number) => (COST[grid.rows[Math.floor(i / n)][i % n]] ?? 0) > 0;
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let i = 0; i < n * n; i++) {
    if (label[i] || !open(i)) continue;
    next++;
    let size = 0;
    const stack = [i];
    label[i] = next;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const cx = c % n;
      const cy = (c - cx) / n;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
          const ni = ny * n + nx;
          // Same rule as the path search: no squeezing diagonally between two blocked cells.
          if (dx && dy && (!open(cy * n + nx) || !open(ny * n + cx))) continue;
          if (!label[ni] && open(ni)) {
            label[ni] = next;
            stack.push(ni);
          }
        }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  const main = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) main[i] = label[i] === best ? 1 : 0;
  areas.set(grid, main);
  return main;
}

function snap(c: { gx: number; gy: number }, cost: (x: number, y: number) => number, n: number) {
  if (cost(c.gx, c.gy)) return c;
  for (let r = 1; r < Math.min(30, n); r++) {
    let best: { gx: number; gy: number } | null = null;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !cost(c.gx + dx, c.gy + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { gx: c.gx + dx, gy: c.gy + dy };
        }
      }
    if (best) return best;
  }
  return null;
}

// Douglas–Peucker: drop points that sit within `eps` of the line through their neighbours.
function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], a, b);
    if (d > far) {
      far = d;
      at = i;
    }
  }
  if (far <= eps) return [a, b];
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)];
}

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.keys.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.keys.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}
