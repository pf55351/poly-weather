// Aggregatore dell'oracolo: interroga TUTTE le fonti abilitate in parallelo,
// concatena i loro members e costruisce la distribuzione di probabilità.
import type { City } from "../cities";
import { buildDistribution, type BucketDef, type DistributionResult } from "./distribution";
import { openMeteoEnsemble, openMeteoMultiModel } from "./sources/open-meteo";
import { metNorway } from "./sources/met-norway";
import { wttrIn } from "./sources/wttr";
import { sevenTimer } from "./sources/seven-timer";
import { openWeather } from "./sources/openweather";
import { weatherApi } from "./sources/weatherapi";
import type { SourceContext, WeatherSource } from "./sources/types";

// Fonti dell'oracolo. Backbone senza chiave (Open-Meteo include il modello ufficiale
// italiano ARPAE ICON-2I) + provider gratuiti aggiuntivi + provider con chiave opzionali.
const ALL_SOURCES: WeatherSource[] = [
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
  const allMembers: number[] = [];

  settled.forEach((r, i) => {
    const src = active[i];
    if (r.status === "fulfilled") {
      const members = r.value;
      allMembers.push(...members);
      const meanC = members.length
        ? members.reduce((s, v) => s + v, 0) / members.length
        : null;
      summaries.push({
        id: src.id,
        label: src.label,
        memberCount: members.length,
        meanC,
        ok: true,
      });
    } else {
      summaries.push({
        id: src.id,
        label: src.label,
        memberCount: 0,
        meanC: null,
        ok: false,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });

  const distribution = buildDistribution(allMembers, city.unit, marketBuckets);

  return {
    cityId: city.id,
    date,
    distribution,
    sources: summaries,
    sourceCount: summaries.filter((s) => s.ok).length,
  };
}
