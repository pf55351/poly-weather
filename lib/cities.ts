// I mercati "Highest temperature in {city}" sono DINAMICI (decine di città, per-giorno).
// Non manteniamo più una lista statica: le città vengono scoperte da Polymarket
// (vedi lib/discover.ts). Qui restano solo:
//  - il tipo City (descrittore usato dall'oracolo)
//  - KNOWN_CITIES: override con le coordinate ESATTE della stazione di risoluzione
//    (aeroporto) per le città principali, dove conta l'allineamento col mercato.
//    Le altre città vengono geocodificate automaticamente (centro città).
//  - ITALY_CITY_IDS: per dare priorità alle città italiane.

export type TempUnit = "C" | "F";

export interface City {
  id: string;
  label: string;
  marketName: string;
  lat: number;
  lon: number;
  station: string;
  unit: TempUnit;
  timezone: string;
  /**
   * ID stazione api.weather.com nel formato "{ICAO}:9:{CC}" (es. "EHAM:9:NL"), cioè la
   * STAZIONE AEROPORTUALE su cui Wunderground (e quindi il mercato) risolve. Quando presente,
   * leggiamo da qui temperatura attuale e massimo osservato (valori reali, non interpolati).
   */
  resolverStation?: string;
}

/** slug stabile a partire dal nome Polymarket: "Hong Kong" -> "hong-kong", "NYC" -> "nyc". */
export function slugifyCity(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Override con coordinate della stazione di risoluzione (aeroporto) verificate.
export const KNOWN_CITIES: Record<string, City> = {
  milan: {
    id: "milan",
    label: "Milan",
    marketName: "Milan",
    lat: 45.6306, // Malpensa LIMC (stazione di risoluzione verificata)
    lon: 8.7281,
    station: "Milano Malpensa (LIMC)",
    resolverStation: "LIMC:9:IT",
    unit: "C",
    timezone: "Europe/Rome",
  },
  paris: {
    id: "paris",
    label: "Paris",
    marketName: "Paris",
    lat: 48.9694, // Le Bourget LFPB
    lon: 2.4414,
    station: "Paris Le Bourget (LFPB)",
    resolverStation: "LFPB:9:FR",
    unit: "C",
    timezone: "Europe/Paris",
  },
  london: {
    id: "london",
    label: "London",
    marketName: "London",
    lat: 51.5048, // London City EGLC
    lon: 0.0495,
    station: "London City (EGLC)",
    resolverStation: "EGLC:9:GB",
    unit: "C",
    timezone: "Europe/London",
  },
  nyc: {
    id: "nyc",
    label: "New York",
    marketName: "NYC",
    lat: 40.7769, // LaGuardia KLGA
    lon: -73.874,
    station: "LaGuardia (KLGA)",
    resolverStation: "KLGA:9:US",
    unit: "F",
    timezone: "America/New_York",
  },
  tokyo: {
    id: "tokyo",
    label: "Tokyo",
    marketName: "Tokyo",
    lat: 35.5494, // Haneda RJTT
    lon: 139.7798,
    station: "Haneda (RJTT)",
    resolverStation: "RJTT:9:JP",
    unit: "C",
    timezone: "Asia/Tokyo",
  },
};

/** Città italiane note (per ordinamento/priorità in lista). */
export const ITALY_CITY_IDS = new Set([
  "milan",
  "rome",
  "naples",
  "turin",
  "florence",
  "bologna",
  "venice",
  "palermo",
  "genoa",
]);

export function getKnownCity(id: string): City | undefined {
  return KNOWN_CITIES[id];
}

export const DEFAULT_CITY_ID = "milan";
