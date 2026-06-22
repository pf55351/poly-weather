// Distribuzione di probabilità sulla temperatura massima, modellata come una NORMALE
// calibrata (centro + dispersione disaccoppiati) invece di un istogramma a conteggio.
// Vantaggi: niente picco artificiale dal peso di Wunderground, probabilità lisce e calibrate,
// e possibilità di troncare sul "massimo già osservato oggi" (flooring intraday).
import type { TempUnit } from "../cities";

export interface BucketDef {
  label: string;
  low: number | null; // estremi nell'unità target (°C o °F)
  high: number | null;
}

export interface OracleBucket extends BucketDef {
  probability: number; // 0..1
  count: number; // stime equivalenti (probability * sampleCount), per la UI
}

export interface OracleStats {
  mean: number;
  median: number;
  stdev: number;
  min: number;
  max: number;
}

export interface DistributionResult {
  unit: TempUnit;
  sampleCount: number;
  stats: OracleStats;
  buckets: OracleBucket[];
  /** Bucket con probabilità massima = "temperatura max più probabile" */
  mostLikely: OracleBucket | null;
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

// erf (Abramowitz-Stegun 7.1.26) e CDF normale.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normCdf(x: number, mu: number, sigma: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  if (sigma <= 0) return x >= mu ? 1 : 0;
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

export interface DistributionInput {
  /** centro previsto (media pesata), in °C */
  meanC: number;
  /** dispersione (σ) già inflazionata e con floor, in °C */
  sigmaC: number;
  unit: TempUnit;
  /** numero REALE di stime, per la UI */
  sampleCount: number;
  /** bucket Polymarket (già nell'unità target); se assenti, auto-bin a 1° intorno al centro */
  marketBuckets?: BucketDef[];
  /** massimo già osservato oggi (°C): la distribuzione viene troncata sotto questo valore */
  floorC?: number;
}

/** Bucket interi da 1° intorno al centro (±4σ), per città senza mercato. */
function autoBuckets(meanU: number, sigmaU: number, unit: TempUnit): BucketDef[] {
  const lo = Math.floor(meanU - 4 * sigmaU);
  const hi = Math.ceil(meanU + 4 * sigmaU);
  const defs: BucketDef[] = [];
  for (let t = lo; t <= hi; t++) defs.push({ label: `${t}°${unit}`, low: t, high: t });
  return defs;
}

const EMPTY: DistributionResult = {
  unit: "C",
  sampleCount: 0,
  stats: { mean: NaN, median: NaN, stdev: NaN, min: NaN, max: NaN },
  buckets: [],
  mostLikely: null,
};

export function buildDistribution(input: DistributionInput): DistributionResult {
  const { unit, sampleCount, marketBuckets, floorC } = input;
  if (!Number.isFinite(input.meanC) || sampleCount === 0) return { ...EMPTY, unit };

  const conv = (c: number) => (unit === "F" ? cToF(c) : c);
  const mu = conv(input.meanC);
  const sigma = Math.max(0.3, unit === "F" ? input.sigmaC * 1.8 : input.sigmaC); // °C→°F scala anche σ
  const floor = floorC !== undefined ? conv(floorC) : null;

  const defs =
    marketBuckets && marketBuckets.length > 0 ? marketBuckets : autoBuckets(mu, sigma, unit);

  // Normalizzazione per il troncamento (massa sopra il floor osservato).
  const denom = floor !== null ? Math.max(1e-9, 1 - normCdf(floor, mu, sigma)) : 1;

  const buckets: OracleBucket[] = defs.map((b) => {
    const lower = b.low === null ? -Infinity : b.low;
    // convenzione bucket: copre [low, high+1) (es. "33°C" -> [33,34))
    const upper = b.high === null ? Infinity : b.high + 1;
    let p: number;
    if (floor !== null && upper <= floor) {
      p = 0; // bucket interamente sotto il massimo già osservato
    } else {
      const lo = floor !== null ? Math.max(lower, floor) : lower;
      p = (normCdf(upper, mu, sigma) - normCdf(lo, mu, sigma)) / denom;
    }
    p = Math.min(1, Math.max(0, p));
    return { ...b, probability: p, count: Math.round(p * sampleCount) };
  });

  const mostLikely =
    buckets.length > 0
      ? buckets.reduce((best, b) => (b.probability > best.probability ? b : best), buckets[0])
      : null;

  const effMean = floor !== null ? Math.max(mu, floor) : mu;
  return {
    unit,
    sampleCount,
    stats: { mean: effMean, median: effMean, stdev: sigma, min: mu - 2 * sigma, max: mu + 2 * sigma },
    buckets,
    mostLikely,
  };
}
