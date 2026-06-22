// Massimo già OSSERVATO oggi nella giornata locale della città.
// Il massimo finale non può essere inferiore: usato come "floor" per troncare la
// distribuzione (vedi buildDistribution.floorC) → l'oracolo si stringe a fine giornata.
import type { City } from "../cities";

const FORECAST = "https://api.open-meteo.com/v1/forecast";

export async function fetchObservedMaxC(
  city: City,
  date: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const url =
    `${FORECAST}?latitude=${city.lat}&longitude=${city.lon}` +
    `&hourly=temperature_2m&start_date=${date}&end_date=${date}` +
    `&timezone=${encodeURIComponent(city.timezone)}`;
  try {
    const res = await fetch(url, { signal, next: { revalidate: 600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      hourly?: { time?: string[]; temperature_2m?: (number | null)[] };
    };
    const times = data.hourly?.time ?? [];
    const temps = data.hourly?.temperature_2m ?? [];
    // ora locale corrente nella tz della città: "YYYY-MM-DD HH:MM"
    const nowKey = new Date().toLocaleString("sv-SE", { timeZone: city.timezone }).slice(0, 16);

    let max = -Infinity;
    for (let i = 0; i < times.length; i++) {
      const t = times[i].replace("T", " "); // "2026-06-22 14:00"
      const v = temps[i];
      if (t <= nowKey && typeof v === "number") max = Math.max(max, v);
    }
    return Number.isFinite(max) ? max : null;
  } catch {
    return null;
  }
}
