import { NextRequest, NextResponse } from "next/server";
import { resolveCity } from "@/lib/discover";
import { fetchTempEvent } from "@/lib/polymarket";
import { runOracle } from "@/lib/oracle";
import type { BucketDef } from "@/lib/oracle/distribution";

export const revalidate = 60;

export interface CitySummary {
  cityId: string;
  label: string;
  hasMarket: boolean;
  image: string | null;
  title: string;
  eventSlug: string | null;
  marketWinner: { label: string; prob: number } | null;
  oracleWinner: { label: string; prob: number } | null;
  sourceCount: number;
  error?: string;
}

// GET /api/summary?city=paris -> dati compatti per la card nella lista iniziale.
export async function GET(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get("city") ?? "";
  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const dateObj = new Date(`${date}T12:00:00Z`);

  const city = await resolveCity(cityId, dateObj);
  if (!city) {
    return NextResponse.json({ error: `città non risolta: ${cityId}` }, { status: 400 });
  }

  try {
    const event = await fetchTempEvent(city, dateObj).catch(() => null);

    const marketBuckets: BucketDef[] | undefined = event?.buckets.length
      ? event.buckets.map((b) => ({ label: b.label, low: b.low, high: b.high }))
      : undefined;

    const oracle = await runOracle(city, date, marketBuckets);

    // Predizione vincente del mercato = bucket con prob. implicita (Yes) più alta.
    let marketWinner: CitySummary["marketWinner"] = null;
    if (event && event.buckets.length) {
      const top = event.buckets.reduce((a, b) => (b.yesPrice > a.yesPrice ? b : a));
      marketWinner = { label: top.label, prob: top.yesPrice };
    }

    const ml = oracle.distribution.mostLikely;
    const oracleWinner = ml ? { label: ml.label, prob: ml.probability } : null;

    const summary: CitySummary = {
      cityId: city.id,
      label: city.label,
      hasMarket: Boolean(event),
      image: event?.image ?? null,
      title: event?.title ?? `Highest temperature in ${city.label}`,
      eventSlug: event?.slug ?? null,
      marketWinner,
      oracleWinner,
      sourceCount: oracle.sourceCount,
    };
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json(
      {
        cityId: city.id,
        label: city.label,
        hasMarket: false,
        image: null,
        title: city.label,
        eventSlug: null,
        marketWinner: null,
        oracleWinner: null,
        sourceCount: 0,
        error: message,
      } satisfies CitySummary,
      { status: 200 },
    );
  }
}
