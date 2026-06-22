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
import { fetchObservedMaxC } from "./observed";
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

  // In parallelo: le previsioni delle fonti + il massimo già osservato oggi (floor intraday).
  const [settled, floorC] = await Promise.all([
    Promise.allSettled(active.map((s) => s.fetchMembers(ctx))),
    fetchObservedMaxC(city, date, signal).catch(() => null),
  ]);

  const summaries: SourceSummary[] = [];
  // Centro (μ) = media PESATA dei member (Wunderground sposta il centro).
  // Dispersione (σ) = stdev dei member NON pesati (vero disaccordo tra modelli).
  let weightedSum = 0;
  let weightedN = 0;
  const unweightedMembers: number[] = [];

  settled.forEach((r, i) => {
    const src = active[i];
    const weight = Math.max(1, Math.round(src.weight ?? 1));
    if (r.status === "fulfilled") {
      const members = r.value;
      unweightedMembers.push(...members);
      for (const v of members) {
        weightedSum += v * weight;
        weightedN += weight;
      }
      const meanC = members.length
        ? members.reduce((s, v) => s + v, 0) / members.length
        : null;
      summaries.push({ id: src.id, label: src.label, memberCount: members.length, weight, meanC, ok: true });
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

  const sampleCount = unweightedMembers.length;
  const meanC = weightedN > 0 ? weightedSum / weightedN : NaN;
  // σ dai member non pesati, inflazionata (ensemble sotto-disperso) e con floor.
  const rawMean = sampleCount
    ? unweightedMembers.reduce((s, v) => s + v, 0) / sampleCount
    : NaN;
  const rawSd = sampleCount
    ? Math.sqrt(unweightedMembers.reduce((s, v) => s + (v - rawMean) ** 2, 0) / sampleCount)
    : 0;
  const sigmaC = Math.max(0.7, rawSd * 1.4);

  const distribution = buildDistribution({
    meanC,
    sigmaC,
    unit: city.unit,
    sampleCount,
    marketBuckets,
    floorC: floorC ?? undefined,
  });

  return {
    cityId: city.id,
    date,
    distribution,
    sources: summaries,
    sourceCount: summaries.filter((s) => s.ok).length,
    sampleCount,
  };
}
