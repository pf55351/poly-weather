// WeatherAPI.com - provider con chiave (WEATHERAPI_KEY).
// Degrada con grazia se la chiave manca.
import type { WeatherSource } from "./types";
import { cacheInit } from "../../fetch-cache";

const URL = "https://api.weatherapi.com/v1/forecast.json";

interface WaForecastDay {
  date: string;
  day?: { maxtemp_c?: number };
}

export const weatherApi: WeatherSource = {
  id: "weatherapi",
  label: "WeatherAPI.com",
  enabled: () => Boolean(process.env.WEATHERAPI_KEY),
  async fetchMembers(ctx) {
    const key = process.env.WEATHERAPI_KEY;
    if (!key) throw new Error("WEATHERAPI_KEY mancante");
    const url = `${URL}?key=${key}&q=${ctx.lat},${ctx.lon}&days=10`;
    const res = await fetch(url, { signal: ctx.signal, ...cacheInit(600, ctx.fresh) });
    if (!res.ok) throw new Error(`weatherapi ${res.status}`);
    const data = (await res.json()) as {
      forecast?: { forecastday?: WaForecastDay[] };
    };
    const day = data.forecast?.forecastday?.find((d) => d.date === ctx.date);
    const t = day?.day?.maxtemp_c;
    if (typeof t !== "number") throw new Error("weatherapi: giorno non disponibile");
    return [t];
  },
};
