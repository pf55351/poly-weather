// Osservazioni dalla STAZIONE DI RISOLUZIONE (aeroporto) via api.weather.com v1, gli stessi
// dati mostrati da wunderground.com e su cui il mercato Polymarket si risolve. Forniscono:
//  - currentC: temperatura attuale REALE della stazione
//  - maxC: MASSIMO osservato finora oggi (max delle letture orarie) → floor affidabile.
//
// IMPORTANTE: NON usiamo l'endpoint v3 "wx/observations/current" perché restituisce un valore
// INTERPOLATO su griglia (stationID null), che può discostarsi di 2-3°C dalla stazione reale.
// L'endpoint v1 "/location/{ICAO}:9:{CC}/observations" legge invece la stazione vera (METAR).
// units=m → gradi Celsius (li convertiamo poi nell'unità della scommessa).

import { cacheInit } from "../fetch-cache";

const V1 = "https://api.weather.com/v1/location";
const KEY = process.env.WEATHERCOM_API_KEY ?? "e1f10a1e78da46f5b10a1e78da96f525";

export interface ResolverObserved {
  /** temperatura attuale (°C) dalla stazione di risoluzione */
  currentC: number | null;
  /** massimo registrato finora oggi (°C) dalla stazione di risoluzione */
  maxC: number | null;
}

const EMPTY: ResolverObserved = { currentC: null, maxC: null };

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * @param stationId  id stazione "{ICAO}:9:{CC}" (es. "EHAM:9:NL"); null/undefined per le città
 *                   senza stazione di risoluzione nota → ritorna EMPTY (si usa il fallback).
 * @param date       giorno target "YYYY-MM-DD" (deve essere oggi: lo garantisce il chiamante).
 */
export async function fetchResolverObserved(
  stationId: string | undefined,
  date: string,
  signal?: AbortSignal,
  fresh?: boolean,
): Promise<ResolverObserved> {
  if (!KEY || !stationId) return EMPTY;
  const common = `apiKey=${KEY}&units=m&language=en-US`;
  const ymd = date.replace(/-/g, ""); // "2026-06-23" -> "20260623"

  try {
    const [curRes, histRes] = await Promise.all([
      fetch(`${V1}/${stationId}/observations.json?${common}`, {
        signal,
        ...cacheInit(300, fresh),
      }),
      fetch(`${V1}/${stationId}/observations/historical.json?${common}&startDate=${ymd}`, {
        signal,
        ...cacheInit(300, fresh),
      }),
    ]);

    let currentC: number | null = null;
    if (curRes.ok) {
      const data = (await curRes.json()) as { observation?: { temp?: number | null } };
      currentC = num(data.observation?.temp);
    }

    let maxC: number | null = null;
    if (histRes.ok) {
      const data = (await histRes.json()) as {
        observations?: { temp?: number | null }[];
      };
      const temps = (data.observations ?? [])
        .map((o) => num(o.temp))
        .filter((v): v is number => v !== null);
      if (temps.length) maxC = Math.max(...temps);
    }

    // Il massimo non può essere sotto la temperatura attuale.
    if (maxC !== null && currentC !== null) maxC = Math.max(maxC, currentC);
    else if (maxC === null) maxC = currentC;

    return { currentC, maxC };
  } catch {
    return EMPTY;
  }
}
