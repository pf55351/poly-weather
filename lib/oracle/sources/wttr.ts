// wttr.in - previsione gratuita senza chiave. Ritorna la temp max (°C) per giorno.
import type { WeatherSource } from "./types";

export const wttrIn: WeatherSource = {
  id: "wttr-in",
  label: "wttr.in (World Weather Online)",
  enabled: () => true,
  async fetchMembers(ctx) {
    const url = `https://wttr.in/${ctx.lat},${ctx.lon}?format=j1`;
    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { "User-Agent": "curl/8" }, // wttr.in serve JSON solo a client non-browser
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`wttr ${res.status}`);
    const data = (await res.json()) as {
      weather?: { date: string; maxtempC: string }[];
    };
    const day = data.weather?.find((w) => w.date === ctx.date);
    const t = day ? parseFloat(day.maxtempC) : NaN;
    if (!Number.isFinite(t)) throw new Error("wttr: giorno non disponibile");
    return [t];
  },
};
