import { NextRequest, NextResponse } from "next/server";
import { discoverCities, resolveCity, type CityCard } from "@/lib/discover";
import { fetchTempEvent } from "@/lib/polymarket";
import { runOracle } from "@/lib/oracle";
import { edgePoints } from "@/lib/format";
import type { BucketDef } from "@/lib/oracle/distribution";
import type { TempUnit } from "@/lib/cities";

export const revalidate = 90;

export interface BoardRow {
  cityId: string;
  label: string;
  marketName: string;
  image: string | null;
  title: string;
  unit: TempUnit;
  timezone: string;
  isItaly: boolean;
  hasMarket: boolean;
  /** quando il mercato chiude/risolve (ISO UTC) */
  endDate: string | null;
  marketWinner: { label: string; prob: number } | null;
  oracleWinner: { label: string; prob: number } | null;
  /** edge = P_oracolo − P_mercato (punti %) quando i due indicano lo stesso bucket, altrimenti null */
  edge: number | null;
  sourceCount: number;
  /** temperatura attuale nell'unità della città (°C/°F) */
  currentTemp: number | null;
  /** massimo registrato finora oggi (unità della città), dal risolutore quando disponibile */
  observedMax: number | null;
}

export interface BoardResponse {
  date: string;
  generatedAt: string;
  cities: BoardRow[];
}

/** Esegue fn su items con al massimo `limit` esecuzioni concorrenti. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function computeRow(card: CityCard, dateStr: string, dateObj: Date): Promise<BoardRow> {
  const base: BoardRow = {
    cityId: card.cityId,
    label: card.label,
    marketName: card.marketName,
    image: card.image,
    title: card.title,
    unit: card.unit,
    timezone: "UTC",
    isItaly: card.isItaly,
    hasMarket: false,
    endDate: null,
    marketWinner: null,
    oracleWinner: null,
    edge: null,
    sourceCount: 0,
    currentTemp: null,
    observedMax: null,
  };

  const city = await resolveCity(card.cityId, dateObj).catch(() => null);
  if (!city) return base;
  base.label = city.label;
  base.timezone = city.timezone;

  const event = await fetchTempEvent(city, dateObj).catch(() => null);
  const marketBuckets: BucketDef[] | undefined = event?.buckets.length
    ? event.buckets.map((b) => ({ label: b.label, low: b.low, high: b.high }))
    : undefined;

  const oracle = await runOracle(city, dateStr, marketBuckets).catch(() => null);

  if (event && event.buckets.length) {
    const top = event.buckets.reduce((a, b) => (b.yesPrice > a.yesPrice ? b : a));
    base.hasMarket = true;
    base.endDate = event.endDate;
    base.marketWinner = { label: top.label, prob: top.yesPrice };
  }
  const ml = oracle?.distribution.mostLikely ?? null;
  base.oracleWinner = ml ? { label: ml.label, prob: ml.probability } : null;
  base.sourceCount = oracle?.sourceCount ?? 0;
  base.currentTemp = oracle?.currentTemp ?? null;
  base.observedMax = oracle?.observedMax ?? null;

  if (base.marketWinner && base.oracleWinner && base.marketWinner.label === base.oracleWinner.label) {
    base.edge = edgePoints(base.oracleWinner.prob, base.marketWinner.prob);
  }
  return base;
}

// GET /api/board?date=YYYY-MM-DD -> tutte le città con market+oracle winner + edge.
// Ordine canonico (Italia prima, A-Z); l'ordinamento per edge è lato client.
export async function GET(req: NextRequest) {
  const dateStr = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const dateObj = new Date(`${dateStr}T12:00:00Z`);

  try {
    const cards = await discoverCities(dateObj);
    const cities = await mapLimit(cards, 6, (c) => computeRow(c, dateStr, dateObj));
    return NextResponse.json({
      date: dateStr,
      generatedAt: new Date().toISOString(),
      cities,
    } satisfies BoardResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json(
      { date: dateStr, generatedAt: new Date().toISOString(), cities: [], error: message },
      { status: 502 },
    );
  }
}
