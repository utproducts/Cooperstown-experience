import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

import type { LatLng } from '@/lib/geo';

export type LocationStatus = 'off' | 'asking' | 'on' | 'denied' | 'error';

/**
 * The phone's position while a screen is open, only after the person taps to share it. `simulate` puts a pretend
 * position on the map (the demo, away from the Village).
 */
export function useMyLocation({ resumeIfAllowed = false }: { resumeIfAllowed?: boolean } = {}) {
  const [status, setStatus] = useState<LocationStatus>('off');
  const [coords, setCoords] = useState<(LatLng & { accuracy: number | null }) | null>(null);
  const [simulated, setSimulated] = useState(false);
  const sub = useRef<Location.LocationSubscription | null>(null);
  useEffect(() => () => sub.current?.remove(), []);

  const stopWatching = () => {
    sub.current?.remove();
    sub.current = null;
  };
  const api = {
    status,
    coords,
    simulated,
    async start() {
      setStatus('asking');
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          setStatus('denied');
          return;
        }
        stopWatching();
        sub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 3 },
          (l) => {
            setCoords({ lat: l.coords.latitude, lng: l.coords.longitude, accuracy: l.coords.accuracy ?? null });
            setSimulated(false);
            setStatus('on');
          },
          () => setStatus('error'),
        );
      } catch {
        setStatus('error');
      }
    },
    simulate(p: LatLng) {
      stopWatching();
      setCoords({ ...p, accuracy: 8 });
      setSimulated(true);
      setStatus('on');
    },
    stop() {
      stopWatching();
      setCoords(null);
      setSimulated(false);
      setStatus('off');
    },
  };
  // Someone who already said yes doesn't have to tap again: pick the position back up when the screen opens.
  const started = useRef(false);
  useEffect(() => {
    if (!resumeIfAllowed || started.current) return;
    started.current = true;
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (p.granted) api.start();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeIfAllowed]);
  return api;
}
