// OpenWeatherMap - provider con chiave (OPENWEATHER_API_KEY).
// Degrada con grazia: enabled()=false se la chiave manca, quindi viene saltato.
import type { WeatherSource } from "./types";

const URL = "https://api.openweathermap.org/data/2.5/forecast";

interface OwmItem {
  dt_txt: string;
  main?: { temp_max?: number; temp?: number };
}

export const openWeather: WeatherSource = {
  id: "openweathermap",
  label: "OpenWeatherMap",
  enabled: () => Boolean(process.env.OPENWEATHER_API_KEY),
  async fetchMembers(ctx) {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) throw new Error("OPENWEATHER_API_KEY mancante");
    const url = `${URL}?lat=${ctx.lat}&lon=${ctx.lon}&units=metric&appid=${key}`;
    const res = await fetch(url, { signal: ctx.signal, next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`owm ${res.status}`);
    const data = (await res.json()) as { list?: OwmItem[] };
    let max = -Infinity;
    for (const it of data.list ?? []) {
      // dt_txt è UTC "YYYY-MM-DD HH:mm:ss"; filtro grezzo sul giorno target.
      if (!it.dt_txt.startsWith(ctx.date)) continue;
      const t = it.main?.temp_max ?? it.main?.temp;
      if (typeof t === "number") max = Math.max(max, t);
    }
    if (!Number.isFinite(max)) throw new Error("owm: giorno non in finestra previsione");
    return [max];
  },
};
