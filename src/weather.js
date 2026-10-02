// Open-Meteo: free, no API key, works from a static site.
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';

export async function fetchForecast({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_gusts_10m,weather_code,uv_index',
    daily: 'temperature_2m_max,temperature_2m_min',
    current: 'temperature_2m,apparent_temperature,weather_code',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    past_days: '1',
    forecast_days: '2',
  });
  const res = await fetch(`${FORECAST}?${params}`);
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
  return res.json();
}

// daily.time is [yesterday, today, tomorrow].
// Uses the API's own local date strings, so no UTC/toISOString date-boundary bugs.
export function hoursForDay(data, dayIndex, startHour, endHour) {
  const date = data.daily.time[dayIndex];
  const h = data.hourly;
  const hours = [];
  h.time.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const hour = Number(t.slice(11, 13));
    if (hour < startHour || hour > endHour) return;
    hours.push({
      hour,
      temp: h.temperature_2m[i],
      feels: h.apparent_temperature[i],
      rain: h.precipitation_probability[i] ?? 0,
      wind: h.wind_speed_10m[i] ?? 0,
      gust: h.wind_gusts_10m[i] ?? 0,
      code: h.weather_code[i] ?? 0,
      uv: h.uv_index[i] ?? 0,
    });
  });
  return { date, hours };
}

export async function searchPlaces(name) {
  const params = new URLSearchParams({ name, count: '6', language: 'en', format: 'json' });
  const res = await fetch(`${GEOCODE}?${params}`);
  if (!res.ok) throw new Error('Search failed');
  const json = await res.json();
  return (json.results || []).map((r) => ({
    name: r.name,
    detail: [r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        name: 'My location',
        detail: '',
        lat: Math.round(pos.coords.latitude * 100) / 100,
        lon: Math.round(pos.coords.longitude * 100) / 100,
      }),
      (err) => reject(err),
      { timeout: 10000, maximumAge: 30 * 60 * 1000 }
    );
  });
}

export const isSnow = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;
export const isStorm = (c) => c >= 95;
