// Met Norway (yr.no) - API gratuita senza chiave. Richiede uno User-Agent identificativo.
// Aggiunge 1 member: la temp max prevista per il giorno target.
import type { WeatherSource } from "./types";
import { cacheInit } from "../../fetch-cache";

const URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
// Met.no richiede uno User-Agent con contatto (vedi ToS). Override via env se serve.
const UA =
  process.env.MET_NORWAY_USER_AGENT ?? "polymeteo/0.1 (https://blockchainitalia.io)";

interface MetTimeseries {
  time: string;
  data?: { instant?: { details?: { air_temperature?: number } } };
}

export const metNorway: WeatherSource = {
  id: "met-norway",
  label: "Met Norway (yr.no)",
  enabled: () => true,
  async fetchMembers(ctx) {
    const url = `${URL}?lat=${ctx.lat.toFixed(3)}&lon=${ctx.lon.toFixed(3)}`;
    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { "User-Agent": UA },
      ...cacheInit(600, ctx.fresh),
    });
    if (!res.ok) throw new Error(`met.no ${res.status}`);
    const data = (await res.json()) as {
      properties?: { timeseries?: MetTimeseries[] };
    };
    const series = data.properties?.timeseries ?? [];
    let max = -Infinity;
    for (const p of series) {
      if (!p.time.startsWith(ctx.date)) continue;
      const t = p.data?.instant?.details?.air_temperature;
      if (typeof t === "number") max = Math.max(max, t);
    }
    if (!Number.isFinite(max)) throw new Error("met.no: giorno non in finestra previsione");
    return [max];
  },
};
