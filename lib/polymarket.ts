// Client per la Gamma API di Polymarket (pubblica, nessuna auth).
// Recupera l'evento "Highest temperature in {city} on {date}?" e normalizza i bucket.
import type { City, TempUnit } from "./cities";

const GAMMA = "https://gamma-api.polymarket.com";

/** Un bucket di temperatura = un mercato Yes/No dentro l'evento. */
export interface TempBucket {
  conditionId: string;
  /** Slug del singolo mercato/bucket, per il link alla pagina d'ordine Polymarket */
  slug: string;
  /** Etichetta originale Polymarket, es. "30-31°C", "29°C or below" */
  label: string;
  /** Estremo inferiore del range in gradi (null = aperto verso il basso) */
  low: number | null;
  /** Estremo superiore del range in gradi (null = aperto verso l'alto) */
  high: number | null;
  /** Probabilità implicita dell'outcome "Yes" (0..1) = prezzo */
  yesPrice: number;
  bestBid: number | null;
  bestAsk: number | null;
  oneDayPriceChange: number | null;
  volume24hr: number;
  volume: number;
  liquidity: number;
  /** Token id ERC1155 per la sottoscrizione WebSocket (outcome Yes) */
  yesTokenId: string | null;
  clobTokenIds: string[];
}

export interface TempMarketEvent {
  cityId: string;
  title: string;
  slug: string;
  /** URL immagine evento (CDN Polymarket) */
  image: string | null;
  endDate: string | null;
  resolutionSource: string | null;
  description: string | null;
  unit: TempUnit;
  volume24hr: number;
  liquidity: number;
  buckets: TempBucket[];
}

function safeJsonArray(raw: unknown): string[] {
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

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Converte l'etichetta di un bucket Polymarket in un range numerico [low, high].
 * Gestisce: "X°C or below", "X°C or above", "X-Y°C", "X–Y°C", "X°C".
 */
export function parseBucketRange(label: string): { low: number | null; high: number | null } {
  const cleaned = label.replace(/°[CF]/gi, "").replace(/,/g, "").trim();
  const lower = cleaned.toLowerCase();

  if (lower.includes("below") || lower.includes("under") || lower.includes("less")) {
    const m = cleaned.match(/-?\d+(\.\d+)?/);
    return { low: null, high: m ? parseFloat(m[0]) : null };
  }
  if (lower.includes("above") || lower.includes("over") || lower.includes("more")) {
    const m = cleaned.match(/-?\d+(\.\d+)?/);
    return { low: m ? parseFloat(m[0]) : null, high: null };
  }
  const range = cleaned.match(/(-?\d+(?:\.\d+)?)\s*[-–to]+\s*(-?\d+(?:\.\d+)?)/i);
  if (range) {
    return { low: parseFloat(range[1]), high: parseFloat(range[2]) };
  }
  const single = cleaned.match(/-?\d+(\.\d+)?/);
  if (single) {
    const v = parseFloat(single[0]);
    return { low: v, high: v };
  }
  return { low: null, high: null };
}

interface RawMarket {
  conditionId?: string;
  slug?: string;
  groupItemTitle?: string;
  outcomes?: unknown;
  outcomePrices?: unknown;
  clobTokenIds?: unknown;
  bestBid?: number;
  bestAsk?: number;
  oneDayPriceChange?: number;
  volume24hr?: unknown;
  volume?: unknown;
  liquidity?: unknown;
  closed?: boolean;
}

interface RawEvent {
  title?: string;
  slug?: string;
  image?: string;
  icon?: string;
  endDate?: string;
  resolutionSource?: string;
  description?: string;
  volume24hr?: unknown;
  liquidity?: unknown;
  markets?: RawMarket[];
  closed?: boolean;
  active?: boolean;
}

function normalizeBucket(m: RawMarket): TempBucket {
  const outcomes = safeJsonArray(m.outcomes);
  const prices = safeJsonArray(m.outcomePrices);
  const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const yesPrice = num(prices[yesIdx >= 0 ? yesIdx : 0], 0);
  const clobTokenIds = safeJsonArray(m.clobTokenIds);
  const label = m.groupItemTitle ?? "";
  const { low, high } = parseBucketRange(label);
  return {
    conditionId: m.conditionId ?? "",
    slug: m.slug ?? "",
    label,
    low,
    high,
    yesPrice,
    bestBid: typeof m.bestBid === "number" ? m.bestBid : null,
    bestAsk: typeof m.bestAsk === "number" ? m.bestAsk : null,
    oneDayPriceChange: typeof m.oneDayPriceChange === "number" ? m.oneDayPriceChange : null,
    volume24hr: num(m.volume24hr),
    volume: num(m.volume),
    liquidity: num(m.liquidity),
    yesTokenId: clobTokenIds[yesIdx >= 0 ? yesIdx : 0] ?? null,
    clobTokenIds,
  };
}

/** Formatta la data nel modo usato nei titoli Polymarket, es. "June 20". */
function monthDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Recupera l'evento temperatura per una città in una data.
 * Prova sempre la ricerca (l'esistenza del mercato è dinamica).
 * Ritorna null se l'evento del giorno non esiste.
 */
export async function fetchTempEvent(
  city: City,
  date: Date,
  signal?: AbortSignal,
): Promise<TempMarketEvent | null> {
  const q = encodeURIComponent(`Highest temperature in ${city.marketName}`);
  const url = `${GAMMA}/public-search?q=${q}&limit_per_type=20`;
  const res = await fetch(url, { signal, next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`Gamma search failed: ${res.status}`);
  const data = (await res.json()) as { events?: RawEvent[] };
  const events = data.events ?? [];

  const wantDay = monthDay(date); // es. "June 20"
  const wantName = city.marketName.toLowerCase();

  // Preferisci l'evento che corrisponde a città + data; altrimenti il primo attivo.
  const match =
    events.find(
      (e) =>
        !e.closed &&
        (e.title ?? "").toLowerCase().includes(wantName) &&
        (e.title ?? "").includes(wantDay),
    ) ??
    events.find((e) => !e.closed && (e.title ?? "").toLowerCase().includes(wantName)) ??
    null;

  if (!match) return null;

  const buckets = (match.markets ?? [])
    .filter((m) => !m.closed && m.groupItemTitle)
    .map(normalizeBucket)
    // ordina dal bucket più freddo al più caldo
    .sort((a, b) => (a.low ?? a.high ?? -999) - (b.low ?? b.high ?? -999));

  return {
    cityId: city.id,
    title: match.title ?? "",
    slug: match.slug ?? "",
    image: match.image ?? match.icon ?? null,
    endDate: match.endDate ?? null,
    resolutionSource: match.resolutionSource ?? null,
    description: match.description ?? null,
    unit: city.unit,
    volume24hr: num(match.volume24hr),
    liquidity: num(match.liquidity),
    buckets,
  };
}

const POLYMARKET = "https://polymarket.com";

/** Pagina Polymarket dell'evento. */
export function polymarketEventUrl(eventSlug: string): string {
  return `${POLYMARKET}/event/${eventSlug}`;
}

/** Pagina del singolo mercato/bucket dove piazzare l'ordine. */
export function polymarketBucketUrl(eventSlug: string, bucketSlug: string): string {
  if (!eventSlug) return POLYMARKET;
  return bucketSlug ? `${POLYMARKET}/event/${eventSlug}/${bucketSlug}` : polymarketEventUrl(eventSlug);
}
