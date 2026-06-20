// Scoperta dinamica di TUTTI i mercati "Highest temperature in {city}" di Polymarket
// e risoluzione delle coordinate città (override noti + geocoding Open-Meteo).
import { City, KNOWN_CITIES, ITALY_CITY_IDS, slugifyCity, type TempUnit } from "./cities";

const GAMMA = "https://gamma-api.polymarket.com";
const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const HIGHEST_TEMP_TAG = 104596; // tag "Highest temperature"

export interface CityCard {
  cityId: string;
  label: string;
  marketName: string;
  eventSlug: string;
  image: string | null;
  title: string;
  unit: TempUnit;
  marketWinner: { label: string; prob: number } | null;
  isItaly: boolean;
}

interface RawMkt {
  groupItemTitle?: string;
  outcomes?: unknown;
  outcomePrices?: unknown;
}
interface RawEv {
  title?: string;
  slug?: string;
  image?: string;
  icon?: string;
  closed?: boolean;
  markets?: RawMkt[];
}

function jsonArr(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** "June 20" nel formato dei titoli Polymarket. */
function monthDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

function unitFromMarkets(markets: RawMkt[]): TempUnit {
  for (const m of markets) {
    const lab = m.groupItemTitle ?? "";
    if (/°?F\b|Fahrenheit/i.test(lab)) return "F";
    if (/°?C\b|Celsius/i.test(lab)) return "C";
  }
  return "C";
}

function marketWinner(markets: RawMkt[]): { label: string; prob: number } | null {
  let best: { label: string; prob: number } | null = null;
  for (const m of markets) {
    const prices = jsonArr(m.outcomePrices);
    const outcomes = jsonArr(m.outcomes);
    const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === "yes");
    const p = parseFloat(prices[yesIdx >= 0 ? yesIdx : 0] ?? "0");
    if (Number.isFinite(p) && (!best || p > best.prob)) {
      best = { label: m.groupItemTitle ?? "", prob: p };
    }
  }
  return best;
}

// --- cache in-memory con TTL (oltre alla cache fetch di Next) ---
const cardsCache = new Map<string, { at: number; data: CityCard[] }>();
const geoCache = new Map<string, { lat: number; lon: number; timezone: string } | null>();
const TTL = 60_000;

/** Scopre tutte le città con mercato temperatura aperto per la data indicata. */
export async function discoverCities(date: Date, signal?: AbortSignal): Promise<CityCard[]> {
  const day = monthDay(date);
  const cached = cardsCache.get(day);
  if (cached && Date.now() - cached.at < TTL) return cached.data;

  const seen = new Map<string, CityCard>();
  for (let offset = 0; offset < 800; offset += 100) {
    const url = `${GAMMA}/events?tag_id=${HIGHEST_TEMP_TAG}&closed=false&order=startDate&ascending=false&limit=100&offset=${offset}`;
    // no-store: la risposta supera il limite di 2MB della fetch-cache di Next;
    // usiamo la nostra cache in-memory (cardsCache, TTL 60s) per il dedup.
    const res = await fetch(url, {
      signal,
      headers: { "User-Agent": "poly-bot/0.1" },
      cache: "no-store",
    });
    if (!res.ok) break;
    const batch = (await res.json()) as RawEv[];
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const e of batch) {
      const title = e.title ?? "";
      if (e.closed || !title.includes(day)) continue;
      const m = title.match(/^Highest temperature in (.+?) on /);
      if (!m) continue;
      const marketName = m[1];
      const cityId = slugifyCity(marketName);
      if (seen.has(cityId)) continue;
      const markets = e.markets ?? [];
      seen.set(cityId, {
        cityId,
        label: KNOWN_CITIES[cityId]?.label ?? marketName,
        marketName,
        eventSlug: e.slug ?? "",
        image: e.image ?? e.icon ?? null,
        title,
        unit: KNOWN_CITIES[cityId]?.unit ?? unitFromMarkets(markets),
        marketWinner: marketWinner(markets),
        isItaly: ITALY_CITY_IDS.has(cityId),
      });
    }
    if (batch.length < 100) break;
  }

  // Ordina: Italia prima, poi alfabetico per label.
  const data = [...seen.values()].sort((a, b) => {
    if (a.isItaly !== b.isItaly) return a.isItaly ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  cardsCache.set(day, { at: Date.now(), data });
  return data;
}

async function geocode(
  name: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lon: number; timezone: string } | null> {
  if (geoCache.has(name)) return geoCache.get(name)!;
  const url = `${GEOCODE}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  try {
    const res = await fetch(url, { signal, next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      results?: { latitude: number; longitude: number; timezone: string }[];
    };
    const r = data.results?.[0];
    const out = r ? { lat: r.latitude, lon: r.longitude, timezone: r.timezone } : null;
    geoCache.set(name, out);
    return out;
  } catch {
    geoCache.set(name, null);
    return null;
  }
}

/**
 * Risolve un cityId in un descrittore City completo (coordinate per l'oracolo).
 * Usa gli override noti; altrimenti geocodifica il nome di mercato della città.
 */
export async function resolveCity(
  cityId: string,
  date: Date,
  signal?: AbortSignal,
): Promise<City | null> {
  const known = KNOWN_CITIES[cityId];
  if (known) return known;

  // Trova il nome di mercato dalla scoperta (per geocodifica e unità corrette).
  const cards = await discoverCities(date, signal).catch(() => [] as CityCard[]);
  const card = cards.find((c) => c.cityId === cityId);
  const marketName = card?.marketName ?? cityId.replace(/-/g, " ");

  const geo = await geocode(marketName, signal);
  if (!geo) return null;

  return {
    id: cityId,
    label: card?.label ?? marketName,
    marketName,
    lat: geo.lat,
    lon: geo.lon,
    station: `${marketName} (city center)`,
    unit: card?.unit ?? "C",
    timezone: geo.timezone,
  };
}
