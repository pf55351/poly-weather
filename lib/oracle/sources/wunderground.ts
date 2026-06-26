// Wunderground (The Weather Company / IBM) — È LA FONTE DI VERITÀ: il mercato Polymarket
// si risolve sulla massima registrata da Wunderground alla stazione. Quindi la SUA previsione
// è il predittore migliore e va pesata molto di più delle altre fonti.
//
// Usa l'endpoint pubblico api.weather.com (lo stesso del sito Wunderground). La apiKey di
// default è quella pubblica del sito (non ufficiale: può cambiare/limitare) — override con
// WEATHERCOM_API_KEY se hai una chiave tua.
import type { WeatherSource } from "./types";
import { cacheInit } from "../../fetch-cache";

const API = "https://api.weather.com/v3/wx/forecast/daily/5day";
const KEY = process.env.WEATHERCOM_API_KEY ?? "e1f10a1e78da46f5b10a1e78da96f525";

/** Peso di Wunderground in "membri equivalenti" nella distribuzione (tunable). */
export const WUNDERGROUND_WEIGHT = 50;

export const wunderground: WeatherSource = {
  id: "wunderground",
  label: "Wunderground (fonte di risoluzione)",
  weight: WUNDERGROUND_WEIGHT,
  enabled: () => Boolean(KEY),
  async fetchMembers(ctx) {
    const url = `${API}?geocode=${ctx.lat},${ctx.lon}&units=m&language=en-US&format=json&apiKey=${KEY}`;
    const res = await fetch(url, { signal: ctx.signal, ...cacheInit(600, ctx.fresh) });
    if (!res.ok) throw new Error(`wunderground ${res.status}`);
    const data = (await res.json()) as {
      validTimeLocal?: string[];
      calendarDayTemperatureMax?: (number | null)[];
    };
    const times = data.validTimeLocal ?? [];
    const maxes = data.calendarDayTemperatureMax ?? [];
    const i = times.findIndex((t) => typeof t === "string" && t.startsWith(ctx.date));
    const t = i >= 0 ? maxes[i] : null;
    if (typeof t !== "number") throw new Error("wunderground: giorno non in finestra previsione");
    return [t];
  },
};
