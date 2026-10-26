import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { C, S } from '@/constants/theme';
import type { EventWeek } from '@/data/types';
import { describeWeather, fetchForecast, type Forecast } from '@/lib/weather';
import { to12h } from '@/lib/time';

import { Badge, Body, Caption, Card, Eyebrow, Row } from './ui';

export function useForecast(event: EventWeek | null) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!event) return;
    let alive = true;
    const load = () =>
      fetchForecast(event.latitude, event.longitude, event.timezone)
        .then((f) => alive && (setForecast(f), setError(null)))
        .catch((e: Error) => alive && setError(e.message));
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [event]);
  return { forecast, error };
}

export function WeatherCard({ event, compact }: { event: EventWeek | null; compact?: boolean }) {
  const { forecast, error } = useForecast(event);
  if (error) {
    return (
      <Card>
        <Eyebrow>Weather</Eyebrow>
        <Caption>Forecast unavailable right now.</Caption>
      </Card>
    );
  }
  if (!forecast) {
    return (
      <Card>
        <Eyebrow>Weather</Eyebrow>
        <Caption>Loading forecast…</Caption>
      </Card>
    );
  }
  const now = describeWeather(forecast.current.code);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow>Weather · Cooperstown</Eyebrow>
        {forecast.stormHours.length > 0 && <Badge label="Storms possible" tone="warn" icon="flash" />}
      </Row>
      <Row gap={S.lg}>
        <Text style={{ fontSize: 40 }}>{now.emoji}</Text>
        <View>
          <Text style={{ fontSize: 34, fontWeight: '800', color: C.navy }}>{forecast.current.tempF}°</Text>
          <Caption>
            {now.label} · feels {forecast.current.feelsLikeF}° · wind {forecast.current.windMph} mph
          </Caption>
        </View>
      </Row>
      {!compact && <Caption>Next hours (ET)</Caption>}
      {!compact && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.md }}>
          {forecast.hourly.map((h) => (
            <View key={h.time} style={{ alignItems: 'center', gap: 2, minWidth: 44 }}>
              <Caption>{to12h(h.time.slice(11, 16)).replace(':00', '')}</Caption>
              <Text style={{ fontSize: 18 }}>{describeWeather(h.code).emoji}</Text>
              <Body style={{ fontWeight: '700' }}>{h.tempF}°</Body>
              <Caption style={{ color: h.precipChance >= 50 ? C.warn : C.muted }}>{h.precipChance}%</Caption>
            </View>
          ))}
        </ScrollView>
      )}
    </Card>
  );
}
