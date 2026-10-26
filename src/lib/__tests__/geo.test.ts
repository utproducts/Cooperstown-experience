import { describe, expect, it } from 'vitest';

import { directionsUrl, distanceM, fitGeo, formatDistance, onPicture, parseLatLng, walkMinutes, type GeoPoint } from '../geo';

// A made-up 1000 m square map, north up, centred on the Village.
const C = { lat: 42.4655, lng: -75.103 };
const dLat = 1000 / 111_320;
const dLng = 1000 / (111_320 * Math.cos((C.lat * Math.PI) / 180));
const at = (x: number, y: number): GeoPoint => ({ x, y, lat: C.lat + (0.5 - y) * dLat, lng: C.lng + (x - 0.5) * dLng });

describe('fitGeo', () => {
  it('needs two points', () => {
    expect(fitGeo([], 1000, 1000)).toBeNull();
    expect(fitGeo([at(0.2, 0.2)], 1000, 1000)).toBeNull();
  });

  it('places a position on the map from three points, and back', () => {
    const fit = fitGeo([at(0.1, 0.1), at(0.9, 0.2), at(0.4, 0.9)], 1000, 1000)!;
    const p = at(0.65, 0.35);
    const xy = fit.toXY(p);
    expect(xy.x).toBeCloseTo(0.65, 4);
    expect(xy.y).toBeCloseTo(0.35, 4);
    const ll = fit.toLatLng(0.65, 0.35);
    expect(ll.lat).toBeCloseTo(p.lat, 6);
    expect(ll.lng).toBeCloseTo(p.lng, 6);
  });

  it('works from two points (scale and rotation)', () => {
    const fit = fitGeo([at(0.2, 0.3), at(0.8, 0.7)], 1000, 1000)!;
    const xy = fit.toXY(at(0.5, 0.1));
    expect(xy.x).toBeCloseTo(0.5, 4);
    expect(xy.y).toBeCloseTo(0.1, 4);
  });

  it('handles a map drawn rotated (north to the right)', () => {
    // Picture x runs south→north, y runs west→east.
    const rot = (x: number, y: number): GeoPoint => ({ x, y, lat: C.lat + (x - 0.5) * dLat, lng: C.lng + (y - 0.5) * dLng });
    const fit = fitGeo([rot(0.1, 0.1), rot(0.9, 0.3), rot(0.3, 0.8)], 2000, 2000)!;
    const p = rot(0.7, 0.6);
    expect(fit.toXY(p).x).toBeCloseTo(0.7, 4);
    expect(fit.toXY(p).y).toBeCloseTo(0.6, 4);
  });

  it('falls back to two-point fitting when three points are in a line', () => {
    const fit = fitGeo([at(0.1, 0.1), at(0.5, 0.5), at(0.9, 0.9)], 1000, 1000)!;
    expect(fit.toXY(at(0.2, 0.8)).x).toBeCloseTo(0.2, 4);
  });
});

describe('distances and directions', () => {
  it('measures and formats', () => {
    const m = distanceM(at(0, 0.5), at(1, 0.5));
    expect(m).toBeGreaterThan(995);
    expect(m).toBeLessThan(1005);
    expect(formatDistance(100)).toBe('330 ft');
    expect(formatDistance(1000)).toBe('0.6 mi');
    expect(formatDistance(50_000)).toBe('31 mi');
    expect(walkMinutes(10)).toBe(1);
    expect(walkMinutes(670)).toBe(10);
  });

  it('knows when a position is off the picture', () => {
    expect(onPicture({ x: 0.5, y: 0.99 })).toBe(true);
    expect(onPicture({ x: 1.3, y: 0.5 })).toBe(false);
  });

  it('reads coordinates pasted from a maps app', () => {
    expect(parseLatLng('42.4655, -75.1030')).toEqual({ lat: 42.4655, lng: -75.103 });
    expect(parseLatLng('(42.4655,-75.103)')).toEqual({ lat: 42.4655, lng: -75.103 });
    expect(parseLatLng('42.4655° N, 75.1030° W')).toEqual({ lat: 42.4655, lng: -75.103 });
    expect(parseLatLng('Field 3')).toBeNull();
    expect(parseLatLng('142, 10')).toBeNull();
  });

  it('builds Apple and Google directions links', () => {
    expect(directionsUrl({ lat: 42.4655, lng: -75.103 }, 'walking', true)).toBe('https://maps.apple.com/?daddr=42.465500,-75.103000&dirflg=w');
    expect(directionsUrl({ lat: 42.4655, lng: -75.103 }, 'driving', false)).toBe('https://www.google.com/maps/dir/?api=1&destination=42.465500,-75.103000&travelmode=driving');
  });
});
