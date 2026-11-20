// Previsioni meteo orarie da Open-Meteo (gratuito, senza chiave), con cache locale.
import { state } from '../state';

export interface WeatherHour {
  t: number; // ms epoch
  cloud: number;
  low: number;
  mid: number;
  high: number;
  humidity: number;
  visibility: number; // metri
  precip: number; // probabilità %
  wind: number; // km/h
}

const KEY = 'vastity.weather.v1';

export async function getWeather(): Promise<WeatherHour[] | null> {
  const { lat, lon } = state.location;
  const k = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && c.k === k && Date.now() - c.t < 3600e3) return c.hours;
  } catch { /* */ }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
      '&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,visibility,precipitation_probability,wind_speed_10m' +
      '&forecast_days=7&timeformat=unixtime&timezone=auto';
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const h = j.hourly;
    const hours: WeatherHour[] = h.time.map((t: number, i: number) => ({
      t: t * 1000, cloud: h.cloud_cover[i] ?? 0, low: h.cloud_cover_low[i] ?? 0, mid: h.cloud_cover_mid[i] ?? 0, high: h.cloud_cover_high[i] ?? 0,
      humidity: h.relative_humidity_2m[i] ?? 50, visibility: h.visibility[i] ?? 20000, precip: h.precipitation_probability[i] ?? 0, wind: h.wind_speed_10m[i] ?? 0,
    }));
    try { localStorage.setItem(KEY, JSON.stringify({ k, t: Date.now(), hours })); } catch { /* */ }
    return hours;
  } catch {
    return null;
  }
}

export function weatherAt(hours: WeatherHour[] | null, t: number): WeatherHour | null {
  if (!hours?.length) return null;
  let best: WeatherHour | null = null, bd = Infinity;
  for (const h of hours) {
    const d = Math.abs(h.t - t);
    if (d < bd) { bd = d; best = h; }
  }
  return bd < 2 * 3600e3 ? best : null;
}

/** Copertura nuvolosa "efficace": le nubi basse contano più dei veli alti. */
export function effectiveCloud(h: WeatherHour) {
  return Math.min(100, Math.max(h.cloud * 0.9, h.low, h.mid * 0.9, h.high * 0.55));
}
