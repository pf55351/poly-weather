import { NextRequest, NextResponse } from "next/server";
import { resolveCity } from "@/lib/discover";
import { fetchTempEvent } from "@/lib/polymarket";

export const revalidate = 15;

// GET /api/markets?city=milan&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get("city") ?? "";
  const dateStr = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const date = new Date(`${dateStr}T12:00:00Z`);

  const city = await resolveCity(cityId, date);
  if (!city) {
    return NextResponse.json({ error: `città non risolta: ${cityId}` }, { status: 400 });
  }

  const cityInfo = {
    id: city.id,
    label: city.label,
    station: city.station,
    unit: city.unit,
    timezone: city.timezone,
  };

  try {
    const event = await fetchTempEvent(city, date, undefined, fresh);
    // hasMarket è dinamico: vero se esiste un evento del giorno per questa città.
    return NextResponse.json({ cityId: city.id, hasMarket: Boolean(event), event, city: cityInfo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json(
      { cityId: city.id, hasMarket: false, event: null, city: cityInfo, error: message },
      { status: 502 },
    );
  }
}
