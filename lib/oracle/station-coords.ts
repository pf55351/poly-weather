// Coordinate della STAZIONE di risoluzione (aeroporto) dato l'ICAO, da aviationweather.gov
// (gratuito, ufficiale). Il mercato risolve sulla temperatura di QUELLA stazione, spesso un
// aeroporto lontano dal centro città (Seoul/Incheon ~50km): prevedere lì invece che al centro
// elimina un bias sistematico. La posizione è statica → cache lunga.
import { cacheInit } from "../fetch-cache";

const STATIONINFO = "https://aviationweather.gov/api/data/stationinfo";

export interface StationCoords {
  lat: number;
  lon: number;
  /** nome leggibile, es. "Seoul/Incheon Intl" */
  name: string;
}

/** Coordinate dell'aeroporto dato lo station id `ICAO:9:CC` (o ICAO nudo). Null se ignoto. */
export async function fetchStationCoords(
  stationId: string | undefined,
  signal?: AbortSignal,
  fresh?: boolean,
): Promise<StationCoords | null> {
  if (!stationId) return null;
  const icao = stationId.split(":")[0]?.trim().toUpperCase();
  if (!icao || !/^[A-Z]{3,4}$/.test(icao)) return null;
  try {
    const res = await fetch(`${STATIONINFO}?ids=${icao}&format=json`, {
      signal,
      headers: { "User-Agent": "polymeteo/0.1 (https://blockchainitalia.io)" },
      ...cacheInit(86_400, fresh), // posizione statica: cache 1 giorno
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as { lat?: number; lon?: number; site?: string }[];
    const a = Array.isArray(arr) ? arr[0] : null;
    if (!a || typeof a.lat !== "number" || typeof a.lon !== "number") return null;
    return { lat: a.lat, lon: a.lon, name: a.site ?? icao };
  } catch {
    return null;
  }
}
