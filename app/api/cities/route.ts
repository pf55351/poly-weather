import { NextRequest, NextResponse } from "next/server";
import { discoverCities } from "@/lib/discover";

export const revalidate = 60;

// GET /api/cities?date=YYYY-MM-DD -> tutte le città con mercato temperatura aperto oggi.
export async function GET(req: NextRequest) {
  const dateStr = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const date = new Date(`${dateStr}T12:00:00Z`);
  try {
    const cities = await discoverCities(date);
    return NextResponse.json({ date: dateStr, count: cities.length, cities });
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json({ date: dateStr, count: 0, cities: [], error: message }, { status: 502 });
  }
}
