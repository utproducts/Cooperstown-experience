import { describe, expect, it } from 'vitest';
import { describeWeather, parseForecast } from '../weather';

describe('weather', () => {
  it('parses an Open-Meteo response and flags storms', () => {
    const f = parseForecast({
      current: { time: '2026-07-11T13:00', temperature_2m: 81.4, apparent_temperature: 84, weather_code: 2, wind_speed_10m: 6.2 },
      hourly: {
        time: ['2026-07-11T12:00', '2026-07-11T13:00', '2026-07-11T14:00'],
        temperature_2m: [80, 81, 79],
        precipitation_probability: [10, 20, 70],
        weather_code: [1, 2, 95],
      },
      daily: { time: ['2026-07-11'], temperature_2m_max: [84.6], temperature_2m_min: [61.2], precipitation_probability_max: [70], weather_code: [95] },
    });
    expect(f.current).toEqual({ tempF: 81, feelsLikeF: 84, windMph: 6, code: 2 });
    expect(f.hourly.map((h) => h.time)).toEqual(['2026-07-11T13:00', '2026-07-11T14:00']);
    expect(f.stormHours).toEqual(['2026-07-11T14:00']);
    expect(f.daily[0]).toMatchObject({ highF: 85, lowF: 61 });
  });

  it('describes codes with a fallback', () => {
    expect(describeWeather(95).label).toBe('Thunderstorms');
    expect(describeWeather(1234).label).toBe('—');
  });
});
