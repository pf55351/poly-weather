import { NextRequest, NextResponse } from "next/server";
import { resolveCity } from "@/lib/discover";
import { fetchTempEvent, resolverStationFor } from "@/lib/polymarket";
import { runOracle } from "@/lib/oracle";
import type { BucketDef } from "@/lib/oracle/distribution";

export const revalidate = 600;

// GET /api/oracle?city=milan&date=YYYY-MM-DD
// Allinea la distribuzione ai bucket Polymarket quando la città ha un mercato.
export async function GET(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get("city") ?? "";
  const dateStr = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const date = new Date(`${dateStr}T12:00:00Z`);

  const city = await resolveCity(cityId, date);
  if (!city) {
    return NextResponse.json({ error: `città non risolta: ${cityId}` }, { status: 400 });
  }

  try {
    // Prova sempre a recuperare i bucket del mercato per allineare la distribuzione.
    let marketBuckets: BucketDef[] | undefined;
    const event = await fetchTempEvent(city, date, undefined, fresh).catch(() => null);
    if (event && event.buckets.length > 0) {
      marketBuckets = event.buckets.map((b) => ({
        label: b.label,
        low: b.low,
        high: b.high,
      }));
    }

    // Stazione di risoluzione dal mercato (auto-config); fallback al valore in cities.ts.
    const station = resolverStationFor(city.id, event?.resolutionSource) ?? city.resolverStation;
    const cityR = station === city.resolverStation ? city : { ...city, resolverStation: station };

    const result = await runOracle(cityR, dateStr, marketBuckets, undefined, fresh);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
