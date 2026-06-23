// Osservazioni dalla STAZIONE DEL RISOLUTORE (Wunderground / api.weather.com), cioè
// gli stessi dati su cui il mercato Polymarket si risolve. Forniscono:
//  - currentC: temperatura attuale
//  - maxC: MASSIMO registrato finora oggi (since 7am local) → il floor più affidabile,
//    allineato alla risoluzione. Più la giornata avanza, più questo numero "decide"
//    l'esito: la distribuzione si tronca sotto di esso.
// units=m → gradi Celsius (li convertiamo poi nell'unità della scommessa).

const CURRENT = "https://api.weather.com/v3/wx/observations/current";
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

export async function fetchResolverObserved(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ResolverObserved> {
  if (!KEY) return EMPTY;
  const url =
    `${CURRENT}?geocode=${lat},${lon}&units=m&language=en-US&format=json&apiKey=${KEY}`;
  try {
    const res = await fetch(url, { signal, next: { revalidate: 300 } });
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as {
      temperature?: number | null;
      temperatureMaxSince7Am?: number | null;
      temperatureMax24Hour?: number | null;
    };
    const current = num(data.temperature);
    // "since 7am" è il massimo della giornata locale; fallback al max 24h.
    const max = num(data.temperatureMaxSince7Am) ?? num(data.temperatureMax24Hour);
    // Il massimo non può essere sotto la temperatura attuale.
    const maxC = max !== null && current !== null ? Math.max(max, current) : (max ?? current);
    return { currentC: current, maxC };
  } catch {
    return EMPTY;
  }
}
