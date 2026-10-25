/** Forecasts from Open-Meteo (free, no API key). */

export interface HourForecast {
  time: string;
  tempF: number;
  precipChance: number;
  code: number;
}

export interface DayForecast {
  date: string;
  highF: number;
  lowF: number;
  precipChance: number;
  code: number;
}

export interface Forecast {
  current: { tempF: number; code: number; windMph: number; feelsLikeF: number };
  hourly: HourForecast[];
  daily: DayForecast[];
  /** Lightning-risk hours in the next 12h, from thunderstorm weather codes. */
  stormHours: string[];
}

const DESCRIPTIONS: Record<number, [string, string]> = {
  0: ['Clear', '☀️'],
  1: ['Mostly clear', '🌤️'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'],
  48: ['Fog', '🌫️'],
  51: ['Light drizzle', '🌦️'],
  53: ['Drizzle', '🌦️'],
  55: ['Heavy drizzle', '🌧️'],
  61: ['Light rain', '🌦️'],
  63: ['Rain', '🌧️'],
  65: ['Heavy rain', '🌧️'],
  80: ['Rain showers', '🌦️'],
  81: ['Rain showers', '🌧️'],
  82: ['Violent showers', '🌧️'],
  95: ['Thunderstorms', '⛈️'],
  96: ['Thunderstorms w/ hail', '⛈️'],
  99: ['Severe thunderstorms', '⛈️'],
};

export function describeWeather(code: number): { label: string; emoji: string } {
  const d = DESCRIPTIONS[code] ?? DESCRIPTIONS[Math.floor(code / 10) * 10] ?? ['—', '🌡️'];
  return { label: d[0], emoji: d[1] };
}

export function isStormCode(code: number): boolean {
  return code >= 95;
}

export function forecastUrl(lat: number, lon: number, timeZone: string): string {
  const params = [
    `latitude=${lat}`,
    `longitude=${lon}`,
    'current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    'hourly=temperature_2m,precipitation_probability,weather_code',
    'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    'temperature_unit=fahrenheit',
    'wind_speed_unit=mph',
    `timezone=${encodeURIComponent(timeZone)}`,
    'forecast_days=7',
  ];
  return `https://api.open-meteo.com/v1/forecast?${params.join('&')}`;
}

export function parseForecast(json: any, now = new Date()): Forecast {
  const hourly: HourForecast[] = (json.hourly?.time ?? []).map((t: string, i: number) => ({
    time: t,
    tempF: Math.round(json.hourly.temperature_2m[i]),
    precipChance: json.hourly.precipitation_probability?.[i] ?? 0,
    code: json.hourly.weather_code[i],
  }));
  const daily: DayForecast[] = (json.daily?.time ?? []).map((d: string, i: number) => ({
    date: d,
    highF: Math.round(json.daily.temperature_2m_max[i]),
    lowF: Math.round(json.daily.temperature_2m_min[i]),
    precipChance: json.daily.precipitation_probability_max?.[i] ?? 0,
    code: json.daily.weather_code[i],
  }));
  // Open-Meteo hourly times are local wall-clock strings ("2026-07-11T14:00"); compare as strings.
  const currentLocal: string = json.current?.time ?? now.toISOString().slice(0, 16);
  const upcoming = hourly.filter((h) => h.time >= currentLocal.slice(0, 13)).slice(0, 12);
  return {
    current: {
      tempF: Math.round(json.current?.temperature_2m ?? 0),
      feelsLikeF: Math.round(json.current?.apparent_temperature ?? 0),
      windMph: Math.round(json.current?.wind_speed_10m ?? 0),
      code: json.current?.weather_code ?? 0,
    },
    hourly: upcoming,
    daily,
    stormHours: upcoming.filter((h) => isStormCode(h.code)).map((h) => h.time),
  };
}

export async function fetchForecast(lat: number, lon: number, timeZone: string): Promise<Forecast> {
  const res = await fetch(forecastUrl(lat, lon, timeZone));
  if (!res.ok) throw new Error(`Weather unavailable (${res.status})`);
  return parseForecast(await res.json());
}
