// 7Timer! - modello meteo gratuito senza chiave. Ricava la temp max (°C) del giorno
// target dai timepoint a 3h (temp2m) a partire dall'orario di init (UTC).
import type { WeatherSource } from "./types";
import { cacheInit } from "../../fetch-cache";

interface SevenTimerResp {
  init?: string; // "YYYYMMDDHH" in UTC
  dataseries?: { timepoint: number; temp2m: number }[];
}

export const sevenTimer: WeatherSource = {
  id: "7timer",
  label: "7Timer! (civil)",
  enabled: () => true,
  async fetchMembers(ctx) {
    const url = `https://www.7timer.info/bin/api.pl?lon=${ctx.lon}&lat=${ctx.lat}&product=civil&output=json`;
    const res = await fetch(url, { signal: ctx.signal, ...cacheInit(600, ctx.fresh) });
    if (!res.ok) throw new Error(`7timer ${res.status}`);
    const data = (await res.json()) as SevenTimerResp;
    const init = data.init;
    if (!init || init.length < 10) throw new Error("7timer: init mancante");

    const initUtc = Date.UTC(
      Number(init.slice(0, 4)),
      Number(init.slice(4, 6)) - 1,
      Number(init.slice(6, 8)),
      Number(init.slice(8, 10)),
    );

    let max = -Infinity;
    for (const p of data.dataseries ?? []) {
      const when = new Date(initUtc + p.timepoint * 3600_000);
      // confronto sul giorno locale della città
      const localDay = when.toLocaleDateString("en-CA", { timeZone: ctx.timezone }); // YYYY-MM-DD
      if (localDay === ctx.date && typeof p.temp2m === "number") {
        max = Math.max(max, p.temp2m);
      }
    }
    if (!Number.isFinite(max)) throw new Error("7timer: giorno fuori finestra");
    return [max];
  },
};
