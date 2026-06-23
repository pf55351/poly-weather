// Segnale d'acquisto onesto: NON un EV secco (la calibrazione dell'oracolo è troppo
// fragile per fidarsi di edge piccoli), ma un insieme di "gate" che devono valere TUTTI.
// L'idea: accendere il badge solo quando l'oracolo batte il prezzo CON MARGINE, nella
// zona di prezzo dove sia mercato che modello sono affidabili, con fonti concordi,
// liquidità decente e (per i mercati sul massimo giornaliero) a giornata avanzata.
import type { TempUnit } from "./cities";

/** Edge minimo (punti %) per agire: deve superare il rumore di calibrazione (~2–5pt). */
export const STRONG_EDGE_PT = 8;
/** Fascia di prezzo affidabile: fuori da qui le code della normale sono inaffidabili. */
export const ASK_MIN = 0.15;
export const ASK_MAX = 0.7;
/** Numero minimo di fonti meteo concordi. */
export const MIN_SOURCES = 4;
/** Dispersione massima tra le fonti (°C; in °F la soglia scala). */
export const MAX_STDEV_C = 2.5;
/** Volume 24h minimo ($) perché il best ask non sia stantio/largo. */
export const MIN_VOLUME = 500;
/** Quota di giornata locale trascorsa: il massimo si "blocca" nel pomeriggio. */
export const LATE_DAY_FRACTION = 0.6;

export interface BuyCheck {
  label: string;
  ok: boolean;
}

export interface BuySignalResult {
  /** true solo se TUTTI i gate sono soddisfatti */
  buy: boolean;
  /** edge in punti % (q − ask), null se mancano i dati */
  edgePts: number | null;
  checks: BuyCheck[];
}

export interface BuySignalInput {
  /** probabilità dell'oracolo per questo bucket (0..1) */
  q: number | null;
  /** prezzo d'acquisto effettivo di «Yes» (best ask, 0..1) */
  ask: number | null;
  /** numero di fonti meteo che hanno risposto */
  sourceCount: number;
  /** dispersione dell'oracolo nell'unità target */
  stdev: number;
  unit: TempUnit;
  /** volume 24h del bucket ($) */
  volume24hr: number | null;
  /** frazione 0..1 di giornata locale trascorsa, o null se ignota */
  dayFraction: number | null;
}

export function buySignal(i: BuySignalInput): BuySignalResult {
  const edgePts = i.q !== null && i.ask !== null ? (i.q - i.ask) * 100 : null;
  const maxStdev = i.unit === "F" ? MAX_STDEV_C * 1.8 : MAX_STDEV_C;

  const checks: BuyCheck[] = [
    { label: `Edge ≥ ${STRONG_EDGE_PT}pt`, ok: edgePts !== null && edgePts >= STRONG_EDGE_PT },
    {
      label: `Price ${Math.round(ASK_MIN * 100)}–${Math.round(ASK_MAX * 100)}%`,
      ok: i.ask !== null && i.ask >= ASK_MIN && i.ask <= ASK_MAX,
    },
    { label: `≥ ${MIN_SOURCES} sources agree`, ok: i.sourceCount >= MIN_SOURCES && i.stdev <= maxStdev },
    { label: "Liquid market", ok: (i.volume24hr ?? 0) >= MIN_VOLUME },
    {
      label: "Daily high settling",
      ok: i.dayFraction === null || i.dayFraction >= LATE_DAY_FRACTION,
    },
  ];

  return { buy: checks.every((c) => c.ok), edgePts, checks };
}
