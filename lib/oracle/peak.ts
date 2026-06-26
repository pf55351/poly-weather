// Ora attesa del PICCO di temperatura per la città/giorno, dalla previsione oraria di Open-Meteo.
// Il momento del massimo varia per città/stagione (Londra d'estate ~17, città continentali ~14-15):
// serve per sapere QUANDO il max del giorno è davvero "in cassa", invece di assumere un'ora fissa.
import type { City } from "../cities";
import { cacheInit } from "../fetch-cache";

const FORECAST = "https://api.open-meteo.com/v1/forecast";

/** Ora locale (0..23, decimale) del massimo previsto oggi, o null se non disponibile. */
export async function fetchPeakHour(
  city: City,
  date: string,
  signal?: AbortSignal,
  fresh?: boolean,
): Promise<number | null> {
  const url =
    `${FORECAST}?latitude=${city.lat}&longitude=${city.lon}` +
    `&hourly=temperature_2m&start_date=${date}&end_date=${date}` +
    `&timezone=${encodeURIComponent(city.timezone)}`;
  try {
    const res = await fetch(url, { signal, ...cacheInit(1800, fresh) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      hourly?: { time?: string[]; temperature_2m?: (number | null)[] };
    };
    const times = data.hourly?.time ?? [];
    const temps = data.hourly?.temperature_2m ?? [];
    let bestI = -1;
    let bestT = -Infinity;
    for (let i = 0; i < temps.length; i++) {
      const t = temps[i];
      if (typeof t === "number" && Number.isFinite(t) && t > bestT) {
        bestT = t;
        bestI = i;
      }
    }
    if (bestI < 0) return null;
    // times[bestI] = "YYYY-MM-DDTHH:00" in ora LOCALE (timezone passato).
    const hh = times[bestI]?.slice(11, 13);
    const h = Number(hh);
    return Number.isFinite(h) ? h : null;
  } catch {
    return null;
  }
}
