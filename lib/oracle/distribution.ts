// Trasforma i "members" (temperature massime previste, °C) in una distribuzione
// di probabilità sui bucket, allineata ai bucket Polymarket quando disponibili.
import type { TempUnit } from "../cities";

export interface BucketDef {
  label: string;
  low: number | null; // estremi nell'unità target (°C o °F)
  high: number | null;
}

export interface OracleBucket extends BucketDef {
  probability: number; // 0..1
  count: number;
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

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function inBucket(v: number, b: BucketDef): boolean {
  const lowOk = b.low === null || v >= b.low;
  // Estremo superiore inclusivo (i bucket Polymarket "30-31" includono fino a ~31.9 prima del successivo);
  // per bucket contigui usiamo [low, high+1) sul singolo grado.
  const upper = b.high === null ? Infinity : b.high + 0.999;
  const highOk = v <= upper;
  return lowOk && highOk;
}

/** Crea bucket interi da 1° coprendo il range osservato, per città senza mercato. */
function autoBuckets(values: number[], unit: TempUnit): BucketDef[] {
  const lo = Math.floor(Math.min(...values));
  const hi = Math.floor(Math.max(...values));
  const defs: BucketDef[] = [];
  for (let t = lo; t <= hi; t++) {
    defs.push({ label: `${t}°${unit}`, low: t, high: t });
  }
  return defs;
}

/**
 * @param membersC  temperature massime previste in °C (da tutte le fonti)
 * @param unit      unità target (allineata a Polymarket)
 * @param marketBuckets bucket Polymarket (già nell'unità target); se assenti, auto-bin a 1°
 */
export function buildDistribution(
  membersC: number[],
  unit: TempUnit,
  marketBuckets?: BucketDef[],
): DistributionResult {
  const values = membersC.map((c) => (unit === "F" ? cToF(c) : c));
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;

  const mean = n ? values.reduce((s, v) => s + v, 0) / n : NaN;
  const variance = n ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / n : NaN;
  const stats: OracleStats = {
    mean,
    median: quantile(sorted, 0.5),
    stdev: Math.sqrt(variance),
    min: sorted[0] ?? NaN,
    max: sorted[n - 1] ?? NaN,
  };

  const defs =
    marketBuckets && marketBuckets.length > 0 ? marketBuckets : autoBuckets(values, unit);

  const buckets: OracleBucket[] = defs.map((b) => {
    const count = values.filter((v) => inBucket(v, b)).length;
    return { ...b, count, probability: n ? count / n : 0 };
  });

  const mostLikely =
    buckets.length > 0
      ? buckets.reduce((best, b) => (b.probability > best.probability ? b : best), buckets[0])
      : null;

  return { unit, sampleCount: n, stats, buckets, mostLikely };
}
