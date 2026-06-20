import type { TempUnit } from "./cities";

export function pct(p: number | null | undefined, digits = 0): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

export function temp(v: number | null | undefined, unit: TempUnit, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}°${unit}`;
}

export function compactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function usd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `$${compactNumber(n)}`;
}

/** edge = P_oracolo - P_mercato, in punti percentuali */
export function edgePoints(oracle: number, market: number): number {
  return (oracle - market) * 100;
}

/** Soglia (in punti %) entro cui oracolo e mercato si considerano "allineati". */
export const ALIGN_THRESHOLD_PT = 2;

/** True se oracolo e mercato combaciano (edge trascurabile). */
export function isAligned(edgePts: number): boolean {
  return Math.abs(edgePts) <= ALIGN_THRESHOLD_PT;
}

export function signedPoints(p: number, digits = 0): string {
  const s = p >= 0 ? "+" : "";
  return `${s}${p.toFixed(digits)}pt`;
}
