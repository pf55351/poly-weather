// Aggregatore dell'oracolo: interroga TUTTE le fonti abilitate in parallelo,
// concatena i loro members e costruisce la distribuzione di probabilità.
import type { City } from "../cities";
import { buildDistribution, cToF, type BucketDef, type DistributionResult } from "./distribution";
import { openMeteoEnsemble, openMeteoMultiModel } from "./sources/open-meteo";
import { metNorway } from "./sources/met-norway";
import { wttrIn } from "./sources/wttr";
import { sevenTimer } from "./sources/seven-timer";
import { wunderground } from "./sources/wunderground";
import { nws } from "./sources/nws";
import { openWeather } from "./sources/openweather";
import { weatherApi } from "./sources/weatherapi";
import { fetchResolverObserved } from "./resolver-observed";
import { fetchPeakHour } from "./peak";
import { fetchStationCoords } from "./station-coords";
import type { SourceContext, WeatherSource } from "./sources/types";

// Fonti dell'oracolo. Wunderground è la FONTE DI RISOLUZIONE → peso alto (vedi sua `weight`).
// Backbone senza chiave (Open-Meteo include il modello ufficiale italiano ARPAE ICON-2I) +
// provider gratuiti aggiuntivi + provider con chiave opzionali.
const ALL_SOURCES: WeatherSource[] = [
  wunderground, // fonte di verità, pesata
  openMeteoEnsemble,
  openMeteoMultiModel,
  metNorway,
  nws, // National Weather Service USA (ufficiale, indipendente) — solo città USA
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
  /** temperatura attuale nell'unità della città (°C/°F), per la UI */
  currentTemp: number | null;
  /** massimo registrato finora oggi (unità della città); preferito dal risolutore */
  observedMax: number | null;
  /** true se observedMax/currentTemp arrivano dalla stazione di risoluzione (Wunderground) */
  observedFromResolver: boolean;
  /** ora locale (0..23) del picco di temperatura previsto oggi, o null */
  peakHour: number | null;
  /** nome della stazione di risoluzione su cui si prevede (aeroporto), null = centro città */
  stationName: string | null;
}

export async function runOracle(
  city: City,
  date: string,
  marketBuckets?: BucketDef[],
  signal?: AbortSignal,
  fresh?: boolean,
): Promise<OracleResult> {
  // Punto di previsione: le COORDINATE DELLA STAZIONE di risoluzione se note (l'aeroporto su cui
  // il mercato risolve, spesso lontano dal centro città), altrimenti il centro città. Così tutte
  // le fonti prevedono dove davvero si risolve, non in un punto diverso (bias sistematico).
  const stationCoords = await fetchStationCoords(city.resolverStation, signal, fresh);
  const fcLat = stationCoords?.lat ?? city.lat;
  const fcLon = stationCoords?.lon ?? city.lon;

  const ctx: SourceContext = {
    lat: fcLat,
    lon: fcLon,
    date,
    timezone: city.timezone,
    signal,
    fresh,
  };
  const fcCity: City = { ...city, lat: fcLat, lon: fcLon };

  const active = ALL_SOURCES.filter((s) => s.enabled());

  // Le osservazioni intraday valgono solo se il giorno target è OGGI nel fuso della città:
  // per i mercati "Domani" non esiste ancora un massimo osservato (niente floor).
  const todayLocal = new Date().toLocaleDateString("sv-SE", { timeZone: city.timezone });
  const isToday = date === todayLocal;

  // In parallelo: le previsioni delle fonti + osservazioni intraday dalla STAZIONE DI RISOLUZIONE
  // (Wunderground = stazione su cui si risolve il mercato). SOLO il risolutore: il dato modellato
  // (Open-Meteo gridded) è inaffidabile (±2-3°F) e usato come floor azzerava bucket validi (vedi
  // Atlanta). Senza stazione reale → niente Now/Max/floor (l'oracolo resta pura previsione).
  const [settled, resolver, peakHour] = await Promise.all([
    Promise.allSettled(active.map((s) => s.fetchMembers(ctx))),
    isToday
      ? fetchResolverObserved(city.resolverStation, date, signal, fresh).catch(() => ({
          maxC: null,
          currentC: null,
        }))
      : Promise.resolve({ maxC: null, currentC: null }),
    isToday ? fetchPeakHour(fcCity, date, signal, fresh).catch(() => null) : Promise.resolve(null),
  ]);
  const observedFromResolver = resolver.maxC !== null;
  const rawMaxC = resolver.maxC; // massimo osservato REALE (stazione), o null
  const currentC = resolver.currentC; // temperatura attuale REALE (stazione), o null
  // Floor della distribuzione = massimo osservato reale (hard floor): il max del giorno non può
  // essere inferiore a ciò che la stazione ha già misurato. Assente la stazione → nessun floor.
  const floorC = rawMaxC;

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
  let meanC = weightedN > 0 ? weightedSum / weightedN : NaN;
  // σ dai member non pesati, inflazionata (ensemble sotto-disperso) e con floor.
  const rawMean = sampleCount
    ? unweightedMembers.reduce((s, v) => s + v, 0) / sampleCount
    : NaN;
  const rawSd = sampleCount
    ? Math.sqrt(unweightedMembers.reduce((s, v) => s + (v - rawMean) ** 2, 0) / sampleCount)
    : 0;
  const dayFraction = isToday ? localDayFraction(city.timezone) : null;
  // Tempo (ore) trascorso dal PICCO previsto, specifico per la città (Londra ~17, altre ~14-15).
  // Prima del picco il max non è ancora arrivato; dopo, è sempre più "in cassa". Se la previsione
  // oraria manca, fallback prudente al picco generico delle 15.
  const hourLocal = dayFraction !== null ? dayFraction * 24 : null;
  const hoursAfterPeak = hourLocal !== null ? hourLocal - (peakHour ?? 15) : null;

  // Ancoraggio al massimo OSSERVATO reale DOPO il picco: il max del giorno è ≈ quello già misurato
  // dalla stazione, quindi la previsione (che oggi può essere sbagliata) conta sempre meno. Senza
  // questo, in un giorno più freddo del previsto l'oracolo resterebbe sulla previsione errata
  // (vedi Seul: previsto 29°C, osservato reale 25°C).
  if (floorC !== null && Number.isFinite(meanC)) {
    const w = anchorWeightAfterPeak(hoursAfterPeak);
    meanC = (1 - w) * meanC + w * floorC;
  }

  // σ del max si restringe DOPO il picco previsto (prima resta piena: il max può ancora salire).
  const sigmaC = Math.max(0.4, Math.max(0.7, rawSd * 1.4) * sigmaShrinkAfterPeak(hoursAfterPeak));

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
    currentTemp: toUnit(currentC, city.unit),
    observedMax: toUnit(rawMaxC, city.unit),
    observedFromResolver,
    peakHour,
    stationName: stationCoords?.name ?? null,
  };
}

/** Converte °C → unità della scommessa (°C/°F), preservando null. */
function toUnit(c: number | null, unit: "C" | "F"): number | null {
  if (c === null) return null;
  return unit === "F" ? cToF(c) : c;
}

/** Frazione 0..1 di giornata trascorsa nel fuso della città. */
function localDayFraction(timezone: string): number {
  const hhmm = new Date().toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return (h * 60 + m) / 1440;
}

/** Peso dell'ancoraggio al max osservato in funzione delle ore DAL PICCO previsto: 0 prima/al
 *  picco (il max non è ancora arrivato), cresce fino a 0.9 ~5h dopo (max ormai in cassa →
 *  la previsione pesa quasi zero, conta il dato osservato reale). */
export function anchorWeightAfterPeak(hoursAfterPeak: number | null): number {
  if (hoursAfterPeak === null || hoursAfterPeak <= 0) return 0;
  return Math.min(0.9, 0.9 * Math.min(1, hoursAfterPeak / 5));
}

/** Restringimento di σ in funzione delle ore DAL PICCO previsto, città-specifico:
 *  - prima del picco: σ piena (il massimo può ancora salire → massima incertezza)
 *  - dopo il picco: collasso da 1.0 a 0.35 in ~4h (superato il picco, niente nuovi massimi attesi)
 *  Così a Londra (picco ~17) σ resta piena fino alle 17, non si stringe per sbaglio alle 15. */
export function sigmaShrinkAfterPeak(hoursAfterPeak: number | null): number {
  if (hoursAfterPeak === null || hoursAfterPeak <= 0) return 1;
  return Math.max(0.35, 1 - 0.65 * Math.min(1, hoursAfterPeak / 4)); // 1.0 → 0.35
}
