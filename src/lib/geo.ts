// Putting a phone's GPS position on the venue's drawn site map. The map is a picture, not a survey, so staff pin a few
// reference points (a spot on the map and its real latitude/longitude); everything else is fitted from those.

export interface LatLng {
  lat: number;
  lng: number;
}

/** A spot on the map picture (0..1 across and down) and where it really is. */
export interface GeoPoint extends LatLng {
  x: number;
  y: number;
  label?: string;
}

/** Stored with the site map (venue_settings.site_map.geo). */
export interface MapGeo {
  points: GeoPoint[];
  /** The demo's points are a rough guess, not measured. */
  sample?: boolean;
}

export interface GeoFit {
  toXY(p: LatLng): { x: number; y: number };
  toLatLng(x: number, y: number): LatLng;
  center: LatLng;
}

const M_PER_DEG_LAT = 111_320;

/**
 * Fits the map to its reference points: with three or more (not in a line) a full affine fit, which also absorbs a
 * map that's stretched one way; with two, scale + rotation only. `width`/`height` are the picture's pixels, so a
 * non-square map isn't distorted. Null until there are enough points.
 */
export function fitGeo(points: GeoPoint[] | undefined, width: number, height: number): GeoFit | null {
  const pts = (points ?? []).filter((p) => [p.x, p.y, p.lat, p.lng].every(Number.isFinite));
  if (pts.length < 2 || !width || !height) return null;
  const center = { lat: mean(pts.map((p) => p.lat)), lng: mean(pts.map((p) => p.lng)) };
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180);
  // Metres east and north of the centre; pixels across and *up* (so both are right-handed).
  const local = (p: LatLng) => ({ e: (p.lng - center.lng) * mPerDegLng, n: (p.lat - center.lat) * M_PER_DEG_LAT });
  const unlocal = (e: number, n: number): LatLng => ({ lat: center.lat + n / M_PER_DEG_LAT, lng: center.lng + e / mPerDegLng });
  const src = pts.map(local);
  const dst = pts.map((p) => ({ u: p.x * width, v: -p.y * height }));

  const affine = pts.length >= 3 ? fitAffine(src, dst) : null;
  const m = affine ?? fitSimilarity(src, dst);
  if (!m) return null;
  const [a, b, c, d, e, f] = m; // u = a·E + b·N + c, v = d·E + e·N + f
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-12) return null;
  return {
    center,
    toXY(p) {
      const { e: E, n: N } = local(p);
      return { x: (a * E + b * N + c) / width, y: -(d * E + e * N + f) / height };
    },
    toLatLng(x, y) {
      const u = x * width - c;
      const v = -y * height - f;
      return unlocal((e * u - b * v) / det, (a * v - d * u) / det);
    },
  };
}

type Src = { e: number; n: number };
type Dst = { u: number; v: number };

function fitAffine(src: Src[], dst: Dst[]): number[] | null {
  // Least squares for [a b c] and [d e f] against rows [E N 1].
  let see = 0, sen = 0, se = 0, snn = 0, sn = 0;
  const k = src.length;
  for (const { e, n } of src) {
    see += e * e;
    sen += e * n;
    se += e;
    snn += n * n;
    sn += n;
  }
  const M = [
    [see, sen, se],
    [sen, snn, sn],
    [se, sn, k],
  ];
  const rhs = (pick: (d: Dst) => number) => [
    src.reduce((s, p, i) => s + p.e * pick(dst[i]), 0),
    src.reduce((s, p, i) => s + p.n * pick(dst[i]), 0),
    dst.reduce((s, d) => s + pick(d), 0),
  ];
  const r1 = solve3(M, rhs((d) => d.u));
  const r2 = solve3(M, rhs((d) => d.v));
  return r1 && r2 ? [...r1, ...r2] : null;
}

function fitSimilarity(src: Src[], dst: Dst[]): number[] | null {
  // Complex numbers: w = A·z + B through the two points farthest apart.
  let best: [number, number] = [0, 1];
  let far = -1;
  for (let i = 0; i < src.length; i++)
    for (let j = i + 1; j < src.length; j++) {
      const d = (src[i].e - src[j].e) ** 2 + (src[i].n - src[j].n) ** 2;
      if (d > far) {
        far = d;
        best = [i, j];
      }
    }
  const [i, j] = best;
  const ze = src[j].e - src[i].e, zn = src[j].n - src[i].n;
  const wu = dst[j].u - dst[i].u, wv = dst[j].v - dst[i].v;
  const zz = ze * ze + zn * zn;
  if (zz < 1e-9) return null;
  const ar = (wu * ze + wv * zn) / zz; // A = w / z
  const ai = (wv * ze - wu * zn) / zz;
  const c = dst[i].u - (ar * src[i].e - ai * src[i].n);
  const f = dst[i].v - (ai * src[i].e + ar * src[i].n);
  return [ar, -ai, c, ai, ar, f];
}

function solve3(M: number[][], r: number[]): number[] | null {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  // Points in (nearly) a straight line can't fix the map's shape.
  if (Math.abs(D) < 1e-6 * Math.max(1, Math.abs(M[0][0] * M[1][1]))) return null;
  return [0, 1, 2].map((col) => det(M.map((row, i) => row.map((v, j) => (j === col ? r[i] : v)))) / D);
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Metres between two points. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "350 ft" up close, "0.4 mi" farther, "12 mi" far away. */
export function formatDistance(m: number): string {
  const ft = m * 3.28084;
  if (ft < 1000) return `${Math.max(10, Math.round(ft / 10) * 10)} ft`;
  const mi = m / 1609.344;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

/** Minutes on foot over a hilly campus with kids and a wagon (about 4 km/h), at least 1. */
export const walkMinutes = (m: number) => Math.max(1, Math.round(m / 67));

/** Whether a map position is on the picture (with a little room around the edge). */
export const onPicture = (p: { x: number; y: number }, margin = 0.05) => p.x >= -margin && p.x <= 1 + margin && p.y >= -margin && p.y <= 1 + margin;

/** Parses "42.4655, -75.1030" as copied from Google or Apple Maps. */
export function parseLatLng(text: string): LatLng | null {
  const m = text.trim().match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?\s*\)?$/i);
  if (!m) return null;
  let lat = Number(m[1]);
  let lng = Number(m[3]);
  if (m[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (m[4]?.toUpperCase() === 'W') lng = -Math.abs(lng);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export type TravelMode = 'walking' | 'driving';

/** Turn-by-turn in Apple Maps on iPhones, Google Maps everywhere else. */
export function directionsUrl(to: LatLng, mode: TravelMode, appleMaps: boolean): string {
  const ll = `${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;
  return appleMaps
    ? `https://maps.apple.com/?daddr=${ll}&dirflg=${mode === 'walking' ? 'w' : 'd'}`
    : `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=${mode}`;
}
