// NWS — National Weather Service USA (api.weather.gov). Gratuito, nessuna chiave.
// Previsione UFFICIALE e INDIPENDENTE dai modelli grezzi (riveduta da meteorologi umani),
// quindi aggiunge informazione reale all'ensemble per le città statunitensi. Fuori dagli USA
// l'endpoint risponde 404 → la fonte ritorna [] e viene scartata automaticamente.
import type { WeatherSource } from "./types";
import { cacheInit } from "../../fetch-cache";

const POINTS = "https://api.weather.gov/points";
const UA = "polymeteo/0.1 (https://blockchainitalia.io)";

/** Bounding box grezzo USA (continentale + Alaska + Hawaii) per evitare 404 inutili altrove. */
function maybeUS(lat: number, lon: number): boolean {
  return lat >= 18 && lat <= 72 && lon >= -170 && lon <= -66;
}

export const nws: WeatherSource = {
  id: "nws",
  label: "NWS api.weather.gov (USA, ufficiale)",
  enabled: () => true,
  async fetchMembers(ctx) {
    if (!maybeUS(ctx.lat, ctx.lon)) return [];
    const headers = { "User-Agent": UA, Accept: "application/geo+json" };

    // 1) /points → URL della previsione per la griglia locale
    const ptRes = await fetch(`${POINTS}/${ctx.lat.toFixed(4)},${ctx.lon.toFixed(4)}`, {
      signal: ctx.signal,
      headers,
      ...cacheInit(3600, ctx.fresh), // la griglia è stabile: cache lunga
    });
    if (!ptRes.ok) return [];
    const pt = (await ptRes.json()) as { properties?: { forecast?: string } };
    const fcUrl = pt.properties?.forecast;
    if (!fcUrl) return [];

    // 2) forecast → periodi 12h; il periodo DIURNO del giorno target è la massima prevista
    const fcRes = await fetch(fcUrl, { signal: ctx.signal, headers, ...cacheInit(600, ctx.fresh) });
    if (!fcRes.ok) return [];
    const fc = (await fcRes.json()) as {
      properties?: {
        periods?: { startTime?: string; isDaytime?: boolean; temperature?: number; temperatureUnit?: string }[];
      };
    };
    const periods = fc.properties?.periods ?? [];
    const hi = periods.find(
      (p) =>
        p.isDaytime === true &&
        typeof p.startTime === "string" &&
        p.startTime.slice(0, 10) === ctx.date &&
        typeof p.temperature === "number",
    );
    if (!hi || typeof hi.temperature !== "number") return [];

    // NWS dà °F (di default); convertiamo in °C come tutte le altre fonti.
    const c = hi.temperatureUnit === "C" ? hi.temperature : ((hi.temperature - 32) * 5) / 9;
    return [c];
  },
};
