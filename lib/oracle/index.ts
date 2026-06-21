// Aggregatore dell'oracolo: interroga TUTTE le fonti abilitate in parallelo,
// concatena i loro members e costruisce la distribuzione di probabilità.
import type { City } from "../cities";
import { buildDistribution, type BucketDef, type DistributionResult } from "./distribution";
import { openMeteoEnsemble, openMeteoMultiModel } from "./sources/open-meteo";
import { metNorway } from "./sources/met-norway";
import { wttrIn } from "./sources/wttr";
import { sevenTimer } from "./sources/seven-timer";
import { wunderground } from "./sources/wunderground";
import { openWeather } from "./sources/openweather";
import { weatherApi } from "./sources/weatherapi";
import type { SourceContext, WeatherSource } from "./sources/types";

// Fonti dell'oracolo. Wunderground è la FONTE DI RISOLUZIONE → peso alto (vedi sua `weight`).
// Backbone senza chiave (Open-Meteo include il modello ufficiale italiano ARPAE ICON-2I) +
// provider gratuiti aggiuntivi + provider con chiave opzionali.
const ALL_SOURCES: WeatherSource[] = [
  wunderground, // fonte di verità, pesata
  openMeteoEnsemble,
  openMeteoMultiModel,
  metNorway,
  wttrIn,
  sevenTimer,
  openWeather, // attivo solo con OPENWEATHER_API_KEY
  weatherApi, // attivo solo con WEATHERAPI_KEY
];

export interface SourceSummary {
  id: string;
  label: string;
  memberCount: number;
  /** peso della fonte nella distribuzione (1 = normale; >1 = pesata, es. Wunderground) */
  weight: number;
  /** media °C dei member di questa fonte, per trasparenza */
  meanC: number | null;
  ok: boolean;
  error?: string;
}

export interface OracleResult {
  cityId: string;
  date: string;
  distribution: DistributionResult;
  sources: SourceSummary[];
  /** numero di fonti che hanno risposto con successo */
  sourceCount: number;
  /** numero REALE di stime (non pesato), per la UI */
  sampleCount: number;
}

export async function runOracle(
  city: City,
  date: string,
  marketBuckets?: BucketDef[],
  signal?: AbortSignal,
): Promise<OracleResult> {
  const ctx: SourceContext = {
    lat: city.lat,
    lon: city.lon,
    date,
    timezone: city.timezone,
    signal,
  };

  const active = ALL_SOURCES.filter((s) => s.enabled());

  const settled = await Promise.allSettled(
    active.map((s) => s.fetchMembers(ctx)),
  );

  const summaries: SourceSummary[] = [];
  // weightedMembers: ogni fonte contribuisce `weight` copie dei suoi membri → la
  // distribuzione riflette il peso (Wunderground domina senza però azzerare le altre).
  const weightedMembers: number[] = [];
  let sampleCount = 0; // conteggio REALE (non pesato) per la UI

  settled.forEach((r, i) => {
    const src = active[i];
    const weight = Math.max(1, Math.round(src.weight ?? 1));
    if (r.status === "fulfilled") {
      const members = r.value;
      sampleCount += members.length;
      for (let k = 0; k < weight; k++) weightedMembers.push(...members);
      const meanC = members.length
        ? members.reduce((s, v) => s + v, 0) / members.length
        : null;
      summaries.push({
        id: src.id,
        label: src.label,
        memberCount: members.length,
        weight,
        meanC,
        ok: true,
      });
    } else {
      summaries.push({
        id: src.id,
        label: src.label,
        memberCount: 0,
        weight,
        meanC: null,
        ok: false,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });

  const distribution = buildDistribution(weightedMembers, city.unit, marketBuckets);

  return {
    cityId: city.id,
    date,
    distribution,
    sources: summaries,
    sourceCount: summaries.filter((s) => s.ok).length,
    sampleCount,
  };
}
